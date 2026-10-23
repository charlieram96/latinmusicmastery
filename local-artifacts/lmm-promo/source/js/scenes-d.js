/* Act IV: jam sessions, the band, the montage, the invitation (104.3s - 141s). */
(function () {
  const E = window.E, TL = E.TL, I = E.ICON;
  E.SCENES = E.SCENES || [];

  // ---------------------------------------------------------------- S17 · jam sessions intro
  E.SCENES.push(function jamIntroScene() {
    const root = E.scene('s17', 104.3, 108.55, 'jam');
    const T = (w, n = 0) => E.wordT('L18', w, n);
    const beams = E.el('div', 'beams', root, '<i></i><i></i><i></i>');
    const bm = [...beams.children];
    E.onUpdate((t) => { if (t < 104.2 || t > 118.2) return; bm.forEach((b, i) => { b.style.transform = `rotate(${Math.sin(t * (0.9 + i * 0.35) + i * 2) * 28 + (i - 1) * 18}deg)`; b.style.opacity = (0.35 + 0.4 * E.energy(t, 'high')).toFixed(3); }); });
    TL.fromTo(beams, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, immediateRender: true }, 104.3);
    const pre = E.el('div', 'jam-pre', root, '<span class="mono">Then comes</span> <span class="serif">the best part</span>');
    E.fadeUp(pre, T('then') - 0.05, { y: 30 });
    TL.to(pre, { autoAlpha: 0, y: -30, duration: 0.3 }, T('jam') - 0.3);
    const title = E.el('div', 'jam-title display', root);
    const l1 = E.el('div', 'l1', title, 'Jam'); const l2 = E.el('div', 'l2', title, 'Sessions');
    TL.fromTo(l1, { autoAlpha: 0, scale: 2.2, filter: 'blur(20px)' }, { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 0.45, ease: 'expo.out', immediateRender: true }, T('jam') - 0.08);
    TL.fromTo(l2, { autoAlpha: 0, scale: 2.2, filter: 'blur(20px)' }, { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 0.45, ease: 'expo.out', immediateRender: true }, T('sessions') - 0.08);
    E.shake(T('jam'), 0.25, 10); E.shake(T('sessions'), 0.3, 12);
    E.sfx(T('jam') - 0.08, 'impact', 0.26); E.sfx(T('sessions') - 0.08, 'impact', 0.3);
    // the play-along mixer
    const mix = E.el('div', 'mixer glass', root);
    mix.innerHTML = `<div class="mx-h"><b>Play along with</b><small class="mono">6 of 6 active</small></div><div class="mx-ch"></div>`;
    const chs = [['Güiro', 'guiro', '#FFC94D'], ['Bongó', 'bongo', '#FF6A3A'], ['Conga', 'conga', '#FF5A48'], ['Bass', 'bass', '#2FD1B5'], ['Tres cubano', 'tres', '#A58BFF'], ['Piano', 'piano', '#5BC0EB']];
    const strips = chs.map(([n, ic, c], i) => E.el('div', 'mx-strip', mix.querySelector('.mx-ch'), `<span class="ic" style="color:${c}">${I[ic]}</span><b>${n}</b><div class="meter">${'<i></i>'.repeat(12)}</div><div class="fader"><i style="background:${c}"></i></div><small class="mono">100</small>`));
    TL.fromTo(mix, { autoAlpha: 0, y: 260 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out', immediateRender: true }, 104.5);
    TL.fromTo(strips, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.09, ease: 'back.out(2)', immediateRender: true }, 104.75);
    strips.forEach((s, i) => E.sfx(104.75 + i * 0.09, 'tick', 0.12, -0.6 + i * 0.24, { pitch: [0, 2, 4, 7, 9, 12][i] }));
    const meters = strips.map(s => [...s.querySelectorAll('.meter i')]);
    E.onUpdate((t) => {
      if (t < 104.5 || t > 108.6) return;
      meters.forEach((m, ci) => {
        const band = ['high', 'mid', 'low', 'low', 'mid', 'mid'][ci];
        const v = E.energy(t + ci * 0.013, band) * (0.75 + 0.25 * Math.sin(t * (7 + ci) + ci));
        const lit = Math.round(v * 12);
        m.forEach((cell, k) => { cell.className = k < lit ? (k > 9 ? 'r' : k > 7 ? 'y' : 'g') : ''; });
      });
    });
    const tm = E.DATA.events.mambo;
    TL.to([title, mix], { scale: 1.3, autoAlpha: 0, filter: 'blur(14px)', duration: 0.35, ease: 'power3.in' }, tm - 0.25);
    E.flash(tm, 0.55, 0.75, 0.04);
    E.sfx(104.3, 'riser', 0.24, 0, { dur: 3.9 });
  });

  // ---------------------------------------------------------------- S18 · the band plays with you
  E.SCENES.push(function bandScene() {
    const tm = E.DATA.events.mambo;
    const root = E.scene('s18', tm - 0.05, 118.2);
    const T = (w, n = 0) => E.wordT('L19', w, n);
    const T20 = (w, n = 0) => E.wordT('L20', w, n);
    E.burst(tm, 960, 560, { n: 160, speed: 1700, life: 1.4, size: 5, gravity: 400, drag: 2.2 });
    E.ring(tm, 960, 560, { r0: 100, r1: 1300, life: 1.0, width: 10, colors: ['#FFC37A'] });
    E.shake(tm, 0.4, 16);
    E.sfx(tm, 'sub_boom', 0.4);
    const circ = E.el('div', 'band', root);
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('viewBox', '0 0 1920 1080'); svg.setAttribute('class', 'band-beams'); circ.appendChild(svg);
    const eq = E.el('div', 'band-eq', circ);
    const eqBars = Array.from({ length: 72 }, (_, i) => E.el('i', '', eq, null, { transform: `rotate(${i * 5}deg) translateY(-190px)` }));
    const you = E.el('div', 'you', circ, `<div class="core"><span class="ic">${I.conga}</span><b>You</b></div><small class="mono">Congas</small>`);
    const members = [['Bass', 'bass', '#2FD1B5', -150], ['Piano', 'piano', '#5BC0EB', -90], ['Bongó', 'bongo', '#FF6A3A', -30], ['Güiro', 'guiro', '#FFC94D', 30], ['Tres', 'tres', '#A58BFF', 90], ['Trumpet', 'trumpet', '#FF324D', 150]];
    const R = 390, cx = 960, cy = 590;
    const nodes = members.map(([n, ic, c, deg]) => {
      const a = deg * Math.PI / 180, x = cx + Math.cos(a - Math.PI / 2) * R * 1.25, y = cy + Math.sin(a - Math.PI / 2) * R * 0.82;
      const line = document.createElementNS(svgNS, 'line'); line.setAttribute('x1', cx); line.setAttribute('y1', cy); line.setAttribute('x2', x); line.setAttribute('y2', y); line.setAttribute('stroke', c); svg.appendChild(line);
      const nd = E.el('div', 'member', circ, `<div class="disc" style="--c:${c}"><span class="ic">${I[ic]}</span></div><b>${n}</b>`, { left: x + 'px', top: y + 'px' });
      return { nd, line, c, x, y };
    });
    TL.fromTo(you, { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 0.8, ease: 'back.out(2.2)', immediateRender: true }, tm + 0.05);
    TL.fromTo(nodes.map(n => n.nd), { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 0.45, scale: 1, duration: 0.6, stagger: 0.06, ease: 'back.out(2)', immediateRender: true }, tm + 0.15);
    nodes.forEach(n => { n.line.style.strokeDasharray = 600; n.line.style.strokeDashoffset = 600; });
    const lightUp = (k, t) => {
      const n = nodes[k];
      TL.to(n.nd, { autoAlpha: 1, duration: 0.15 }, t);
      TL.set(n.nd, { attr: { class: 'member on' } }, t);
      TL.fromTo(n.nd.querySelector('.disc'), { scale: 1 }, { scale: 1.3, duration: 0.18, yoyo: true, repeat: 1, immediateRender: false }, t);
      TL.fromTo(n.line, { strokeDashoffset: 600 }, { strokeDashoffset: 0, duration: 0.45, ease: 'power2.out', immediateRender: false }, t);
      E.burst(t + 0.05, n.x, n.y, { n: 22, speed: 380, life: 0.7, size: 4, gravity: 150, colors: [n.c, '#FFFFFF'] });
      E.sfx(t, 'pluck', 0.22, (n.x - 960) / 960, { pitch: [0, 4, 7, 9, 12, 16][k] });
    };
    lightUp(0, T('bass')); lightUp(1, T('piano')); lightUp(2, T('bong')); lightUp(3, T('gui'));
    const tw = T('whole');
    lightUp(4, tw); lightUp(5, tw + 0.12);
    TL.fromTo(circ, { rotation: 0 }, { rotation: 0, duration: 0.01, immediateRender: true }, tm);
    const head = E.el('div', 'band-head', root, '<span class="display">The whole band</span> <span class="serif grad-text">plays with you.</span>');
    E.fadeUp(head, tw - 0.1, { y: 40 });
    // pulses on the beat, audio-reactive ring
    E.beatsIn(tw, 114.0).forEach((b, i) => { if (i % 2 === 0) E.ring(b, cx, cy, { r0: 120, r1: 520, life: 0.8, width: 3, colors: ['rgba(255,170,80,.9)'], alpha: 0.5 }); });
    E.onUpdate((t) => {
      if (t < tm || t > 114.6) return;
      const lo = E.energy(t, 'low'), mi = E.energy(t, 'mid'), hi = E.energy(t, 'high');
      eqBars.forEach((b, i) => { const v = [lo, mi, hi][i % 3] * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.3 + t * 5))); b.style.height = (10 + v * 90).toFixed(1) + 'px'; });
      you.querySelector('.core').style.boxShadow = `0 0 0 ${10 + lo * 18}px rgba(255,140,40,.18), 0 0 ${60 + lo * 80}px rgba(255,130,40,${(0.45 + 0.4 * lo).toFixed(2)})`;
    });
    TL.to([circ, head], { autoAlpha: 0, scale: 1.15, filter: 'blur(10px)', duration: 0.45, ease: 'power2.in' }, 113.75);
    // the real band: you're playing in the orquesta
    const vid = E.el('div', 'full-vid band-vid', root);
    const vim = E.img('assets/seq/heroslow/f_00001.jpg', 'cover', vid);
    vim.style.transform = 'scale(1.36)';
    E.seq(vim, { dir: 'assets/seq/heroslow', count: 140, start: 113.9, rate: 0.85, offset: 0, activeFrom: 113.8, activeTo: 118.3 });
    TL.fromTo(vid, { autoAlpha: 0, scale: 1.2 }, { autoAlpha: 1, scale: 1.04, duration: 1.2, ease: 'expo.out', immediateRender: true }, 113.9);
    const s1 = E.el('div', 'orq-1', root, 'You’re not just practicing anymore.');
    const s2 = E.el('div', 'orq-2', root, '<span class="display">You’re playing in the</span> <span class="serif grad-text">orquesta.</span>');
    E.fadeUp(s1, T20('you') - 0.05, { y: 24 });
    TL.to(s1, { autoAlpha: 0, y: -20, duration: 0.3 }, T20('you', 1) - 0.25);
    E.fadeUp(s2, T20('you', 1) - 0.05, { y: 40, d: 0.8 });
    E.sfx(113.85, 'whoosh_big', 0.22);
    TL.to([s2], { autoAlpha: 0, duration: 0.3 }, 117.75);
  });

  // ---------------------------------------------------------------- S19 · beat-cut montage
  E.SCENES.push(function montageScene() {
    const root = E.scene('s19', 117.7, 126.75);
    const beats = E.beatsIn(117.75, 126.6).filter((_, i) => i % 2 === 0);
    const shots = [
      { k: 'seq', dir: 'assets/seq/ps_conga', count: 420, first: 0, offset: 300, zoom: 1.14, origin: '50% 100%' },
      { k: 'seq', dir: 'assets/seq/band', count: 275, first: 1, offset: 0, zoom: 1.6, origin: '35% 55%' },
      { k: 'seq', dir: 'assets/seq/ps_piano', count: 240, first: 0, offset: 150, zoom: 1.14, origin: '50% 100%' },
      { k: 'seq', dir: 'assets/seq/hero', count: 290, first: 1, offset: 195, rate: 0.5, zoom: 1.6, origin: '35% 40%' },
      { k: 'seq', dir: 'assets/seq/miami', count: 360, first: 1, offset: 150 },
      { k: 'faces' },
      { k: 'seq', dir: 'assets/seq/ps_conga', count: 420, first: 0, offset: 60, zoom: 1.14, origin: '50% 100%' },
      { k: 'seq', dir: 'assets/seq/band', count: 275, first: 1, offset: 140 },
    ];
    const words = ['Learn it.', null, 'Play it.', null, 'Feel it.', null, 'Live it.', null];
    beats.slice(0, shots.length).forEach((b, i) => {
      const end = beats[i + 1] ?? 126.6;
      const sh = shots[i];
      const box = E.el('div', 'mshot', root);
      if (sh.k === 'img') E.img(sh.src, 'cover', box);
      else if (sh.k === 'faces') E.el('div', 'mfaces', box, ['leo_garcia', 'manuel_orza', 'niuver_usa', 'rolando_morejon', 'yan_carlos_artime'].map(f => `<img src="assets/img/teachers/${f}.jpg">`).join(''));
      else { const im = E.img(`${sh.dir}/f_${String(sh.first + sh.offset).padStart(5, '0')}.jpg`, 'cover', box); if (sh.zoom) { im.style.transform = `scale(${sh.zoom})`; im.style.transformOrigin = sh.origin; } E.seq(im, { dir: sh.dir, count: sh.count, first: sh.first, start: b, offset: sh.offset, rate: sh.rate || 1, activeFrom: b - 0.05, activeTo: end + 0.05 }); }
      TL.set(box, { autoAlpha: 1 }, b);
      TL.set(box, { autoAlpha: 0 }, end);
      TL.fromTo(box, { scale: 1.18, rotation: i % 2 ? 1.2 : -1.2 }, { scale: 1.02, rotation: 0, duration: end - b, ease: 'power2.out', immediateRender: false }, b);
      E.flash(b, 0.16, 0.35, 0.01);
      E.sfx(b - 0.03, 'whoosh_short', 0.14, i % 2 ? 0.4 : -0.4);
      if (words[i]) {
        const w = E.el('div', 'mword display', root, `<span class="grad-text">${words[i]}</span>`);
        TL.fromTo(w, { autoAlpha: 0, scale: 1.5, filter: 'blur(16px)' }, { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 0.35, ease: 'expo.out', immediateRender: true }, b);
        TL.to(w, { autoAlpha: 0, scale: 0.9, duration: 0.15 }, end + (beats[i + 2] ? (beats[i + 2] - end) : 1.1) - 0.12);
      }
    });
    const vig = E.el('div', 'mvig', root);
  });

  // ---------------------------------------------------------------- S20 · the band is ready. your part is missing.
  E.SCENES.push(function finaleScene() {
    const t0 = E.DATA.events.finale;
    const root = E.scene('s20', t0 - 0.1, null);
    const T = (w, n = 0) => E.wordT('L21', w, n);
    E.flash(t0, 0.35, 0.45, 0.02);
    const plot = E.el('div', 'fin-plot', root);
    const pos = [[300, 130], [450, 130], [612, 130], [770, 130], [130, 300], [290, 300], [540, 300], [668, 300], [796, 300], [215, 455], [350, 455], [690, 455]];
    const seats = pos.map(([x, y]) => E.el('div', 'fseat on', plot, '<i></i>', { left: x + 'px', top: y + 'px' }));
    const empty = E.el('div', 'fseat empty', plot, '<i></i><b class="mono">You</b>', { left: '520px', top: '455px' });
    TL.fromTo(plot, { autoAlpha: 0, rotationX: 55, y: 140 }, { autoAlpha: 0.9, rotationX: 50, y: 0, duration: 1.4, ease: 'expo.out', immediateRender: true }, t0);
    TL.fromTo(seats, { scale: 0 }, { scale: 1, duration: 0.4, stagger: 0.04, ease: 'back.out(2)', immediateRender: true }, t0 + 0.2);
    const l1 = E.el('div', 'fin-1 display', root, 'The band is ready.');
    const w1 = E.splitWords(l1);
    E.wordsIn(w1, [T('the'), T('band'), T('is'), T('ready')], { y: 50, blur: 14, d: 0.5 });
    const l2 = E.el('div', 'fin-2 serif', root, 'Your part is missing.');
    const w2 = E.splitWords(l2);
    w2.forEach(w => w.classList.add('grad-text'));
    E.wordsIn(w2, [T('your'), T('part'), T('is', 1), T('missing')], { y: 50, blur: 14, d: 0.6 });
    E.onUpdate((t) => { if (t < t0 || t > 131) return; empty.querySelector('i').style.boxShadow = `0 0 0 ${6 + 6 * Math.abs(Math.sin(t * 3.2))}px rgba(255,165,36,.25)`; });
    // the empty seat ignites and becomes the brand
    const ti = 130.55;
    TL.set(empty, { attr: { class: 'fseat empty lit' } }, ti);
    E.burst(ti, 960, 760, { n: 140, speed: 900, life: 1.6, size: 4, gravity: -200, dir: -Math.PI / 2, spread: 1.6, colors: ['#FFD27A', '#FFA524', '#FF6A3A', '#FFFFFF'] });
    E.ring(ti, 960, 760, { r0: 20, r1: 600, life: 0.9, width: 5, colors: ['#FFB55A'] });
    E.sfx(ti, 'ignite', 0.34);
    TL.to([l1, l2], { autoAlpha: 0, y: -50, filter: 'blur(12px)', duration: 0.5, ease: 'power2.in' }, ti - 0.05);
    TL.to(plot, { autoAlpha: 0.25, y: 120, duration: 0.8 }, ti);
    TL.to(plot, { autoAlpha: 0, duration: 0.8 }, ti + 1.4);
    const logo = E.el('div', 'fin-logo', root, '<img src="assets/img/large-color-logo.svg"><span class="shine-mask"><i class="shine"></i></span>');
    const tl = E.wordT('L22', 'latin') - 0.15;
    TL.fromTo(logo, { autoAlpha: 0, scale: 0.75, filter: 'blur(20px)' }, { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out', immediateRender: true }, tl);
    E.shineAcross(logo.querySelector('.shine'), tl + 0.5, 1.1);
    E.sfx(tl, 'shimmer', 0.3);
    const tag = E.el('div', 'fin-tag serif', root, 'Learn from the masters of <span class="grad-text">la música latina.</span>');
    E.fadeUp(tag, tl + 0.9, { y: 24 });
    TL.to(logo, { y: -175, scale: 0.84, duration: 0.6, ease: 'power3.inOut' }, 134.7);
    TL.to(tag, { autoAlpha: 0, y: -20, duration: 0.35, ease: 'power2.in' }, 134.7);
    TL.to(root, { autoAlpha: 0, duration: 0.7, ease: 'power1.in' }, E.DATA.duration - 0.75);
    E.shineAcross(logo.querySelector('.shine'), E.DATA.events.stinger + 0.3, 1.2);
    const turno = E.el('div', 'turno serif', root, '<span class="grad-text">¡Tu turno!</span>');
    const tt = E.wordT('L23', 'tu') - 0.08;
    TL.fromTo(turno, { autoAlpha: 0, scale: 0.4, rotation: -6 }, { autoAlpha: 1, scale: 1, rotation: -3, duration: 0.55, ease: 'back.out(2.2)', immediateRender: true }, tt);
    TL.to(turno, { scale: 1.06, duration: 0.85, ease: 'none' }, tt + 0.55);
    TL.to(turno, { scale: 0.92, rotation: -2, duration: 0.5, ease: 'expo.out' }, E.DATA.events.stinger);
    E.burst(tt + 0.1, 960, 520, { n: 70, kind: 'star', speed: 900, life: 1.2, size: 10, gravity: 300, colors: ['#FFD27A', '#FFFFFF', '#FFA524'] });
  });

  // ---------------------------------------------------------------- S21 · end card
  E.SCENES.push(function endScene() {
    const ts = E.DATA.events.stinger;
    const root = E.scene('s21', ts - 0.02, null);
    E.flash(ts, 0.8, 1.0, 0.03);
    E.shake(ts, 0.35, 14);
    E.ring(ts + 0.02, 960, 520, { r0: 80, r1: 1300, life: 1.1, width: 10, colors: ['#FFC37A'] });
    E.burst(ts + 0.02, 960, 520, { n: 90, kind: 'spark', speed: 1500, life: 1.6, size: 4, gravity: 250, drag: 2.4, colors: ['#FFD27A', '#FFA524', '#FF6A3A', '#FFFFFF'] });
    E.burst(ts + 0.1, 960, 520, { n: 40, kind: 'star', speed: 700, life: 1.8, size: 9, gravity: 120, colors: ['#FFE6B0', '#FFC94D', '#FFFFFF'] });
    E.sfx(ts, 'sub_boom', 0.4);
    const cta = E.el('div', 'end-cta', root, `<span class="btn-orange">Join the waitlist${I.arrow}</span><small class="mono">Founding-member pricing</small>`);
    E.fadeUp(cta, ts + 0.75, { y: 24 });
    const url = E.el('div', 'end-url mono', root, 'latinmusicmastery.com');
    E.fadeUp(url, ts + 1.0, { y: 16 });
    const feat = E.el('div', 'end-feat mono', root, ['Maestros', 'PlaySense', 'Jam sessions', 'Community', 'Kids world', 'EN · ES'].map(x => `<span>${x}</span>`).join('<b>·</b>'));
    E.fadeUp(feat, ts + 1.25, { y: 16 });
    E.burst(ts + 1.2, 960, 540, { n: 70, kind: 'dust', speed: 120, life: 3.5, size: 2.4, gravity: -15, colors: ['#FFE2B0', '#FFA524', '#FFFFFF'], drag: 0.3 });
    TL.to(root, { autoAlpha: 0, duration: 0.7, ease: 'power1.in' }, E.DATA.duration - 0.75);
    TL.to(E.atmos, { glow: 0.0, duration: 0.7 }, E.DATA.duration - 0.75);
  });
})();
