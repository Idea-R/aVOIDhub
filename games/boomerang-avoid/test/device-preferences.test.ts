import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePreferences,DEFAULT_BINDINGS,type Preferences} from '../src/input';
import {padAxes} from '../src/gamepad';
const defaults:Preferences={music:.28,sfx:.65,reducedMotion:false,touch:false,character:'pip',quality:'auto',bindings:DEFAULT_BINDINGS,gamepadButtons:{dash:0,slash:2,throw:1}};
test('malformed saved device controls cannot poison bindings, quality or button indices',()=>{
  const prefs=normalizePreferences({music:NaN,sfx:-2,touch:'yes',quality:'cinema',bindings:[{up:17,dash:null,left:'<html>',right:'KeyQ'}],gamepadButtons:{dash:-1,slash:2.5,throw:99},stickDeadzone:1,invertAimY:'true',unknown:'drop'},defaults);
  assert.equal(prefs.music,.28);assert.equal(prefs.sfx,.65);assert.equal(prefs.touch,false);assert.equal(prefs.quality,'auto');
  assert.equal(prefs.bindings[0].up,'KeyW');assert.equal(prefs.bindings[0].right,'KeyQ');assert.equal(prefs.bindings[1].slash,'Numpad1');
  assert.deepEqual(prefs.gamepadButtons,defaults.gamepadButtons);assert.equal(prefs.stickDeadzone,.18);assert.equal(prefs.invertAimY,false);assert.equal('unknown' in prefs,false);
  assert.doesNotThrow(()=>normalizePreferences({bindings:{0:'bad'},gamepadButtons:null},defaults));
  const collided=normalizePreferences({bindings:[{up:'KeyS',down:14}],gamepadButtons:{dash:9}},defaults);
  const codes=collided.bindings.flatMap(binding=>Object.values(binding));assert.equal(new Set(codes).size,codes.length);assert.notEqual(collided.bindings[0].up,collided.bindings[0].down);assert.equal(collided.gamepadButtons.dash,0);
});
test('valid device accessibility settings survive detached normalization',()=>{
  const value={music:.5,quality:'low',touch:true,character:'nori',bindings:[{throw:'KeyL'}],gamepadButtons:{dash:4,slash:5,throw:7},stickDeadzone:.3,invertAimY:true,haptics:true};
  const prefs=normalizePreferences(value,defaults);assert.equal(prefs.stickDeadzone,.3);assert.equal(prefs.invertAimY,true);assert.equal(prefs.bindings[0].throw,'KeyL');assert.equal(prefs.gamepadButtons.dash,4);
  prefs.bindings[0].up='KeyI';assert.equal(DEFAULT_BINDINGS[0].up,'KeyW');
  assert.equal(prefs.haptics,true);assert.equal(normalizePreferences({haptics:'yes'},defaults).haptics,false);assert.equal(normalizePreferences(null,defaults).haptics,false);
  const sample={id:'fixture',index:0,mapping:'standard',axes:[.25,0,0,.6],buttons:[]};
  assert.equal(padAxes(sample,.3).mx,0);assert.ok(padAxes(sample,.1).mx>0);assert.ok(Number.isFinite(padAxes(sample,NaN).ay));
});
