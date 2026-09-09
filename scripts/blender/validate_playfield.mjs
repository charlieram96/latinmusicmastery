/** Validate the Blender/runtime contract before shipping replacement GPU assets. */
import fs from 'node:fs'
import assert from 'node:assert/strict'

const path = new URL('../../public/playsense/models/afterhours-playfield.glb', import.meta.url)
const bytes = fs.readFileSync(path)
assert.equal(bytes.toString('ascii', 0, 4), 'glTF')
assert.equal(bytes.readUInt32LE(4), 2)
assert.equal(bytes.readUInt32LE(8), bytes.length)
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
assert.equal(gltf.scenes.length, 1, 'Do not export unrelated Blender scenes or review objects')
const names = ['board', 'entrance', 'lounge', 'note_body', 'note_face', 'note_inlay']
assert.deepEqual(gltf.scenes[0].nodes.map(i => gltf.nodes[i].name).sort(), [...names].sort())
let noteTriangles = 0
for (const name of names) {
  const node = gltf.nodes.find(node => node.name === name)
  assert.ok(node?.children?.length, `${name} is missing its authored geometry`)
  assert.deepEqual(node.translation ?? [0, 0, 0], [0, 0, 0], `${name} lost its origin`)
  assert.deepEqual(node.scale ?? [1, 1, 1], [1, 1, 1], `${name} has unbaked scale`)
  if (!name.startsWith('note_')) continue
  assert.equal(node.children.length, 1, `${name} must remain one instanced mesh`)
  const child = gltf.nodes[node.children[0]]
  assert.deepEqual(child.translation ?? [0, 0, 0], [0, 0, 0])
  assert.ok(!child.rotation, `${name} must retain its baked Y-up playing orientation`)
  for (const part of gltf.meshes[child.mesh].primitives) {
    const position = gltf.accessors[part.attributes.POSITION]
    assert.ok(position.min[0] >= -.55 && position.max[0] <= .55, `${name} exceeds its lane width`)
    assert.ok(position.min[1] >= -.2 && position.max[1] <= .2, `${name} lost its component pivot`)
    assert.ok(position.min[2] >= -.5 && position.max[2] <= .5, `${name} lost its strike-line alignment`)
    noteTriangles += gltf.accessors[part.indices].count / 3
  }
}
assert.ok(noteTriangles < 8_000, `Instanced note detail is too expensive: ${noteTriangles} triangles`)
for (const textureName of ['Oiled walnut', 'Deep olive woven deck', 'Pearlescent note enamel', 'Cinnamon boucle']) {
  const material = gltf.materials.find(m => m.name.includes(textureName))
  assert.ok(material?.pbrMetallicRoughness?.baseColorTexture, `${textureName} lost its color texture`)
  assert.ok(material.normalTexture, `${textureName} lost its surface texture`)
}
assert.ok(gltf.extensionsRequired.includes('KHR_draco_mesh_compression'))
assert.ok(gltf.images.every(image => image.bufferView != null && image.mimeType === 'image/webp'))
assert.ok(gltf.buffers.every(buffer => !buffer.uri))
assert.ok(bytes.length < 2_000_000, 'The playfield exceeded its 2 MB download budget')
console.log(`Blender playfield verified: six masters, textured surfaces, ${noteTriangles} triangles/note, ${(bytes.length / 1e6).toFixed(2)} MB.`)
