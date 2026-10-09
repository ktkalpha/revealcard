import test from 'node:test'
import assert from 'node:assert/strict'
import { newPet, normalizePet, validPetImage, petExpression, normalizeMapping, petSheetPrompt, petExpressionPrompt, PET_SHEET_PROMPT } from '../src/lib/pet.js'

test('custom pet requires an image and defaults to disabled',()=> {
  assert.deepEqual(newPet(),{enabled:false,name:'나의 펫',image:'',sheet:'',size:112,side:'right',position:null})
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
test('custom mappings route study events to built-in or custom expressions',()=> {
  const mapping=normalizeMapping({known:'custom-1',again:'missing',pat:'celebrate',extra:'happy'},['custom-1'])
  assert.deepEqual(mapping,{idle:'idle',known:'custom-1',again:'thinking',complete:'celebrate',pat:'celebrate'})
  assert.equal(petExpression('known',mapping),'custom-1')
  assert.equal(petExpression('again',mapping),'thinking')
  assert.equal(petExpression('unknown',mapping),'idle')
})
test('owner descriptions are quoted into generation prompts',()=> {
  assert.equal(petSheetPrompt(''),PET_SHEET_PROMPT)
  assert.match(petSheetPrompt('  빨간  "모자" '),/: "빨간 '모자'"\.$/)
  const prompt=petExpressionPrompt('윙크','고양이')
  assert.match(prompt,/"윙크"/)
  assert.match(prompt,/"고양이"/)
})
