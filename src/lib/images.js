export const CARD_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const CARD_IMAGE_URL = /^\/api\/images\/[0-9a-f-]{36}\.(?:png|jpg|webp)$/
export const validCardImage = (value) =>
  typeof value === 'string' && value.length <= 8 * 1024 * 1024 &&
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)
export const imageMarkdown = (alt, url) =>
  `![${String(alt || '사진').replace(/[\[\]\n]/g, ' ').trim() || '사진'}](${url})`
