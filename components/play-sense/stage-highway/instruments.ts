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

export function createKeyboard() {
  const group = new THREE.Group(), black = matte(0x151b1c, 0.34), chrome = metal(0xbcb4a0), ivory = matte(0xe1d8bd, 0.3)
  block(group, [4.8,.35,1.6], black, [0,0,0], .12)
  const cheeks = textured('wood', '#764222', .38)
  for (const side of [-1,1]) block(group, [.19,.4,1.65], cheeks, [side*2.42,0,0], .06)
  for (let i = 0; i < 28; i++) {
    block(group, [.146,.1,.78], ivory, [(i-13.5)*.157,.22,.3], .013)
    if (![2,6].includes(i%7) && i < 27) block(group, [.09,.14,.46], black, [(i-13)*.157,.32,.14], .01)
  }
  for (let i = 0; i < 8; i++) cylinder(group,.047,.047,.06,chrome,-1.8+i*.2,.23,-.44,12)
  block(group,[.65,.01,.18],luminous(0x75baaf,.5),[.65,.188,-.43])
  rod(group,[-1.6,-2.5,.55],[1.6,-.22,-.35],.065,chrome)
  rod(group,[1.6,-2.5,.55],[-1.6,-.22,-.35],.065,chrome)
  for (const side of [-1,1]) rod(group,[side*1.6,-2.5,-.55],[side*1.6,-2.5,.95],.065,black)
  return group
}

export function createGuitar() {
  const group = new THREE.Group(), chrome = metal(0xb4aa91), black = matte(0x151718,.3)
  const body = new THREE.Shape()
  body.moveTo(0,-.7); body.bezierCurveTo(-.75,-.8,-.95,-.13,-.51,.22)
  body.bezierCurveTo(-.29,.38,-.38,.55,-.32,.93); body.bezierCurveTo(-.25,1.2,-.1,.42,0,.44)
  body.bezierCurveTo(.28,.51,.16,1.04,.4,.9); body.bezierCurveTo(.63,.73,.15,.35,.58,.12)
  body.bezierCurveTo(1,-.3,.61,-.84,0,-.7)
  const wood = textured('wood','#944723',.28)
  mesh(group,new THREE.ExtrudeGeometry(body,{depth:.18,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.075,bevelThickness:.045,curveSegments:20}),wood)
  block(group,[.2,2.6,.12],wood,[0,1.75,.05],.025)
  block(group,[.18,2.1,.035],black,[0,1.52,.15])
  block(group,[.3,.58,.14],wood,[.04,3.27,.045],.05)
  for (let i=0;i<18;i++) block(group,[.18,.009,.016],chrome,[0,.57+i*.108,.177])
  for (const y of [-.1,.15]) block(group,[.37,.105,.075],black,[0,y,.23],.015)
  block(group,[.32,.16,.055],chrome,[0,-.4,.24])
  for(let i=0;i<4;i++) { rod(group,[(i-1.5)*.035,-.45,.287],[(i-1.5)*.035,3.45,.17],.0035,chrome); cylinder(group,.045,.045,.04,chrome,i%2?.24:-.17,3.08+i*.13,.05,12).rotation.z=Math.PI/2 }
  for(let i=0;i<3;i++) cylinder(group,.045,.045,.045,chrome,.42-i*.035,-.23-i*.13,.24,16).rotation.x=Math.PI/2
  group.rotation.z=-.13
  return group
}

export function createMicrophone() {
  const group = new THREE.Group(), chrome = metal(0x8e9796,.3), black = matte(0x111718)
  cylinder(group,.045,.055,3.5,chrome,0,1.75)
  for(let i=0;i<3;i++) { const a=i*Math.PI*2/3; rod(group,[0,.2,0],[Math.cos(a)*.65,.03,Math.sin(a)*.65],.035,black) }
  rod(group,[-.4,3.45,0],[1,3.8,0],.035,chrome)
  const mic = cylinder(group,.09,.065,.42,black,1.12,3.83,0); mic.rotation.z=-Math.PI/2+.2
  mesh(group,new THREE.SphereGeometry(.105,16,12),metal(0x515c59,.7),1.33,3.88)
  return group
}
