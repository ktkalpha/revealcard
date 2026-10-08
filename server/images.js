import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { CARD_IMAGE_MAX_BYTES, CARD_IMAGE_URL, validCardImage } from '../src/lib/images.js'

const error = (status, message) => Object.assign(new Error(message), { status })

// Card images are addressed by unguessable UUID names so public sets can show them
// to signed-out readers without exposing a listing.
export function createImages(directory) {
  const dir = resolve(directory)
  return {
    async save(image) {
      if (!validCardImage(image)) throw error(400, 'PNG, JPG, WebP 이미지를 확인해 주세요.')
      const [, type, encoded] = /^data:image\/(png|jpeg|webp);base64,(.*)$/.exec(image)
      const bytes = Buffer.from(encoded, 'base64')
      if (bytes.length > CARD_IMAGE_MAX_BYTES) throw error(413, '5MB 이하 이미지를 사용해 주세요.')
      const magic = type === 'png'
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : type === 'jpeg'
          ? bytes[0] === 255 && bytes[1] === 216
          : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
      if (!magic) throw error(400, '올바른 이미지 파일이 아니에요.')
      const name = `${randomUUID()}.${type === 'jpeg' ? 'jpg' : type}`
      await mkdir(dir, { recursive: true, mode: 0o700 })
      await writeFile(resolve(dir, name), bytes, { mode: 0o600 })
      return { name, url: `/api/images/${name}` }
    },
    async read(name) {
      if (!CARD_IMAGE_URL.test(`/api/images/${name}`)) throw error(404, '이미지를 찾을 수 없어요.')
      return readFile(resolve(dir, name)).catch(() => { throw error(404, '이미지를 찾을 수 없어요.') })
    },
  }
}
