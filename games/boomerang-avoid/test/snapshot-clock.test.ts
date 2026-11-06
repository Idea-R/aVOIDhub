import test from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotClock } from '../src/snapshot-clock.ts';
test('arbitrary server/browser clock offset and ordinary network jitter stay fresh',()=>{
 const c=new SnapshotClock(10);assert.ok(c.accept(1_000_000,10));assert.ok(c.accept(1_000_050,180));assert.equal(c.age(200),20);assert.equal(c.stale(200),false);
});
test('ongoing stale callbacks cannot reset the freshness watchdog',()=>{
 const c=new SnapshotClock(0);assert.ok(c.accept(1_000_000,0));assert.equal(c.accept(1_001_000,5000),false);assert.equal(c.accept(1_001_050,5050),false);assert.equal(c.age(5050),5050);assert.ok(c.stale(5050));
});
test('fresh authority after a stall restores freshness without a new clock anchor',()=>{
 const c=new SnapshotClock(0);assert.ok(c.accept(1_000_000,0));assert.ok(c.stale(2000));assert.ok(c.accept(1_005_000,5010));assert.equal(c.stale(5010),false);
});
test('a faster arrival tightens calibration and rejects a later old snapshot',()=>{
 const c=new SnapshotClock(0);assert.ok(c.accept(10000,500));assert.ok(c.accept(11000,1010));assert.equal(c.accept(11050,4000),false);
});
test('invalid timestamps never arm or refresh authority',()=>{
 const c=new SnapshotClock(0);assert.equal(c.accept(NaN,1000),false);assert.equal(c.accept(1000,Infinity),false);assert.ok(c.stale(2000));
});
test('age is monotonic-clock based and the exact threshold remains valid',()=>{
 const c=new SnapshotClock(10);assert.equal(c.stale(1510),false);assert.equal(c.stale(1511),true);assert.equal(c.age(0),0);
});
