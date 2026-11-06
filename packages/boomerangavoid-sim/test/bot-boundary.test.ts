import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ARENAS,CHARACTERS,RULES,createMatch,getBotInputs,restartMatch,stateHash,step,type Difficulty,type MatchState} from '../src/index.js';

function edge(wall:number,difficulty:Difficulty,threat=false){
 const arena=structuredClone(ARENAS[0]!);arena.obstacles=[];arena.hazards=[];
 const s=createMatch({mode:'ffa',wins:3,mapId:arena.id,arenaDraft:arena,seed:41827,friendlyFire:false,upgrades:false},[2,5].map((i,n)=>({id:`studio-${i}`,name:`Bot ${i}`,character:CHARACTERS[i]!.id,color:CHARACTERS[i]!.color,team:n,bot:difficulty})));
 s.phase='playing';s.tick=s.roundStart=200;
 const x=arena.width/2-RULES.playerRadius,y=arena.height/2-RULES.playerRadius;
 const points=[[x,-2,x,2],[-x,2,-x,-2],[-2,y,2,y],[2,-y,-2,-y]][wall]!;
 Object.assign(s.players[0]!,{x:points[0],y:points[1]});Object.assign(s.players[1]!,{x:points[2],y:points[3]});
 if(threat){const p=s.players[0]!,w=s.weapons[1]!;Object.assign(w,{phase:'outbound',phaseTick:1,x:p.x+(wall<2?0:2.5),y:p.y+(wall<2?2.5:0),vx:wall<2?0:-13,vy:wall<2?-13:0});}
 return s;
}
function observe(s:MatchState){for(let n=0;n<50;n++){s.tick++;getBotInputs(s);}return getBotInputs(s);}
function outward(s:MatchState,p:MatchState['players'][number],c:{mx:number;my:number}){
 const a=s.config.arenaDraft!,x=a.width/2-RULES.playerRadius,y=a.height/2-RULES.playerRadius;
 return (Math.abs(p.x)>=x-1e-8&&p.x*c.mx>1e-8)||(Math.abs(p.y)>=y-1e-8&&p.y*c.my>1e-8);
}
test('walking bots use an inward or tangent route at every arena edge',()=>{
 for(const difficulty of ['easy','normal','hard'] as const)for(let wall=0;wall<4;wall++){
  const s=edge(wall,difficulty),commands=observe(s);
  for(const p of s.players){const c=commands[p.id]!;assert.equal(outward(s,p,c),false,`${difficulty}/wall${wall}/${p.id}`);assert.ok(Math.hypot(c.mx,c.my)>0,'Open inward space must offer a route');}
 }
});
test('defensive dashes never choose a landing outside the arena footprint',()=>{
 for(const difficulty of ['normal','hard'] as const)for(let wall=0;wall<4;wall++){
  const s=edge(wall,difficulty,true),commands=observe(s),a=s.config.arenaDraft!;
  for(const p of s.players){const c=commands[p.id]!;assert.equal(outward(s,p,c),false);if(c.dash){const scale=RULES.dashSpeed*RULES.dashTicks/RULES.tickRate/Math.max(1,Math.hypot(c.mx,c.my));assert.ok(Math.abs(p.x+c.mx*scale)<=a.width/2-RULES.playerRadius);assert.ok(Math.abs(p.y+c.my*scale)<=a.height/2-RULES.playerRadius);}}
 }
});
test('retained two-Hard match and rematch finish naturally without sustained outward wall commands',()=>{
 const f=JSON.parse(fs.readFileSync(new URL('../../../docs/boomerangavoid/evidence/ads-powers/two-hard-fixture-walltime.json',import.meta.url),'utf8')).expected.first;
 let s=createMatch(f.config,f.seats);
 const run=()=>{let pushes=0;while(s.phase!=='matchResults'&&s.tick<36000){const c=getBotInputs(s);if(s.phase==='playing')for(const p of s.players.filter(p=>p.alive&&p.bot&&p.dashUntil<=s.tick+1))pushes+=Number(outward(s,p,c[p.id]!));step(s,c);}assert.equal(s.phase,'matchResults');assert.equal(pushes,0);assert.equal(Math.max(...s.players.map(p=>p.score)),5);return {tick:s.tick,hash:stateHash(s),scores:s.players.map(p=>p.score),winners:s.matchWinnerIds};};
 const first=run();s=restartMatch(s);assert.deepEqual(run(),first);
});
