import { parseDraft, type StudioDraft } from "./studio-contract";
export type ReportStatus="open"|"fixed"|"archived";
export interface StudioReport {schema:"boomerangavoid-report";version:1;id:string;at:string;status:ReportStatus;note:string;fixNote:string;selected:string|null;mapSnapshot:string|null;draft:StudioDraft}
const statuses:ReportStatus[]=["open","fixed","archived"];
const validSnapshot=(value:unknown):value is string|null=>value===null||(typeof value==="string"&&value.length<=180000&&/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value));
export function makeReport(draft:StudioDraft,note:string,selected:string|null,mapSnapshot:string|null=null):StudioReport{
  if(!note.trim())throw Error("Describe what needs attention before capturing a report.");
  if(!validSnapshot(mapSnapshot))throw Error("Map capture is invalid or too large.");
  return {schema:"boomerangavoid-report",version:1,id:crypto.randomUUID(),at:new Date().toISOString(),status:"open",note:note.trim().slice(0,1000),fixNote:"",selected:selected?.slice(0,40)||null,mapSnapshot,draft:parseDraft(draft)};
}
export function readReports(value:unknown):StudioReport[]{
  if(!Array.isArray(value))return[];
  const result:StudioReport[]=[];
  for(const item of value.slice(-20))try{
    if(!item||item.schema!=="boomerangavoid-report"||item.version!==1||typeof item.id!=="string"||item.id.length>80||!statuses.includes(item.status)||typeof item.note!=="string"||item.note.length>1000||typeof item.fixNote!=="string"||item.fixNote.length>1000||typeof item.at!=="string"||!Number.isFinite(Date.parse(item.at)))continue;
    if(!validSnapshot(item.mapSnapshot))continue;
    result.push({schema:"boomerangavoid-report",version:1,id:item.id,at:item.at,status:item.status,note:item.note,fixNote:item.fixNote,mapSnapshot:item.mapSnapshot,selected:typeof item.selected==="string"?item.selected.slice(0,40):null,draft:parseDraft(item.draft)});
  }catch{/* Corrupt or stale reports do not prevent opening the workshop. */}
  return result;
}
export function setReportStatus(reports:StudioReport[],id:string,status:ReportStatus,fixNote=""):StudioReport[]{
  if(!statuses.includes(status))throw Error("Unknown report status");
  return reports.map(report=>report.id===id?{...report,status,fixNote:fixNote.slice(0,1000)}:report);
}
/** Captures the measured map, not the unrelated attract scene behind the studio. */
export async function captureMap(svg:SVGSVGElement):Promise<string>{
  const source=new XMLSerializer().serializeToString(svg),url=URL.createObjectURL(new Blob([source],{type:"image/svg+xml"}));
  try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement("canvas");canvas.width=640;canvas.height=Math.max(1,Math.round(640*svg.viewBox.baseVal.height/svg.viewBox.baseVal.width));const context=canvas.getContext("2d")!;context.fillStyle="#24474a";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL("image/png");}finally{URL.revokeObjectURL(url);}
}
