import { copy, type StudioDraft } from "./studio-contract";

/** Dragging is in measured world coordinates, coalesced into one undo step by the UI. */
export function moveStudioObject(draft: StudioDraft, id: string, dx: number, dy: number, grid = .25): StudioDraft {
  if (![dx,dy,grid].every(Number.isFinite) || grid <= 0) throw Error("Invalid drag coordinates");
  const next=copy(draft),a=next.arena;
  const object=[...a.obstacles,...a.hazards,...(a.platforms||[]),...(a.switches||[])].find(o=>o.id===id);
  if(!object)throw Error("Choose an arena object");
  const points="to" in object?[object,object.to]:[object];
  const limit=(delta:number,axis:"x"|"y",size:number,extent:number)=>{
    const snapped=Math.round(delta/grid)*grid;
    // The import boundary requires every center (including platform endpoints)
    // to stay 0.5 units inside the arena as well as containing the full shape.
    const inset=Math.max(.5,size/2);
    const min=Math.max(...points.map(p=>-extent/2+inset-p[axis]));
    const max=Math.min(...points.map(p=> extent/2-inset-p[axis]));
    return Math.max(min,Math.min(max,snapped));
  };
  const x=limit(dx,"x",object.w,a.width),y=limit(dy,"y",object.h,a.height);
  object.x+=x;object.y+=y;
  if("to" in object){object.to.x+=x;object.to.y+=y;}
  return next;
}
