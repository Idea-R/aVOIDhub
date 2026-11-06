import type {GameEvent, MatchState} from '@avoid/boomerangavoid-sim';

export interface RumbleParams {duration:number;startDelay:number;strongMagnitude:number;weakMagnitude:number}
export interface RumbleActuator {
  readonly effects?:readonly string[];
  playEffect(type:'dual-rumble',params:RumbleParams):unknown;
  reset?():unknown;
}
export interface RumblePad {index:number;id:string;connected?:boolean;vibrationActuator?:RumbleActuator|null}
export interface FeedbackSeat {id:string;control:string}
interface Pattern extends RumbleParams {priority:number}
const patterns:Record<string,Pattern>={
  dash:{duration:80,startDelay:0,strongMagnitude:.12,weakMagnitude:.28,priority:1},
  slash:{duration:45,startDelay:0,strongMagnitude:.12,weakMagnitude:.23,priority:1},
  throw:{duration:40,startDelay:0,strongMagnitude:.08,weakMagnitude:.2,priority:1},
  catch:{duration:40,startDelay:0,strongMagnitude:.12,weakMagnitude:.15,priority:1},
  deflect:{duration:80,startDelay:0,strongMagnitude:.35,weakMagnitude:.5,priority:2},
  shield:{duration:100,startDelay:0,strongMagnitude:.4,weakMagnitude:.3,priority:2},
  upgrade:{duration:80,startDelay:0,strongMagnitude:.12,weakMagnitude:.35,priority:2},
  delivery:{duration:130,startDelay:0,strongMagnitude:.3,weakMagnitude:.4,priority:2},
  death:{duration:150,startDelay:0,strongMagnitude:.65,weakMagnitude:.4,priority:3},
  pop:{duration:65,startDelay:0,strongMagnitude:.22,weakMagnitude:.3,priority:2},
};

/** Optional local feedback. It never queues effects or changes the simulation. */
export class ControllerFeedback {
  private seen=new Set<string>();
  private context='';
  private failed=new WeakSet<object>();
  private active=new Map<number,{id:string;actuator:RumbleActuator;at:number;until:number;priority:number}>();
  readonly metrics={effects:0,resets:0,failures:0};
  constructor(private readPads:()=>ArrayLike<RumblePad|null> = ()=>navigator.getGamepads()){}

  private safely(actuator:RumbleActuator,work:()=>unknown){
    try{void Promise.resolve(work()).catch(()=>{this.failed.add(actuator);this.metrics.failures++;});}
    catch{this.failed.add(actuator);this.metrics.failures++;}
  }
  stop(){
    for(const {actuator} of this.active.values()){
      this.metrics.resets++;
      this.safely(actuator,()=>actuator.reset?actuator.reset():actuator.playEffect('dual-rumble',{duration:0,startDelay:0,strongMagnitude:0,weakMagnitude:0}));
    }
    this.active.clear();
  }
  update(state:MatchState,events:readonly GameEvent[],seats:readonly FeedbackSeat[],now:number,enabled:boolean){
    const context=`${state.config.seed}:${state.round}`;
    if(context!==this.context){this.stop();this.seen.clear();this.context=context;}
    const fresh:GameEvent[]=[];
    for(const event of events){
      if(this.seen.has(event.id))continue;
      this.seen.add(event.id);
      if(event.tick<=state.tick&&event.tick>=state.tick-8)fresh.push(event);
    }
    while(this.seen.size>256)this.seen.delete(this.seen.values().next().value!);
    // Consume IDs while disabled so reopening a menu never replays old impacts.
    if(!enabled||state.phase!=='playing'||!Number.isFinite(now)){this.stop();return;}
    let pads:RumblePad[];
    try{pads=Array.from(this.readPads()).filter((pad):pad is RumblePad=>!!pad&&pad.connected!==false);}catch{this.stop();return;}
    for(const [index,active] of this.active){
      if(!pads.some(p=>p.index===index&&p.id===active.id&&p.vibrationActuator===active.actuator)){
        this.safely(active.actuator,()=>active.actuator.reset?.());this.active.delete(index);
      }else if(now>=active.until)this.active.delete(index);
    }
    const choices=new Map<number,Pattern>();
    for(const seat of seats){
      const match=/^pad(\d+)$/.exec(seat.control);if(!match)continue;
      const index=Number(match[1]);
      for(const event of fresh){
        const type=event.type==='death'?(event.target===seat.id?'death':event.actor===seat.id?'pop':''):
          event.type==='shield'?(event.target===seat.id?'shield':''):event.actor===seat.id?event.type:'';
        const pattern=Object.hasOwn(patterns,type)?patterns[type]:undefined;if(!pattern)continue;
        if(!choices.has(index)||pattern.priority>choices.get(index)!.priority)choices.set(index,pattern);
      }
    }
    for(const [index,pattern] of choices){
      const pad=pads.find(p=>p.index===index),actuator=pad?.vibrationActuator;
      if(!pad||!actuator||typeof actuator.playEffect!=='function'||this.failed.has(actuator)||
        (actuator.effects&&!actuator.effects.includes('dual-rumble')))continue;
      const active=this.active.get(index);
      if(active&&now-active.at<60&&pattern.priority<=active.priority)continue;
      const {priority,...params}=pattern;
      this.active.set(index,{id:pad.id,actuator,at:now,until:now+params.duration,priority});
      this.metrics.effects++;
      this.safely(actuator,()=>actuator.playEffect('dual-rumble',params));
    }
  }
}
