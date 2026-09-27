(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js');
const PHOTOS = window.__PHOTOS || {};
let LANG = 'en';
const T = (en, es) => LANG === 'es' ? es : en;
const IC = {
  check: '<svg viewBox="0 0 20 20" fill="none"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chev: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg width="12" height="12" viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z" fill="currentColor"/></svg>',
  stop: '<svg width="11" height="11" viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7" rx="1" fill="currentColor"/></svg>',
};

/* ══════════ data ══════════ */
const TEACHERS = {
  alexander: { name: 'Alexander Carriera', inst: 'Percussion · Timbal', fam: 'perc', tags: ['Timba', 'Salsa', 'Son', 'Mambo', 'Cha-cha-chá'] },
  frank: { name: 'Frank La Rosa', inst: 'Congas', fam: 'perc', tags: ['Rumba', 'Son Cubano', 'Timba', 'Cha-cha-chá'] },
  leo: { name: 'Leo Garcia', inst: 'Timbal', fam: 'perc', tags: [] },
  leysa: { name: 'Leysa Reyes', inst: 'Piano · Accordion', fam: 'keys', tags: ['Bolero', 'Cumbia', 'Son'] },
  livan: { name: 'Livan Mesa', inst: 'Piano', fam: 'keys', tags: ['Son', 'Bolero', 'Salsa', 'Timba'] },
  manuel: { name: 'Manuel Orza', inst: 'Bass', fam: 'bass', tags: [] },
  mariela: { name: 'Mariela Suárez', inst: 'Piano · Violin', fam: 'keys', tags: [] },
  mauricio: { name: 'Mauricio Upmann', inst: 'Congas', fam: 'perc', tags: [] },
  miguel: { name: 'Miguel Ruiz', inst: 'Minor Percussion', fam: 'perc', tags: ['Son', 'Guaracha', 'Guaguancó', 'Mambo', 'Danzón', 'Songo', 'Timba'] },
  miriam: { name: 'Miriam Mar', inst: 'Voice', fam: 'voice', tags: ['Son', 'Filin', 'Bolero', 'Latin Jazz'] },
  niuver: { name: 'Niuver Usa', inst: 'Guitar · Tres', fam: 'strings', tags: ['Son Cubano', 'Bolero'] },
  orlando: { name: 'Orlando Guanche', inst: 'Piano', fam: 'keys', tags: [] },
  patricio: { name: 'Patricio “El Chino” Díaz', inst: 'Timbal', fam: 'perc', tags: ['Son', 'Salsa', 'Changüí', 'Songo'] },
  raffy: { name: 'Raffy Pérez', inst: 'Saxophone · Piano · EWI', fam: 'horns', tags: ['Latin Jazz'] },
  rolando: { name: 'Rolando Morejón', inst: 'Violin', fam: 'strings', tags: ['Cha-cha-chá', 'Bolero', 'Filin', 'Latin Jazz'] },
  thommy: { name: 'Thommy Lowry García', inst: 'Trumpet', fam: 'horns', tags: ['Jazz', 'Afro-Cuban', 'Salsa', 'Timba'] },
  yancarlos: { name: 'Yan Carlos Artime', inst: 'Piano', fam: 'keys', tags: [] },
  yorgis: { name: 'Yorgis Goiricelaya', inst: 'Bass', fam: 'bass', tags: ['Son', 'Mambo', 'Guaracha', 'Salsa', 'Timba'] },
};
const TEACHER_ORDER = ['frank', 'patricio', 'livan', 'miriam', 'yorgis', 'thommy', 'leysa', 'alexander', 'rolando', 'raffy', 'niuver', 'miguel', 'leo', 'manuel', 'yancarlos', 'mariela', 'orlando', 'mauricio'];

const SEATS = [
  { id: 'timbal', name: 'Timbal', es: 'Timbal', x: 450, y: 130, glyph: 'timbal', ch: 'CH 01–04', teachers: ['leo', 'patricio', 'alexander'], note: 'Cáscara, abanicos and the bell that drives the mambo.', noteEs: 'Cáscara, abanicos y la campana que empuja el mambo.', courses: ['Son Cubano', 'Timba', 'Mambo', 'Rumba', 'Danzón', 'Bolero Cubano', 'Cha-Cha-Cha', 'Salsa Cubana', 'Bomba', 'Plena'] },
  { id: 'conga', name: 'Congas', es: 'Congas', x: 290, y: 130, glyph: 'conga', ch: 'CH 05–07', groove: 'conga', teachers: ['frank', 'mauricio'], note: 'The tumbao: slap on two, open tones on four-and.', noteEs: 'El tumbao: slap en el dos, tonos abiertos en el cuatro-y.', courses: ['Son Cubano', 'Rumba', 'Timba', 'Mambo', 'Guajira', 'Danzón', 'Bolero Cubano', 'Cha-Cha-Cha', 'Salsa Cubana', 'Latin Jazz', 'Bomba', 'Plena', 'Reggaeton'] },
  { id: 'minor', name: 'Minor Perc.', es: 'Percusión menor', x: 612, y: 130, glyph: 'bongo', ch: 'CH 08–09', groove: 'campana', teachers: ['miguel', 'alexander'], note: 'Bongó, campana, güiro, maracas. The bongocero takes the bell in the montuno.', noteEs: 'Bongó, campana, güiro, maracas. El bongosero toma la campana en el montuno.', courses: ['Son Cubano', 'Mambo', 'Guajira', 'Bolero Cubano'] },
  { id: 'drums', name: 'Drums', es: 'Batería', x: 770, y: 130, glyph: 'drums', ch: 'CH 10–16', teachers: [], note: 'Songo, timba and Latin jazz grooves on the kit.', noteEs: 'Songo, timba y latin jazz en la batería.', courses: ['Timba', 'Mambo', 'Salsa Cubana', 'Latin Jazz', 'Reggaeton'] },
  { id: 'piano', name: 'Piano', es: 'Piano', x: 130, y: 300, glyph: 'piano', ch: 'CH 17–18', groove: 'piano', teachers: ['livan', 'yancarlos', 'orlando', 'mariela', 'leysa'], note: 'Montunos, guajeos and the harmony under the coro.', noteEs: 'Montunos, guajeos y la armonía bajo el coro.', courses: ['Son Cubano', 'Timba', 'Mambo', 'Danzón', 'Bolero Cubano', 'Cha-Cha-Cha', 'Salsa Cubana', 'Latin Jazz', 'Bomba', 'Plena', 'Reggaeton'] },
  { id: 'bass', name: 'Bass', es: 'Bajo', x: 290, y: 300, glyph: 'bass', ch: 'CH 19', groove: 'bajo', teachers: ['manuel', 'yorgis'], note: 'The anticipated tumbao that never lands on one.', noteEs: 'El tumbao anticipado que nunca cae en el uno.', courses: ['Son Cubano', 'Timba', 'Mambo', 'Danzón', 'Bolero Cubano', 'Cha-Cha-Cha', 'Salsa Cubana', 'Latin Jazz', 'Bomba', 'Plena', 'Reggaeton'] },
  { id: 'tres', name: 'Tres', es: 'Tres', x: 540, y: 300, glyph: 'tres', ch: 'CH 20', teachers: ['niuver'], note: 'Three doubled courses and the guajeo at the heart of son.', noteEs: 'Tres órdenes dobles y el guajeo en el corazón del son.', courses: ['Son Cubano', 'Guajira'] },
  { id: 'guitar', name: 'Guitar', es: 'Guitarra', x: 668, y: 300, glyph: 'guitar', ch: 'CH 21', teachers: ['niuver'], note: 'Rasgueo, guajira strumming and bolero voicings.', noteEs: 'Rasgueo, guajira y voicings de bolero.', courses: ['Son Cubano', 'Guajira'] },
  { id: 'violin', name: 'Violin', es: 'Violín', x: 796, y: 300, glyph: 'violin', ch: 'CH 22', teachers: ['rolando', 'mariela'], note: 'The charanga string section: danzón and cha-cha-chá.', noteEs: 'La cuerda de la charanga: danzón y cha-cha-chá.', courses: ['Danzón', 'Cha-Cha-Cha'] },
  { id: 'sax', name: 'Sax', es: 'Saxo', x: 215, y: 450, glyph: 'horn', ch: 'CH 23', teachers: ['raffy'], soon: true, note: 'Mambo lines, moñas and Latin jazz solos.', noteEs: 'Líneas de mambo, moñas y solos de latin jazz.', courses: [] },
  { id: 'trumpet', name: 'Trumpet', es: 'Trompeta', x: 350, y: 450, glyph: 'horn', ch: 'CH 24', teachers: ['thommy'], soon: true, note: 'Section playing, moñas and the high lead line.', noteEs: 'Sección de metales, moñas y la primera voz aguda.', courses: [] },
  { id: 'voice', name: 'Voz', es: 'Voz', x: 520, y: 450, glyph: 'mic', ch: 'CH 25–27', groove: 'clave', teachers: ['miriam'], soon: true, note: 'The sonero sings the pregón and plays the clave.', noteEs: 'El sonero canta el pregón y toca la clave.', courses: [] },
];
const COUNTRY_OF = { 'Son Cubano': 'CU', Timba: 'CU', Mambo: 'CU', Rumba: 'CU', Danzón: 'CU', 'Bolero Cubano': 'CU', 'Cha-Cha-Cha': 'CU', 'Salsa Cubana': 'CU', Guajira: 'CU', 'Latin Jazz': 'CU', Bomba: 'PR', Plena: 'PR', Reggaeton: 'PR' };
const COURSES = [];
SEATS.filter(s => s.courses.length).forEach(s => {
  COURSES.push({ style: 'Fundamentals', inst: s.id, instName: s.name, country: '', fund: true });
  s.courses.forEach(st => COURSES.push({ style: st, inst: s.id, instName: s.name, country: COUNTRY_OF[st] }));
});
const ATLAS = [
  { code: 'CU', name: 'Cuba', geo: 'La Habana · 23.11°N 82.37°W', c: '#FFA524', styles: [['Son Cubano', 1], ['Timba', 1], ['Mambo', 1], ['Rumba', 1], ['Danzón', 1], ['Bolero Cubano', 1], ['Cha-Cha-Cha', 1], ['Salsa Cubana', 1], ['Guajira', 1], ['Latin Jazz', 1], ['Guaracha', 0], ['Songo', 0], ['Mozambique', 0], ['Fusión Latina', 0]] },
  { code: 'PR', name: 'Puerto Rico', geo: 'San Juan · 18.47°N 66.11°W', c: '#FF324D', styles: [['Bomba', 1], ['Plena', 1], ['Reggaeton', 1]] },
  { code: 'DO', name: 'República Dominicana', geo: 'Santo Domingo · 18.49°N 69.93°W', c: '#A58BFF', styles: [['Bachata', 0], ['Merengue Típico', 0], ['Merengue Moderno', 0], ['Perico Ripiao', 0]] },
  { code: 'CO', name: 'Colombia', geo: 'Barranquilla · 10.97°N 74.80°W', c: '#2FD1B5', styles: [['Cumbia', 0], ['Vallenato', 0], ['Salsa Colombiana', 0]] },
];

/* record-sleeve covers */
const SLEEVES = [
  { bg: '#FFA524', ink: '#1A0B0F' }, { bg: '#FF324D', ink: '#FFF3E6' }, { bg: '#2FD1B5', ink: '#0B1A17' }, { bg: '#A58BFF', ink: '#140A26' },
  { bg: '#F6EBDD', ink: '#1A0B0F' }, { bg: '#2C1E31', ink: '#FFA524' }, { bg: '#1F3B63', ink: '#FFC94D' }, { bg: '#7A1E2E', ink: '#F6EBDD' }, { bg: '#FFC94D', ink: '#2A120C' },
];
const MOTIFS = [
  mc => `radial-gradient(circle at 78% 30%,transparent 0 16%,${mc} 16% 17.5%,transparent 17.5% 25%,${mc} 25% 26.5%,transparent 26.5% 34%,${mc} 34% 35.5%,transparent 35.5%)`,
  mc => `linear-gradient(180deg,transparent 52%,var(--bg) 52%),repeating-linear-gradient(90deg,${mc} 0 7%,transparent 7% 12.5%)`,
  mc => `radial-gradient(circle at 50% 108%,${mc} 0 44%,transparent 44.5%)`,
  mc => `radial-gradient(circle,${mc} 0 7px,transparent 7.5px) 12px 12px/34px 34px`,
  mc => `repeating-linear-gradient(-35deg,${mc} 0 12px,transparent 12px 30px)`,
  mc => `radial-gradient(circle at 70% 32%,${mc} 0 28%,transparent 28.5%),radial-gradient(circle at 70% 32%,transparent 0 34%,${mc} 34% 35%,transparent 35.5%)`,
];
const hashStr = s => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
function sleeve(title, tl, tr, seed) {
  const h = hashStr(seed), sv = SLEEVES[h % SLEEVES.length], m = MOTIFS[(h >>> 4) % MOTIFS.length];
  const mc = `color-mix(in srgb,${sv.ink} 16%,transparent)`;
  return `<div class="sleeve" style="--bg:${sv.bg};--ink:${sv.ink};--motif:${m(mc)}"><span class="si">${tl}</span><span class="sc">${tr}</span><span class="st">${title}</span></div>`;
}

/* ══════════ groove engine (sound only when asked) ══════════ */
const INST = [
  { id: 'clave', name: 'Clave', es: 'Clave', c: '#F6EBDD', part: 'Son clave', partEs: 'Clave de son' },
  { id: 'campana', name: 'Campana', es: 'Campana', c: '#FFC94D', part: 'Bongó bell', partEs: 'Campana' },
  { id: 'conga', name: 'Conga', es: 'Conga', c: '#FF5A48', part: 'Tumbao', partEs: 'Tumbao' },
  { id: 'bajo', name: 'Bass', es: 'Bajo', c: '#2FD1B5', part: 'Tumbao', partEs: 'Tumbao' },
  { id: 'piano', name: 'Piano', es: 'Piano', c: '#A58BFF', part: 'Montuno', partEs: 'Montuno' },
];
const CLAVES = { son32: [0, 3, 6, 10, 12], son23: [2, 4, 8, 11, 14], rumba32: [0, 3, 7, 10, 12] };
const CHORDS = ['C', 'F', 'G', 'F'];
const ROOT = { C: 48, F: 41, G: 43 };
const VOICE = { C: { h: [64, 67, 72], l: [60, 72] }, F: { h: [65, 69, 72], l: [53, 65] }, G: { h: [62, 67, 71], l: [55, 67] } };
const chordAt = s => CHORDS[Math.floor(((s % 16) + 16) % 16 / 4)];
const antic = s => s % 4 === 3 ? chordAt(s + 1) : chordAt(s);
const PAT = {
  clave: Array(16).fill(0),
  campana: [1, 0, .55, 0, 1, 0, .55, 0, 1, 0, .55, 0, 1, 0, .55, 0],
  conga: ['h', 'h', 's', 'h', 'h', 'h', 'o', 'O', 'h', 'h', 's', 'h', 'h', 'h', 'o', 'O'],
  bajo: [0, 0, 0, 41, 0, 0, 43, 0, 0, 0, 0, 41, 0, 0, 48, 0],
  piano: [0, 'l', 0, 'h', 'l', 0, 'h', 'l', 0, 'l', 0, 'h', 'l', 0, 'h', 'l'],
};
function setClave(k) { PAT.clave = Array(16).fill(0); CLAVES[k].forEach(i => PAT.clave[i] = 1); }
setClave('son32');
const vel = (id, s) => {
  const v = PAT[id][s];
  if (!v) return 0;
  if (id === 'conga') return v === 'h' ? .32 : v === 's' ? .78 : 1;
  if (id === 'piano') return v === 'h' ? .9 : .7;
  if (id === 'bajo') return 1;
  return v;
};
const G = { bpm: 184, playing: false, step: -1, muted: new Set(), subs: [], queue: [], next: 0, nextTime: 0 };
const stepDur = () => 60 / G.bpm / 2;
const on = fn => G.subs.push(fn);

let AC = null, MASTER, NB, BUS = {};
function initAudio() {
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  const comp = AC.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .2;
  MASTER = AC.createGain(); MASTER.gain.value = .85; MASTER.connect(comp); comp.connect(AC.destination);
  NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
  const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const len = AC.sampleRate * 1.9, ir = AC.createBuffer(2, len, AC.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const x = ir.getChannelData(ch); for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  const rev = AC.createConvolver(); rev.buffer = ir;
  const revIn = AC.createGain(); revIn.gain.value = .9; revIn.connect(rev); rev.connect(MASTER);
  const pans = { clave: .32, campana: -.38, conga: .45, bajo: 0, piano: -.22 };
  const sends = { clave: .25, campana: .2, conga: .22, bajo: .05, piano: .28 };
  INST.forEach(({ id }) => {
    const g = AC.createGain(); const p = AC.createStereoPanner ? AC.createStereoPanner() : null;
    if (p) { p.pan.value = pans[id]; g.connect(p); p.connect(MASTER); } else g.connect(MASTER);
    const s = AC.createGain(); s.gain.value = sends[id]; g.connect(s); s.connect(revIn);
    BUS[id] = g;
  });
}
function env(g, t, peak, dec, att = .002) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, .0002), t + att); g.gain.exponentialRampToValueAtTime(.0001, t + dec); }
function osc(type, f, t, peak, dec, dest, f2) {
  const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + .04);
  const g = AC.createGain(); env(g, t, peak, dec); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dec + .05);
}
function noise(t, dec, peak, type, f, q, dest) {
  const s = AC.createBufferSource(); s.buffer = NB;
  const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = AC.createGain(); env(g, t, peak, dec, .001); s.connect(fl); fl.connect(g); g.connect(dest);
  s.start(t, Math.random() * .5); s.stop(t + dec + .05);
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const SOUND = {
  clave(t, v) { const b = BUS.clave; osc('sine', 2480, t, .42 * v, .07, b); osc('triangle', 1650, t, .08 * v, .035, b); noise(t, .012, .12, 'bandpass', 4200, 2, b); },
  campana(t, v) {
    const b = BUS.campana, bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = .9;
    const g = AC.createGain(); env(g, t, .2 * v, v > .8 ? .32 : .16); bp.connect(g); g.connect(b);
    [587, 845].forEach(f => { const o = AC.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(bp); o.start(t); o.stop(t + .4); });
  },
  conga(t, _v, s) {
    const b = BUS.conga, k = PAT.conga[s];
    if (k === 'h') osc('sine', 118, t, .16, .07, b);
    else if (k === 's') { noise(t, .07, .5, 'bandpass', 1900, 1, b); osc('sine', 390, t, .28, .06, b); }
    else { const f = k === 'O' ? 196 : 262; osc('sine', f * 1.12, t, .72, .42, b, f); noise(t, .02, .08, 'bandpass', 900, 1, b); }
  },
  bajo(t, _v, s) {
    const b = BUS.bajo, f = hz(PAT.bajo[s]), dur = stepDur() * 2.6;
    osc('sine', f, t, .62, dur + .25, b); osc('triangle', f * 2, t, .1, dur * .6, b);
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1100, t); lp.frequency.exponentialRampToValueAtTime(260, t + .15); lp.connect(b);
    osc('sawtooth', f, t, .09, .18, lp);
  },
  piano(t, v, s) {
    const b = BUS.piano, notes = VOICE[antic(s)][PAT.piano[s]] || VOICE[antic(s)].h;
    notes.forEach((m, i) => { const f = hz(m); osc('triangle', f, t + i * .004, .075 * v, .95, b); osc('sine', f * 2, t + i * .004, .025 * v, .45, b); });
    noise(t, .01, .04, 'highpass', 5000, .7, b);
  },
};
let schedTimer = null;
function schedule() {
  while (G.nextTime < AC.currentTime + .12) {
    const s = G.next, t = G.nextTime;
    INST.forEach(({ id }) => { const v = vel(id, s); if (v && !G.muted.has(id)) SOUND[id](t, v, s); });
    G.queue.push({ s, t });
    G.nextTime += stepDur(); G.next = (s + 1) % 16;
  }
}
function playGroove() {
  initAudio(); if (AC.state === 'suspended') AC.resume();
  G.playing = true; G.queue = []; G.next = 0; G.nextTime = AC.currentTime + .08;
  clearInterval(schedTimer); schedTimer = setInterval(schedule, 25); schedule();
  updateSeqUI();
}
function stopGroove() {
  G.playing = false; clearInterval(schedTimer); G.queue = []; G.step = -1;
  if (AC) AC.suspend();
  G.subs.forEach(fn => fn(-1, {}));
  updateSeqUI();
}
function pumpGroove() {
  if (!G.playing) return;
  while (G.queue.length && G.queue[0].t <= AC.currentTime) {
    const ev = G.queue.shift(); G.step = ev.s;
    const hits = {}; INST.forEach(({ id }) => { const v = vel(id, ev.s); if (v && !G.muted.has(id)) hits[id] = v; });
    G.subs.forEach(fn => fn(ev.s, hits));
  }
}

/* sequencer grid */
function renderSeq() {
  const rows = $('#seqRows'); if (!rows) return;
  rows.innerHTML = INST.map(i => `<div class="seq-row${G.muted.has(i.id) ? ' muted' : ''}" data-id="${i.id}" style="--c:${i.c}">
    <button type="button" class="seq-lbl" aria-pressed="${!G.muted.has(i.id)}"><b><i></i>${LANG === 'es' ? i.es : i.name}</b><span>${LANG === 'es' ? i.partEs : i.part}</span></button>
    <div class="cells">${Array.from({ length: 16 }, (_, s) => { const v = vel(i.id, s); return `<button type="button" data-s="${s}" class="${v ? 'on' : ''}${G.step === s ? ' now' : ''}" style="--v:${v}" aria-label="${i.name} step ${s + 1}${v ? ' on' : ''}"></button>`; }).join('')}</div></div>`).join('');
  $('#seqCounts').innerHTML = Array.from({ length: 16 }, (_, s) => s % 2 ? '<span>&amp;</span>' : `<b>${(s % 8) / 2 + 1}</b>`).join('');
}
function updateSeqUI() {
  const ic = $('#seqIcon'), lb = $('#seqLbl'); if (!ic) return;
  ic.innerHTML = G.playing ? IC.stop : IC.play;
  lb.textContent = G.playing ? T('Stop', 'Parar') : T('Hear the groove', 'Escuchar el groove');
}
function wireSeq() {
  const seq = $('#seq'); if (!seq) return;
  seq.addEventListener('click', e => {
    const lbl = e.target.closest('.seq-lbl');
    if (lbl) { const id = lbl.closest('.seq-row').dataset.id; G.muted.has(id) ? G.muted.delete(id) : G.muted.add(id); renderSeq(); return; }
    const cell = e.target.closest('.cells button');
    if (cell) {
      const id = cell.closest('.seq-row').dataset.id, s = +cell.dataset.s, cur = PAT[id][s];
      if (id === 'conga') PAT.conga[s] = cur === 'h' || !cur ? 'o' : cur === 'o' ? 's' : 0;
      else if (id === 'bajo') PAT.bajo[s] = cur ? 0 : ROOT[chordAt(s + 1)];
      else if (id === 'piano') PAT.piano[s] = cur ? 0 : 'h';
      else if (id === 'campana') PAT.campana[s] = cur ? 0 : (s % 4 === 0 ? 1 : .55);
      else { PAT.clave[s] = cur ? 0 : 1; $$('#claveSeg button').forEach(b => b.setAttribute('aria-pressed', 'false')); }
      if (G.playing && PAT[id][s] && !G.muted.has(id)) SOUND[id](AC.currentTime + .01, vel(id, s), s);
      renderSeq();
    }
  });
  $('#seqPlay').addEventListener('click', () => G.playing ? stopGroove() : playGroove());
  $('#claveSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    setClave(b.dataset.clave); $$('#claveSeg button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderSeq();
  });
  const upd = () => { $('#bpm').innerHTML = `<b>${G.bpm}</b> BPM`; };
  $('#bpmDown').addEventListener('click', () => { G.bpm = Math.max(120, G.bpm - 8); upd(); });
  $('#bpmUp').addEventListener('click', () => { G.bpm = Math.min(232, G.bpm + 8); upd(); });
  let lastNow = [];
  on(s => {
    lastNow.forEach(c => c.classList.remove('now'));
    lastNow = s < 0 ? [] : $$(`#seqRows .cells button[data-s="${s}"]`);
    lastNow.forEach(c => c.classList.add('now'));
    if (s >= 0) $('#chord').textContent = antic(s);
  });
}

/* ══════════ stage plot ══════════ */
const glyphs = {
  timbal: '<circle class="g" cx="-18" cy="0" r="16"/><circle class="g" cx="18" cy="2" r="18"/><rect class="gf" x="-5" y="-26" width="10" height="7" rx="2"/><circle class="g" cx="-44" cy="-14" r="9"/>',
  conga: '<circle class="g" cx="-24" cy="4" r="14"/><circle class="g" cx="4" cy="-8" r="15"/><circle class="g" cx="30" cy="6" r="16"/>',
  bongo: '<circle class="g" cx="-10" cy="0" r="11"/><circle class="g" cx="13" cy="0" r="13"/><rect class="gf" x="-28" y="-24" width="12" height="8" rx="2"/><ellipse class="g" cx="30" cy="-18" rx="9" ry="5"/>',
  drums: '<circle class="g" cx="0" cy="8" r="20"/><circle class="g" cx="-26" cy="-12" r="10"/><circle class="g" cx="24" cy="-14" r="11"/><circle class="g" cx="-38" cy="16" r="13" stroke-dasharray="3 3"/><circle class="g" cx="40" cy="12" r="14" stroke-dasharray="3 3"/>',
  piano: '<path class="g" d="M-50 -32h54c24 0 40 15 40 34v0c0 17-11 28-28 28h-66z"/><path class="g" d="M-50 -32v60" stroke-width="5" stroke-dasharray="2 3"/>',
  bass: '<path class="g" d="M-10 22c-12 0-16-10-12-18s0-12 6-16 6-12 16-12 12 8 10 14-6 8-2 14-4 18-18 18z"/><path class="g" d="M4 -22l18 -34"/>',
  tres: '<circle class="g" cx="-6" cy="8" r="17"/><circle class="gf" cx="-6" cy="8" r="4"/><path class="g" d="M8 -2l26 -36"/>',
  guitar: '<path class="g" d="M-8 24c-14 0-20-12-14-22 4-6 0-12 8-16s10-10 18-8 10 10 6 16 2 12-4 20-6 10-14 10z"/><path class="g" d="M8 -12l24 -30"/>',
  violin: '<path class="g" d="M-3 18c-9 0-12-7-9-13s0-8 4-11 4-8 10-8 8 6 6 9-3 6 0 10-2 13-11 13z"/><path class="g" d="M6 -14l14 -22"/><path class="g" d="M-22 -18l44 30"/>',
  horn: '<path class="g" d="M-26 0h30l14 -12v24l-14 -12"/><circle class="g" cx="-14" cy="-8" r="3"/><circle class="g" cx="-4" cy="-8" r="3"/><circle class="g" cx="6" cy="-8" r="3"/>',
  mic: '<circle class="g" cx="0" cy="-6" r="10"/><circle class="gf" cx="0" cy="-6" r="4"/><path class="g" d="M0 4v22M-14 26h28"/>',
};
let selSeat = 'conga';
function buildPlot() {
  const svg = $('#plotSvg'); if (!svg) return;
  svg.setAttribute('viewBox', '0 0 900 620');
  let h = `<defs><linearGradient id="apron" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(246,235,221,.05)"/><stop offset="1" stop-color="rgba(246,235,221,0)"/></linearGradient></defs>
  <path d="M30 40h840v480q-420 90-840 0z" fill="url(#apron)" stroke="rgba(246,235,221,.18)" stroke-dasharray="6 6"/>
  <rect x="206" y="66" width="650" height="160" rx="10" fill="rgba(246,235,221,.025)" stroke="rgba(246,235,221,.12)"/>
  <text x="842" y="86" text-anchor="end" fill="rgba(246,235,221,.35)" style="font:500 10px 'DM Mono',monospace;letter-spacing:.14em">RISER 8′×24′ · +16″</text>
  <text x="450" y="604" text-anchor="middle" fill="rgba(246,235,221,.35)" style="font:500 11px 'DM Mono',monospace;letter-spacing:.3em">▼ AUDIENCE ▼</text>`;
  SEATS.forEach(s => {
    h += `<g class="seat${s.soon ? ' soon' : ''}" data-id="${s.id}" transform="translate(${s.x} ${s.y})" tabindex="0" role="button" aria-label="${s.name}">
      <rect class="pad" x="-62" y="-50" width="124" height="100" rx="18"/>
      ${glyphs[s.glyph]}
      <text y="72" text-anchor="middle">${s.name}</text>
      <text y="86" text-anchor="middle" class="ch">${s.ch}${s.soon ? ' · SOON' : ''}</text>
    </g>`;
  });
  svg.innerHTML = h;
  svg.addEventListener('click', e => { const g = e.target.closest('.seat'); if (g) renderPanel(g.dataset.id, true); });
  svg.addEventListener('keydown', e => { const g = e.target.closest('.seat'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); renderPanel(g.dataset.id, true); } });
}
const avatar = k => PHOTOS[k] ? `<img src="${PHOTOS[k]}" alt="">` : '<span class="ph"></span>';
function renderPanel(id, anim) {
  selSeat = id;
  const s = SEATS.find(x => x.id === id), p = $('#seatPanel'); if (!p) return;
  $$('.seat').forEach(g => g.classList.toggle('sel', g.dataset.id === id));
  const n = s.courses.length ? s.courses.length + 1 : 0;
  const chips = s.courses.length
    ? `<span class="chip base">${T('Fundamentals', 'Fundamentos')}</span>` + s.courses.map((c, i) => `<span class="chip" style="animation-delay:${anim ? (i + 1) * 28 : 0}ms">${c}</span>`).join('')
    : `<span class="chip soon">${T('Courses in production', 'Cursos en producción')}</span>`;
  const tch = s.teachers.length
    ? `<div class="teachers">${s.teachers.map((k, i) => `<div class="tch" style="animation-delay:${anim ? i * 50 : 0}ms">${avatar(k)}<div><b>${TEACHERS[k].name}</b><span>${TEACHERS[k].inst}</span></div></div>`).join('')}</div>`
    : `<p style="color:var(--humo-2);font-size:14px">${T('Instructor to be announced.', 'Instructor por anunciar.')}</p>`;
  p.innerHTML = `
    <div class="sp-top"><div><div class="sp-name">${LANG === 'es' ? s.es : s.name}</div><p class="sp-note">${LANG === 'es' ? s.noteEs : s.note}</p></div>
    <div class="sp-count"><b class="tnum">${n || '—'}</b><span>${n ? T('courses', 'cursos') : T('coming soon', 'próximamente')}</span></div></div>
    <div><p class="sp-label" style="margin-bottom:10px">${T('Courses', 'Cursos')}</p><div class="chips">${chips}</div></div>
    <div><p class="sp-label" style="margin-bottom:10px">${T('Taught by', 'Con')}</p>${tch}</div>
    <div class="sp-cta">${s.courses.length
      ? `<a class="btn btn-hot" href="#explore" data-inst="${s.id}">${T('Browse ' + s.name + ' courses', 'Ver cursos de ' + s.es)}</a><small>${T('Fundamentals included', 'Fundamentos incluidos')}</small>`
      : `<a class="btn btn-ghost" href="#join">${T('Get notified', 'Avísame')}</a>`}</div>`;
  const cta = p.querySelector('[data-inst]');
  if (cta) cta.addEventListener('click', () => { EX.inst = s.id; });
}

/* ══════════ atlas, marquee ══════════ */
function renderAtlas() {
  const el = $('#atlasGrid'); if (!el) return;
  el.innerHTML = ATLAS.map(c => {
    const live = c.styles.filter(s => s[1]).length;
    return `<article class="ctry" style="--cc:${c.c}">
      <div class="ctry-code">${c.code}</div>
      <h3 class="ctry-name">${c.name}</h3>
      <p class="ctry-geo">${c.geo}</p>
      <ul class="styles">${c.styles.map(([n, l]) => `<li class="${l ? 'live' : 'soon'}">${n === 'Son Cubano' ? `<a href="#son-cubano" style="text-decoration:none">${n} →</a>` : n}<span>${l ? T('● Live', '● Disponible') : T('Coming soon', 'Próximamente')}</span></li>`).join('')}</ul>
      <p class="ctry-geo" style="margin-top:14px">${live}/${c.styles.length} ${T('styles live', 'estilos disponibles')}</p>
    </article>`;
  }).join('');
}
const MQ1 = [['Son Cubano', 'CU'], ['Timba', 'CU'], ['Bomba', 'PR'], ['Mambo', 'CU'], ['Danzón', 'CU'], ['Plena', 'PR'], ['Rumba', 'CU'], ['Bachata', 'DO'], ['Cha-Cha-Chá', 'CU'], ['Cumbia', 'CO'], ['Bolero', 'CU'], ['Guajira', 'CU'], ['Latin Jazz', 'CU'], ['Merengue', 'DO']];
(() => {
  const cd = '<span class="cdots" aria-hidden="true">' + [1, 0, 1, 1, 0, 1].map(x => `<i class="${x ? 'x' : ''}"></i>`).join('') + '</span>';
  const one = MQ1.map(([n, c], i) => `<span class="mq-item"><span class="${i % 2 ? 'o' : ''}">${n}</span><sup>${c}</sup>${cd}</span>`).join('');
  const el = $('#mq1'); if (el) el.innerHTML = one + one;
})();

/* ══════════ maestros ══════════ */
function mcCard(k, href) {
  const t = TEACHERS[k];
  return `<article class="mc" tabindex="0" data-fam="${t.fam}" ${href ? `data-href="${href}" style="cursor:pointer"` : ''}>
    ${PHOTOS[k] ? `<img src="${PHOTOS[k]}" alt="${t.name}" draggable="false">` : ''}
    <div class="mc-body"><p class="mc-inst">${t.inst}</p><h3 class="mc-name">${t.name}</h3>
    ${t.tags.length ? `<div class="mc-tags">${t.tags.map(x => `<span>${x}</span>`).join('')}</div>` : ''}</div>
  </article>`;
}
function renderMaestros() { const r = $('#mRail'); if (r) r.innerHTML = TEACHER_ORDER.map(k => mcCard(k, k === 'patricio' ? '#patricio' : '')).join(''); }
let drag = null;
document.addEventListener('pointermove', e => {
  const c = e.target.closest && e.target.closest('.mc'); if (!c) return;
  const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  c.style.setProperty('--mx', x * 100 + '%'); c.style.setProperty('--my', y * 100 + '%');
  if (!REDUCE) { c.style.setProperty('--ry', ((x - .5) * 6).toFixed(2) + 'deg'); c.style.setProperty('--rx', ((.5 - y) * 4).toFixed(2) + 'deg'); }
});
document.addEventListener('pointerout', e => { const c = e.target.closest && e.target.closest('.mc'); if (c && !c.contains(e.relatedTarget)) { c.style.setProperty('--ry', '0deg'); c.style.setProperty('--rx', '0deg'); } });
document.addEventListener('click', e => { const c = e.target.closest('.mc[data-href]'); if (c && !(drag && drag.moved)) location.hash = c.dataset.href.slice(1); });
document.addEventListener('keydown', e => { const c = e.target.closest && e.target.closest('.mc[data-href]'); if (c && e.key === 'Enter') location.hash = c.dataset.href.slice(1); });
const rail = $('#mRail');
rail.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; drag = { x: e.clientX, sl: rail.scrollLeft, moved: false }; });
window.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 4) { drag.moved = true; rail.classList.add('drag'); } rail.scrollLeft = drag.sl - dx; });
window.addEventListener('pointerup', () => { if (!drag) return; setTimeout(() => { drag = null; }, 0); rail.classList.remove('drag'); });
const cardStep = () => { const c = $('.mc', rail); return c ? c.getBoundingClientRect().width + 16 : 300; };
$('#mPrev').addEventListener('click', () => rail.scrollBy({ left: -cardStep() * 2, behavior: 'smooth' }));
$('#mNext').addEventListener('click', () => rail.scrollBy({ left: cardStep() * 2, behavior: 'smooth' }));

/* ══════════ pricing calculator (mountable) ══════════ */
const PRICE = { m: 19.99, y: 199.99, add: 9.99 };
function mountCalc(old) {
  const root = old.cloneNode(false); old.replaceWith(root);
  const st = { inst: 'conga', styles: 1, bill: 'm', shown: 19.99 };
  root.innerHTML = `
    <div class="calc-row"><div class="calc-lbl"><span class="sp-label">${T('Instrument', 'Instrumento')}</span><span class="sp-label" data-r="ic"></span></div><div class="inst-pick" data-r="pick" role="group" aria-label="Instrument"></div></div>
    <div class="calc-row" style="grid-template-columns:1fr auto;align-items:center"><div><span class="sp-label">${T('Style courses', 'Cursos de estilo')}</span><p style="color:var(--humo);font-size:14.5px;margin-top:6px">${T('The first is included. Each extra: $9.99/mo.', 'El primero va incluido. Cada extra: $9.99/mes.')}</p></div>
      <div class="stepper"><button type="button" data-r="minus" aria-label="Fewer styles">−</button><output data-r="out" class="tnum"></output><button type="button" data-r="plus" aria-label="More styles">+</button></div></div>
    <div class="calc-row" style="grid-template-columns:1fr auto;align-items:center"><span class="sp-label">${T('Billing', 'Facturación')}</span>
      <div class="seg" role="group" aria-label="Billing" data-r="bill"><button type="button" data-bill="m">${T('Monthly', 'Mensual')}</button><button type="button" data-bill="y">${T('Yearly −17%', 'Anual −17%')}</button></div></div>
    <div class="total"><div class="total-amt tnum"><sup>$</sup><span data-r="amt">19.99</span><small data-r="per">/mo</small></div><div class="total-break tnum" data-r="brk"></div></div>
    <a class="btn btn-hot" href="#join" style="--h:58px;font-size:16px">${T('Lock in founding pricing', 'Asegura el precio fundador')}</a>`;
  const r = k => root.querySelector(`[data-r="${k}"]`);
  const render = () => {
    const live = SEATS.filter(s => s.courses.length);
    r('pick').innerHTML = live.map(s => `<button type="button" data-id="${s.id}" aria-pressed="${s.id === st.inst}">${LANG === 'es' ? s.es : s.name}</button>`).join('');
    const max = SEATS.find(x => x.id === st.inst).courses.length;
    st.styles = Math.min(st.styles, max);
    r('ic').textContent = `${max} ${T('style courses available', 'cursos de estilo disponibles')}`;
    r('out').textContent = `${st.styles} ${st.styles === 1 ? T('style', 'estilo') : T('styles', 'estilos')}`;
    r('minus').disabled = st.styles <= 1; r('plus').disabled = st.styles >= max;
    $$('button', r('bill')).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.bill === st.bill)));
    const extra = (st.styles - 1) * PRICE.add;
    let amt, brk;
    if (st.bill === 'm') { amt = PRICE.m + extra; r('per').textContent = T('/mo', '/mes'); brk = `Base $${PRICE.m.toFixed(2)}${extra ? `<br>+ ${st.styles - 1} × $${PRICE.add}` : ''}`; }
    else { amt = PRICE.y; r('per').textContent = T('/yr', '/año'); brk = `<b>${T('Save', 'Ahorras')} $${(PRICE.m * 12 - PRICE.y).toFixed(2)}</b> ${T('vs monthly', 'vs mensual')}${extra ? `<br>+ $${extra.toFixed(2)}${T('/mo for extra styles', '/mes por estilos extra')}` : ''}`; }
    r('brk').innerHTML = brk;
    const from = st.shown, t0 = performance.now(), d = REDUCE ? 1 : 520;
    const step = t => { const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 4); st.shown = from + (amt - from) * e; r('amt').textContent = st.shown.toFixed(2); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  root.addEventListener('click', e => {
    const p = e.target.closest('[data-r="pick"] button'); if (p) { st.inst = p.dataset.id; render(); return; }
    if (e.target.closest('[data-r="minus"]')) { st.styles--; render(); }
    if (e.target.closest('[data-r="plus"]')) { st.styles++; render(); }
    const b = e.target.closest('[data-bill]'); if (b) { st.bill = b.dataset.bill; render(); }
  });
  render();
}

/* ══════════ PlaySense workspace: video + staff + highway ══════════ */
const ONSETS = [3, 6, 11, 14];
const HW_NOTES = [{ s: 3, str: 0, fret: 1, len: 3 }, { s: 6, str: 0, fret: 3, len: 4.5 }, { s: 11, str: 0, fret: 1, len: 3 }, { s: 14, str: 1, fret: 3, len: 2 }];
const STR_C = ['#FF5A48', '#FFC94D', '#2FD1B5', '#A58BFF'];
const OFFS = [4, -7, 12, 3, -2, 26, 6, -5, 2, 9, -9, 5, 1, -3, 31, 8, -6, 0, 3, 14];
const WS_ALL = [];
function mountWS(el, opt = {}) {
  const ws = { el, view: opt.view || 'staff', bpm: 120, t0: performance.now() / 1000, lastP: 0, loops: 0, jk: 0, res: { ok: 0, late: 0 }, visible: false, anchors: null, notes: [], bars: [], flashes: [0, 0, 0, 0] };
  el.innerHTML = `
    <div class="app-bar"><span class="dots"><i></i><i></i><i></i></span><span class="app-title"><b>Son Cubano Bass</b> · ${T('Lesson 4 · The tumbao', 'Lección 4 · El tumbao')}</span><span class="sp"></span><span class="pill tnum">120 BPM · 65%</span><span class="pill rec"><i></i>MIC</span></div>
    <div class="ws-body">
      <div class="ws-video"><video src="band.mp4" muted loop playsinline preload="metadata" aria-hidden="true"></video><span class="vcap">Yorgis Goiricelaya · ${T('bass', 'bajo')}</span></div>
      <div class="ws-music">
        <div class="staff2" data-v="staff"><div class="chords"></div><div class="bar-tint"></div><div class="staff-host"></div><div class="ph-line" aria-hidden="true"></div><div class="helpers"></div></div>
        <div class="hw" data-v="highway" hidden><canvas></canvas></div>
      </div>
    </div>
    <div class="vbar"><span>${IC.play}</span><span class="tnum" data-r="time">2:20</span><span class="scrub"><i></i><span class="ab" title="Loop A–B"></span></span><span class="tnum">6:10</span><span>0.65×</span><span>A–B ⟲</span></div>
    <div class="ws-foot"><div class="res"><span class="ok">${T('On time', 'A tiempo')} <b class="tnum" data-r="ok">0</b></span><span class="late">${T('Late', 'Tarde')} <b class="tnum" data-r="late">0</b></span><span>${T('Loop', 'Vuelta')} <b class="tnum" data-r="loop">1</b></span></div><span>${T('Demo: student input simulated', 'Demo: entrada simulada')}</span></div>`;
  ws.host = $('.staff-host', el); ws.ph = $('.ph-line', el); ws.tint = $('.bar-tint', el); ws.chords = $('.chords', el); ws.help = $('.helpers', el);
  ws.cv = $('.hw canvas', el); ws.cx = ws.cv.getContext('2d'); ws.video = $('video', el);
  ws.setView = v => { ws.view = v; $('[data-v="staff"]', el).hidden = v !== 'staff'; $('[data-v="highway"]', el).hidden = v !== 'highway'; if (v === 'staff') { ws.w = 0; buildStaff(ws); } else sizeHW(ws); };
  new ResizeObserver(() => { if (ws.view === 'staff') { const w = ws.host.clientWidth; if (Math.abs(w - (ws.w || 0)) > 8) buildStaff(ws); } else sizeHW(ws); }).observe($('.ws-music', el));
  new IntersectionObserver(es => es.forEach(en => { ws.visible = en.isIntersecting; if (ws.visible && !REDUCE) ws.video.play().catch(() => {}); else ws.video.pause(); })).observe(el);
  ws.video.addEventListener('error', () => { ws.video.style.display = 'none'; });
  WS_ALL.push(ws);
  (async () => { try { if (document.fonts) await Promise.race([document.fonts.load('30px Bravura'), new Promise(r => setTimeout(r, 1500))]); } catch (_) {} ws.setView(ws.view); })();
  return ws;
}
function buildStaff(ws) {
  const VF = window.VexFlow || (window.Vex && window.Vex.Flow);
  const host = ws.host;
  if (!VF) { host.innerHTML = '<p class="staff-fallback">Notation engine did not load.</p>'; return; }
  const W = host.clientWidth; if (!W) return;
  ws.w = W; host.innerHTML = '';
  const H = 120, sc = W < 520 ? .8 : 1, w = W / sc;
  const r = new VF.Renderer(host, VF.Renderer.Backends.SVG); r.resize(W, H * sc);
  const ctx = r.getContext(); ctx.scale(sc, sc);
  ctx.setFillStyle('#F6EBDD'); ctx.setStrokeStyle('rgba(246,235,221,.55)');
  const w1 = (w - 12) * .54, w2 = (w - 12) - w1;
  const s1 = new VF.Stave(4, 6, w1); s1.addClef('bass').addTimeSignature('4/4'); s1.setBegBarType(VF.Barline.type.REPEAT_BEGIN);
  const s2 = new VF.Stave(4 + w1, 6, w2); s2.setEndBarType(VF.Barline.type.REPEAT_END);
  [s1, s2].forEach(s => s.setContext(ctx).draw());
  const style = { fillStyle: '#F6EBDD', strokeStyle: '#F6EBDD' };
  const N = (k, d) => { const n = new VF.StaveNote({ clef: 'bass', keys: [k], duration: d }); n.setStyle(style); return n; };
  const b1 = [N('d/3', 'qr'), N('d/3', '8r'), N('f/2', '8'), N('f/2', 'q'), N('g/2', 'q')];
  const b2 = [N('g/2', 'q'), N('d/3', '8r'), N('f/2', '8'), N('f/2', 'q'), N('c/3', 'q')];
  VF.Formatter.FormatAndDraw(ctx, s1, b1); VF.Formatter.FormatAndDraw(ctx, s2, b2);
  const tie = (a, b) => { const t = new VF.StaveTie({ firstNote: a, lastNote: b, firstIndexes: [0], lastIndexes: [0] }); t.setContext(ctx).draw(); };
  tie(b1[2], b1[3]); tie(b1[4], b2[0]); tie(b2[2], b2[3]); tie(b2[4], null);
  const all = [...b1, ...b2], steps = [0, 2, 3, 4, 6, 8, 10, 11, 12, 14];
  ws.anchors = all.map((n, i) => [steps[i], (n.getAbsoluteX() + 6) * sc]);
  ws.anchors.push([16, (s2.getX() + s2.getWidth() - 12) * sc]);
  ws.noteSteps = steps; ws.notes = $$('.vf-stavenote', host);
  ws.bars = [[s1.getNoteStartX() * sc - 6, (s1.getX() + s1.getWidth()) * sc], [s2.getX() * sc + 2, (s2.getX() + s2.getWidth()) * sc - 2]];
  ws.ph.style.height = (H * sc - 26) + 'px';
  const X = s => stepX(ws, s);
  ws.chords.innerHTML = CHORDS.map((c, i) => `<span style="left:${X(i * 4)}px">${c}</span>`).join('');
  ws.help.innerHTML = Array.from({ length: 16 }, (_, s) => `<span style="left:${X(s) + 2}px">${s % 2 ? '&' : (s % 8) / 2 + 1}</span>`).join('');
}
function stepX(ws, p) {
  const a = ws.anchors; if (!a) return 0;
  for (let i = 0; i < a.length - 1; i++) { const [s0, x0] = a[i], [s1, x1] = a[i + 1]; if (p >= s0 && p <= s1) return x0 + (x1 - x0) * ((p - s0) / (s1 - s0 || 1)); }
  return a[0][1];
}
function sizeHW(ws) { const r = ws.cv.getBoundingClientRect(); const d = Math.min(2, devicePixelRatio || 1); ws.cv.width = Math.round(r.width * d); ws.cv.height = Math.round(r.height * d); ws.dpr = d; ws.cw = r.width; ws.ch = r.height; }
function drawHW(ws, p, t) {
  const cx = ws.cx, W = ws.cw, H = ws.ch; if (!W) return;
  cx.setTransform(ws.dpr, 0, 0, ws.dpr, 0, 0); cx.clearRect(0, 0, W, H);
  const vx = W / 2, vy = -H * .35, hitY = H * .8, span = Math.min(W * .78, 520), AHEAD = 14;
  const f = d => (1 / (1 + 2.4 * d) - 1 / 3.4) / (1 - 1 / 3.4);
  const P = (lx, d) => { const k = f(d); return [vx + (lx - vx) * k, vy + (hitY - vy) * k]; };
  const lane = i => vx - span / 2 + span * (i + .5) / 4;
  const L = vx - span / 2, R = vx + span / 2;
  const [l0x, l0y] = P(L, 1), [r0x] = P(R, 1), [l1x] = P(L, -.12), [r1x, r1y] = P(R, -.12);
  const g = cx.createLinearGradient(0, l0y, 0, r1y); g.addColorStop(0, 'rgba(246,235,221,0)'); g.addColorStop(1, 'rgba(246,235,221,.05)');
  cx.fillStyle = g; cx.beginPath(); cx.moveTo(l0x, l0y); cx.lineTo(r0x, l0y); cx.lineTo(r1x, r1y); cx.lineTo(l1x, r1y); cx.closePath(); cx.fill();
  cx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const lx = L + span * i / 4, [ax, ay] = P(lx, 1), [bx, by] = P(lx, -.12); cx.strokeStyle = 'rgba(246,235,221,.12)'; cx.beginPath(); cx.moveTo(ax, ay); cx.lineTo(bx, by); cx.stroke(); }
  for (let k = Math.ceil(p); k < p + AHEAD; k++) {
    if (k % 2) continue;
    const d = (k - p) / AHEAD, [ax, ay] = P(L, d), [bx] = P(R, d);
    cx.strokeStyle = k % 8 === 0 ? 'rgba(255,165,36,.35)' : 'rgba(246,235,221,.08)'; cx.beginPath(); cx.moveTo(ax, ay); cx.lineTo(bx, ay); cx.stroke();
  }
  const hg = cx.createLinearGradient(L, 0, R, 0); hg.addColorStop(0, '#FFA524'); hg.addColorStop(1, '#FF324D');
  const [hx0, hy] = P(L, 0), [hx1] = P(R, 0);
  cx.strokeStyle = hg; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(hx0, hy); cx.lineTo(hx1, hy); cx.stroke();
  cx.font = '500 11px "DM Mono",monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  ['E', 'A', 'D', 'G'].forEach((s, i) => {
    const fl = Math.max(0, 1 - (t - ws.flashes[i]) / .35), [x, y] = P(lane(i), -.07);
    cx.fillStyle = fl ? STR_C[i] : 'rgba(246,235,221,.4)'; cx.fillText(s, x, y + 10);
    if (fl) { cx.save(); cx.globalAlpha = fl * .6; cx.fillStyle = STR_C[i]; cx.shadowColor = STR_C[i]; cx.shadowBlur = 24; cx.beginPath(); cx.ellipse(x, hy, 26, 8, 0, 0, Math.PI * 2); cx.fill(); cx.restore(); }
  });
  HW_NOTES.forEach(n => {
    [n.s - p, n.s + 16 - p].forEach(rel => {
      if (rel > AHEAD + 1 || rel < -n.len - .5) return;
      const d0 = Math.max(-.08, rel / AHEAD), d1 = Math.min(1, (rel + n.len * .85) / AHEAD);
      if (d1 < -.05) return;
      const lx = lane(n.str), hw = span / 4 * .36;
      const [ax, ay] = P(lx - hw * .35, d1), [bx] = P(lx + hw * .35, d1), [c2, cy] = P(lx + hw * .35, d0), [dx] = P(lx - hw * .35, d0);
      cx.fillStyle = STR_C[n.str] + '40'; cx.beginPath(); cx.moveTo(ax, ay); cx.lineTo(bx, ay); cx.lineTo(c2, cy); cx.lineTo(dx, cy); cx.closePath(); cx.fill();
      if (rel < -.3) return;
      const [gx, gy] = P(lx, Math.max(d0, -.04)), sz = 34 * f(Math.max(0, d0)) + 10;
      cx.fillStyle = STR_C[n.str];
      cx.beginPath(); if (cx.roundRect) cx.roundRect(gx - sz * .75, gy - sz * .32, sz * 1.5, sz * .64, sz * .2); else cx.rect(gx - sz * .75, gy - sz * .32, sz * 1.5, sz * .64); cx.fill();
      cx.fillStyle = '#140D17'; cx.font = `700 ${Math.max(9, sz * .42)}px "DM Mono",monospace`; cx.fillText(String(n.fret), gx, gy + 1);
    });
  });
}
function tickWS(ws, now) {
  if (!ws.visible || !ws.el.offsetParent) return;
  const sd = 60 / ws.bpm / 2, raw = (now - ws.t0) / sd, p = REDUCE ? 5.5 : raw % 16, loop = REDUCE ? 0 : Math.floor(raw / 16);
  if (loop !== ws.loops) { ws.loops = loop; ws.notes.forEach(n => n.classList.remove('played', 'lit-ok', 'lit-late')); const lr = $('[data-r="loop"]', ws.el); if (lr) lr.textContent = loop + 1; }
  ONSETS.forEach(s => {
    if (!(ws.lastP < s && p >= s)) return;
    const off = OFFS[ws.jk++ % OFFS.length], ok = Math.abs(off) <= 20;
    ws.res[ok ? 'ok' : 'late']++;
    $('[data-r="ok"]', ws.el).textContent = ws.res.ok; $('[data-r="late"]', ws.el).textContent = ws.res.late;
    const hn = HW_NOTES.find(n => n.s === s); if (hn) ws.flashes[hn.str] = now;
    if (ws.view === 'staff' && ws.anchors) {
      const el = ws.notes[ws.noteSteps.indexOf(s)];
      if (el) el.classList.add(ok ? 'lit-ok' : 'lit-late');
      const j = document.createElement('span'); j.className = 'judge ' + (ok ? 'ok' : 'late');
      j.textContent = ok ? (Math.abs(off) <= 5 ? T('Perfect', 'Perfecto') : `${off > 0 ? '+' : ''}${off}ms`) : `${T('Late', 'Tarde')} +${off}ms`;
      j.style.left = (stepX(ws, s) + 18) + 'px'; j.style.top = '0px';
      $('.staff2', ws.el).appendChild(j); setTimeout(() => j.remove(), 1000);
    }
  });
  ws.lastP = p;
  if (ws.view === 'staff' && ws.anchors) {
    ws.ph.style.transform = `translateX(${stepX(ws, p) + 15}px)`;
    ws.notes.forEach((n, i) => { if (ws.noteSteps[i] + 1.5 < p) n.classList.add('played'); });
    const b = p < 8 ? ws.bars[0] : ws.bars[1];
    ws.tint.style.left = (b[0] + 16) + 'px'; ws.tint.style.width = (b[1] - b[0]) + 'px';
    const ci = Math.floor(p / 4); $$('span', ws.chords).forEach((s, i) => s.classList.toggle('cur', i === ci));
    const cs = Math.floor(p); $$('span', ws.help).forEach((s, i) => s.classList.toggle('cur', i === cs));
  } else if (ws.view === 'highway') drawHW(ws, p, now);
  const sc = $('.scrub i', ws.el); if (sc) sc.style.setProperty('--p', (38 + 14 * (p / 16)).toFixed(1) + '%');
  const tm = $('[data-r="time"]', ws.el); if (tm) { const secs = Math.floor(370 * (.38 + .14 * p / 16)); tm.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`; }
}

/* ══════════ real PlaySense stage (recorded from the Miami bayfront scene) ══════════ */
const CONGA_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><ellipse cx="12" cy="6" rx="6" ry="2.2"/><path d="M6 6c0 5 1 9 2.5 14h7C17 15 18 11 18 6"/><path d="M7.5 11h9M8.5 16h7"/></svg>';
function mountStage(el) {
  el.innerHTML = `<video src="miami-stage.webm" poster="miami-poster.jpg" muted playsinline preload="auto" aria-label="PlaySense stage: notes travel down a pier on Biscayne Bay toward three congas, with the Miami skyline at dusk"></video>
    <div class="stage-dip"></div>
    <div class="sh sh-tl"><span class="sh-ic">${CONGA_IC}</span><div><small>DEMO PERFORMANCE</small><b>Tumbao Esencial</b><span>Latin foundations · 100 BPM · 4/4</span></div></div>
    <div class="sh sh-tr"><div class="sh-score"><div><span>Score</span><b data-r="sc">0<small>/ 100</small></b></div><div class="cb"><span>Combo</span><b data-r="cb">0<small>in a row</small></b></div><div class="ac"><span>Accuracy</span><b data-r="ac">100%</b></div></div>
      <div class="sh-band"><small>WITH THE BAND</small><b>Bass · Keys · Timbales</b></div></div>
    <div class="sh-pop" data-r="pop">PERFECT</div>
    <div class="sh sh-bl"><i></i>Demo · hits are simulated</div>
    <div class="sh sh-br"><span class="meas"><i></i><i></i><i></i><i></i></span><span data-r="ms">Measure 1 of 4</span></div>`;
  const v = $('video', el), dip = $('.stage-dip', el), r = k => el.querySelector(`[data-r="${k}"]`);
  let lastHit = -1, looping = false;
  const LEN = 11.6, BEAT = 60 / 100;
  const restart = () => { if (looping) return; looping = true; dip.classList.add('on'); setTimeout(() => { v.currentTime = 0; v.play().catch(() => {}); lastHit = -1; setTimeout(() => { dip.classList.remove('on'); looping = false; }, 120); }, 340); };
  v.addEventListener('ended', restart);
  v.addEventListener('error', () => { v.style.display = 'none'; });
  const tick = () => {
    const t = v.currentTime || 0;
    if (t > LEN) restart();
    const hits = Math.floor(t / (BEAT / 2)), m = Math.min(3, Math.floor(t / (BEAT * 4)) % 4);
    r('cb').innerHTML = `${hits}<small>in a row</small>`;
    r('sc').innerHTML = `${Math.min(100, Math.round(hits * 100 / 22))}<small>/ 100</small>`;
    r('ms').textContent = `Measure ${m + 1} of 4`;
    $$('.meas i', el).forEach((x, i) => x.classList.toggle('on', i <= m));
    if (hits !== lastHit && hits % 3 === 0 && hits > 0 && !REDUCE) { const pp = r('pop'); pp.classList.remove('show'); void pp.offsetWidth; pp.classList.add('show'); }
    lastHit = hits;
  };
  setInterval(() => { if (!v.paused) tick(); }, 120);
  if (!REDUCE) new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting && el.offsetParent) v.play().catch(() => {}); else v.pause(); }), { threshold: .2 }).observe(el);
  return el;
}

/* ══════════ pages ══════════ */
const phead = (crumb, title, lede, extra = '') => `
  <header class="phead"><div class="lights" aria-hidden="true"><div class="beam b1"></div><div class="beam b2"></div></div>
  <div class="wrap phead-in"><div><p class="crumbs"><a href="#top">Home</a><span>/</span>${crumb}</p><h1 class="ptitle">${title}</h1></div><div style="display:grid;gap:20px">${lede ? `<p class="lede">${lede}</p>` : ''}${extra}</div></div></header>`;
const finale = (h, p) => `<section class="sec" style="padding-block:clamp(72px,8vw,120px);border-top:1px solid var(--line);text-align:center"><div class="wrap"><h2 class="h2" style="font-size:clamp(40px,5vw,80px)">${h}</h2><p class="lede" style="margin:18px auto 0">${p}</p><div style="margin-top:28px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn btn-hot" href="#join">Join the waitlist ${IC.arrow}</a><a class="btn btn-ghost" href="#pricing-page">See pricing</a></div></div></section>`;

const EX = { inst: 'all', ctry: 'all', q: '' };
const PAGES = {};
PAGES.explore = {
  html: () => phead('Explore', 'Explore <span class="serif grad-text">the catalog.</span>', '69 courses across 9 instruments. Every instrument starts with a fundamentals course, then you add the styles you want to play.', `<div class="field" style="max-width:420px;flex:none"><label for="exq" style="position:absolute;left:-9999px">Search courses</label><input id="exq" type="search" placeholder="Search a style or instrument"></div>`) + `
  <div class="toolbar"><div class="wrap" style="display:grid;gap:12px;width:100%">
    <div class="filters" id="exInst"></div>
    <div class="filters" id="exCtry"></div>
  </div></div>
  <div class="wrap"><p class="eyebrow" style="padding-top:26px" id="exCount"></p><div class="posters" id="exGrid"></div></div>
  <section class="sec" style="padding-block:clamp(72px,8vw,120px)"><div class="wrap"><div class="sec-head"><div><p class="eyebrow">Browse by country</p><h2 class="h2" style="margin-top:18px">Where the <span class="serif grad-text">music comes from.</span></h2></div><p class="lede">Styles from the Dominican Republic and Colombia are in production now.</p></div><div class="atlas" id="exAtlas"></div></div></section>`,
  init() {
    const insts = SEATS.filter(s => s.courses.length);
    const ctrys = [['all', 'All countries'], ['CU', 'Cuba'], ['PR', 'Puerto Rico'], ['DO', 'Dominican Rep.', 1], ['CO', 'Colombia', 1]];
    const draw = () => {
      $('#exInst').innerHTML = `<button class="fchip" aria-pressed="${EX.inst === 'all'}" data-i="all">All instruments <small>69</small></button>` + insts.map(s => `<button class="fchip" data-i="${s.id}" aria-pressed="${EX.inst === s.id}">${s.name} <small>${s.courses.length + 1}</small></button>`).join('');
      $('#exCtry').innerHTML = ctrys.map(([k, n, soon]) => `<button class="fchip" data-c="${k}" aria-pressed="${EX.ctry === k}" ${soon ? 'disabled style="opacity:.45;cursor:default"' : ''}>${n}${soon ? ' <small>soon</small>' : ''}</button>`).join('');
      const q = EX.q.toLowerCase();
      const list = COURSES.filter(c => (EX.inst === 'all' || c.inst === EX.inst) && (EX.ctry === 'all' || c.country === EX.ctry) && (!q || (c.style + ' ' + c.instName).toLowerCase().includes(q)));
      $('#exCount').innerHTML = `<b>${list.length}</b> course${list.length === 1 ? '' : 's'}`;
      $('#exGrid').innerHTML = list.length ? list.map((c, i) => {
        const link = c.style === 'Son Cubano' && c.inst === 'timbal' ? '#course' : c.style === 'Son Cubano' ? '#son-cubano' : '';
        return `<a class="poster" ${link ? `href="${link}"` : ''} style="animation-delay:${Math.min(i, 16) * 30}ms;${link ? '' : 'cursor:default'}">
          ${sleeve(c.fund ? `${c.instName}<br>Basics` : c.style, c.instName, c.fund ? 'START' : c.country, c.style + c.inst)}
          <div class="pmeta"><b>${c.fund ? c.instName + ' Fundamentals' : c.style + ' ' + c.instName}</b><span>${c.fund ? 'Included' : link ? 'Preview →' : ''}</span></div></a>`;
      }).join('') : '<p class="empty">No courses match that search yet.</p>';
    };
    $('#exInst').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { EX.inst = b.dataset.i; draw(); } });
    $('#exCtry').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b && !b.disabled) { EX.ctry = b.dataset.c; draw(); } });
    $('#exq').addEventListener('input', e => { EX.q = e.target.value; draw(); });
    this.draw = draw; draw();
    $('#exAtlas').innerHTML = $('#atlasGrid').innerHTML;
  },
  show() { if (this.draw) this.draw(); },
};

const SON_COURSES = COURSES.filter(c => c.style === 'Son Cubano');
PAGES['son-cubano'] = {
  html: () => phead('<a href="#explore">Explore</a><span>/</span>Cuba', 'Son <span class="serif grad-text">cubano.</span>', 'The root of salsa. Born in the mountains of eastern Cuba, carried to Havana, and still the first thing a Cuban musician learns to play in clave.', `<div class="course-meta" style="margin-top:0"><span class="pill">Cuba · Oriente</span><span class="pill">Clave de son</span><span class="pill">${SON_COURSES.length} courses</span></div>`) + `
  <section class="sec"><div class="wrap style-intro">
    <div class="prose"><p class="eyebrow" style="margin-bottom:18px">The story</p>
      <p><strong>Son</strong> took shape in Oriente, the eastern end of Cuba, in the late 1800s. It joined Spanish song forms and the guitar family with rhythms carried by enslaved Africans and their descendants, above all the Bantu-derived drumming of the region.</p>
      <p>By the 1920s it had reached Havana, where groups like the <strong>Sexteto Habanero</strong> and Ignacio Piñeiro's <strong>Septeto Nacional</strong> made it the sound of the city: tres, guitar, bongó, bass, maracas, claves and voices, later a trumpet.</p>
      <p>In the 1940s <strong>Arsenio Rodríguez</strong> expanded the band into the conjunto, adding the conga, piano and more trumpets, and stretched the montuno into the long vamp that salsa was later built on.</p>
      <div class="facts"><div><b>Oriente</b><span>Where it started</span></div><div><b>1880s</b><span>First appearances</span></div><div><b>3-2 · 2-3</b><span>Clave direction</span></div><div><b>Montuno</b><span>The vamp that became salsa</span></div></div>
    </div>
    <div class="clave-card"><p class="sp-label" style="margin-bottom:14px">The son clave, 3-2</p>
      <div class="seq-rows">${[['Clave', '#F6EBDD', [0, 3, 6, 10, 12]], ['Bongó', '#FFC94D', [0, 2, 4, 6, 8, 10, 12, 14]], ['Bass', '#2FD1B5', [3, 6, 11, 14]]].map(([n, c, onS]) => `<div class="seq-row" style="--c:${c}"><span class="seq-lbl"><b><i></i>${n}</b></span><div class="cells">${Array.from({ length: 16 }, (_, s) => `<button type="button" tabindex="-1" class="${onS.includes(s) ? 'on' : ''}" aria-hidden="true"></button>`).join('')}</div></div>`).join('')}</div>
      <div class="counts" style="margin-top:8px"><span></span><div>${Array.from({ length: 16 }, (_, s) => s % 2 ? '<span>&amp;</span>' : `<b>${(s % 8) / 2 + 1}</b>`).join('')}</div></div>
      <p style="color:var(--humo);font-size:14.5px;margin-top:16px">Three strokes in the first bar, two in the second. The bass never plays on one: it anticipates the next chord on the &amp; of 2 and on 4.</p>
      <a class="btn btn-ghost btn-sm" href="#groove" style="margin-top:16px">Hear it on the home page</a>
    </div>
  </div></section>
  <section class="sec" style="padding-top:0"><div class="wrap"><div class="sec-head"><div><p class="eyebrow">${SON_COURSES.length} courses</p><h2 class="h2" style="margin-top:18px">Play son on <span class="serif grad-text">any seat.</span></h2></div><p class="lede">Each course teaches that instrument's role in the conjunto, from the basic pattern to variations and solos.</p></div>
    <div class="posters" style="padding-top:0">${SON_COURSES.map((c, i) => `<a class="poster" ${c.inst === 'timbal' ? 'href="#course"' : ''} style="animation-delay:${i * 40}ms;${c.inst === 'timbal' ? '' : 'cursor:default'}">${sleeve('Son Cubano', c.instName, 'CU', 'Son Cubano' + c.inst)}<div class="pmeta"><b>${c.instName}</b><span>${c.inst === 'timbal' ? 'Preview →' : ''}</span></div></a>`).join('')}</div>
  </div></section>
  <section class="sec" style="padding-top:0"><div class="wrap"><div class="sec-head"><div><p class="eyebrow">Maestros</p><h2 class="h2" style="margin-top:18px">Who plays <span class="serif grad-text">son here.</span></h2></div></div>
    <div class="igrid" style="padding-top:0">${['patricio', 'frank', 'niuver', 'livan', 'yorgis', 'miguel'].map(k => mcCard(k, k === 'patricio' ? '#patricio' : '')).join('')}</div></div></section>` + finale('Start with <span class="serif grad-text">the clave.</span>', 'Pick an instrument, add Son Cubano as your style, and play your first montuno with the band.'),
};

const TIMBAL_SECTIONS = [
  { t: 'Course welcome', items: ['Course overview', 'Basic timbales course', 'Parts of the timbales, setup and playing position', 'Tuning the timbales', 'Basic sound and sound combinations', 'Stick grip, rebound and hand-to-hand technique', 'Single strokes, double strokes and basic rolls', 'Paradiddles and fundamental rudiments', 'Accents and dynamics', 'Hand independence and coordination', 'Roll development, endurance and speed control'] },
  { t: 'Fundamentals of the timbal in son', items: ['Intro: the timbal in son', 'Basic timbal rhythm in son', 'Cáscara rhythm variations'] },
  { t: 'Expanding the musical language', items: [] },
  { t: 'Applying what we have learned', items: [] },
];
PAGES.course = {
  html: () => `
  <header class="phead"><div class="lights" aria-hidden="true"><div class="beam b1"></div><div class="beam b2"></div></div>
  <div class="wrap course-hero" style="padding-block:clamp(40px,6vw,90px) clamp(40px,5vw,72px)">
    <div><p class="crumbs"><a href="#explore">Explore</a><span>/</span><a href="#son-cubano">Son Cubano</a><span>/</span>Timbal</p>
      <h1 class="ptitle">Son Cubano <span class="serif grad-text">timbal.</span></h1>
      <p class="lede" style="margin-top:22px">Develop your timbal technique with authentic patterns, cáscara, bell work and fills. Learn to lead the rhythm section with authority.</p>
      <div class="course-meta"><span class="pill">4 sections</span><span class="pill">14 lessons</span><span class="pill">PlaySense notation</span></div>
      <a class="inst-card" href="#patricio" style="margin-top:28px;max-width:540px">${PHOTOS.patricio ? `<img src="${PHOTOS.patricio}" alt="">` : ''}<div><span class="sp-label">Your maestro</span><b style="margin-top:8px">Patricio “El Chino” Díaz</b><p>First timbal student of José Luis “Changuito” Quintana, the creator of songo. Six years under the master.</p></div></a>
    </div>
    <div class="course-sleeve">${sleeve('Son<br>Cubano', 'Timbal', 'CU', 'Son Cubanotimbal')}</div>
  </div></header>
  <section class="sec" style="padding-top:clamp(48px,6vw,88px)"><div class="wrap course-body">
    <div>
      <p class="eyebrow">What you'll learn</p>
      <div class="learn">${['Setting up and tuning the timbales', 'Stick grip, rebound and rudiments', 'The basic son pattern on cáscara', 'Cáscara variations and bell work', 'Fills and abanicos into the montuno', 'Leading the rhythm section'].map(x => `<div>${IC.check}<span>${x}</span></div>`).join('')}</div>
      <div style="margin-top:56px"><div style="display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:16px;flex-wrap:wrap"><h2 class="h2" style="font-size:clamp(36px,4vw,56px)">Curriculum</h2><span class="eyebrow">14 lessons · 2 sections in production</span></div>
      <div class="curric">${TIMBAL_SECTIONS.map((s, i) => `<div class="sec-item${i === 0 ? ' open' : ''}"><button type="button" aria-expanded="${i === 0}"><span class="no tnum">${String(i + 1).padStart(2, '0')}</span><span class="tt">${s.t}</span><span class="ct">${s.items.length ? s.items.length + ' lessons' : 'In production'}</span><span class="chev">${IC.chev}</span></button>
        <div class="sec-list"><div>${s.items.length ? `<ol>${s.items.map(x => `<li><span>${x}</span><span class="lock">Plan</span></li>`).join('')}</ol>` : '<p class="inprod">This section is being recorded. It unlocks for everyone on the plan when it ships.</p>'}</div></div></div>`).join('')}</div></div>
      <div style="margin-top:56px"><p class="eyebrow" style="margin-bottom:16px">Practice every lesson in PlaySense</p><div class="stage" data-stage="course"></div></div>
    </div>
    <aside class="enroll"><span class="sp-label">Included with the Timbal plan</span><div class="price tnum">$19.99<small>/mo</small></div>
      <ul><li>${IC.check}Timbal Fundamentals included</li><li>${IC.check}Son Cubano as your style course</li><li>${IC.check}PlaySense notation and feedback</li><li>${IC.check}Cancel anytime</li></ul>
      <a class="btn btn-hot" href="#join">Lock in founding pricing</a><a class="btn btn-ghost" href="#pricing-page">Compare plans</a>
      <small style="color:var(--humo-2);font-size:13px">Or $199.99/yr, 17% less than monthly.</small></aside>
  </div></section>`,
  init() {
    $$('#pg-course .sec-item>button').forEach(b => b.addEventListener('click', () => { const it = b.parentElement; it.classList.toggle('open'); b.setAttribute('aria-expanded', String(it.classList.contains('open'))); }));
    mountStage($('[data-stage="course"]'));
  },
};

PAGES.instructors = {
  html: () => phead('Instructors', 'Los <span class="serif grad-text">maestros.</span>', 'Eighteen working musicians, each teaching the instrument they play for a living.') + `
  <div class="toolbar"><div class="wrap filters" id="inFam" style="width:100%"></div></div>
  <div class="wrap"><div class="igrid" id="inGrid"></div></div>
  <section class="sec"><div class="wrap about-split">
    <blockquote class="quote" style="margin:0">Students don't just learn notes. They learn the rhythms, the history and the soul behind the music they play.<cite>Our teaching philosophy</cite></blockquote>
    <div class="prose"><p>Every maestro on the platform performs the music they teach. They bring decades of bandstand experience and the context that doesn't fit on a chart: where a pattern comes from, when to break it, and how it sits against the clave.</p><p>Courses move from fundamentals to style, and every lesson comes with synced notation so you can practice what you just watched.</p></div>
  </div></section>` + finale('Ready to learn <span class="serif grad-text">from the best?</span>', 'Join the waitlist for early access and founding-member pricing.'),
  init() {
    const fams = [['all', 'Everyone'], ['perc', 'Percussion'], ['keys', 'Keys'], ['bass', 'Bass'], ['strings', 'Strings'], ['horns', 'Horns'], ['voice', 'Voice']];
    let cur = 'all';
    const draw = () => {
      $('#inFam').innerHTML = fams.map(([k, n]) => `<button class="fchip" data-f="${k}" aria-pressed="${cur === k}">${n} <small>${k === 'all' ? TEACHER_ORDER.length : TEACHER_ORDER.filter(t => TEACHERS[t].fam === k).length}</small></button>`).join('');
      $('#inGrid').innerHTML = TEACHER_ORDER.filter(k => cur === 'all' || TEACHERS[k].fam === cur).map(k => mcCard(k, k === 'patricio' ? '#patricio' : '')).join('');
    };
    $('#inFam').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { cur = b.dataset.f; draw(); } });
    draw();
  },
};

PAGES.patricio = {
  html: () => `<div class="wrap profile">
    <figure class="portrait" style="margin:0">${PHOTOS.patricio ? `<img src="${PHOTOS.patricio}" alt="Patricio “El Chino” Díaz">` : ''}<figcaption>Timbal · Camagüey, Cuba</figcaption></figure>
    <div>
      <p class="crumbs"><a href="#instructors">Instructors</a><span>/</span>Timbal</p>
      <h1 class="ptitle" style="font-size:clamp(56px,7vw,112px)">Patricio <span class="serif grad-text">“El Chino”</span> Díaz</h1>
      <p class="lede" style="margin-top:22px">Timbalero from Camagüey. The first timbal student of José Luis “Changuito” Quintana, the creator of songo and a twenty-year member of Los Van Van.</p>
      <div class="played-with">${TEACHERS.patricio.tags.map(t => `<span class="chip">${t}</span>`).join('')}</div>
      <p class="eyebrow" style="margin-top:48px">Lineage</p>
      <ol class="lineage">
        <li><span>1974 · Camagüey</span><b>Born in Camagüey, Cuba</b><p>Studies at the Vocational Arts School “Luisa Casa Romero”, then the Higher Institute “José White”.</p></li>
        <li><span>Age 16 · Havana</span><b>Calixto Oviedo</b><p>Studies with the percussionist of Adalberto y su Son and N.G. La Banda.</p></li>
        <li><span>Six years</span><b>José Luis “Changuito” Quintana</b><p>Becomes Changuito's first timbal student and studies with the songo master for six years.</p></li>
        <li><span>Cuba</span><b>The bandstand</b><p>Plays with Conjunto Artístico, Percusión Sonora, Son del Barrio and Algo Nuevo.</p></li>
        <li><span>1993 · Venezuela</span><b>Eighteen years abroad</b><p>Tours Venezuela with Algo Nuevo and stays. Performs with Fania All Stars, Larry Harlow, Maelo Ruiz, Cano Estremera, Lalo Rodríguez, Guayacán, Luis Enrique and many more.</p></li>
      </ol>
      <p class="eyebrow" style="margin-top:28px;margin-bottom:16px">Courses</p>
      <a class="inst-card" href="#course" style="max-width:560px"><div style="width:120px">${sleeve('Son', 'Timbal', 'CU', 'Son Cubanotimbal')}</div><div><span class="sp-label">14 lessons · 4 sections</span><b style="margin-top:8px">Son Cubano Timbal</b><p>Cáscara, bell work and fills, from setup to leading the rhythm section.</p></div></a>
    </div></div>` + finale('Study with <span class="serif grad-text">El Chino.</span>', 'Pick the Timbal plan and choose Son Cubano as your first style.'),
};

PAGES['playsense-page'] = {
  html: () => phead('PlaySense', 'Play<span class="serif grad-text">Sense.</span>', 'The sun just set over Biscayne Bay. The band is ready. Find your place in the groove.') + `
  <section class="sec" style="padding-top:clamp(48px,6vw,88px)"><div class="wrap">
    <div class="stage" data-stage="ps"></div>
    <div class="stage-cap"><span>Recorded from the PlaySense stage · Tumbao Esencial on congas</span><span>Notes travel down the pier. Hit them as they reach your drums.</span></div>
  </div></section>
  <section class="sec" style="padding-top:0"><div class="wrap"><div class="sec-head"><div><p class="eyebrow">How it works</p><h2 class="h2" style="margin-top:18px">Three steps, <span class="serif grad-text">every session.</span></h2></div></div>
    <div class="steps3"><div><b>1</b><h3>Open a lesson</h3><p>Pick any course and start a lesson. The exercise is ready on the stage with the band behind you.</p></div><div><b>2</b><h3>Play along</h3><p>Use your microphone or a PlaySense device. Notes travel down the pier and PlaySense listens to every hit.</p></div><div><b>3</b><h3>Improve faster</h3><p>See which notes were early, late or missed, loop those measures, and play them again.</p></div></div></div></section>
  <section class="sec" style="padding-top:0"><div class="wrap">
    <div class="sec-head"><div><p class="eyebrow">Prefer the chart?</p><h2 class="h2" style="margin-top:18px">Notation, <span class="serif grad-text">synced to the maestro.</span></h2></div><p class="lede">Every lesson also has the sheet music under the video, bar by bar. Arrange it side by side, stacked, or music only.</p></div>
    <div class="ws-tools"><div class="seg" role="group" aria-label="Layout" id="psLayout"><button type="button" data-l="side" aria-pressed="true">Side by side</button><button type="button" data-l="stack" aria-pressed="false">Stacked</button><button type="button" data-l="music" aria-pressed="false">Music only</button></div></div>
    <div class="ws" data-layout="side" data-ws="ps"></div>
  </div></section>
  <section class="sec" style="padding-top:0"><div class="wrap"><div class="fgrid">
    ${[['Real-time feedback', 'Listens through your microphone or PlaySense device and responds as you play.', '<path d="M3 12h3l3-7 4 14 3-7h5"/>'],
      ['Pitch and rhythm accuracy', 'See where your timing and pitch drift, so you fix mistakes before they become habits.', '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'],
      ['Play with the band', 'A backing band plays around you. Mute your own part and fill the hole.', '<circle cx="7" cy="17" r="3"/><circle cx="17" cy="15" r="3"/><path d="M10 17V5l10-2v12"/>'],
      ['Practice your way', 'Slow passages down, loop difficult measures and repeat until it feels easy.', '<path d="M7 4v16M17 4v16M7 8h10M7 16h10"/>'],
      ['Synchronized notation', 'Sheet music and tablature follow each video lesson.', '<path d="M4 7h16M4 12h16M4 17h16"/>'],
      ['Take the chart home', 'Export any section as PDF, MusicXML or MIDI.', '<path d="M6 3h9l4 4v14H6z"/><path d="M9 13h7M9 17h5"/>']].map(([h, p, d]) => `<div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg><h3>${h}</h3><p>${p}</p></div>`).join('')}
  </div></div></section>` + finale('Your place in the band <span class="serif grad-text">is waiting.</span>', 'PlaySense is included in every plan.'),
  init() {
    mountStage($('[data-stage="ps"]'));
    mountWS($('[data-ws="ps"]'));
    const lay = $('#psLayout'), el = $('[data-ws="ps"]');
    const swap = fn => (document.startViewTransition && !REDUCE) ? document.startViewTransition(fn) : fn();
    lay.addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (!b) return; swap(() => { el.dataset.layout = b.dataset.l; $$('button', lay).forEach(x => x.setAttribute('aria-pressed', String(x === b))); }); });
  },
};

PAGES['pricing-page'] = {
  html: () => phead('Pricing', 'Simple, <span class="serif grad-text">per instrument.</span>', 'Start with one instrument: its fundamentals course plus a style you choose. Add more styles whenever you are ready.', '<div class="glass notice"><span class="live-dot"></span><div><b>Founding-member pricing</b><small>These rates are for a limited time. Join the waitlist to lock them in.</small></div></div>') + `
  <section class="sec" style="padding-top:clamp(48px,6vw,88px)"><div class="wrap price-grid">
    <div class="calc" data-calc></div>
    <div class="side-cards"><div class="inc"><span class="sp-label">Every plan includes</span><ul>${['Your instrument\'s fundamentals course', 'One style course of your choice', 'PlaySense notation and real-time feedback', 'Streaks, weekly goal and practice calendar', 'New content monthly · cancel anytime'].map(x => `<li>${IC.check}<span>${x}</span></li>`).join('')}</ul></div>
    <div class="allaccess"><div><b>All-access</b><p>Every instrument and every style.</p></div><span class="tag">Coming soon</span></div></div>
  </div></section>
  <section class="sec" style="padding-top:0"><div class="wrap"><div class="sec-head"><div><p class="eyebrow">How pricing works</p><h2 class="h2" style="margin-top:18px">Build your <span class="serif grad-text">own plan.</span></h2></div></div>
    <div class="steps3"><div><b>1</b><h3>Pick an instrument</h3><p>$19.99/mo includes that instrument's fundamentals course plus one style course.</p></div><div><b>2</b><h3>Add styles</h3><p>Want more styles on the same instrument? Add any style course for $9.99/mo each.</p></div><div><b>3</b><h3>Go yearly</h3><p>Pay $199.99/yr for the instrument base and save 17%. Extra styles stay monthly.</p></div></div></div></section>
  <section class="sec" style="padding-top:0"><div class="wrap"><h2 class="h2" style="font-size:clamp(36px,4vw,56px);margin-bottom:24px">Compare plans</h2><div class="tbl"><table class="compare">
    <thead><tr><th>Feature</th><th>Per instrument</th><th>All-access <span class="tag" style="margin-left:6px">Soon</span></th></tr></thead>
    <tbody>${[['Instruments', '1', 'All 9'], ['Fundamentals course', '✓', '✓'], ['Style courses', '1 included, +$9.99/mo each', 'Every style'], ['PlaySense notation and feedback', '✓', '✓'], ['Sheet music export', '✓', '✓'], ['Progress, streaks and calendar', '✓', '✓'], ['New content monthly', '✓', '✓'], ['Price', '$19.99/mo or $199.99/yr', 'To be announced']].map(r => `<tr>${r.map((c, i) => `<td class="${i && c === 'To be announced' ? 'dim' : ''}">${c === '✓' ? IC.check : c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p style="color:var(--humo-2);font-size:14px;margin-top:16px">Questions about billing? <a href="#faq" style="color:var(--ambar)">Read the FAQ</a>.</p></div></section>`,
  init() { $$('#pg-pricing-page [data-calc]').forEach(mountCalc); },
};

PAGES.about = {
  html: () => phead('About', 'Keep the music <span class="serif grad-text">in good hands.</span>', 'Latin Music Mastery was born from respect for the music, culture and traditions of Latin America.') + `
  <section class="sec"><div class="wrap about-split">
    <div class="about-media"><video src="band.mp4" muted loop playsinline preload="metadata" data-autovid aria-hidden="true"></video></div>
    <div><p class="eyebrow" style="margin-bottom:22px">Our mission</p>
      <p class="manifesto">Teach more than notes. <span class="serif grad-text">Teach the feel, the history and the clave.</span></p>
      <div class="prose" style="margin-top:28px"><p>For generations, Latin music has moved the world with its rhythm and soul, from the syncopated language of Cuban son to the fire of salsa and the sophistication of mambo. These traditions carry stories and musical wisdom that deserve to be preserved and shared.</p><p>We bring together master musicians, structured lessons and modern practice tools so students anywhere can learn the technique, the history and the cultural foundation behind the music.</p></div>
    </div>
  </div></section>
  <section class="sec" style="padding-top:0"><div class="wrap"><div class="values">
    <div style="--c:#FFA524"><h3>Authentic</h3><p>Every course is taught by a musician who plays that music on stage, in the style's own language.</p></div>
    <div style="--c:#FF324D"><h3>Structured</h3><p>Fundamentals first, then styles, then playing inside the band. Each step builds on the one before.</p></div>
    <div style="--c:#2FD1B5"><h3>Rooted</h3><p>Technique comes with context: where a pattern comes from, who made it famous, and how it sits against the clave.</p></div>
  </div></div></section>
  <div class="wrap"><div class="numbers" style="border-top:1px solid var(--line)"><div class="num"><b>69</b><span>Courses</span></div><div class="num"><b>18</b><span>Maestros</span></div><div class="num"><b>12</b><span>Instruments</span></div><div class="num"><b>24</b><span>Styles</span></div><div class="num"><b>4</b><span>Countries</span></div></div></div>` + finale('Carry the legacy <span class="serif grad-text">forward.</span>', 'Join the waitlist and be part of the first class of students.'),
};

const FAQ = [
  ['Getting started', [
    ['What is Latin Music Mastery?', 'An online school for Latin music. You learn an instrument from musicians who play it professionally, with HD video lessons, notation synced to every video, and PlaySense feedback while you practice.'],
    ['Do I need any prior musical experience?', 'No. Every instrument starts with a fundamentals course that assumes you are new to it. Experienced players can move straight to the style courses.'],
    ['Which instruments are covered?', 'Courses are live for timbal, congas, minor percussion, drums, piano, bass, tres, guitar and violin. Voice, trumpet and saxophone are in production.', 1],
    ['How do the lessons work?', 'Each lesson has a video from your maestro with the notation synced underneath. You can slow it down, loop a passage, and play along while PlaySense listens.'],
  ]],
  ['Subscription and billing', [
    ['How much does it cost?', 'Each instrument is $19.99/mo, or $199.99/yr. That includes the instrument\'s fundamentals course plus one style course. Extra style courses are $9.99/mo each. An All-access plan is coming.', 1],
    ['What does founding-member pricing mean?', 'People who join the waitlist before launch keep today\'s prices when they subscribe.'],
    ['Can I cancel anytime?', 'Yes. There are no contracts or cancellation fees. You keep access until the end of your billing period.'],
    ['Is my payment information secure?', 'Payments are processed by Stripe. Card details never touch our servers.'],
  ]],
  ['PlaySense', [
    ['What does PlaySense need?', 'A microphone on your computer, phone or tablet, or a PlaySense device. Headphones help so the backing track doesn\'t bleed into the mic.'],
    ['Can I download the sheet music?', 'Yes. Any section can be exported as PDF, MusicXML or MIDI.'],
    ['Does it work for percussion?', 'Yes. For percussion, PlaySense focuses on timing, so you see which strokes were early, late or missed.'],
  ]],
];
PAGES.faq = {
  html: () => phead('FAQ', 'Questions, <span class="serif grad-text">answered.</span>', 'Can\'t find what you need? <a href="#contact" style="color:var(--ambar)">Write to us</a>.') + `
  <section class="sec" style="padding-top:clamp(48px,6vw,88px)"><div class="wrap faq-grid">
    <nav class="faq-nav">${FAQ.map(([c], i) => `<a href="#faq" data-jump="faq-${i}">${c}</a>`).join('')}</nav>
    <div>${FAQ.map(([c, qs], i) => `<div class="faq-cat" id="faq-${i}"><h2>${c}</h2>${qs.map(([q, a, fix], j) => `<details class="qa" ${i === 0 && j === 0 ? 'open' : ''}><summary><span>${q}${fix ? '<span class="fix">Corrected</span>' : ''}</span><i>+</i></summary><p>${a}</p></details>`).join('')}</div>`).join('')}</div>
  </div></section>`,
  init() { $$('#pg-faq [data-jump]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); document.getElementById(a.dataset.jump).scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth' }); })); },
};

PAGES.contact = {
  html: () => phead('Contact', 'Hablemos. <span class="serif grad-text">Let\'s talk.</span>', 'Questions, feedback or partnership ideas. We answer within 24 hours.') + `
  <section class="sec" style="padding-top:clamp(48px,6vw,88px)"><div class="wrap contact-grid">
    <form class="cform" novalidate id="cform">
      <div class="hide-done" style="display:grid;gap:18px">
        <div class="row2"><label for="cf-name">Name<input id="cf-name" autocomplete="name" placeholder="Your name"></label><label for="cf-email">Email<input id="cf-email" type="email" autocomplete="email" placeholder="you@email.com"></label></div>
        <div><span class="sp-label">Topic</span><div class="topics" style="margin-top:8px" id="cf-topics">${['General question', 'Billing', 'PlaySense', 'Teach with us', 'Partnership'].map((t, i) => `<button type="button" class="fchip" aria-pressed="${i === 0}">${t}</button>`).join('')}</div></div>
        <label for="cf-msg">Message<textarea id="cf-msg" placeholder="How can we help?"></textarea></label>
        <p class="err" aria-live="polite" id="cf-err"></p>
        <button class="btn btn-hot" type="submit" style="justify-self:start">Send message ${IC.arrow}</button>
      </div>
      <div class="sent" role="status"><b style="font-size:18px">Message sent.</b><p style="color:var(--humo);margin-top:6px">We'll reply to your email within 24 hours.</p></div>
    </form>
    <div class="side-info">
      <div class="info"><span class="sp-label">Email</span><b id="mail">support@latinmusicmastery.com</b><button type="button" class="btn btn-ghost btn-sm copy" id="copyMail">Copy address</button></div>
      <div class="info"><span class="sp-label">Response time</span><b>Within 24 hours</b><p>We read every message.</p></div>
      <div class="info"><span class="sp-label">Follow along</span><p>Tips, lessons and behind-the-scenes clips on Instagram, TikTok, YouTube and Facebook.</p></div>
    </div>
  </div></section>`,
  init() {
    $('#cf-topics').addEventListener('click', e => { const b = e.target.closest('button'); if (b) $$('#cf-topics button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    $('#cform').addEventListener('submit', e => {
      e.preventDefault();
      const em = $('#cf-email').value.trim(), msg = $('#cf-msg').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { $('#cf-err').textContent = 'Enter an email like name@example.com.'; return; }
      if (!msg) { $('#cf-err').textContent = 'Write a message so we know how to help.'; return; }
      $('#cform').classList.add('done');
    });
    $('#copyMail').addEventListener('click', e => {
      const btn = e.currentTarget;
      const sel = () => { const r = document.createRange(); r.selectNodeContents($('#mail')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = 'Selected. Press ⌘C to copy'; };
      try { navigator.clipboard.writeText('support@latinmusicmastery.com').then(() => { btn.textContent = 'Copied'; }, sel); } catch (_) { sel(); }
    });
  },
};

const POSTS = [
  ['Education', 'What is clave, and why does everything follow it?', 'Five strokes over two bars decide where every other part of the band lands. How to hear it, count it and feel it.'],
  ['History', 'Changuito and the birth of songo', 'How a timbalero in Los Van Van rewired the Cuban rhythm section in the 1970s.'],
  ['Tutorials', 'Practicing a tumbao with PlaySense', 'Mute the bass, loop two bars at 65% and bring the tempo up until the anticipations sit.'],
  ['History', 'Bomba and plena: two drums of Puerto Rico', 'One comes from the sugar plantations, the other from the streets of Ponce. Both are still played every weekend.'],
  ['Tutorials', 'Tuning timbales in five minutes', 'Macho, hembra and the interval between them. A quick routine before every session.'],
  ['Features', 'Inside the charanga: the violin in danzón', 'Flute, violins and a rhythm section built for the ballroom. Where cha-cha-chá came from.'],
  ['Education', 'Reading your first montuno', 'Piano montunos look busy on paper. Split one into its two hands and it becomes a pattern you can play.'],
];
PAGES.blog = {
  html: () => phead('Blog', 'Notes from <span class="serif grad-text">the bandstand.</span>', 'Tutorials, history and stories from the world of Latin music.', '<span class="sample">Sample posts to show the layout. The blog has no articles yet</span>') + `
  <div class="toolbar"><div class="wrap filters" id="bCats" style="width:100%"></div></div>
  <div class="wrap">
    <article class="blog-feature">${sleeve('La clave', 'Education', '8 MIN', 'clave-feature')}<div><span class="pcat">${POSTS[0][0]} · 8 min read</span><h2>${POSTS[0][1]}</h2><p>${POSTS[0][2]}</p><a class="btn btn-ghost" href="#blog" style="margin-top:22px">Read article</a></div></article>
    <div class="bgrid" id="bGrid"></div>
  </div><div style="height:clamp(72px,8vw,120px)"></div>`,
  init() {
    const cats = ['All', 'Tutorials', 'History', 'Education', 'Features'];
    let cur = 'All';
    const draw = () => {
      $('#bCats').innerHTML = cats.map(c => `<button class="fchip" data-c="${c}" aria-pressed="${c === cur}">${c}</button>`).join('');
      $('#bGrid').innerHTML = POSTS.slice(1).filter(p => cur === 'All' || p[0] === cur).map((p, i) => `<article class="post" style="animation:chipIn .6s ${i * 60}ms var(--ease-out) both">${sleeve(p[1].split(' ').slice(0, 2).join(' '), p[0], `${4 + i} MIN`, p[1])}<span class="pcat">${p[0]}</span><h3>${p[1]}</h3><p>${p[2]}</p></article>`).join('') || '<p class="empty">No posts in this category yet.</p>';
    };
    $('#bCats').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { cur = b.dataset.c; draw(); } });
    draw();
  },
};

/* ══════════ router + page preview nav ══════════ */
const ROUTES = [['home', 'Home'], ['explore', 'Explore'], ['son-cubano', 'Style · Son Cubano'], ['course', 'Course · Son Cubano Timbal'], ['instructors', 'Instructors'], ['patricio', 'Instructor · Patricio Díaz'], ['playsense-page', 'PlaySense'], ['pricing-page', 'Pricing'], ['about', 'About'], ['faq', 'FAQ'], ['contact', 'Contact'], ['blog', 'Blog']];
const built = {};
let curPage = 'home', menuOpen = false;
function show(pg) {
  if (pg !== 'home' && !built[pg]) {
    const box = document.getElementById('pg-' + pg);
    box.innerHTML = PAGES[pg].html();
    built[pg] = true;
    if (PAGES[pg].init) PAGES[pg].init();
    $$('video[data-autovid]', box).forEach(watchVideo);
  }
  $$('[data-page]').forEach(p => p.classList.toggle('active', p.dataset.page === pg));
  if (PAGES[pg] && PAGES[pg].show) PAGES[pg].show();
  curPage = pg;
  const navMap = { explore: 'explore', 'son-cubano': 'explore', course: 'explore', instructors: 'instructors', patricio: 'instructors', 'playsense-page': 'playsense-page', 'pricing-page': 'pricing-page', about: 'about' };
  $$('.nav a').forEach(a => a.classList.toggle('cur', a.getAttribute('href') === '#' + navMap[pg]));
  renderPageNav();
}
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  const known = h !== 'home' && ROUTES.some(r => r[0] === h);
  const was = curPage;
  show(known ? h : 'home');
  if (known || !h || h === 'top') window.scrollTo(0, 0);
  else { const el = document.getElementById(h); if (el) el.scrollIntoView({ behavior: (REDUCE || was !== 'home') ? 'auto' : 'smooth' }); }
}
function renderPageNav() {
  const i = ROUTES.findIndex(r => r[0] === curPage);
  $('#pagenav').innerHTML = `<button type="button" data-go="${ROUTES[(i + ROUTES.length - 1) % ROUTES.length][0]}" aria-label="Previous page">←</button>
    <button type="button" class="pn-cur" id="pnCur" aria-expanded="${menuOpen}">${ROUTES[i][1]} <small>${i + 1}/${ROUTES.length}</small></button>
    <button type="button" data-go="${ROUTES[(i + 1) % ROUTES.length][0]}" aria-label="Next page">→</button>
    ${menuOpen ? `<div class="pn-menu">${ROUTES.map(([k, n], j) => `<button type="button" data-go="${k}" ${k === curPage ? 'aria-current="page"' : ''}>${n}<small>${j + 1}</small></button>`).join('')}</div>` : ''}`;
}
$('#pagenav').addEventListener('click', e => {
  if (e.target.closest('#pnCur')) { menuOpen = !menuOpen; renderPageNav(); return; }
  const b = e.target.closest('[data-go]'); if (!b) return;
  menuOpen = false; const k = b.dataset.go;
  if (location.hash.slice(1) === (k === 'home' ? 'top' : k)) route(); else location.hash = k === 'home' ? 'top' : k;
});
document.addEventListener('click', e => { if (menuOpen && !e.target.closest('#pagenav')) { menuOpen = false; renderPageNav(); } });
addEventListener('hashchange', route);

/* ══════════ i18n (home copy) ══════════ */
function setLang(l) {
  LANG = l; document.documentElement.lang = l;
  $$('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
  $$('[data-es]').forEach(el => { if (el.dataset.en === undefined) el.dataset.en = el.innerHTML; el.innerHTML = l === 'es' ? el.dataset.es : el.dataset.en; });
  renderPanel(selSeat, false); renderAtlas(); renderMaestros(); renderSeq(); updateSeqUI();
  $$('[data-page="home"] [data-calc]').forEach(mountCalc);
}
$$('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));

/* ══════════ forms, header, reveal, counters, video ══════════ */
document.addEventListener('submit', e => {
  const f = e.target.closest('form.signup'); if (!f) return;
  e.preventDefault();
  const inp = $('input', f), err = f.nextElementSibling;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value.trim())) { err.textContent = T('Enter an email like name@example.com.', 'Escribe un correo como nombre@ejemplo.com.'); inp.focus(); return; }
  err.textContent = ''; f.classList.add('done');
});
const hdr = $('#hdr');
const onScroll = () => hdr.classList.toggle('scrolled', scrollY > 24);
addEventListener('scroll', onScroll, { passive: true }); onScroll();
const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
$$('.rv').forEach(el => io.observe(el));
const numIO = new IntersectionObserver(es => es.forEach(en => {
  if (!en.isIntersecting) return; numIO.disconnect(); if (REDUCE) return;
  $$('#numbers [data-count]').forEach((b, i) => {
    const to = +b.dataset.count, t0 = performance.now() + i * 90;
    const step = t => { const k = Math.max(0, Math.min(1, (t - t0) / 1300)), e = 1 - Math.pow(1 - k, 3); b.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}), { threshold: .4 });
numIO.observe($('#numbers'));
function watchVideo(v) {
  v.addEventListener('error', () => { v.style.display = 'none'; });
  if (REDUCE) { v.removeAttribute('autoplay'); return; }
  new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting && v.offsetParent) v.play().catch(() => {}); else v.pause(); })).observe(v);
}
$$('video[data-autovid]').forEach(watchVideo);
$$('[data-photo]').forEach(img => { if (PHOTOS[img.dataset.photo]) img.src = PHOTOS[img.dataset.photo]; else img.remove(); });

/* ══════════ hero piano keys ══════════ */
(() => {
  const keys = $('#keys'); if (!keys) return;
  const vis = $('#heroVis'), vids = $$('video', keys);
  const lay = () => {
    const W = keys.offsetWidth, H = keys.offsetHeight;
    $$('.key', keys).forEach(k => { k.style.setProperty('--vx', -k.offsetLeft + 'px'); k.style.setProperty('--vy', -k.offsetTop + 'px'); k.style.setProperty('--vw', W + 'px'); k.style.setProperty('--vh', H + 'px'); });
  };
  new ResizeObserver(lay).observe(keys); lay();
  vids.forEach(v => v.addEventListener('error', () => { v.style.display = 'none'; }));
  const lead = vids[0];
  lead.addEventListener('timeupdate', () => vids.slice(1).forEach(v => { if (Math.abs(v.currentTime - lead.currentTime) > .08) v.currentTime = lead.currentTime; }));
  if (!REDUCE) new IntersectionObserver(es => es.forEach(en => vids.forEach(v => en.isIntersecting ? v.play().catch(() => {}) : v.pause()))).observe(keys);
  vis.addEventListener('pointermove', e => {
    if (REDUCE || innerWidth < 1100) return;
    const r = vis.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    keys.style.setProperty('--ry', (-8 + x * 10).toFixed(2) + 'deg'); keys.style.setProperty('--rx', (4 - y * 8).toFixed(2) + 'deg');
  });
  vis.addEventListener('pointerleave', () => { keys.style.removeProperty('--ry'); keys.style.removeProperty('--rx'); });
  keys.addEventListener('click', e => {
    const k = e.target.closest('[data-midi]'); if (!k) return;
    k.classList.remove('hit'); void k.offsetWidth; k.classList.add('hit');
    setTimeout(() => k.classList.remove('hit'), 450);
    initAudio(); if (AC.state === 'suspended') AC.resume();
    const t = AC.currentTime + .02, f = hz(+k.dataset.midi), b = BUS.piano;
    osc('triangle', f, t, .16, 1.8, b); osc('sine', f * 2, t, .05, .9, b); osc('sine', f * 3, t, .018, .5, b); noise(t, .012, .05, 'highpass', 4000, .7, b);
  });
})();

/* ══════════ main loop ══════════ */
function loop(ts) {
  pumpGroove();
  const now = ts / 1000;
  WS_ALL.forEach(ws => tickWS(ws, now));
  requestAnimationFrame(loop);
}

/* boot */
buildPlot(); renderPanel(selSeat, false); renderAtlas(); renderMaestros(); renderSeq(); wireSeq(); updateSeqUI();
$$('[data-page="home"] [data-calc]').forEach(mountCalc);
mountStage($('[data-stage="home"]'));
route();
requestAnimationFrame(loop);
})();
