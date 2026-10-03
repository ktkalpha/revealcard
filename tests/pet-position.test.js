import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizePet,normalizePetPosition} from '../src/lib/pet.js'
import {petPositionAt,petPositionPixels} from '../src/lib/petPosition.js'

test('saved pet locations reject malformed coordinates and clamp off-screen values',()=>{
  for(const input of [null,{}, {x:'0.5',y:.5},{x:NaN,y:0},{x:1,y:Infinity}])assert.equal(normalizePetPosition(input),null)
  assert.deepEqual(normalizePetPosition({x:-5,y:4}),{x:0,y:1})
  assert.equal(normalizePet({name:'기존 펫'}).position,null)
  assert.deepEqual(normalizePet({position:{x:.2,y:.75}}).position,{x:.2,y:.75})
})
test('dragging to any viewport edge keeps the whole companion inside the screen',()=>{
  const viewport={width:390,height:844},box={width:104,height:197}
  const min=petPositionAt(-100,-300,viewport,box),max=petPositionAt(10000,10000,viewport,box)
  assert.deepEqual(petPositionPixels(min,viewport,box),{left:12,top:12})
  assert.deepEqual(petPositionPixels(max,viewport,box),{left:274,top:635})
  assert.deepEqual(petPositionPixels(max,{width:90,height:150},box),{left:0,top:0})
})
test('a saved position remains proportional after switching to a smaller viewport',()=>{
  const desktop={width:1440,height:900},box={width:112,height:205},point={left:650,top:480}
  const saved=petPositionAt(point.left,point.top,desktop,box)
  const restored=petPositionPixels(saved,desktop,box)
  assert.ok(Math.abs(restored.left-point.left)<.001 && Math.abs(restored.top-point.top)<.001)
  const mobile={width:390,height:600},mobileBox={width:104,height:197}
  const resized=petPositionPixels(saved,mobile,mobileBox)
  assert.ok(resized.left>=12 && resized.left+mobileBox.width<=mobile.width-12)
  assert.ok(resized.top>=12 && resized.top+mobileBox.height<=mobile.height-12)
})
