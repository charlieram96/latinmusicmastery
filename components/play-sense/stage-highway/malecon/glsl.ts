/**
 * Shared GLSL for the Malecón stage. The sky dome, the sea's reflections and the
 * one-off environment bake all evaluate the same `psSky`, so every reflection on
 * lacquer, chrome and water agrees with the sky the player actually sees.
 */
export const NOISE = /* glsl */ `
  float psHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float psNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(mix(psHash(i), psHash(i + vec2(1., 0.)), f.x), mix(psHash(i + vec2(0., 1.)), psHash(i + vec2(1., 1.)), f.x), f.y);
  }
  float psFbm(vec2 p) {
    float value = 0., amplitude = .5;
    for (int i = 0; i < 4; i++) { value += amplitude * psNoise(p); p = p * 2.03 + vec2(17.1, 9.2); amplitude *= .5; }
    return value;
  }
`

/** `psSky(direction)` returns linear HDR radiance. Uniforms: psSunDir, psTime, psCloudMotion. */
export const SKY = /* glsl */ `
  uniform vec3 psSunDir;
  uniform float psTime;
  uniform float psCloudMotion;
  ${NOISE}
  vec3 psSkyBase(vec3 d, float sunAmount) {
    float e = d.y;
    vec3 zenith = vec3(.012, .018, .075);
    vec3 upper = vec3(.07, .045, .19);
    vec3 mauve = vec3(.42, .12, .24);
    vec3 ember = vec3(.82, .23, .06);
    vec3 horizon = mix(mauve, ember, pow(sunAmount, 3.));
    // A thin, bright band sits right on the waterline, strongest beneath the sun.
    vec3 band = mix(vec3(.5, .16, .17), vec3(1., .34, .11), pow(sunAmount, 6.));
    float h = max(e, 0.);
    vec3 color = mix(horizon, upper, smoothstep(0., .32, h));
    color = mix(color, zenith, smoothstep(.22, .85, h));
    color += band * exp(-h * 38.) * .55;
    // Below the horizon only the haze remains; the sea covers it in the game view.
    return e < 0. ? mix(horizon * .55, vec3(.05, .04, .08), smoothstep(0., .25, -e)) : color;
  }
  vec3 psSky(vec3 d) {
    d = normalize(d);
    float sunAmount = max(dot(d, psSunDir), 0.);
    vec3 color = psSkyBase(d, sunAmount);
    // Sun: a hot disc with a wide, warm corona.
    color += vec3(2.2, .7, .2) * pow(sunAmount, 90.) * .38;
    color += vec3(1.4, .38, .12) * pow(sunAmount, 8.) * .17;
    float disc = smoothstep(.99968, .99982, sunAmount) * smoothstep(-.004, .002, d.y);
    color = mix(color, vec3(3.6, 1.55, .6), disc);
    if (d.y > 0.) {
      // Two cloud decks projected onto flat planes; they streak naturally toward the horizon.
      vec2 wind = vec2(psTime * .006, psTime * .0025) * psCloudMotion;
      vec2 p = d.xz / (d.y + .045);
      float high = psFbm(p * .55 + wind * 2. + vec2(3., 1.));
      high = smoothstep(.46, .78, high) * smoothstep(.02, .16, d.y) * (1. - smoothstep(.55, .95, d.y));
      vec2 q = p * vec2(.9, 2.2) + wind * 4.;
      float low = psFbm(q) * .7 + psFbm(q * 2.7 + 5.) * .3;
      low = smoothstep(.43, .7, low) * smoothstep(.006, .045, d.y) * (1. - smoothstep(.14, .32, d.y));
      float lit = pow(sunAmount, 4.);
      vec3 rim = mix(vec3(.55, .2, .36), vec3(2.3, .95, .4), lit);
      vec3 shade = mix(vec3(.06, .035, .1), vec3(.3, .09, .12), lit);
      color = mix(color, mix(shade, rim, .45 + .55 * lit), high * .75);
      color = mix(color, mix(shade * .8, rim * 1.1, lit * .85 + .12), low * .9);
      // First stars through the clear upper sky.
      vec2 starPlane = d.xz / (d.y + .3) * 160.;
      vec2 cell = floor(starPlane);
      float point = 1. - smoothstep(.02, .16, length(fract(starPlane) - .5));
      float star = step(.9965, psHash(cell)) * point * smoothstep(.28, .7, d.y) * (1. - high);
      float twinkle = .6 + .4 * sin(psTime * (1.5 + psHash(cell + 3.) * 3.) + psHash(cell) * 40.);
      color += vec3(.9, .95, 1.2) * star * twinkle * 1.4;
    }
    return color;
  }
`
