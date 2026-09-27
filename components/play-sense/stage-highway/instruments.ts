import * as THREE from 'three'
import type { StageTheme } from './themes'
import { batchStatic, block, cylinder, hoop, luminous, matte, mesh, metal, rod, textured } from './craft'

/** Hand-shaped stave profile, inset hide, rolled crowns, individual lugs and curved hooks. */
export function createConga(color: number, theme: StageTheme, short = false) {
  const group = new THREE.Group()
  const chrome = metal(theme.id === 'studio' ? 0xc7b58d : theme.metal, 0.22)
  const dark = matte(0x171a1a)
  const wood = theme.id === 'studio' ? textured('wood', short ? '#644128' : '#9a4c22', 0.32) : new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.3 })
  const skin = textured('skin', '#d7c7a2', 0.77)
  const height = short ? 0.58 : 1.58
  const profile = [[0.4, -height], [0.43, -height * 0.91], [0.51, -height * 0.75], [0.61, -height * 0.52], [0.66, -height * 0.3], [0.65, -0.09], [0.63, -0.035]]
  mesh(group, new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), 64), wood)
  // Subtle joinery follows the shell profile instead of a flat stripe on the surface.
  const seam = matte(0x462c1b, 0.55)
  for (let i = 0; i < 16; i++) {
    const angle = i / 16 * Math.PI * 2
    const curve = new THREE.CatmullRomCurve3(profile.map(([r,y]) => new THREE.Vector3(Math.cos(angle) * (r + 0.001), y, Math.sin(angle) * (r + 0.001))))
    mesh(group, new THREE.TubeGeometry(curve, 12, 0.003, 3, false), seam)
  }
  cylinder(group, 0.604, 0.604, 0.065, skin, 0, 0.003, 0, 64)
  hoop(group, 0.603, 0.013, skin, 0.037)
  hoop(group, 0.648, 0.038, chrome, -0.043)
  hoop(group, 0.666, 0.025, chrome, -0.12)
  hoop(group, 0.632, 0.011, dark, -0.007)
  hoop(group, 0.422, 0.038, dark, -height + 0.025)
  hoop(group, 0.437, 0.014, chrome, -height + 0.08)
  // A narrow light in the crown identifies the lane without painting over the materials.
  hoop(group, 0.662, 0.011, luminous(color, 1.4), -0.063)
  for (let i = 0; i < 8; i++) {
    const angle = (i + 0.5) / 8 * Math.PI * 2, x = Math.cos(angle), z = Math.sin(angle)
    const lug = new THREE.Group(); lug.position.set(x * 0.652, -0.25, z * 0.652); lug.rotation.y = Math.PI / 2 - angle
    block(lug, [0.1, 0.16, 0.055], chrome, [0, 0, 0], 0.023)
    rod(lug, [0, 0.17, 0.055], [0, -0.23, 0.075], 0.018, chrome)
    rod(lug, [0, 0.17, 0.055], [0, 0.21, -0.016], 0.018, chrome)
    cylinder(lug, 0.035, 0.035, 0.04, chrome, 0, -0.22, 0.075, 6)
    group.add(lug)
  }
  const badge = cylinder(group, 0.095, 0.095, 0.015, chrome, 0, -0.62, 0.65, 32)
  badge.rotation.x = Math.PI / 2
  const inset = cylinder(group, 0.074, 0.074, 0.02, dark, 0, -0.62, 0.66, 6)
  inset.rotation.x = Math.PI / 2
  block(group, [0.015, 0.072, 0.008], chrome, [0, -0.62, 0.677])
  return batchStatic(group)
}

export function createTimbale(color: number, theme: StageTheme) {
  const group = new THREE.Group(), chrome = metal(theme.metal, 0.19), skin = textured('skin', '#ccceca', 0.67)
  cylinder(group, 0.65, 0.65, 0.5, chrome, 0, -0.25)
  cylinder(group, 0.62, 0.62, 0.03, skin, 0, 0.012)
  hoop(group, 0.654, 0.025, chrome, 0.035); hoop(group, 0.66, 0.025, chrome, -0.48)
  hoop(group, 0.672, 0.011, luminous(color, 1.4), 0.01)
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; rod(group, [Math.cos(a)*.66,-.02,Math.sin(a)*.66], [Math.cos(a)*.66,-.4,Math.sin(a)*.66], .025, chrome) }
  rod(group, [0,-.5,0], [0,-1.8,0], .055, chrome)
  if (theme.id !== 'studio') for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; rod(group, [0,-1.4,0], [Math.cos(a)*.55,-1.82,Math.sin(a)*.55], .032, chrome) }
  return batchStatic(group)
}
