import * as THREE from "three";
import { loadCharacter } from "./character-library";
import { CHARACTERS, type CharacterId } from "@avoid/boomerangavoid-sim";
export function assetStudio(root: HTMLElement) {
  root.innerHTML = `<h2>Cast & motion</h2><p>Inspect the actual exported characters and clips before promoting an asset.</p><label>Character<select id="ads-character">${CHARACTERS.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}</select></label><label>Animation<select id="ads-clip"><option>idle</option></select></label><canvas id="ads-character-view" style="width:100%;height:320px;border-radius:16px;margin-top:12px" aria-label="Animated character turntable"></canvas><p id="ads-asset-status" role="status">Loading character…</p>`;
  const canvas = root.querySelector<HTMLCanvasElement>("canvas")!,
    status = root.querySelector<HTMLElement>("#ads-asset-status")!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(Math.max(240, root.clientWidth), 320, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x27433f);
  scene.add(new THREE.HemisphereLight(0xfff3d4, 0x739c88, 3));
  const light = new THREE.DirectionalLight(0xffe6c0, 3);
  light.position.set(-2, 4, 3);
  scene.add(light);
  const camera = new THREE.PerspectiveCamera(
    35,
    canvas.width / canvas.height,
    0.1,
    20,
  );
  camera.position.set(2, 1.6, 3.5);
  camera.lookAt(0, 0.8, 0);
  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.85, 0.15, 40),
    new THREE.MeshStandardMaterial({ color: 0x6a8770, roughness: 0.8 }),
  );
  stand.position.y = -0.1;
  scene.add(stand);
  let model: THREE.Object3D | null = null,
    mixer: THREE.AnimationMixer | null = null,
    actions: Record<string, THREE.AnimationAction> = {},
    current: THREE.AnimationAction | null = null,
    alive = true,
    generation = 0,
    frame = 0,
    last = performance.now();
  const release = (object: THREE.Object3D) =>
    object.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          m.dispose(),
        );
      }
    });
  async function select() {
    const mine = ++generation;
    try {
      const loaded = await loadCharacter(
        root.querySelector<HTMLSelectElement>("#ads-character")!
          .value as CharacterId,
      );
      if (!alive || mine !== generation) {
        release(loaded.model);
        return;
      }
      if (model) {
        scene.remove(model);
        release(model);
      }
      mixer?.stopAllAction();
      model = loaded.model;
      scene.add(model);
      mixer = new THREE.AnimationMixer(model);
      actions = Object.fromEntries(
        loaded.clips.map((c) => [c.name, mixer!.clipAction(c)]),
      );
      current = actions.idle;
      current?.play();
      root.querySelector<HTMLSelectElement>("#ads-clip")!.innerHTML =
        loaded.clips.map((c) => `<option>${c.name}</option>`).join("");
      status.textContent = `${loaded.clips.length} clips · original Blender source · 360° turntable`;
    } catch {
      if (alive)
        status.textContent =
          "Character could not load. Return to the map and retry.";
    }
  }
  root.querySelector<HTMLSelectElement>("#ads-character")!.onchange = () =>
    void select();
  root.querySelector<HTMLSelectElement>("#ads-clip")!.onchange = (e) => {
    current?.stop();
    current = actions[(e.target as HTMLSelectElement).value];
    current?.reset().play();
  };
  function dispose() {
    alive = false;
    generation++;
    cancelAnimationFrame(frame);
    mixer?.stopAllAction();
    release(scene);
    renderer.dispose();
    renderer.forceContextLoss();
  }
  function draw(now: number) {
    if (!alive) return;
    if (!canvas.isConnected) {
      dispose();
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (model) model.rotation.y += dt * 0.25;
    mixer?.update(dt);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);
  void select();
  return dispose;
}
