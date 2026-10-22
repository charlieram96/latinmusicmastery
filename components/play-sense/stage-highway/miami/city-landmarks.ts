import * as THREE from 'three'
import type { StageCity } from '../cities'
import { SEA_Y } from './sky'

/** Recognizable silhouettes built from actual geometry, with PBR surfaces and lit windows. */
export function cityLandmarks(city: StageCity) {
  const group = new THREE.Group()
  group.position.set(0, SEA_Y, -330)
  const steel = new THREE.MeshStandardMaterial({ color: 0x748495, metalness: .8, roughness: .28 })
  const stone = new THREE.MeshStandardMaterial({ color: 0xaaa294, metalness: .2, roughness: .65 })
  const red = new THREE.MeshStandardMaterial({ color: 0xb74427, metalness: .55, roughness: .4 })
  const glass = new THREE.MeshStandardMaterial({ color: 0x263d51, metalness: .85, roughness: .15 })
  const light = new THREE.MeshStandardMaterial({ color: 0xffdbaa, emissive: 0xffb36a, emissiveIntensity: 1.6 })
  const materials = [steel, stone, red, glass, light]
  const used = new Set<THREE.Material>()
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x:number,y:number,z=0) {
    used.add(material)
    const m = new THREE.Mesh(geometry,material); m.position.set(x,y,z); group.add(m); return m
  }
  function box(x:number,y:number,w:number,h:number,d:number, material=steel,z=0) { return mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z) }
  function spire(x:number,y:number,h:number) { mesh(new THREE.CylinderGeometry(.15,.65,h,8),steel,x,y+h/2) }
  function windows(x:number,width:number,height:number,z:number) {
    const rows=Math.floor(height/3), cols=Math.floor(width/2)
    const m=new THREE.InstancedMesh(new THREE.PlaneGeometry(.65,1),light,rows*cols)
    used.add(light);const t=new THREE.Object3D()
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++) {
      t.position.set(x-width/2+c*2+1,2+r*3,z);t.scale.setScalar((r*7+c*3)%5===0?0:1);t.updateMatrix();m.setMatrixAt(r*cols+c,t.matrix)
    }
    group.add(m)
  }
  if(city==='new-york') {
    // Stepped Art Deco crown, alongside a tapered modern tower.
    const x=-30
    box(x,31,20,62,15,stone); windows(x,20,62,7.6)
    box(x,70,15,16,12,stone);box(x,83,9,10,8,stone);spire(x,88,24)
    mesh(new THREE.CylinderGeometry(3,10,85,4),glass,35,42.5).rotation.y=Math.PI/4;spire(35,85,22)
  } else if(city==='los-angeles') {
    mesh(new THREE.CylinderGeometry(8,9,60,32),glass,-25,30)
    mesh(new THREE.CylinderGeometry(6,8,6,32),light,-25,63)
    box(32,9,42,18,15,stone)
    for(const x of [18,32,46]) mesh(new THREE.SphereGeometry(x===32?7:5,24,12,0,Math.PI*2,0,Math.PI/2),steel,x,18)
    // Low foothill silhouettes behind the observatory.
    for(let i=0;i<6;i++) mesh(new THREE.SphereGeometry(1,24,12),new THREE.MeshStandardMaterial({color:0x344037,roughness:1}),-130+i*48,-3,-50).scale.set(45,15+(i%3)*6,25)
  }
  for(const material of materials)if(!used.has(material))material.dispose()
  return group
}
