/* Act I: the clave, the brand, the music, the problem, the reveal (0s - 31.5s). */
(function () {
  const E = window.E, TL = E.TL;
  E.SCENES = E.SCENES || [];

  // ---------------------------------------------------------------- S0 · clave intro
  E.SCENES.push(function introScene() {
    const root = E.scene('s0', 0.0005, 10.4);
    root.style.visibility = 'visible'; root.style.opacity = 1;
    const clicks = E.DATA.introClicks;
    // footage layer for the swell
    const vid = E.el('div', 'intro-vid', root);
    const vimg = E.img('assets/seq/heroslow/f_00001.jpg', 'cover', vid);
    E.seq(vimg, { dir: 'assets/seq/heroslow', count: 140, start: 5.0, rate: 0.7, activeFrom: 4.9, activeTo: 10.0 });
    const bars = E.el('div', 'letterbox', root, '<i></i><i></i>');
    TL.fromTo(vid, { autoAlpha: 0, scale: 1.18 }, { autoAlpha: 1, scale: 1.02, duration: 4.8, ease: 'power1.inOut', immediateRender: true }, 5.0);
    TL.fromTo(vid, { filter: 'brightness(1) saturate(1)' }, { filter: 'brightness(1.5) saturate(1.3)', duration: 1.0, ease: 'power2.in', immediateRender: true }, 8.75);
    TL.fromTo(bars.children, { scaleY: 0 }, { scaleY: 1, duration: 1.2, ease: 'power3.out', immediateRender: true }, 5.2);
    // clave grid: 16 eighth notes, son clave 3-2 on 0,3,6,10,12
    const row = E.el('div', 'clave-row', root);
    const dots = [];
    for (let i = 0; i < 16; i++) { const d = E.el('div', 'clave-dot' + (i === 8 ? ' bar' : ''), row, null, { left: (465 + i * 66) + 'px' }); dots.push(d); }
    const hits = [0, 3, 6, 10, 12];
    TL.fromTo(dots, { autoAlpha: 0, scale: 0.2 }, { autoAlpha: 1, scale: 1, duration: 0.6, stagger: 0.025, ease: 'power3.out', immediateRender: true }, 0.25);
    hits.forEach((h, k) => {
      const t = clicks[k];
      TL.to(dots[h], { backgroundColor: '#FFB04A', boxShadow: '0 0 34px 10px rgba(255,140,40,.75)', scale: 1.9, duration: 0.12, ease: 'power2.out' }, t);
      TL.to(dots[h], { scale: 1.35, duration: 0.5, ease: 'power2.out' }, t + 0.12);
      const x = 960 - 7.5 * 66 + h * 66;
      E.ring(t, x, 600, { r0: 10, r1: 120, life: 0.8, width: 3, colors: ['#FFB55A'] });
      E.burst(t, x, 600, { n: 14, speed: 380, life: 0.7, size: 3, gravity: 200, kind: 'spark' });
    });
    // connect the clave strokes
    const line = E.el('div', 'clave-line', root);
    TL.fromTo(line, { scaleX: 0, autoAlpha: 0 }, { scaleX: 1, autoAlpha: 1, duration: 0.7, ease: 'power3.inOut', immediateRender: true }, 5.35);
    // typography synced to "In Latin music... everything starts with the clave."
    const l1 = E.el('div', 'intro-l1 serif', root, 'In Latin music…');
    const l2 = E.el('div', 'intro-l2', root, 'everything starts with');
    const l3 = E.el('div', 'intro-l3 serif grad-text', root, 'the clave.');
    E.fadeUp(l1, E.wordT('L01', 'in') - 0.05, { y: 30, d: 1.2 });
    E.fadeUp(l2, E.wordT('L01', 'everything') - 0.05, { y: 24, d: 0.9 });
    const l3c = E.splitChars(l3);
    TL.fromTo(l3c, { autoAlpha: 0, y: 50, scale: 0.7 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, stagger: 0.04, ease: 'expo.out', immediateRender: true }, E.wordT('L01', 'clave') - 0.12);
    // swell: type and dots dissolve into the footage
    TL.to([l1, l2], { autoAlpha: 0, y: -40, filter: 'blur(14px)', duration: 0.9, ease: 'power2.in', stagger: 0.06 }, 6.0);
    TL.to(l3c, { autoAlpha: 0, y: -40, duration: 0.7, ease: 'power2.in', stagger: 0.03 }, 6.1);
    TL.to(row, { scaleX: 2.6, autoAlpha: 0, filter: 'blur(6px)', duration: 1.4, ease: 'power2.in' }, 6.1);
    TL.to(line, { autoAlpha: 0, duration: 0.6 }, 6.2);
    E.burst(5.4, 960, 600, { n: 50, kind: 'dust', speed: 140, life: 4.5, size: 2.6, gravity: -20, spread: Math.PI * 2, colors: ['#FFD9A0', '#FFB45A', '#FFFFFF'], drag: 0.4 });
    E.burst(7.0, 960, 560, { n: 60, kind: 'dust', speed: 220, life: 3.2, size: 2.2, gravity: -30, colors: ['#FFE5BF', '#FF9A50'], drag: 0.5 });
    TL.to(E.atmos, { glow: 0.1, duration: 0.01 }, 0);
    TL.to(E.atmos, { glow: 0.65, duration: 4, ease: 'power1.in' }, 5.5);
    // build to the hit
    E.flash(9.80, 0.75, 1.0, 0.18);
    E.sfx(0.05, 'room_tone', 0.0);
    E.sfx(7.6, 'riser', 0.32, 0, { dur: 2.2 });
    E.sfx(9.80, 'impact', 0.5);
  });

  // ---------------------------------------------------------------- S1 · logo slam
  E.SCENES.push(function logoScene() {
    const t0 = E.DATA.events.hit;
    const root = E.scene('s1', t0 - 0.02, 11.25);
    const bgv = E.el('div', 'full-vid dim', root);
    const bim = E.img('assets/seq/hero/f_00001.jpg', 'cover', bgv);
    E.seq(bim, { dir: 'assets/seq/hero', count: 290, start: t0, activeFrom: t0 - 0.1, activeTo: 11.3 });
    const wrap = E.el('div', 'logo-slam', root);
    const logo = E.img('assets/img/lmm-video-watermark.png', '', wrap);
    const glow = E.el('div', 'logo-glow', wrap);
    TL.fromTo(wrap, { scale: 1.45, autoAlpha: 0, filter: 'blur(16px)' }, { scale: 1, autoAlpha: 1, filter: 'blur(0px)', duration: 0.55, ease: 'expo.out', immediateRender: true }, t0);
    TL.fromTo(glow, { autoAlpha: 0.9, scale: 0.6 }, { autoAlpha: 0, scale: 1.6, duration: 1.0, ease: 'power2.out', immediateRender: true }, t0);
    TL.to(wrap, { scale: 0.92, duration: 1.0, ease: 'none' }, t0 + 0.55);
    TL.to(wrap, { scale: 0.5, y: -330, autoAlpha: 0, filter: 'blur(10px)', duration: 0.45, ease: 'power3.in' }, 10.72);
    TL.fromTo(bgv, { scale: 1.12 }, { scale: 1.0, duration: 1.6, ease: 'expo.out', immediateRender: true }, t0);
    E.ring(t0 + 0.02, 960, 540, { r0: 60, r1: 1100, life: 0.9, width: 10, colors: ['#FFC37A'] });
    E.ring(t0 + 0.12, 960, 540, { r0: 40, r1: 800, life: 0.8, width: 4, colors: ['#FF5A48'] });
    E.burst(t0 + 0.02, 960, 540, { n: 120, speed: 1500, life: 1.3, size: 5, gravity: 600, drag: 2.2 });
    E.shake(t0, 0.45, 16);
    E.sfx(t0, 'sub_boom', 0.5);
    E.sfx(t0 + 0.02, 'shimmer', 0.42);
  });

  // ---------------------------------------------------------------- S2 · Son. Salsa. Mambo. Timba. Bolero.
  E.SCENES.push(function genreScene() {
    const v = E.vo('L02');
    const times = v.split.map(s => s.at);
    const root = E.scene('s2', 10.95, 16.75);
    const bgv = E.el('div', 'full-vid genre-vid', root);
    const bim = E.img('assets/seq/hero/f_00001.jpg', 'cover', bgv);
    E.seq(bim, { dir: 'assets/seq/hero', count: 290, start: E.DATA.events.hit, activeFrom: 10.9, activeTo: 16.8 });
    TL.fromTo(bgv, { scale: 1.0 }, { scale: 1.12, duration: 6, ease: 'none', immediateRender: true }, 10.95);
    const names = ['Son', 'Salsa', 'Mambo', 'Timba', 'Bolero'];
    const strip = E.el('div', 'genre-strip mono', root);
    const tags = names.map(n => E.el('span', '', strip, n));
    TL.fromTo(strip, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.6, immediateRender: true }, 11.0);
    names.forEach((n, i) => {
      const t = times[i];
      const w = E.el('div', 'genre-word display', root);
      const inner = E.el('span', 'grad-text', w, n);
      const idx = E.el('div', 'genre-idx mono', root, `0${i + 1} <b></b> ${['Cuba', 'Caribbean · New York', 'Cuba', 'Cuba', 'Cuba'][i]}`);
      const out = i < 4 ? times[i + 1] - 0.1 : 16.45;
      TL.fromTo(w, { autoAlpha: 0, scale: 1.35, filter: 'blur(18px)', y: 0 }, { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 0.42, ease: 'expo.out', immediateRender: true }, t - 0.06);
      TL.to(w, { scale: 1.06, duration: out - t, ease: 'none' }, t + 0.36);
      TL.to(w, { autoAlpha: 0, scale: 0.86, y: -60, filter: 'blur(12px)', duration: 0.14, ease: 'power2.in' }, out);
      TL.fromTo(idx, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.3, immediateRender: true }, t);
      TL.to(idx, { autoAlpha: 0, duration: 0.12 }, out);
      TL.to(tags[i], { color: '#FFA524', duration: 0.1 }, t);
      if (i > 0) TL.to(tags[i - 1], { color: 'rgba(246,235,221,.35)', duration: 0.1 }, t);
      E.flash(t - 0.02, 0.22, 0.28, 0.02);
      E.sfx(t - 0.06, 'whoosh_short', 0.16, (i - 2) * 0.25);
      E.burst(t, 960, 540, { n: 26, speed: 1100, life: 0.6, size: 3, gravity: 0, drag: 3.2, colors: ['#FFE2B0', '#FFA524'] });
    });
    TL.to(strip, { autoAlpha: 0, y: 20, duration: 0.3 }, 16.4);
    E.sfx(16.4, 'whoosh', 0.25);
  });

  // ---------------------------------------------------------------- S3 · history & soul (atlas)
  E.SCENES.push(function atlasScene() {
    const root = E.scene('s3', 16.38, 23.55);
    const map = E.el('div', 'atlas', root);
    const rings = E.el('div', 'atlas-rings', map, '<i></i><i></i><i></i><i></i>');
    const countries = [
      { n: 'Cuba', geo: 'La Habana · 23.11°N 82.37°W', c: '#FFA524', x: 560, y: 330, cx: 34, cy: -34, s: ['Son', 'Mambo', 'Timba', 'Bolero', 'Cha-cha-chá'] },
      { n: 'República Dominicana', geo: 'Santo Domingo · 18.49°N 69.93°W', c: '#A58BFF', x: 1130, y: 440, cx: 34, cy: -34, s: ['Merengue', 'Bachata'] },
      { n: 'Puerto Rico', geo: 'San Juan · 18.47°N 66.11°W', c: '#FF324D', x: 1440, y: 590, cx: -150, cy: 40, s: ['Bomba', 'Plena', 'Salsa'] },
      { n: 'Colombia', geo: 'Barranquilla · 10.97°N 74.80°W', c: '#2FD1B5', x: 930, y: 820, cx: 34, cy: -34, s: ['Cumbia', 'Salsa'] },
    ];
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('class', 'atlas-arcs'); svg.setAttribute('viewBox', '0 0 1920 1080'); map.appendChild(svg);
    const arcs = [];
    [[0, 1], [1, 2], [0, 3], [3, 2]].forEach(([a, b]) => {
      const A = countries[a], B = countries[b], mx = (A.x + B.x) / 2, my = Math.min(A.y, B.y) - 140;
      const p = document.createElementNS(svgNS, 'path'); p.setAttribute('d', `M${A.x},${A.y} Q${mx},${my} ${B.x},${B.y}`); svg.appendChild(p); arcs.push(p);
    });
    const mstart = [16.55, 16.95, 17.3, 17.65];
    countries.forEach((c, i) => {
      const m = E.el('div', 'marker', map, `<i style="background:${c.c};box-shadow:0 0 24px ${c.c}"></i><b style="border-color:${c.c}"></b>`, { left: c.x + 'px', top: c.y + 'px' });
      const card = E.el('div', 'mcard', map, `<div class="mname">${c.n}</div><div class="mgeo mono">${c.geo}</div><div class="mchips">${c.s.map(s => `<span>${s}</span>`).join('')}</div>`, { left: (c.x + c.cx) + 'px', top: (c.y + c.cy) + 'px', borderLeftColor: c.c });
      E.popIn(m, mstart[i], { from: 0, d: 0.5 });
      TL.fromTo(card, { autoAlpha: 0, x: -24, filter: 'blur(8px)' }, { autoAlpha: 1, x: 0, filter: 'blur(0px)', duration: 0.6, immediateRender: true }, mstart[i] + 0.08);
      TL.fromTo(card.querySelectorAll('.mchips span'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.06, immediateRender: true }, mstart[i] + 0.25);
      E.ring(mstart[i], c.x, c.y, { r0: 6, r1: 90, life: 0.8, width: 2.5, colors: [c.c] });
      E.sfx(mstart[i], 'ping', 0.2, (c.x - 960) / 960, { pitch: [0, 4, 7, 12][i] });
    });
    arcs.forEach((p, i) => { const L = 1400; p.style.strokeDasharray = L; TL.fromTo(p, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', immediateRender: true }, 18.0 + i * 0.25); });
    TL.fromTo(rings.children, { scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 2.2, stagger: 0.18, ease: 'expo.out', immediateRender: true }, 16.4);
    TL.fromTo(map, { scale: 1.08, rotation: -1.5 }, { scale: 1, rotation: 0, duration: 7, ease: 'none', immediateRender: true }, 16.4);
    TL.to(E.atmos, { grid: 0.55, glow: 0.45, duration: 0.8 }, 16.4);
    TL.to(E.atmos, { grid: 0.0, duration: 0.8 }, 23.0);
    // headline synced to the voice
    const hl = E.el('div', 'atlas-hl', root);
    const h1 = E.el('div', 'display', hl, 'Music with');
    const h2 = E.el('div', 'display big', hl, 'history,');
    const h3 = E.el('div', 'serif grad-text big2', hl, 'with soul.');
    E.fadeUp(h1, E.wordT('L03', 'music') - 0.05, { y: 40 });
    E.fadeUp(h2, E.wordT('L03', 'history') - 0.08, { y: 60 });
    E.fadeUp(h3, E.wordT('L03', 'soul') - 0.2, { y: 50, d: 1.1 });
    TL.to(hl, { autoAlpha: 0, x: -60, filter: 'blur(10px)', duration: 0.5, ease: 'power2.in' }, E.wordT('L03', 'you') - 0.35);
    // "You feel it ... before you understand it."
    const feel = E.el('div', 'feel', root);
    const f1 = E.el('div', 'serif grad-text', feel, 'Feel it');
    const f2 = E.el('div', 'mono', feel, 'before you understand it');
    E.fadeUp(f1, E.wordT('L03', 'feel') - 0.08, { y: 60, d: 1 });
    E.fadeUp(f2, E.wordT('L03', 'before') - 0.05, { y: 20, d: 0.8 });
    const pulse = E.el('div', 'heartbeat', root);
    E.beatsIn(20.2, 23.2).forEach((b, i) => {
      if (i % 2) return;
      E.ring(b, 960, 540, { r0: 140, r1: 760, life: 1.1, width: 3, colors: ['rgba(255,140,60,.9)'], alpha: 0.55 });
      TL.fromTo(pulse, { scale: 1.0, autoAlpha: 0.9 }, { scale: 1.25, autoAlpha: 0.0, duration: 0.9, ease: 'power2.out', immediateRender: false }, b);
    });
    TL.to(map, { autoAlpha: 0.06, duration: 0.5 }, 19.75);
    TL.to([feel], { autoAlpha: 0, scale: 0.96, filter: 'blur(10px)', duration: 0.4, ease: 'power2.in' }, 23.1);
    E.sfx(23.15, 'whoosh', 0.2);
  });

  // ---------------------------------------------------------------- S4 · the problem
  E.SCENES.push(function problemScene() {
    const root = E.scene('s4', 23.25, 28.6, 'cold');
    const wall = E.el('div', 'vwall', root);
    const titles = ['Salsa piano in 10 min', 'Conga basics #4', 'Learn timbales FAST', 'Bongó for beginners', 'Clave explained', 'Tumbao lesson pt. 2', 'Montuno tutorial', 'Bass groove 101', 'Cáscara pattern', 'Latin rhythms 3', 'Timba piano tricks', 'Güiro in 5 minutes'];
    const cards = titles.map((tt, i) => {
      const c = E.el('div', 'vcard', wall);
      const th = E.el('div', 'vthumb', c);
      E.img(`assets/seq/${i % 2 ? 'band' : 'hero'}/f_${String(30 + i * 19).padStart(5, '0')}.jpg`, 'cover', th);
      E.el('div', 'vplay', th, E.ICON.play);
      E.el('div', 'vdur mono', th, `${8 + (i * 7) % 14}:${String((i * 23) % 60).padStart(2, '0')}`);
      E.el('div', 'vtitle', c, tt);
      E.el('div', 'vmeta', c, `<i></i><span>${(i * 37 % 90) + 4}K views · ${1 + i % 5} years ago</span>`);
      return c;
    });
    TL.fromTo(wall, { rotationX: 30, rotationZ: -8, y: 120, scale: 1.05 }, { rotationX: 22, rotationZ: -6, y: -60, scale: 1.0, duration: 5.4, ease: 'none', immediateRender: true }, 23.3);
    TL.fromTo(cards, { autoAlpha: 0, y: 80 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: { each: 0.045, from: 'random' }, ease: 'expo.out', immediateRender: true }, 23.35);
    const q = E.el('div', 'prob-q', root);
    const q1 = E.el('div', 'serif', q, 'But learning it?');
    E.fadeUp(q1, E.wordT('L04', 'but') - 0.05, { y: 30, d: 0.8 });
    TL.to(q1, { autoAlpha: 0, y: -20, duration: 0.3 }, E.wordT('L04', 'most') - 0.15);
    // "Most videos just talk at you."
    const bubbles = [];
    [[310, 330], [820, 250], [1330, 360], [560, 650], [1150, 640]].forEach(([x, y], i) => {
      const b = E.el('div', 'talk', root, ['blah blah…', 'just watch…', 'now you try…', 'repeat after me…', 'blah blah…'][i], { left: x + 'px', top: y + 'px' });
      bubbles.push(b);
      E.popIn(b, E.wordT('L04', 'talk') - 0.25 + i * 0.09, { from: 0.4, d: 0.45 });
    });
    const talk = E.el('div', 'prob-big display', root, 'They talk.');
    E.fadeUp(talk, E.wordT('L04', 'talk') - 0.1, { y: 40, d: 0.5 });
    TL.to([talk, ...bubbles], { autoAlpha: 0, scale: 0.9, duration: 0.25, ease: 'power2.in' }, E.wordT('L04', 'they') - 0.2);
    // "They never listen back."
    const mic = E.el('div', 'nomic', root, `${E.ICON.mic}<i class="slash"></i>`);
    const never = E.el('div', 'prob-never', root, '<span class="display">They never</span> <span class="serif">listen back.</span>');
    E.popIn(mic, E.wordT('L04', 'never') - 0.15, { from: 0.3, d: 0.6 });
    TL.fromTo(mic.querySelector('.slash'), { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: 'power3.out', immediateRender: true }, E.wordT('L04', 'listen'));
    E.fadeUp(never, E.wordT('L04', 'never') - 0.05, { y: 40, d: 0.7 });
    TL.fromTo(wall, { filter: 'grayscale(0) brightness(1) blur(0px)' }, { filter: 'grayscale(1) brightness(.4) blur(3px)', duration: 0.6, immediateRender: false }, E.wordT('L04', 'never') - 0.1);
    E.sfx(E.wordT('L04', 'listen') + 0.02, 'error_soft', 0.1);
    // brass hits: everything shatters into the reveal
    const tx = E.DATA.events.mainGroove;
    cards.forEach((c, i) => {
      const r = E.rng(i + 5); const a = r() * Math.PI * 2;
      TL.to(c, { x: Math.cos(a) * 1600, y: Math.sin(a) * 1100, rotation: (r() - 0.5) * 120, autoAlpha: 0, duration: 0.55, ease: 'power3.in' }, tx - 0.45 + r() * 0.1);
    });
    TL.to([mic, never], { scale: 1.6, autoAlpha: 0, filter: 'blur(16px)', duration: 0.4, ease: 'power3.in' }, tx - 0.4);
    E.sfx(tx - 0.42, 'whoosh_big', 0.3);
  });

  // ---------------------------------------------------------------- S5 · reveal: the course
  E.SCENES.push(function revealScene() {
    const t0 = E.DATA.events.mainGroove;
    const root = E.scene('s5', t0 - 0.05, 31.75);
    E.flash(t0, 0.6, 0.85, 0.05);
    E.ring(t0 + 0.02, 960, 560, { r0: 80, r1: 1300, life: 1.0, width: 8, colors: ['#FFB55A'] });
    E.burst(t0, 960, 540, { n: 90, speed: 1300, life: 1.2, size: 4.5, gravity: 500, drag: 2 });
    E.sfx(t0, 'impact_bright', 0.32);
    const brand = E.el('div', 'reveal-brand', root);
    E.img('assets/img/large-color-logo.svg', '', brand);
    TL.fromTo(brand, { autoAlpha: 0, y: 30, scale: 0.92 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, immediateRender: true }, t0 + 0.05);
    TL.to(brand, { y: -40, autoAlpha: 0.0, scale: 0.9, duration: 0.6, ease: 'power2.in' }, 30.15);
    const changes = E.el('div', 'reveal-changes serif grad-text', root, 'changes that.');
    E.fadeUp(changes, E.wordT('L05', 'changes') - 0.1, { y: 30 });
    TL.to(changes, { autoAlpha: 0, y: -30, duration: 0.4 }, 30.3);
    const win = E.el('div', 'browser reveal-win', root);
    E.el('div', 'browser-bar', win, '<i></i><i></i><i></i><div class="url">latinmusicmastery.com/course/son-cubano-timbal</div>');
    const body = E.el('div', 'browser-body', win);
    const ov = E.buildOverview(body);
    const sh = E.el('div', 'shine', win);
    TL.fromTo(win, { autoAlpha: 0, y: 700, rotationX: 38, scale: 0.86 }, { autoAlpha: 1, y: 60, rotationX: 0, scale: 0.88, duration: 1.4, ease: 'expo.out', immediateRender: true }, 29.75);
    E.shineAcross(sh, 30.6, 1.0);
    E.animateOverview(ov, 29.85);
    TL.to(win, { scale: 1.32, x: 262, y: -10, duration: 0.75, ease: 'power3.inOut' }, 30.55);
    TL.to(win, { autoAlpha: 0, scale: 1.25, filter: 'blur(14px)', duration: 0.45, ease: 'power2.in' }, 31.35);
    E.sfx(29.75, 'whoosh_up', 0.22);
    E.sfx(30.6, 'shimmer', 0.2);
  });
})();
