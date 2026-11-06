import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Inputs,DEFAULT_BINDINGS,type Preferences} from '../src/input';
function fixture(){
  const events=new Map<string,()=>void>();
  const pad={index:0,id:'Viewport fixture',mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>[pad]}});
  Object.assign(globalThis,{innerWidth:1440,innerHeight:900,addEventListener:(name:string,fn:()=>void)=>events.set(name,fn),document:{addEventListener:()=>{},querySelector:()=>null,querySelectorAll:()=>[]}});
  const prefs:Preferences={music:0,sfx:0,reducedMotion:false,touch:true,character:'pip',quality:'auto',bindings:DEFAULT_BINDINGS,gamepadButtons:{dash:0,slash:2,throw:1}};
  const input=new Inputs(prefs);input.active=true;input.pollGamepads(false);
  const resize=(width:number,height:number)=>{Object.assign(globalThis,{innerWidth:width,innerHeight:height});events.get('resize')!();};
  return{input,pad,resize};
}
test('orientation changes release keyboard and touch while same-aspect viewport changes preserve valid input',()=>{
  const{input,resize}=fixture();input.keys.add('KeyD');input.touchInput.my=1;input.touchInput.throw=true;
  resize(1280,800);assert.equal(input.keys.has('KeyD'),true);assert.equal(input.touchInput.my,1);
  resize(390,844);assert.equal(input.keys.size,0);assert.deepEqual(input.touchInput,{mx:0,my:0,ax:0,ay:0,dash:false,slash:false,throw:false});
  input.touchInput.mx=1;resize(844,390);assert.equal(input.touchInput.mx,0);
});
test('a held gamepad cannot resume across orientation change until neutral and fresh activity',()=>{
  const{input,pad,resize}=fixture();pad.axes[0]=1;input.pollGamepads(false);assert.equal(input.read('pad0').mx,1);
  resize(390,844);input.pollGamepads(false);assert.equal(input.read('pad0').mx,0);
  pad.axes[0]=0;input.pollGamepads(false);pad.axes[0]=1;input.pollGamepads(false);assert.equal(input.read('pad0').mx,1);
});
