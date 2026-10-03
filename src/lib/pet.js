export const PET_STATES = ['idle', 'happy', 'thinking', 'celebrate']
export const newPet = () => ({ enabled: false, name: '나의 펫', image: '', sheet: '', size: 112, side: 'right', position: null })
export const petName = (value) => typeof value === 'string' ? [...value.trim()].slice(0, 16).join('') || '나의 펫' : '나의 펫'
export const validPetImage = (value) => typeof value === 'string' && value.length <= 12 * 1024 * 1024 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)
export function normalizePetPosition(value) {
  return value && typeof value === 'object' && Number.isFinite(value.x) && Number.isFinite(value.y)
    ? {x:Math.min(1,Math.max(0,value.x)),y:Math.min(1,Math.max(0,value.y))} : null
}
export function normalizePet(value) {
  if (!value || typeof value !== 'object') return newPet()
  return { enabled: value.enabled === true, name: petName(value.name), image: validPetImage(value.image) ? value.image : '', sheet: validPetImage(value.sheet) ? value.sheet : '', size: [80,112,144].includes(value.size) ? value.size : 112, side: value.side === 'left' ? 'left' : 'right', position:normalizePetPosition(value.position) }
}
export function petExpression(reaction) {
  return { known: 'happy', again: 'thinking', complete: 'celebrate', pat: 'happy' }[reaction] || 'idle'
}
export const PET_SHEET_PROMPT = `Use the attached image as the character identity reference. Create a production-ready study companion expression sheet: exactly four equally sized square cells in a clean 2 by 2 grid. Top left: calm idle expression, eyes open. Top right: delighted smile, eyes smiling, celebrating a correct answer. Bottom left: gentle confused/encouraging expression after an incorrect answer, never distressed. Bottom right: joyful celebration after completing a study session. Each cell contains only the same single character, fully visible and centered at exactly the same scale and ground line, with generous empty margins. Preserve the reference character's identity, colors, clothes, textures, and visual style in all four cells. Actual transparent background in every cell. No labels, text, border, grid lines, or additional characters. The sheet will be displayed as four interchangeable sprites in a website.`
