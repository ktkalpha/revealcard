import test from 'node:test'
import assert from 'node:assert/strict'
import { newPet, normalizePet, validPetImage, petExpression, PET_SHEET_PROMPT } from '../src/lib/pet.js'

test('custom pet requires an image and defaults to disabled',()=> {
  assert.deepEqual(newPet(),{enabled:false,name:'나의 펫',image:'',sheet:'',size:112,side:'right'})
})
test('saved custom pets reject executable URLs and invalid settings',()=> {
  const valid='data:image/png;base64,aGVsbG8='
  assert.equal(validPetImage(valid),true)
  for(const bad of ['javascript:alert(1)','https://example.com/pet.png','data:image/svg+xml;base64,aGVsbG8=']) assert.equal(validPetImage(bad),false)
  assert.deepEqual(normalizePet({enabled:true,name:'  ',image:'javascript:alert(1)',sheet:valid,size:999,side:'bad'}),{...newPet(),enabled:true,sheet:valid})
  assert.deepEqual(normalizePet(null),newPet())
})
test('rating and completion use the intended expression sheet cells',()=> {
  assert.equal(petExpression('known'),'happy')
  assert.equal(petExpression('again'),'thinking')
  assert.equal(petExpression('complete'),'celebrate')
  assert.equal(petExpression('pat'),'happy')
  assert.equal(petExpression('anything'),'idle')
  assert.match(PET_SHEET_PROMPT,/Top left: calm idle/)
  assert.match(PET_SHEET_PROMPT,/Top right: delighted smile/)
  assert.match(PET_SHEET_PROMPT,/Bottom left: gentle confused/)
  assert.match(PET_SHEET_PROMPT,/Bottom right: joyful celebration/)
})
