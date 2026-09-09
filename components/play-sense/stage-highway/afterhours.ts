import * as THREE from 'three'
import { batchStatic, block, cable, contactShadow, cylinder, hoop, luminous, matte, mesh, metal, rod, textured } from './craft'
import { createConga, createGuitar, createKeyboard, createMicrophone, createTimbale } from './instruments'
import type { Instrument } from '@/lib/play-sense/types'
import { STAGE_THEMES } from './themes'
import { backingPercussion } from './band'

const FLOOR = -3.2

function lightShaft(parent: THREE.Object3D, start: number[], end: number[], color: number) {
  const a=new THREE.Vector3(...start), b=new THREE.Vector3(...end), length=a.distanceTo(b)
  const material=new THREE.ShaderMaterial({
    uniforms:{ tint:{value:new THREE.Color(color)}, length:{value:length} },
    transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec3 vNormal; varying vec3 vView; varying float vHeight;
      uniform float length;
      void main() { vec4 p=modelViewMatrix*vec4(position,1.); vView=-p.xyz;
        vNormal=normalMatrix*normal; vHeight=position.y/length+.5; gl_Position=projectionMatrix*p; }`,
    fragmentShader:`varying vec3 vNormal; varying vec3 vView; varying float vHeight; uniform vec3 tint;
      void main() { float edge=pow(abs(dot(normalize(vNormal),normalize(vView))),1.4);
        float fade=smoothstep(0.,.22,vHeight)*(1.-smoothstep(.85,1.,vHeight));
        gl_FragColor=vec4(tint,edge*fade*.042); }`,
  })
  const beam=new THREE.Mesh(new THREE.ConeGeometry(3.2,length,40,1,true),material)
  beam.position.copy(a.add(b).multiplyScalar(.5))
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...start).sub(new THREE.Vector3(...end)).normalize())
  parent.add(beam)
}

function amplifier(width = 2.3, height = 3) {
  const group = new THREE.Group(), cabinet = textured('cloth','#242828',.87), chrome = metal(0x8d8b79,.4)
  const grille = textured('cloth','#58584b',.86), cone = matte(0x1c2222,.9)
  block(group,[width,height,1.3],cabinet,[0,height/2,0],.09)
  block(group,[width-.18,height-.55,.04],grille,[0,height/2-.1,.68],.035)
  for (const y of [height*.28,height*.67]) {
    const speaker = cylinder(group,width*.32,width*.27,.055,cone,0,y,.717,40); speaker.rotation.x=Math.PI/2
    const surround = hoop(group,width*.32,.035,chrome); surround.rotation.x=0; surround.position.set(0,y,.745)
    mesh(group,new THREE.SphereGeometry(width*.12,24,12),matte(0x303732),0,y,.76).scale.z=.28
  }
  block(group,[width-.13,.22,.035],chrome,[0,height-.21,.69])
  for(let i=0;i<7;i++) cylinder(group,.035,.035,.03,cone,-width*.35+i*width*.11,height-.21,.727,12).rotation.x=Math.PI/2
  block(group,[.04,.04,.015],luminous(0xe8b861,1),[width*.4,height-.21,.72])
  for (const side of [-1,1]) for (const z of [-.45,.45]) block(group,[.14,.12,.18],cone,[side*(width/2-.16),.01,z])
  return group
}

function plant() {
  const group = new THREE.Group(), ceramic=matte(0x69533f,.8), earth=matte(0x24251d), greens=[matte(0x344e3a),matte(0x536043),matte(0x65734e)]
  cylinder(group,.56,.38,.9,ceramic,0,.45); cylinder(group,.49,.49,.02,earth,0,.9)
  for(let i=0;i<19;i++) {
    const a=i*2.4,height=1.5+(i%4)*.33,reach=.65+(i%3)*.15
    const end=[Math.cos(a)*reach,height,Math.sin(a)*reach]
    rod(group,[0,.88,0],end,.013,greens[i%3])
    const leaf = new THREE.Shape(); leaf.moveTo(0,0); leaf.bezierCurveTo(-.28,.4,-.35,.75,0,1.1); leaf.bezierCurveTo(.35,.75,.28,.4,0,0)
    const geometry = new THREE.ShapeGeometry(leaf,6)
    const positions=geometry.getAttribute('position')
    for(let v=0;v<positions.count;v++) positions.setZ(v,Math.sin(positions.getY(v)*2)*.16)
    geometry.computeVertexNormals()
    const leafMesh=mesh(group,geometry,greens[i%3],...end as [number,number,number]); leafMesh.rotation.set(.4,a,.3)
    greens[i%3].side=THREE.DoubleSide
  }
  return group
}

function wallSign() {
  const canvas=document.createElement('canvas'); canvas.width=1536;canvas.height=384
  const ctx=canvas.getContext('2d')!
  ctx.textAlign='center';ctx.fillStyle='#ead6b2';ctx.font='300 146px Georgia, serif';ctx.fillText('PlaySense',768,194)
  ctx.fillStyle='#a79980';ctx.font='400 24px system-ui, sans-serif';ctx.fillText('L A   S A L A   ·   S E S I O N E S   E N   V I V O',768,264)
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(10,2.5),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false,fog:false}))
  // Hang above the front lintel, clear of both the window's depth and curtain rod.
  sign.position.set(0,7.1,-25.05)
  return sign
}

/** A purpose-built courtyard band set. Open center preserves the complete note approach. */
export interface BandAssetSlot { holder: THREE.Group; fallback: THREE.Object3D; name: string; height?: number }
export interface AfterhoursSet {
  group: THREE.Group
  sign: THREE.Mesh
  assetSlots: BandAssetSlot[]
  pulseLights: THREE.PointLight[]
  meters: THREE.Mesh[]
}

export function buildAfterhours(instrument: Instrument): AfterhoursSet {
  const group = new THREE.Group()
  const walnut=textured('wood','#5f4430',.57), trim=matte(0x244a47), plaster=textured('plaster','#8a6251',.95), stone=textured('plaster','#776f58',.9)
  const black=matte(0x172122), bronze=metal(0x988265,.43), amber=luminous(0xffd899,2.2), teal=luminous(0x89c2b4,.7)
  // Individual planks, raised stage edge and end grain anchor everything in one room.
  for(let i=0;i<38;i++) {
    block(group,[.83,.22,40],walnut,[(i-18.5)*.87,FLOOR-.14,-11],.012)
    for(let j=0;j<6;j++) block(group,[.78,.006,.025],black,[(i-18.5)*.87,FLOOR-.022,-28+j*6+(i%3)*1.65])
  }
  block(group,[33,.45,.27],walnut,[0,FLOOR-.24,9.1],.035)
  block(group,[32,.03,.035],amber,[0,FLOOR-.31,9.25])
  block(group,[33,14,.55],plaster,[0,3.7,-31])
  block(group,[33,.3,.9],stone,[0,10.4,-30.85])
  block(group,[33,.55,.6],stone,[0,FLOOR+.4,-30.7])
  for(const side of [-1,1]) {
    block(group,[.6,11.5,39],plaster,[side*16.25,2.45,-11])
    block(group,[.9,.3,39],stone,[side*16.15,8.2,-11])
    for(let i=0;i<4;i++) {
      const z=-25+i*8
      block(group,[.85,10,.85],stone,[side*15.65,1.8,z],.04)
      block(group,[.06,5.7,3.4],black,[side*15.89,2,z+3.1])
      for(let j=0;j<10;j++) block(group,[.12,.11,3.15],trim,[side*15.78,.0+j*.43,z+3.1])
    }
  }
  // Recessed arched windows with shutters and warm interiors.
  for(const x of [-11,-6.7,6.7,11]) {
    block(group,[2.85,5.8,.22],stone,[x,2.45,-30.48],.055)
    block(group,[2.45,5.35,.16],black,[x,2.4,-30.32])
    block(group,[1.25,3.75,.045],luminous(0xbb7847,.3),[x,2.48,-30.22])
    for(const side of [-1,1]) {
      block(group,[.73,4.3,.12],trim,[x+side*.95,2.3,-30.15],.025)
      for(let i=0;i<15;i++) block(group,[.69,.09,.15],stone,[x+side*.95,.4+i*.27,-30.04])
    }
    block(group,[.09,4,.09],stone,[x,2.4,-30.07]); block(group,[1.5,.11,.09],stone,[x,2.4,-30.07])
    const arch = mesh(group,new THREE.TorusGeometry(1.3,.105,8,32,Math.PI),stone,x,5.23,-30.2)
    arch.rotation.z=0
  }
  // A hazy skyline sits above the courtyard rather than an empty black void.
  const skyline=matte(0x223b3d)
  for(let i=0;i<16;i++) {
    const height=7+(i*7%8), x=(i-7.5)*4.6
    block(group,[3.7,height,4],skyline,[x,8+height/2,-40-(i%3)*6])
    block(group,[3.85,.22,4.2],trim,[x,8+height,-40-(i%3)*6])
  }
  // Suspended festoon lamps give scale and connected pools of warm light.
  for(const z of [-9,-23]) {
    cable(group,[[-16,9,z],[-8,7.3,z],[0,6.7,z],[8,7.3,z],[16,9,z]],black,.035)
    for(let i=0;i<13;i++) {
      const x=(i-6)*2.35,y=6.75+Math.pow(x/16,2)*2.25
      rod(group,[x,y,z],[x,y-.3,z],.025,black)
      cylinder(group,.1,.1,.14,bronze,x,y-.33,z,12)
      mesh(group,new THREE.SphereGeometry(.12,12,8),amber,x,y-.47,z)
    }
  }
  for(const side of [-1,1]) {
    for(const z of [-6,-18]) {
      cylinder(group,.13,.13,.42,bronze,side*14.5,4,z)
      block(group,[.42,.68,.36],bronze,[side*14.5,4.3,z],.03)
      block(group,[.27,.48,.38],amber,[side*14.5,4.3,z])
    }
    const palm=plant();palm.position.set(side*12.5,FLOOR,2.3);palm.scale.setScalar(1.6);group.add(palm)
    const backPlant=plant();backPlant.position.set(side*13.7,FLOOR,-21);backPlant.scale.setScalar(1.8);group.add(backPlant)
  }
  // Woven percussion rug and a Latin backline arranged around the student.
  const rug=textured('cloth','#633e32',1)
  block(group,[7.6,.035,6.4],rug,[-9.1,FLOOR+.01,-5.1])
  for(let i=0;i<4;i++) {
    const inset=i*.15, rugTrim=matte(i%2?0x786c50:0x272b27)
    block(group,[7.4-inset*2,.009,.06],rugTrim,[-9.1,FLOOR+.034,-8.17+inset]);block(group,[7.4-inset*2,.009,.06],rugTrim,[-9.1,FLOOR+.034,-2.03-inset])
    for(const side of [-1,1]) block(group,[.06,.009,6.15-inset*2],rugTrim,[-9.1+side*(3.68-inset),FLOOR+.034,-5.1])
  }
  const keys=createKeyboard();keys.position.set(9.55,.05,-9);keys.scale.setScalar(1.28);keys.rotation.y=-.12;group.add(keys)
  const bass=createGuitar();bass.position.set(7.5,-1.7,-.5);bass.scale.setScalar(1.7);bass.rotation.y=-.28;group.add(bass)
  // A padded cradle and folding stand ground the bass in the room.
  rod(group,[7.5,FLOOR+.1,-.78],[7.5,-1.5,-.78],.055,black)
  for(const side of [-1,1]) {
    rod(group,[7.5,FLOOR+.5,-.78],[7.5+side*.65,FLOOR+.04,-.3],.045,black)
    rod(group,[7.5+side*.34,-2.52,-.7],[7.5+side*.34,-2.52,-.12],.065,black)
  }
  rod(group,[7.5,FLOOR+.35,-.78],[7.5,FLOOR+.04,-1.4],.045,black)
  const amp=amplifier();amp.position.set(10.2,FLOOR,-1.6);amp.rotation.y=-.25;group.add(amp)
  const secondAmp=amplifier(2,2.5);secondAmp.position.set(-12.3,FLOOR,-10);secondAmp.rotation.y=.3;group.add(secondAmp)
  const mic=createMicrophone();mic.position.set(-6.8,FLOOR,-5);mic.rotation.y=-.3;group.add(mic)
  const mic2=createMicrophone();mic2.position.set(6.6,FLOOR,-9);mic2.rotation.y=2.1;group.add(mic2)
  for(const side of [-1,1]) {
    const monitor=block(group,[2.2,.8,1.3],black,[side*8.2,FLOOR+.38,4.1],.09);monitor.rotation.x=-.23;monitor.rotation.y=side*-.2
    block(monitor,[1.92,.035,.96],textured('cloth','#44483e',.9),[0,.42,0],.04)
    block(group,[.3,.03,.04],teal,[side*8.2,FLOOR+.12,4.85])
    cable(group,[[side*6.4,FLOOR+.035,.3],[side*6.8,FLOOR+.035,2.5],[side*9,FLOOR+.035,3],[side*10,FLOOR+.035,1],[side*11,FLOOR+.035,-.4]],black)
    contactShadow(group,side*8.8,-4.5,8,8,FLOOR+.025)
    contactShadow(group,side*8.2,4.1,3.3,2.8,FLOOR+.028)
  }
  // Bronze lamps on stands frame the band without crossing the central playing area.
  for(const side of [-1,1]) {
    rod(group,[side*12,FLOOR,-4],[side*12,4.5,-4],.055,bronze)
    const shade=cylinder(group,.27,.64,.48,bronze,side*12,4.4,-4);shade.rotation.z=side*.3
    const lens=cylinder(group,.5,.5,.02,amber,side*12,4.15,-4);lens.rotation.z=side*.3
    lightShaft(group,[side*12,4.1,-4],[side*7,FLOOR,-5],side<0?0xe8b771:0x94c1b4)
  }
  // Ceramic tile runners, a slatted recording booth and a framed descarga poster.
  const tileCream=matte(0xb6a27c,.65), tileBlue=matte(0x316260,.55), tileClay=matte(0x9e5b43,.72)
  for(const side of [-1,1]) for(let row=0;row<19;row++) for(let col=0;col<3;col++) {
    const x=side*(12.1+col*.9),z=5-row*1.8
    block(group,[.86,.025,1.74],(row+col)%2?tileBlue:tileCream,[x,FLOOR+.005,z])
    const diamond=block(group,[.42,.008,.42],tileClay,[x,FLOOR+.022,z]);diamond.rotation.y=Math.PI/4
  }
  for(const side of [-1,1]) {
    block(group,[5.8,7,.28],trim,[side*10,1.5,-19.8],.09)
    for(let i=0;i<20;i++) block(group,[.11,6.6,.18],walnut,[side*10+(i-9.5)*.27,1.5,-19.6],.025)
    block(group,[5.6,.05,.06],amber,[side*10,5,-19.55])
    for(const foot of [-1,1]) {
      block(group,[.14,1.2,.14],bronze,[side*10+foot*1.8,-2.6,-19.8],.025)
      block(group,[.25,.12,1.5],black,[side*10+foot*1.8,FLOOR+.06,-19.8],.04)
    }
  }
  const posterCanvas=document.createElement('canvas');posterCanvas.width=512;posterCanvas.height=768
  const ctx=posterCanvas.getContext('2d')!
  ctx.fillStyle='#183f3d';ctx.fillRect(0,0,512,768)
  ctx.strokeStyle='#d8985f';ctx.lineWidth=3;ctx.strokeRect(24,24,464,720)
  ctx.fillStyle='#e9c691';ctx.textAlign='center';ctx.font='20px sans-serif';ctx.fillText('PLAYSENSE PRESENTA',256,89)
  ctx.font='italic 64px Georgia';ctx.fillText('Descarga',256,170)
  for(let i=0;i<7;i++) {ctx.strokeStyle=i%2?'#dda26c':'#5b9186';ctx.lineWidth=17;ctx.beginPath();ctx.arc(256,395,60+i*21,Math.PI*.06,Math.PI*1.94);ctx.stroke()}
  ctx.fillStyle='#e9c691';ctx.font='20px sans-serif';ctx.fillText('SON  /  SALSA  /  LATIN JAZZ',256,661);ctx.font='16px sans-serif';ctx.fillText('LA SALA · LIVE SESSIONS',256,704)
  const posterMap=new THREE.CanvasTexture(posterCanvas);posterMap.colorSpace=THREE.SRGBColorSpace
  block(group,[3.55,5.3,.18],bronze,[-10,1.5,-19.32],.035)
  mesh(group,new THREE.PlaneGeometry(3.35,5.05),new THREE.MeshBasicMaterial({map:posterMap}),-10,1.5,-19.21)

  // Batch architecture before adding the replaceable Blender instruments and animated meters.
  batchStatic(group)
  const sign=wallSign();group.add(sign)
  const assetSlots: BandAssetSlot[]=[]
  const theme=STAGE_THEMES.studio
  const percussion=backingPercussion(instrument)
  const band=new THREE.Group();band.position.set(-8.5,FLOOR,-6.9);band.rotation.y=.19;group.add(band)
  const standMetal=metal(0xb2b9aa,.26)
  if(percussion==='conga') {
    for(const [i,name] of ['conga','tumba'].entries()) {
      const holder=new THREE.Group();holder.position.set((i-.5)*2.8,3.12+(i===1?.12:0),i===1?-.35:0);band.add(holder)
      const fallback=createConga(theme.colors[i],theme);fallback.scale.setScalar(holder.position.y/1.58);holder.add(fallback)
      assetSlots.push({holder,fallback,name,height:holder.position.y})
    }
  } else {
    for(const [i,name] of ['timbale_macho','timbale_hembra'].entries()) {
      const holder=new THREE.Group();holder.position.set((i-.5)*2.18,3.25,i===0?.1:-.15);band.add(holder)
      const fallback=createTimbale(theme.colors[i],theme);fallback.scale.setScalar(1.58);holder.add(fallback)
      assetSlots.push({holder,fallback,name})
      rod(band,[holder.position.x,.08,holder.position.z],[holder.position.x,2.5,holder.position.z],.065,standMetal)
      for(let f=0;f<3;f++){const a=f*Math.PI*2/3;rod(band,[holder.position.x,.6,holder.position.z],[holder.position.x+Math.cos(a)*.75,.05,holder.position.z+Math.sin(a)*.75],.04,standMetal)}
    }
    // Two mounted bells, clave sticks, and a full chrome crossbar distinguish the timbalero's rig.
    rod(band,[-1.3,3.65,-.85],[1.3,3.65,-.85],.035,standMetal)
    rod(band,[0,.1,-.85],[0,4.15,-.85],.04,standMetal)
    for(const side of [-1,1]) {
      const bell=mesh(band,new THREE.CylinderGeometry(.16,.38,.65,4,1,true),side<0?standMetal:matte(0x332922),side*.55,3.83,-.62)
      bell.rotation.set(Math.PI/2,Math.PI/4,0);bell.scale.z=.6
    }
    for(const side of [-1,1]) rod(band,[side*.15,3.43,.35],[side*.8,3.48,-.3],.032,matte(0xc5a475))
  }
  contactShadow(group,-8.5,-6.9,7,6,FLOOR+.029)
  const pulseLights: THREE.PointLight[]=[]
  const meters: THREE.Mesh[]=[]
  for(const side of [-1,1]) {
    const light=new THREE.PointLight(side<0?0xffb878:0x89dccc,30,14,2);light.position.set(side*8,2.8,-8);group.add(light);pulseLights.push(light)
    for(let i=0;i<12;i++) {
      const bar=block(group,[.12,1,.08],luminous(side<0?0xeeb17a:0x89d5c5,1.2),[side*6.05,-1.4,-4-i*.9],.025)
      bar.castShadow=false;meters.push(bar)
    }
  }
  return {group,sign,assetSlots,pulseLights,meters}
}
