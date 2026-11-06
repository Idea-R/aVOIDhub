import {test} from "node:test";
import assert from "node:assert/strict";
import {UPGRADES} from "@avoid/boomerangavoid-sim";
import {parseDraft} from "../src/studio-contract";
import {powerDraft,replayPowerDraft} from "../verify/ads-power-fixtures";

for(const [kind,count,wins] of [["legacy",4,3],["on",6,5],["off",2,3],["empty",4,7]] as const) {
  test(`${kind} power settings, ${count} seats and first-to-${wins} survive a natural match and rematch`,()=>{
    const draft=parseDraft(JSON.parse(JSON.stringify(powerDraft(kind,count,wins))));
    const result=replayPowerDraft(draft);
    assert.deepEqual(result.first,result.rematch);
    assert.equal(Math.max(...result.first.scores),wins);
    assert.equal(result.first.seats.length,count);
    assert.deepEqual(result.first.seats,draft.seats.map(({control,...seat})=>seat));
    assert.deepEqual(result.first.config,{...draft.match,arenaDraft:draft.arena});
    assert.deepEqual(result.cleanRestart,{tick:0,round:1,scores:Array(count).fill(0),pickups:0,upgrades:Array(count).fill(0),shields:Array(count).fill(false)});
    const drops=result.first.drops.map(d=>d.upgrade);
    if(kind==="off"||kind==="empty")assert.deepEqual(drops,[]);
    else {
      assert.ok(drops.length>0,"A natural match must exercise actual pickup spawning");
      const allowed=new Set<string>(kind==="legacy"?UPGRADES.map(u=>u.id):draft.match.enabledUpgrades!);
      assert.ok(drops.every(id=>allowed.has(id)));
      if(kind==="legacy") {
        assert.equal(draft.match.enabledUpgrades,undefined);
        assert.ok(new Set(drops).size>1,"Omitted pool really allows multiple registered powers");
      }else assert.deepEqual([...new Set(drops)],["tailwind"]);
    }
  });
}
