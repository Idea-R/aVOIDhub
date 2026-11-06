import {test} from "node:test";
import assert from "node:assert/strict";
import {newDraft,parseDraft} from "../src/studio-contract";
import {moveStudioObject} from "../src/studio-edit";
import {makeReport,readReports,setReportStatus} from "../src/studio-reports";
test("world-space object dragging snaps, preserves source and clamps geometry",()=>{
  const d=newDraft("moss-court"),id=d.arena.obstacles[0].id,before=structuredClone(d);
  const n=moveStudioObject(d,id,.66,-.36);assert.equal(n.arena.obstacles[0].x-d.arena.obstacles[0].x,.75);assert.equal(n.arena.obstacles[0].y-d.arena.obstacles[0].y,-.25);assert.deepEqual(d,before);
  const edge=moveStudioObject(d,id,100,100).arena.obstacles[0];assert.ok(edge.x+edge.w/2<=d.arena.width/2);assert.ok(edge.y+edge.h/2<=d.arena.height/2);assert.throws(()=>moveStudioObject(d,id,NaN,1));
});
test("dragging a moving floor translates its entire path and keeps both ends bounded",()=>{
  const d=newDraft(),p=d.arena.platforms![0],n=moveStudioObject(d,p.id,1.2,.6),q=n.arena.platforms![0];
  assert.equal(q.x-p.x,q.to.x-p.to.x);assert.equal(q.y-p.y,q.to.y-p.to.y);assert.doesNotThrow(()=>parseDraft(n));
  const e=moveStudioObject(d,p.id,100,100).arena.platforms![0];assert.ok(e.to.y+e.h/2<=d.arena.height/2);
});
test("narrow shapes dragged to every wall survive detached export and reimport",()=>{
  const draft=newDraft("lantern-foundry"),before=structuredClone(draft);
  for(const [dx,dy] of [[100,0],[-100,0],[0,100],[0,-100]]){
    const moved=moveStudioObject(draft,"shutter-west",dx!,dy!);
    const reparsed=parseDraft(JSON.parse(JSON.stringify(moved)));
    assert.deepEqual(reparsed,moved);
    const shutter=reparsed.arena.hazards.find(h=>h.id==="shutter-west")!;
    assert.ok(Math.abs(shutter.x)<=draft.arena.width/2-.5);
    assert.ok(Math.abs(shutter.y)<=draft.arena.height/2-.5);
  }
  assert.deepEqual(draft,before);
});
test("narrow moving floors keep their whole path inside the importer center margin",()=>{
  const draft=newDraft();
  const platform=draft.arena.platforms![0]!;
  platform.w=platform.h=.25;
  for(const [dx,dy] of [[100,100],[-100,-100]]){
    const moved=moveStudioObject(draft,platform.id,dx!,dy!);
    const reparsed=parseDraft(JSON.parse(JSON.stringify(moved)));
    const p=reparsed.arena.platforms![0]!;
    assert.equal(p.to.x-p.x,platform.to.x-platform.x);
    assert.equal(p.to.y-p.y,platform.to.y-platform.y);
    for(const point of [p,p.to]){
      assert.ok(Math.abs(point.x)<=draft.arena.width/2-.5);
      assert.ok(Math.abs(point.y)<=draft.arena.height/2-.5);
    }
  }
});
test("reports retain immutable seed/rules/crew and explicit review status",()=>{
  const d=newDraft(),r=makeReport(d,"Platform route needs a safer landing",d.arena.platforms![0].id);d.match.seed=1;assert.equal(r.draft.match.seed,1337);
  const fixed=setReportStatus([r],r.id,"fixed","Moved the end point and tested a round");assert.equal(r.status,"open");assert.equal(fixed[0].status,"fixed");assert.equal(readReports(fixed)[0].fixNote,fixed[0].fixNote);
  assert.equal(readReports([{...r,mapSnapshot:"https://untrusted.example/track"}]).length,0);assert.equal(readReports({}).length,0);assert.throws(()=>makeReport(d," ",null));
  assert.equal(readReports([{...r,mapSnapshot:'data:image/png;base64,abc" onerror="bad'}]).length,0);
  assert.equal("unknown" in readReports([{...r,unknown:"discard"}])[0],false);
});
