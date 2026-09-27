import * as THREE from 'three'

/**
 * Photographic surface textures (generated, stored under public/playsense/textures).
 * The procedural `fallback` renders immediately; the photo replaces its image in
 * place once decoded, so materials never recompile and nothing waits on the network.
 * Mirrored tiling hides the seams of these non-periodic photographs.
 */
export function photoTexture(url: string, fallback: THREE.Texture, repeat: [number, number], anisotropy: number, color = true) {
  const texture = fallback
  texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping
  texture.repeat.set(...repeat)
  texture.anisotropy = anisotropy
  if (color) texture.colorSpace = THREE.SRGBColorSpace
  new THREE.ImageLoader().load(url, image => {
    // The GPU copy was allocated at the fallback's size; release it so the photo re-uploads.
    texture.dispose()
    texture.image = image
    texture.needsUpdate = true
  }, undefined, () => { /* Keep the procedural surface if the photo is unavailable. */ })
  return texture
}
