import { ARENAS, UPGRADES, CONTENT_VERSION, RULESET, RULES, NEUTRAL, type Input, type MatchConfig, type MatchState, type Seat } from '@avoid/boomerangavoid-sim';
export const PROTOCOL = 'bav-1';
export const MAX_SEATS = 6;
export const MAX_PACKET_BYTES = 8192;
export const CONTENT_HASH = hash(JSON.stringify({arenas:ARENAS,content:CONTENT_VERSION,rules:RULESET,tuning:RULES}));
export function hash(value:string):string { let h=2166136261; for(let i=0;i<value.length;i++) h=Math.imul(h^value.charCodeAt(i),16777619); return (h>>>0).toString(16).padStart(8,'0'); }
export interface InputCommand extends Input { seatId:string; sequence:number; tick:number; round:number }
export interface PartySeat extends Seat { connectionId:string; ready:boolean; connected:boolean; spectator:boolean }
export interface Snapshot { protocol:string; contentHash:string; roomId:string; ownerId:string; region:string; public:boolean;
 stage:'lobby'|'loading'|'match'; resultPersistence?:'session'|'pending'|'saved'|'unavailable'; message:string; seats:PartySeat[]; config:MatchConfig; state:MatchState|null; ack:Record<string,number>; serverTime:number }
export interface Welcome { seatIds:string[]; connectionId:string; guest:boolean }
export function record(value:unknown):value is Record<string,unknown> {return typeof value==='object'&&value!==null&&!Array.isArray(value);}
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const integer=(v:unknown):v is number=>finite(v)&&Number.isSafeInteger(v)&&v>=0;
export function parseInput(value:unknown):InputCommand|null {
 if(!record(value)||Object.keys(value).some(k=>!['seatId','sequence','tick','round','mx','my','ax','ay','dash','slash','throw'].includes(k)))return null;
 if(typeof value.seatId!=='string'||value.seatId.length>80||!integer(value.sequence)||!integer(value.tick)||!integer(value.round))return null;
 if(!['mx','my','ax','ay'].every(k=>finite(value[k])&&Math.abs(value[k] as number)<=1)||!['dash','slash','throw'].every(k=>typeof value[k]==='boolean'))return null;
 const length=Math.hypot(value.mx as number,value.my as number); const aim=Math.hypot(value.ax as number,value.ay as number);
 return {...value,mx:(value.mx as number)/Math.max(1,length),my:(value.my as number)/Math.max(1,length),ax:(value.ax as number)/Math.max(1,aim),ay:(value.ay as number)/Math.max(1,aim)} as unknown as InputCommand;
}
export function parseConfig(value:unknown):MatchConfig|null {
 if(record(value)&&('arenaDraft' in value||'stageIds' in value))return null;
 if(!record(value)||!['ffa','teams','relay'].includes(value.mode as string)||![3,5,7].includes(value.wins as number)||!ARENAS.some(a=>a.id===value.mapId)||!integer(value.seed)||typeof value.friendlyFire!=='boolean'||typeof value.upgrades!=='boolean')return null;
 if(value.enabledUpgrades!==undefined&&(!Array.isArray(value.enabledUpgrades)||value.enabledUpgrades.length>UPGRADES.length||new Set(value.enabledUpgrades).size!==value.enabledUpgrades.length||value.enabledUpgrades.some(id=>!UPGRADES.some(u=>u.id===id))))return null;
 return {mode:value.mode as MatchConfig['mode'],wins:value.wins as number,mapId:value.mapId as string,seed:(value.seed as number)>>>0,friendlyFire:value.friendlyFire,upgrades:value.upgrades,...(value.enabledUpgrades===undefined?{}:{enabledUpgrades:[...value.enabledUpgrades] as MatchConfig['enabledUpgrades']})};
}
export function safeName(value:unknown,fallback='Garden guest'):string {return typeof value==='string'?value.replace(/[\x00-\x1f<>]/g,'').trim().slice(0,24)||fallback:fallback;}
export class InputBuffer {
 private seats=new Map<string,{sequence:number;queue:InputCommand[];last:Input;acceptedTick:number;ack:number}>();
 reset(){this.seats.clear();}
 clear(id:string){this.seats.delete(id);}
 enqueue(command:InputCommand,owned:readonly string[],tick:number,round:number):boolean {
  if(!owned.includes(command.seatId)||command.round!==round||command.tick>tick+6||command.tick<tick-15)return false;
  const s=this.seats.get(command.seatId)??{sequence:-1,queue:[],last:{...NEUTRAL},acceptedTick:-1000,ack:-1};
  if(command.sequence<=s.sequence||s.queue.length>=12)return false;
  s.sequence=command.sequence;s.acceptedTick=tick;s.queue.push(command);this.seats.set(command.seatId,s);return true;
 }
 consume(id:string,tick:number):Input {
  const s=this.seats.get(id);if(!s)return {...NEUTRAL};
  const command=s.queue[0];
  if(command&&command.tick<=tick){s.queue.shift();s.last={mx:command.mx,my:command.my,ax:command.ax,ay:command.ay,dash:command.dash,slash:command.slash,throw:command.throw};s.ack=command.sequence;const result={...s.last};return tick-s.acceptedTick<=9?result:{...NEUTRAL};}
  return tick-s.acceptedTick<=9?{...s.last}:{...NEUTRAL};
 }
 acknowledgements():Record<string,number>{return Object.fromEntries([...this.seats].map(([id,s])=>[id,s.ack]));}
}
