export async function readPetFile(file) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('PNG, JPG, WebP 이미지를 선택해 주세요.')
  if (file.size > 8 * 1024 * 1024) throw new Error('8MB 이하 이미지를 선택해 주세요.')
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('이미지를 읽지 못했어요.'))
    reader.readAsDataURL(file)
  })
  const image = new Image()
  image.src = data
  try { await image.decode() } catch { throw new Error('이미지 파일을 확인해 주세요.') }
  return { data, width: image.naturalWidth, height: image.naturalHeight }
}
