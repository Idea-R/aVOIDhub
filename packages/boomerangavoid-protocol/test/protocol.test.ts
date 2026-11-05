import { test } from 'node:test';import assert from 'node:assert/strict';
import { parseInput, InputBuffer } from '../src/index';import { mintTicket, TicketVerifier } from '../src/tickets';
const cmd={seatId:'p1',sequence:1,tick:100,round:1,mx:1,my:1,ax:0,ay:0,dash:true,slash:false,throw:false};
test('rejects malformed/fabricated inputs and normalizes diagonal',()=>{assert.ok(Math.abs(Math.hypot(parseInput(cmd)!.mx,parseInput(cmd)!.my)-1)<1e-10);for(const bad of [null,[],{...cmd,mx:NaN},{...cmd,mx:Infinity},{...cmd,mx:2},{...cmd,score:999},{...cmd,dash:1},{...cmd,sequence:1.5}])assert.equal(parseInput(bad),null);});
test('ownership, monotonic sequence and tick/round limits',()=>{const b=new InputBuffer();assert.equal(b.enqueue(cmd,['other'],100,1),false);assert.equal(b.enqueue(cmd,['p1'],100,2),false);assert.equal(b.enqueue({...cmd,tick:107},['p1'],100,1),false);assert.equal(b.enqueue({...cmd,tick:84},['p1'],100,1),false);assert.equal(b.enqueue(cmd,['p1'],100,1),true);assert.equal(b.enqueue(cmd,['p1'],100,1),false);assert.equal(b.consume('p1',100).dash,true);assert.equal(b.consume('p1',101).dash,true);assert.equal(b.consume('p1',110).mx,0);});
test('future queue cannot accelerate movement or attacks and is bounded',()=>{const b=new InputBuffer();for(let i=1;i<=12;i++)assert.equal(b.enqueue({...cmd,sequence:i,tick:101},['p1'],100,1),true);assert.equal(b.enqueue({...cmd,sequence:13},['p1'],100,1),false);assert.equal(b.consume('p1',100).dash,false);b.consume('p1',101);assert.equal(b.acknowledgements().p1,1);});
test('ticket is signed, audience/room/expiry bounded and single-use',()=>{const secret='test-only-not-a-deployment-secret-123456';const now=100000;const token=mintTicket({userId:'test-user',name:'Pip',room:'create',audience:'bav',seats:2},secret,now);const v=new TicketVerifier(secret,'bav');assert.equal(v.verify(token,'wrong',now),null);assert.equal(v.verify(token+'x','create',now),null);assert.equal(v.verify(token,'create',now)!.seats,2);assert.equal(v.verify(token,'create',now),null);assert.equal(new TicketVerifier(secret,'wrong').verify(token,'create',now),null);assert.equal(new TicketVerifier(secret,'bav').verify(token,'create',now+60000),null);});


test('a held action sent at 30Hz stays held between server ticks instead of repeating edges',()=>{
 const b=new InputBuffer();let edges=0,previous=false;
 for(let tick=100;tick<220;tick++){if(tick%2===0)b.enqueue({...cmd,tick,sequence:tick,dash:false,throw:true},['p1'],tick,1);const input=b.consume('p1',tick);if(input.throw&&!previous)edges++;previous=input.throw;}
 assert.equal(edges,1,'An empty network tick must not synthesize button release');assert.equal(b.consume('p1',230).throw,false);
});

test('creation preflight verifies authority without consuming the join nonce',()=>{const secret='test-only-fixture-secret-never-use-in-deployment',now=100000;const token=mintTicket({userId:'u',name:'Pip',room:'create',audience:'bav',seats:1},secret,now);const v=new TicketVerifier(secret,'bav');assert.ok(v.verify(token,'create',now,false));assert.ok(v.verify(token,'create',now,false));assert.ok(v.verify(token,'create',now));assert.equal(v.verify(token,'create',now,false),null);});
