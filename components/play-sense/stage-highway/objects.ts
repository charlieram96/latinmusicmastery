import * as THREE from 'three'
import type { StageTheme } from './themes'
import { createConga, createTimbale } from './instruments'
import { batchStatic, block, cylinder, matte, metal, rod } from './craft'

export function material(color: number | string, metalness = 0, roughness = 0.5) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness })
}

export function lightMaterial(color: number | string, intensity = 1) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.3, metalness: 0.25 })
}

export function box(parent: THREE.Object3D, width: number, height: number, depth: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat)
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

/** Custom authored instruments, shared by lessons, practice and the preview. */
export const buildDrum = createConga

export function buildPad(color: number, theme: StageTheme, label: string): THREE.Group {
  if (['macho', 'hembra', 'cascara'].includes(label)) return createTimbale(color, theme)
  const group = new THREE.Group(), chrome = metal(theme.metal), dark = matte(0x1c2424)
  if (label.includes('campana') || label.includes('cencerro') || label === 'cowbell') {
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 0.9, 4, 1, true), chrome)
    bell.rotation.set(Math.PI / 2, Math.PI / 4, 0); bell.position.set(0, 0.11, 0)
    bell.scale.z = 0.64; group.add(bell)
    block(group, [0.62, 0.22, 0.025], dark, [0, 0.11, 0.33], 0.02)
    rod(group, [0,-1.8,-.25],[0,.15,-.25],.04,chrome)
    block(group,[.45,.023,.025],lightMaterial(color,1.4),[0,.36,.28])
  } else {
    block(group,[1.2,.4,.8],material(color,.25,.3),[0,-.08,0],.065)
    block(group,[1.08,.12,.026],dark,[0,-.1,.4],.035)
    block(group,[.88,.025,.03],lightMaterial(color,1.4),[0,.14,.22])
    rod(group,[0,-1.8,0],[0,-.25,0],.045,chrome)
  }
  cylinder(group,.14,.14,.1,chrome,0,-1.25,0)
  if (theme.id !== 'studio') for(let i=0;i<3;i++) { const a=i*Math.PI*2/3; rod(group,[0,-1.4,0],[Math.cos(a)*.55,-1.82,Math.sin(a)*.55],.025,chrome) }
  return batchStatic(group)
}

export function glowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,0.8)')
  gradient.addColorStop(0.15, 'rgba(255,255,255,0.35)')
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.08)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

export function labelSprite(label: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const displayNames: Record<string, string> = { cascara: 'Cáscara', jamblock: 'Jam block' }
  const name = displayNames[label] ?? label
  const text = name.charAt(0).toUpperCase() + name.slice(1)
  ctx.font = '400 38px system-ui, sans-serif'
  const tracking = .8
  const textWidth = [...text].reduce((width, letter) => width + ctx.measureText(letter).width, 0) + (text.length - 1) * tracking
  canvas.width = Math.ceil(textWidth) + 24; canvas.height = 72
  ctx.font = '400 38px system-ui, sans-serif'
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#e2d6bf'
  ctx.shadowColor = 'rgba(18,25,21,.6)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1
  let x = (canvas.width - textWidth) / 2
  for (const letter of text) { ctx.fillText(letter, x, 30); x += ctx.measureText(letter).width + tracking }
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
  const underline = ctx.createLinearGradient(canvas.width * .33, 0, canvas.width * .67, 0)
  underline.addColorStop(0, 'transparent'); underline.addColorStop(.3, color)
  underline.addColorStop(.7, color); underline.addColorStop(1, 'transparent')
  ctx.globalAlpha = .45
  ctx.fillStyle = underline; ctx.fillRect(canvas.width * .33, 58, canvas.width * .34, 1.5)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, opacity: .84, depthTest: false, depthWrite: false, toneMapped: false }))
  sprite.scale.set(canvas.width / canvas.height * .42, .42, 1)
  sprite.renderOrder = 10
  return sprite
}

/** Each direction changes the set architecture as well as its materials. */
export function buildEnvironment(theme: StageTheme): THREE.Group {
  const group = new THREE.Group()
  const metal = material(theme.metal, 0.8, 0.32)
  const accent = lightMaterial(theme.accent, 2)
  const secondary = lightMaterial(theme.secondary, 1.1)
  if (theme.id === 'concert') {
    for (let i = 0; i < 3; i++) {
      const portal = new THREE.Mesh(new THREE.TorusGeometry(8 + i * 0.48, i === 0 ? 0.09 : 0.025, 8, 100, Math.PI * 1.68), i === 1 ? secondary : accent)
      portal.position.set(0, 4.5, -31 - i * 0.4)
      portal.rotation.z = -Math.PI * 0.34
      group.add(portal)
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const z = -i * 4 - 1
        const tower = box(group, 0.22, 5 + i * 0.28, 0.32, metal, side * (7.5 + i * 0.14), 1, z)
        tower.rotation.z = side * -0.2
        const strip = box(group, 0.05, 4.8 + i * 0.28, 0.04, i % 3 === 0 ? secondary : accent, 0, 0, 0.2)
        tower.add(strip)
      }
    }
  } else if (theme.id === 'arcade') {
    for (let i = 0; i < 4; i++) {
      const arch = new THREE.Group()
      const m = i % 2 ? secondary : accent
      box(arch, 0.16, 10, 0.16, m, -8, 3)
      box(arch, 0.16, 10, 0.16, m, 8, 3)
      box(arch, 16, 0.16, 0.16, m, 0, 8)
      arch.position.z = -17 - i * 8
      arch.rotation.z = i % 2 ? -0.1 : 0.1
      group.add(arch)
    }
    for (const side of [-1, 1]) for (let i = 0; i < 12; i++) {
      const height = 0.8 + ((i * 7) % 5) * 0.6
      const block = box(group, 0.8, height, 1, material(theme.colors[i % theme.colors.length], 0.25, 0.4), side * 8, height / 2 - 1, -i * 3)
      block.rotation.y = Math.PI / 4
      box(group, 0.9, 0.07, 0.9, i % 2 ? secondary : accent, side * 8, height - 0.96, -i * 3)
    }
  }
  return group
}

/** Geometry, materials and texture ownership stay local to one renderer. */
export function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  const bitmaps = new Set<ImageBitmap>()
  root.traverse(object => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry) geometries.add(mesh.geometry)
    if (mesh.material) for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(mat)
      for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value)
    }
    if (object instanceof THREE.InstancedMesh) object.dispose()
  })
  textures.forEach(texture => {
    if (typeof ImageBitmap !== 'undefined' && texture.source.data instanceof ImageBitmap) bitmaps.add(texture.source.data)
    texture.dispose()
  })
  bitmaps.forEach(bitmap => bitmap.close())
  materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose())
}
