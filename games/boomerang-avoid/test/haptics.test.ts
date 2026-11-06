import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTERS,createMatch,type GameEvent} from '@avoid/boomerangavoid-sim';
import {ControllerFeedback,type RumbleActuator,type RumblePad,type RumbleParams} from '../src/haptics';
const seats=[{id:'p0',control:'pad0'},{id:'p1',control:'pad1'}];
function fixture(){
 const state=createMatch({mode:'ffa',mapId:'moss-court',wins:3,seed:1,upgrades:false,friendlyFire:false},CHARACTERS.slice(0,2).map((c,i)=>({id:`p${i}`,name:c.name,color:c.color,character:c.id,team:i,bot:null})));state.phase='playing';state.tick=200;
 const effects:{index:number;type:string;params:RumbleParams}[]=[],resets:number[]=[];
 const make=(index:number):RumblePad=>({index,id:`fixture${index}`,connected:true,vibrationActuator:{effects:['dual-rumble'],playEffect(type,params){effects.push({index,type,params});return Promise.resolve('complete');},reset(){resets.push(index);return Promise.resolve('complete');}}});
 let pads:RumblePad[]=[make(0),make(1)];const feedback=new ControllerFeedback(()=>pads);
 const event=(id:string,type:string,actor='p0',target?:string):GameEvent=>({id,type,actor,target,tick:state.tick,x:0,y:0});
 return{state,effects,resets,feedback,event,setPads:(next:RumblePad[])=>{pads=next;},make};
}
test('feedback routes only local gamepad seats, deduplicates snapshots and ignores stale or future events',()=>{
 const f=fixture();const event=f.event('a','dash');f.feedback.update(f.state,[event],seats,1000,true);assert.equal(f.effects.length,1);
 f.feedback.update(f.state,[event,f.event('foreign','dash','remote'),{...f.event('old','throw'),tick:100},{...f.event('future','slash'),tick:201}],seats,1200,true);assert.equal(f.effects.length,1);
 f.feedback.update(f.state,[f.event('key','dash')],[{id:'p0',control:'keyboard1'}],1400,true);assert.equal(f.effects.length,1);
});
test('victim and attacker receive distinct bounded effects with highest-priority coalescing',()=>{
 const f=fixture();f.feedback.update(f.state,[f.event('dash','dash'),f.event('pop','death','p1','p0'),f.event('slash','slash')],seats,1000,true);
 assert.equal(f.effects.length,2);assert.equal(f.effects.find(e=>e.index===0)!.params.strongMagnitude,.65);assert.equal(f.effects.find(e=>e.index===1)!.params.strongMagnitude,.22);
 for(const {type,params} of f.effects){assert.equal(type,'dual-rumble');assert.ok(params.duration<=150&&params.duration>0);assert.equal(params.startDelay,0);assert.ok(params.strongMagnitude>=0&&params.strongMagnitude<=1);assert.ok(params.weakMagnitude>=0&&params.weakMagnitude<=1);}
});
test('disabled or paused feedback stops immediately and consumes IDs without delayed replay',()=>{
 const f=fixture();f.feedback.update(f.state,[f.event('a','dash')],seats,1000,true);f.feedback.update(f.state,[f.event('b','catch')],seats,1010,false);assert.deepEqual(f.resets,[0]);
 f.feedback.update(f.state,[f.event('b','catch')],seats,1100,true);assert.equal(f.effects.length,1);
 f.state.phase='matchResults';f.feedback.update(f.state,[f.event('c','death','p1','p0')],seats,1200,true);assert.equal(f.effects.length,1);
});
test('unplug and replacement reset the previous actuator without inheriting queued feedback',()=>{
 const f=fixture();f.feedback.update(f.state,[f.event('a','dash')],seats,1000,true);f.setPads([]);f.feedback.update(f.state,[],seats,1010,true);assert.deepEqual(f.resets,[0]);
 f.setPads([{...f.make(0),id:'replacement'}]);f.feedback.update(f.state,[f.event('a','dash')],seats,1100,true);assert.equal(f.effects.length,1);f.feedback.update(f.state,[f.event('b','throw')],seats,1200,true);assert.equal(f.effects.length,2);
});
test('unsupported, throwing and rejected actuator APIs cannot interrupt gameplay or loop retries',async()=>{
 const f=fixture();let attempts=0;const actuator:RumbleActuator={playEffect(){attempts++;return Promise.reject(Error('unsupported'));}};f.setPads([{index:0,id:'rejecting',vibrationActuator:actuator}]);f.feedback.update(f.state,[f.event('a','dash')],seats,1000,true);await Promise.resolve();
 assert.equal(f.feedback.metrics.failures,1);f.feedback.update(f.state,[f.event('b','throw')],seats,1200,true);assert.equal(attempts,1);
 f.setPads([{index:0,id:'throwing',vibrationActuator:{playEffect(){throw Error('inactive document');}}}]);assert.doesNotThrow(()=>f.feedback.update(f.state,[f.event('c','slash')],seats,1400,true));
 f.setPads([{index:0,id:'absent'},{index:1,id:'wrong effects',vibrationActuator:{effects:['trigger-rumble'],playEffect(){throw Error('must not call');}}}]);assert.doesNotThrow(()=>f.feedback.update(f.state,[f.event('d','dash','p1')],seats,1600,true));
 const denied=new ControllerFeedback(()=>{throw Error('Gamepad permission unavailable');});assert.doesNotThrow(()=>denied.update(f.state,[f.event('e','dash')],seats,1800,true));
});
test('rapid low-priority cues coalesce while a damage cue can preempt them',()=>{
 const f=fixture();f.feedback.update(f.state,[f.event('a','dash')],seats,1000,true);f.feedback.update(f.state,[f.event('b','slash')],seats,1010,true);assert.equal(f.effects.length,1);
 f.feedback.update(f.state,[f.event('c','death','p1','p0')],[seats[0]],1020,true);assert.equal(f.effects.length,2);assert.equal(f.effects[1].params.strongMagnitude,.65);
});
