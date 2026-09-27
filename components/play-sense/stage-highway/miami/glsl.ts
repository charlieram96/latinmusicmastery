/**
 * Shared GLSL for the Miami bayfront stage. The sky dome, the sea's reflections and the
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
    float h = max(d.y, 0.);
    // Miami after sundown: gold on the waterline, coral and magenta, violet, then navy.
    vec3 away = vec3(.5, .15, .29);
    vec3 toward = vec3(.92, .34, .12);
    vec3 horizon = mix(away, toward, pow(sunAmount, 4.));
    vec3 color = mix(horizon, vec3(.4, .09, .27), smoothstep(0., .1, h));
    color = mix(color, vec3(.1, .04, .19), smoothstep(.07, .34, h));
    color = mix(color, vec3(.01, .014, .055), smoothstep(.3, .9, h));
    color += mix(vec3(.4, .1, .2), vec3(.85, .34, .13), pow(sunAmount, 5.)) * exp(-h * 32.) * .38;
    return d.y < 0. ? mix(horizon * .5, vec3(.03, .02, .05), smoothstep(0., .25, -d.y)) : color;
  }
  /** The sky without clouds or stars: cheap enough for reflections and haze on large surfaces. */
  vec3 psSkyClear(vec3 d) {
    d = normalize(d);
    float sunAmount = max(dot(d, psSunDir), 0.);
    return psSkyBase(d, sunAmount) + vec3(1.1, .4, .16) * pow(sunAmount, 36.) * .2 * smoothstep(-.02, .03, d.y);
  }
  vec3 psSky(vec3 d) {
    d = normalize(d);
    float sunAmount = max(dot(d, psSunDir), 0.);
    vec3 color = psSkyBase(d, sunAmount);
    // The sun has just set: a soft afterglow behind the skyline, no disc to glare.
    color += vec3(1.1, .4, .16) * pow(sunAmount, 36.) * .2 * smoothstep(-.02, .03, d.y);
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
      vec3 rim = mix(vec3(.7, .2, .42), vec3(1.7, .72, .34), lit);
      vec3 shade = mix(vec3(.07, .03, .11), vec3(.32, .09, .16), lit);
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
