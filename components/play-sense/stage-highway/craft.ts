import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/** Small authored modeling tools. All geometry and textures belong to the stage. */
export function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material)
  object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true
  parent.add(object)
  return object
}
export function block(parent: THREE.Object3D, size: [number, number, number], mat: THREE.Material, position: [number, number, number] = [0, 0, 0], bevel = 0) {
  return mesh(parent, bevel ? new RoundedBoxGeometry(...size, 2, bevel) : new THREE.BoxGeometry(...size), mat, ...position)
}
export function cylinder(parent: THREE.Object3D, r: number, bottom: number, height: number, mat: THREE.Material, x = 0, y = 0, z = 0, segments = 32) {
  return mesh(parent, new THREE.CylinderGeometry(r, bottom, height, segments), mat, x, y, z)
}
export function hoop(parent: THREE.Object3D, radius: number, tube: number, mat: THREE.Material, y = 0) {
  const object = mesh(parent, new THREE.TorusGeometry(radius, tube, 8, 64), mat, 0, y)
  object.rotation.x = Math.PI / 2
  return object
}
export function rod(parent: THREE.Object3D, a: number[], b: number[], radius: number, mat: THREE.Material) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start)
  const object = cylinder(parent, radius, radius, direction.length(), mat)
  object.position.copy(start.add(end).multiplyScalar(0.5))
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  return object
}

const noise = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}
export function surfaceTexture(kind: 'wood' | 'skin' | 'plaster' | 'cloth', color: string, size = 256) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color; ctx.fillRect(0, 0, size, size)
  const pixels = ctx.getImageData(0, 0, size, size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4
    let variation = (noise(x, y) - 0.5) * (kind === 'skin' ? 20 : 28)
    if (kind === 'wood') variation += Math.sin(x * 0.32 + Math.sin(y * 0.025) * 2 + Math.sin(x * 0.045) * 5) * 16 + Math.sin(x * 1.8 + y * 0.01) * 6
    if (kind === 'cloth') variation += ((x % 4 < 2 ? 1 : -1) + (y % 4 < 2 ? 1 : -1)) * 12
    if (kind === 'plaster') variation += Math.sin(x * 0.075) * Math.cos(y * 0.09) * 9
    if (kind === 'skin') variation += Math.sin(x * 0.014 + y * 0.021) * 9
    for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] += variation
  }
  ctx.putImageData(pixels, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 4
  return texture
}
export function textured(kind: Parameters<typeof surfaceTexture>[0], color: string, roughness = 0.7, metalness = 0) {
  const map = surfaceTexture(kind, color)
  return new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: kind === 'wood' ? 0.045 : 0.025, roughness, metalness })
}
export const metal = (color: number = 0xc9c0a8, roughness = 0.25) => new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness })
export const matte = (color: number, roughness = 0.75) => new THREE.MeshStandardMaterial({ color, roughness })
export const luminous = (color: number, intensity = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 })

/** Bake transforms and combine static parts by material, rather than drawing each bolt. */
export function batchStatic(root: THREE.Group) {
  root.updateMatrixWorld(true)
  const inverse = root.matrixWorld.clone().invert()
  const buckets = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[]; cast: boolean; receive: boolean }>()
  const originals = new Set<THREE.BufferGeometry>()
  const remove: THREE.Mesh[] = []
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material) || object.material.transparent) return
    const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`
    const bucket: NonNullable<ReturnType<typeof buckets.get>> = buckets.get(key) ?? { material: object.material, geometries: [], cast: object.castShadow, receive: object.receiveShadow }
    const geometry = object.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld))
    // Every authored primitive uses position, normal and UV. Drop optional attributes before merging.
    for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name)
    bucket.geometries.push(geometry.index ? geometry.toNonIndexed() : geometry)
    if (geometry.index) geometry.dispose()
    buckets.set(key, bucket); originals.add(object.geometry); remove.push(object)
  })
  for (const object of remove) object.removeFromParent()
  for (const bucket of buckets.values()) {
    const geometry = mergeGeometries(bucket.geometries, false)
    bucket.geometries.forEach(part => part.dispose())
    if (!geometry) continue
    const object = new THREE.Mesh(geometry, bucket.material)
    object.castShadow = bucket.cast; object.receiveShadow = bucket.receive
    root.add(object)
  }
  originals.forEach(geometry => geometry.dispose())
  return root
}

/** Deterministic contact occlusion under props; still present in compatibility mode. */
export function contactShadow(parent: THREE.Object3D, x: number, z: number, width: number, depth: number, y = -3.18) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')!, gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 32)
  gradient.addColorStop(0, '#000b'); gradient.addColorStop(0.4, '#0007'); gradient.addColorStop(1, '#0000')
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64)
  const object = mesh(parent, new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), x, y, z)
  object.rotation.x = -Math.PI / 2; object.castShadow = false; object.receiveShadow = false
}
