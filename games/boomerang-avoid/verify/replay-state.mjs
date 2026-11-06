/** Raw replay comparison for hash half-rounding boundaries; discrete fields remain exact. */
export function compareReplayStates(a,b){
 let maxDelta=0,maxPath='';const mismatches=[];
 const exactFields=new Set(['tick','round','score','kills','nextId','roundStart','phaseUntil','dashUntil','dashCooldown','slashUntil','slashStart','slashCooldown','throwAt','stunUntil','shieldGraceUntil','respawnAt','protectedUntil','spawnTick','phaseTick','ricochets','generation','endTick','progress','lockUntil','previousLockUntil','next','nextAttack']);
 function walk(x,y,path){
  if(typeof x==='number'&&typeof y==='number'){
   const delta=Math.abs(x-y);if(delta>maxDelta){maxDelta=delta;maxPath=path;}
   const exact=exactFields.has(path.split('.').at(-1))||path.includes('.relay.scores.');
   if(!Number.isFinite(x)||!Number.isFinite(y)||(exact?x!==y:delta>1e-10))mismatches.push(path);return;
  }
  if(x&&y&&typeof x==='object'&&typeof y==='object'){
   if(Array.isArray(x)!==Array.isArray(y)||(Array.isArray(x)&&x.length!==y.length)){mismatches.push(path);return;}
   const keys=v=>Object.keys(v).filter(k=>v[k]!==undefined).sort();
   const kx=keys(x),ky=keys(y);if(JSON.stringify(kx)!==JSON.stringify(ky)){mismatches.push(path);return;}
   for(const k of kx)walk(x[k],y[k],path+'.'+k);return;
  }
  if(x!==y)mismatches.push(path);
 }
 walk(a,b,'state');return {equivalent:mismatches.length===0,maxDelta,maxPath,mismatches};
}
