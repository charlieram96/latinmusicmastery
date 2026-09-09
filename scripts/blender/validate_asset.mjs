/** Verify the shipped Blender artifact's names, pivots, compression and download budget. */
import fs from 'node:fs'
import assert from 'node:assert/strict'
const path = new URL('../../public/playsense/models/afterhours-instruments.glb', import.meta.url)
const bytes = fs.readFileSync(path)
assert.equal(bytes.toString('ascii', 0, 4), 'glTF')
assert.equal(bytes.readUInt32LE(4), 2)
assert.equal(bytes.readUInt32LE(8), bytes.length)
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
for (const name of ['quinto', 'conga', 'tumba', 'timbale_macho', 'timbale_hembra']) {
  const node = gltf.nodes.find(node => node.name === name)
  assert.ok(node?.children?.length, `${name} is missing its meshes`)
  assert.deepEqual(node.translation ?? [0, 0, 0], [0, 0, 0], `${name} lost its playing-surface pivot`)
}
assert.ok(gltf.extensionsRequired.includes('KHR_draco_mesh_compression'))
assert.ok(gltf.images.every(image => image.bufferView != null && image.mimeType === 'image/webp'))
assert.ok(gltf.buffers.every(buffer => !buffer.uri), 'The collection must not depend on external model buffers')
assert.ok(bytes.length < 4_000_000, 'The collection exceeded its 4 MB download budget')
console.log(`Blender collection verified: five named instruments, embedded WebP textures, Draco geometry, ${(bytes.length / 1e6).toFixed(2)} MB.`)
