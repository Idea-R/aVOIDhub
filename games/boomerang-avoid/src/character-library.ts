import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { CharacterId } from "@avoid/boomerangavoid-sim";

const loader = new GLTFLoader();
type Entry={promise:Promise<GLTF>;controller:AbortController;ready:boolean};
const library = new Map<CharacterId, Entry>();
function template(id:CharacterId) {
  let entry = library.get(id);
  if (!entry) {
    const controller=new AbortController();
    const url=`${import.meta.env.BASE_URL}models/gamefeel/${id}.glb`;
    const pending=fetch(url,{signal:controller.signal}).then(async response=>{
      if(!response.ok)throw Error(`Character asset unavailable (${response.status})`);
      // Our self-contained GLBs have no external textures or buffers.
      return loader.parseAsync(await response.arrayBuffer(),new URL(url,location.href).href);
    });
    entry={promise:pending,controller,ready:false};
    library.set(id, entry);
    const current=entry;
    void pending.then(()=>{current.ready=true;},()=>{if(library.get(id)===current)library.delete(id);});
  }
  return entry;
}
export const isCharacterReady=(id:CharacterId)=>library.get(id)?.ready===true;
export async function preloadCharacters(ids:CharacterId[],signal:AbortSignal):Promise<void>{
  if(signal.aborted)throw new DOMException("Preparation cancelled","AbortError");
  const entries=[...new Set(ids)].map(id=>({id,entry:template(id)}));
  const work=Promise.all(entries.map(({entry})=>entry.promise));
  await new Promise<void>((resolve,reject)=>{
    const aborted=()=>{
      cleanup();
      for(const {id,entry} of entries)if(!entry.ready&&library.get(id)===entry){library.delete(id);entry.controller.abort();}
      reject(new DOMException("Preparation cancelled","AbortError"));
    };
    const cleanup=()=>signal.removeEventListener("abort",aborted);
    signal.addEventListener("abort",aborted,{once:true});
    void work.then(()=>{cleanup();signal.aborted?aborted():resolve();},error=>{cleanup();reject(error);});
  });
}
export async function loadCharacter(id: CharacterId) {
  const gltf = await template(id).promise;
  const model = clone(gltf.scene);
  // Each actor owns its disposable resources; disposing one seat never invalidates another.
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry = object.geometry.clone();
    object.material = Array.isArray(object.material)
      ? object.material.map((m) => m.clone())
      : object.material.clone();
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = false; // Animated bounds must not cull a bent pose.
  });
  return { model, clips: gltf.animations };
}
