export const PRODUCT_IMAGE_MAX_BYTES = 10 * 1024 * 1024

const IMAGE_FORMATS = [
  { mimeType: 'image/png', extension: 'png', matches: (bytes) => [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte) },
  { mimeType: 'image/jpeg', extension: 'jpg', matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { mimeType: 'image/webp', extension: 'webp', matches: (bytes) => ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP' },
  { mimeType: 'image/gif', extension: 'gif', matches: (bytes) => ['GIF87a', 'GIF89a'].includes(ascii(bytes, 0, 6)) },
  { mimeType: 'image/avif', extension: 'avif', matches: (bytes) => ascii(bytes, 4, 4) === 'ftyp' && ['avif', 'avis'].includes(ascii(bytes, 8, 4)) }
]

function ascii(bytes, start, length) {
  return String.fromCharCode(...bytes.slice(start, start + length))
}

export async function validateProductImage(file) {
  if (!file || typeof file !== 'object') {
    throw new Error('Choose a valid image file.')
  }
  if (file.size === 0) throw new Error(`${file.name}: this image file is empty.`)
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error(`${file.name}: images must be 10 MB or smaller.`)
  }
  if (typeof file.arrayBuffer !== 'function' || typeof file.slice !== 'function') {
    throw new Error('Choose a valid image file.')
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const format = IMAGE_FORMATS.find((entry) => entry.matches(header))
  if (!format) {
    throw new Error(`${file.name}: file contents are not a supported PNG, JPEG, WebP, GIF, or AVIF image.`)
  }
  if (file.type && file.type !== format.mimeType) {
    throw new Error(`${file.name}: file type does not match its image contents.`)
  }

  return format
}
