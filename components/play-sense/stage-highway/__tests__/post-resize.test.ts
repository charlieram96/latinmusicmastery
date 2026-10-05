import { expect, it } from 'vitest'
import * as THREE from 'three'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { createComposer } from '../miami/post'

it('keeps image smoothing aligned with physical pixels across panel and render-scale changes', () => {
  const renderer = {
    getPixelRatio: () => 2,
    getSize: (size: THREE.Vector2) => size.set(800, 400),
    getDrawingBufferSize: (size: THREE.Vector2) => size.set(1600, 800),
  } as THREE.WebGLRenderer
  const { composer } = createComposer(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), .5)
  try {
    const smoothing = composer.passes.at(-1) as ShaderPass
    expect(smoothing.uniforms.resolution.value.toArray()).toEqual([1 / 1600, 1 / 800])
    composer.setSize(1000, 500)
    expect(smoothing.uniforms.resolution.value.toArray()).toEqual([1 / 2000, 1 / 1000])
    composer.setPixelRatio(1)
    expect(smoothing.uniforms.resolution.value.toArray()).toEqual([1 / 1000, 1 / 500])
  } finally {
    composer.passes.forEach(pass => pass.dispose())
    composer.dispose()
  }
})
