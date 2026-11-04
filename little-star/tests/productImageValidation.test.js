import test from 'node:test'
import assert from 'node:assert/strict'
import { PRODUCT_IMAGE_MAX_BYTES, validateProductImage } from '../src/admin/productImageValidation.js'

const file = (name, type, bytes) => new File([Uint8Array.from(bytes)], name, { type })

test('accepts supported image signatures and returns trusted storage MIME types', async () => {
  const supported = [
    ['tiny.png', 'image/png', [137, 80, 78, 71, 13, 10, 26, 10]],
    ['photo.jpg', 'image/jpeg', [255, 216, 255]],
    ['photo.webp', 'image/webp', [...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')]],
    ['photo.gif', 'image/gif', [...Buffer.from('GIF89a')]],
    ['photo.avif', 'image/avif', [0, 0, 0, 0, ...Buffer.from('ftypavif')]]
  ]
  for (const [name, type, bytes] of supported) {
    assert.equal((await validateProductImage(file(name, type, bytes))).mimeType, type)
  }
})

test('rejects mismatched content types, unsupported files and oversized images', async () => {
  await assert.rejects(validateProductImage(file('wrong.png', 'image/png', Buffer.from('not an image'))), /not a supported/)
  await assert.rejects(validateProductImage(file('wrong.jpg', 'image/png', [255, 216, 255])), /does not match/)

  const tooLarge = {
    name: 'large.png',
    type: 'image/png',
    size: PRODUCT_IMAGE_MAX_BYTES + 1,
    slice: () => { throw new Error('Oversized image should be rejected before reading bytes.') }
  }
  await assert.rejects(validateProductImage(tooLarge), /10 MB or smaller/)
})

test('accepts valid image data when the browser supplies no MIME type', async () => {
  const validFile = file('green1122.png', 'image/png', [137, 80, 78, 71, 13, 10, 26, 10])
  const noMimeFile = new File([validFile], 'green1122.png')
  assert.equal((await validateProductImage(noMimeFile)).mimeType, 'image/png')
})
