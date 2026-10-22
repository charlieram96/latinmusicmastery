import * as THREE from 'three'
import { batchStatic, block, cylinder, hoop, mesh, metal, rod, surfaceTexture, textured } from './craft'
import type { StageTheme } from './themes'

/** Reference-shaped, real geometry. Materials and hardware share the conga stage lighting. */
export function buildSonPiece(id: string, _color: number, _theme: StageTheme): THREE.Group {
  const group = new THREE.Group()
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xe0e5e8, metalness: 1, roughness: .18, envMapIntensity: 1.5, clearcoat: .3 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x101216, roughness: .65 })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x080909, roughness: .9 })
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd4af55, metalness: .95, roughness: .23, clearcoat: .35, envMapIntensity: 1.4 })
  const skin = textured('skin', '#d8d4c8', .65)
  skin.bumpScale = .003
  skin.name = 'PlaySense coated head'

  function bolt(parent: THREE.Object3D, x: number, y: number, z: number) {
    cylinder(parent, .031, .031, .035, chrome, x, y, z, 6)
    block(parent, [.029, .004, .006], dark, [x, y + .019, z])
  }
  function stand(parent: THREE.Object3D, top: number, bottom = -2.35) {
    rod(parent, [0, bottom + .3, 0], [0, top, 0], .035, chrome)
    cylinder(parent, .065, .065, .16, chrome, 0, (top + bottom) / 2)
    block(parent, [.13, .035, .04], chrome, [.09, (top + bottom) / 2, 0], .01)
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3, x = Math.cos(a) * .52, z = Math.sin(a) * .52
      rod(parent, [0, bottom + .65, 0], [x, bottom, z], .027, chrome)
      rod(parent, [0, bottom + .25, 0], [x * .65, bottom + .18, z * .65], .015, chrome)
      block(parent, [.13, .08, .16], rubber, [x, bottom, z], .03)
    }
  }
  function shell(parent: THREE.Object3D, radius: number, depth: number, finish: THREE.Material, bottomHead: boolean) {
    mesh(parent, new THREE.CylinderGeometry(radius, radius, depth, 96, 1, true), finish, 0, -depth / 2)
    const head = cylinder(parent, radius - .022, radius - .022, .025, skin, 0, -.008, 0, 96)
    head.name = 'playing-head'
    // Raised flat hoop plus rolled lips, not a single wire ring.
    mesh(parent, new THREE.CylinderGeometry(radius + .021, radius + .021, .075, 96, 1, true), chrome, 0, .014)
    hoop(parent, radius + .022, .012, chrome, .052)
    hoop(parent, radius + .018, .014, chrome, -.026)
    hoop(parent, radius, .009, dark, -.036)
    hoop(parent, radius + .01, .02, chrome, -depth)
    if (bottomHead) cylinder(parent, radius - .02, radius - .02, .016, skin, 0, -depth, 0, 96)
    else {
      for (const y of [-depth * .3, -depth * .74]) hoop(parent, radius + .004, .011, finish, y)
    }
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5, x = Math.cos(a), z = Math.sin(a)
      const lug = new THREE.Group(); lug.rotation.y = -a; lug.position.set(x * (radius + .025), -depth * .52, z * (radius + .025))
      block(lug, [.065, depth * .27, .085], chrome, [0, 0, 0], .022)
      parent.add(lug)
      rod(parent, [x * (radius + .055), .027, z * (radius + .055)], [x * (radius + .055), -depth * .61, z * (radius + .055)], .012, chrome)
      bolt(parent, x * (radius + .055), .042, z * (radius + .055))
      if (bottomHead) {
        rod(parent, [x * (radius + .055), -depth * .7, z * (radius + .055)], [x * (radius + .055), -depth, z * (radius + .055)], .012, chrome)
      }
    }
    const badge = cylinder(parent, .075, .075, .012, brass, 0, -depth * .52, radius + .015, 32)
    badge.rotation.x = Math.PI / 2
    const inset = cylinder(parent, .052, .052, .016, dark, 0, -depth * .52, radius + .023, 32)
    inset.rotation.x = Math.PI / 2
  }

  if (id.startsWith('paila-')) {
    const r = id === 'paila-low' ? .79 : .71
    const depth = .64
    // Broad reflected stage softboxes reveal the spun steel instead of tinting it solid purple.
    const reflectionCanvas=document.createElement('canvas');reflectionCanvas.width=512;reflectionCanvas.height=256
    const ctx=reflectionCanvas.getContext('2d')!
    const fill=ctx.createLinearGradient(0,0,0,256)
    fill.addColorStop(0,'#b5c4d6');fill.addColorStop(.46,'#d5d1ca');fill.addColorStop(.54,'#323a44');fill.addColorStop(1,'#73777c')
    ctx.fillStyle=fill;ctx.fillRect(0,0,512,256)
    for(const x of [36,180,340,470]) {
      const light=ctx.createLinearGradient(x-25,0,x+25,0)
      light.addColorStop(0,'rgba(255,249,233,0)');light.addColorStop(.4,'rgba(255,249,233,.95)');light.addColorStop(.6,'rgba(255,249,233,.95)');light.addColorStop(1,'rgba(255,249,233,0)')
      ctx.fillStyle=light;ctx.fillRect(x-25,45,50,153)
    }
    const reflection=new THREE.CanvasTexture(reflectionCanvas)
    reflection.colorSpace=THREE.SRGBColorSpace;reflection.mapping=THREE.EquirectangularReflectionMapping
    chrome.envMap=reflection;chrome.envMapIntensity=1.1
    const steel = new THREE.MeshPhysicalMaterial({ color: 0xe9eeef, metalness: .88, roughness: .2, clearcoat: .55, clearcoatRoughness: .14, envMapIntensity: 1.8, side: THREE.DoubleSide, envMap: reflection })
    // A spun open-bottom shell, with two broad pressed beads as on the LP reference.
    const profile = [[r,-depth],[r+.012,-depth+.018],[r,-depth+.04],
      [r,-.49],[r+.016,-.474],[r+.016,-.459],[r,-.443],
      [r,-.22],[r+.016,-.204],[r+.016,-.189],[r,-.173],[r,-.04]]
    mesh(group, new THREE.LatheGeometry(profile.map(([x,y]) => new THREE.Vector2(x,y)), 128), steel)
    const pailaHead = skin.clone(); pailaHead.color.set(0xfff4dc)
    pailaHead.name = 'PlaySense paila head'
    cylinder(group, r-.015, r-.015, .016, pailaHead, 0, -.015, 0, 128)
    // Tall flat hoop, curled top edge, and a thin flesh hoop underneath.
    mesh(group, new THREE.CylinderGeometry(r+.022,r+.022,.085,128,1,true), chrome,0,.013)
    hoop(group,r+.022,.011,chrome,.056)
    hoop(group,r+.023,.012,chrome,-.029)
    hoop(group,r,.007,dark,-.043)
    hoop(group,r+.004,.012,chrome,-depth)
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4, x=Math.sin(a), z=Math.cos(a)
      const lug=new THREE.Group();lug.position.set(x*(r+.018),-.285,z*(r+.018));lug.rotation.y=a
      block(lug,[.085,.17,.048],chrome,[0,0,0],.02)
      block(lug,[.10,.056,.075],chrome,[0,.025,.025],.015)
      group.add(lug)
      rod(group,[x*(r+.07),.057,z*(r+.07)],[x*(r+.07),-.30,z*(r+.07)],.013,chrome)
      cylinder(group,.034,.034,.045,chrome,x*(r+.07),-.18,z*(r+.07),6)
      bolt(group,x*(r+.07),.062,z*(r+.07))
      const screw=cylinder(group,.012,.012,.014,dark,x*(r+.044),-.335,z*(r+.044),12)
      screw.rotation.x=Math.PI/2;screw.rotation.z=-a
    }
    // Restrained maker medallion and side mounting clamp, independent of lane spacing.
    const badge=cylinder(group,.077,.077,.012,brass,0,-.37,r+.018,40);badge.rotation.x=Math.PI/2
    const inset=cylinder(group,.061,.061,.014,dark,0,-.37,r+.027,40);inset.rotation.x=Math.PI/2
    block(group,[.3,.10,.22],dark,[0,-.46,-r],.018)
    rod(group,[0,-.46,-r],[0,-.70,0],.035,chrome)
    stand(group,-.68)
  } else if (id === 'reserved-snare') {
    const copper = new THREE.MeshPhysicalMaterial({ map: surfaceTexture('wood', '#995e3c', 512), metalness: .82, roughness: .32, clearcoat: .25 })
    shell(group, .7, .53, copper, true)
    for (let i = 0; i < 18; i++) rod(group, [-.56, -.553, (i - 8.5) * .014], [.56, -.553, (i - 8.5) * .014], .003, chrome)
    block(group, [.1, .22, .09], chrome, [.7, -.25, 0], .02)
    rod(group, [.74, -.23, 0], [.8, -.08, 0], .018, chrome)
    stand(group, -.55)
  } else if (id === 'reserved-tom') {
    const lacquer = new THREE.MeshPhysicalMaterial({ map: surfaceTexture('wood', '#611622', 512), metalness: .25, roughness: .22, clearcoat: 1, clearcoatRoughness: .13 })
    shell(group, .72, 1.15, lacquer, true)
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3, x = Math.cos(a), z = Math.sin(a)
      block(group, [.12, .22, .12], chrome, [x * .74, -.9, z * .74], .025)
      rod(group, [x * .77, -.72, z * .77], [x * .8, -2.1, z * .8], .025, chrome)
      rod(group, [x * .8, -2.1, z * .8], [x * .94, -2.35, z * .94], .025, chrome)
      cylinder(group, .045, .045, .09, rubber, x * .94, -2.35, z * .94)
    }
  } else if (id === 'reserved-kick') {
    const body = new THREE.Group(); group.add(body)
    const blue = new THREE.MeshPhysicalMaterial({ color: 0x72a4b4, metalness: .5, roughness: .24, clearcoat: 1, clearcoatRoughness: .16 })
    shell(body, .91, .85, blue, false)
    // Black resonant skin faces the player, with a restrained off-centre port.
    cylinder(body, .87, .87, .028, dark, 0, .012, 0, 96)
    const port = cylinder(body, .13, .13, .032, rubber, .38, .035, .36, 40)
    port.name = 'kick-port'
    body.rotation.x = Math.PI / 2; body.position.set(0, -1.39, .25)
    for (const side of [-1, 1]) {
      rod(group, [side * .68, -1.48, .1], [side * .98, -2.33, .57], .032, chrome)
      block(group, [.12, .1, .14], rubber, [side * .98, -2.35, .57], .03)
    }
    block(group, [.25, .045, .5], chrome, [0, -2.31, .98], .02)
    rod(group, [0, -2.25, .7], [0, -1.38, .5], .018, chrome)
    cylinder(group, .065, .065, .09, skin, 0, -1.37, .5)
  } else if (id === 'cymbal') {
    const profile = [[.04,.18],[.12,.18],[.19,.13],[.25,.035],[.43,.008],[.74,-.02],[1.03,-.07]]
    const finish = new THREE.MeshPhysicalMaterial({ color: 0xe8b84f, metalness: 1, roughness: .25, clearcoat: .3, side: THREE.DoubleSide, envMapIntensity: 1.5 })
    mesh(group, new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), 128), finish)
    const groove = metal(0xb08735, .36)
    for (let r = .28; r < 1.025; r += .018) hoop(group, r, .0016, groove, .035 - r * .097)
    cylinder(group, .055, .055, .07, rubber, 0, .2)
    cylinder(group, .025, .025, .13, chrome, 0, .23)
    block(group, [.15, .025, .035], chrome, [0, .29, 0], .012)
    stand(group, .08)
  } else if (id === 'jamblock') {
    const red = new THREE.MeshPhysicalMaterial({ color: 0xf00816, roughness: .32, clearcoat: .25 })
    // Separate walls preserve a real recessed mouth instead of a painted black face.
    block(group, [1.18, .12, .67], red, [0, .12, 0], .05)
    block(group, [1.18, .12, .67], red, [0, -.17, 0], .05)
    for (const x of [-.55, .55]) block(group, [.12, .27, .67], red, [x, -.025, 0], .04)
    block(group, [1.06, .23, .08], red, [0, -.02, -.29], .02)
    block(group, [.94, .19, .02], new THREE.MeshStandardMaterial({ color: 0x660209, roughness: .9 }), [0, -.02, -.22])
    block(group, [.38, .09, .24], dark, [0, -.09, -.44], .035)
    bolt(group, -.18, .18, -.19); bolt(group, .18, .18, -.19)
    stand(group, -.25)
  } else {
    const chacha = id === 'chacha-bell', copper = id === 'contracampana'
    const finish = copper ? new THREE.MeshPhysicalMaterial({ map: surfaceTexture('plaster', '#ad754b', 512), metalness: .92, roughness: .29 }) : chrome
    const body = new THREE.Group(); group.add(body)
    const length = chacha ? .85 : 1.2, front = chacha ? .46 : .51, back = .24, height = chacha ? .19 : .22
    // Four tapered sheet-metal faces and a rolled open rectangular mouth.
    const verts = [-back,-height,-length/2, back,-height,-length/2, back,height,-length/2,-back,height,-length/2,
      -front,-height,length/2, front,-height,length/2, front,height,length/2,-front,height,length/2]
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1],2))
    geo.setIndex([0,1,5,0,5,4, 3,7,6,3,6,2, 0,4,7,0,7,3, 1,2,6,1,6,5, 0,3,2,0,2,1]);geo.computeVertexNormals()
    finish.side = THREE.DoubleSide
    mesh(body, geo, finish)
    block(body,[front*1.82,height*1.65,.018],dark,[0,0,-length*.27],.04)
    for(const y of [-height,height]) rod(body,[-front,y,length/2],[front,y,length/2],.012,finish)
    for(const x of [-front,front]) rod(body,[x,-height,length/2],[x,height,length/2],.012,finish)
    block(body,[.24,.075,.26],chrome,[0,-.025,-length/2-.1],.025)
    bolt(body,0,.035,-length/2-.12)
    body.rotation.x = -.16
    stand(group, -.2)
  }
  return batchStatic(group)
}
