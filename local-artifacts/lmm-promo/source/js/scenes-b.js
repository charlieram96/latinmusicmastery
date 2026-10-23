/* Act II: maestros, instruments, the path, the game loop, the kids world (31.5s - 65.2s). */
(function () {
  const E = window.E, TL = E.TL, I = E.ICON;
  E.SCENES = E.SCENES || [];

  // ---------------------------------------------------------------- course overview (dark recreation of /course/[id])
  const PATH = [
    { n: 'Course Overview', i: 'play' }, { n: 'Basic Timbales Course', i: 'book' }, { n: 'Parts of the Timbales', i: 'book' },
    { n: 'Tuning the Timbales', i: 'book' }, { n: 'Basic Sound', i: 'note' }, { n: 'Stick Grip & Rebound', i: 'book' },
    { n: 'Single & Double Strokes', i: 'book' }, { n: 'Accents & Dynamics', i: 'book' }, { n: 'Module 1 checkpoint', i: 'trophy' },
  ];
  E.buildOverview = (parent) => {
    const o = E.el('div', 'ov app', parent);
    const L = E.el('div', 'ov-left', o);
    const chips = E.el('div', 'ov-chips', L, `<span>${I.note}Son Cubano</span><span>${I.timbal}Timbal</span><span>${I.globe}Cuba</span><em>All levels</em>`);
    const h1 = E.el('h1', 'ov-h1', L, 'Son Cubano Timbal');
    const tr = E.el('div', 'ov-teacher', L, `<img src="assets/img/caps/patricio.jpg"><b>Patricio “el Chino” Díaz</b><span>· Timbal</span><a>View profile</a>`);
    const ph = E.el('div', 'ov-pathhead', L, `<b>Your path</b><span>· 1 of 14 lessons done</span>`);
    const mods = E.el('div', 'ov-mods', L, `<span><i>MODULE 1</i> Course Welcome</span><span><i>MODULE 2</i> Fundamentals of the Timbal</span>`);
    const path = E.el('div', 'ov-path', L);
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('viewBox', '0 0 1120 220'); path.appendChild(svg);
    const pts = PATH.map((p, i) => ({ x: 50 + i * 128, y: 96 + Math.sin(i * 1.15) * 34 }));
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p.x + ',' + p.y).join(' ');
    const line = document.createElementNS(svgNS, 'path'); line.setAttribute('d', d); line.setAttribute('class', 'ov-dots'); svg.appendChild(line);
    const nodes = PATH.map((p, i) => {
      const n = E.el('div', 'ov-node' + (i === 0 ? ' cur' : '') + (p.i === 'trophy' ? ' trophy' : ''), path, `<span class="ic">${I[p.i]}</span><label>${p.n}</label>`, { left: pts[i].x + 'px', top: pts[i].y + 'px' });
      return n;
    });
    const bubble = E.el('div', 'ov-bubble', path, 'CONTINUE', { left: pts[0].x + 'px', top: (pts[0].y - 78) + 'px' });
    const desc = E.el('p', 'ov-desc', L, 'Develop your timbal technique with authentic patterns, cáscara, bell work and fills. Learn to lead the rhythm section with authority.');
    const mh = E.el('div', 'ov-modhead', L, `<b>01</b><span>Course Welcome</span><em>11 lessons · In progress</em>`);
    const seg = E.el('div', 'ov-seg', L, '<i class="on"></i>' + '<i></i>'.repeat(10));
    const rows = [
      E.el('div', 'ov-row cur', L, `<span class="pl">${I.play}</span><div><b>Course Overview</b><small>Video · 1 of 1 items done</small></div><em>Continue lesson</em>`),
      E.el('div', 'ov-row', L, `<span class="num">2</span><div><b>Basic Timbales Course</b><small>Lesson · Exercise · Quiz</small></div>`),
      E.el('div', 'ov-row', L, `<span class="num">3</span><div><b>Parts of the Timbales, Setup and Playing Position</b><small>Lesson · Exercise · Quiz</small></div>`),
    ];
    const R = E.el('div', 'ov-right', o);
    const banner = E.el('div', 'ov-banner', R, `<img src="assets/img/caps/patricio.jpg">`);
    const prog = E.el('div', 'ov-prog', R, `<div class="ring"><svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="25"/><circle class="fill" cx="30" cy="30" r="25"/></svg><b>14%</b></div><div><b>Lesson 2 of 14</b><small>Basic Timbales Course</small></div>`);
    const tiles = E.el('div', 'ov-tiles', R, `<div><b>4</b><small>Modules</small></div><div><b>14</b><small>Lessons</small></div><div><b>All levels</b><small>Level</small></div><div><b>EN · ES</b><small>Language</small></div>`);
    const cta = E.el('div', 'btn-orange ov-cta', R, `${I.play}<span>CONTINUE LESSON</span>`);
    const incl = E.el('div', 'ov-incl', R, `${I.check}<span>Included in your plan</span>`);
    const list = E.el('ul', 'ov-list', R, ['14 learning items', 'Interactive sheet music & tabs', 'Practice backing tracks', 'Certificate of completion'].map(x => `<li>${I.check}<span>${x}</span></li>`).join(''));
    return { o, chips, h1, tr, ph, mods, path, line, nodes, bubble, desc, mh, seg, rows, banner, prog, tiles, cta, incl, list };
  };
  E.animateOverview = (v, t) => {
    const items = [v.chips, v.h1, v.tr, v.ph, v.mods];
    TL.fromTo(items, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.07, immediateRender: true }, t);
    const L = 1300; v.line.style.strokeDasharray = '2 14';
    TL.fromTo(v.nodes, { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 0.5, stagger: 0.06, ease: 'back.out(2.4)', immediateRender: true }, t + 0.3);
    TL.fromTo(v.line, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, immediateRender: true }, t + 0.3);
    TL.fromTo(v.bubble, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'back.out(3)', immediateRender: true }, t + 0.8);
    TL.fromTo([v.desc, v.mh, v.seg, ...v.rows], { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.06, immediateRender: true }, t + 0.45);
    TL.fromTo([v.banner, v.prog, v.tiles, v.cta, v.incl, v.list], { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: 0.7, stagger: 0.06, immediateRender: true }, t + 0.2);
    const ring = v.prog.querySelector('.fill');
    TL.fromTo(ring, { strokeDashoffset: 157 }, { strokeDashoffset: 157 * (1 - 0.14), duration: 1.2, ease: 'power2.out', immediateRender: true }, t + 0.7);
    E.onUpdate((tt) => { const k = E.clamp((tt - t - 0.8) / 0.5); v.bubble.style.marginTop = (-Math.abs(Math.sin((tt - t) * 5)) * 8 * k) + 'px'; });
  };

  // ---------------------------------------------------------------- S6 · maestros
  E.SCENES.push(function maestrosScene() {
    const root = E.scene('s6', 31.45, 36.9);
    const T = (w, n = 0) => E.wordT('L06', w, n);
    const head = E.el('div', 'm-head', root);
    const eb = E.el('div', 'eyebrow', head, 'The maestros');
    const h = E.el('div', 'm-title', head, '<span class="display">Learn from</span> <span class="display">real</span> <span class="serif grad-text">maestros.</span>');
    const sub = E.el('div', 'm-sub', root, 'The musicians who play this music every night.');
    E.fadeUp(eb, 31.5, { y: 20 });
    E.wordsIn([...h.children], [T('learn'), T('learn') + 0.18, T('real'), T('maestros')], { y: 50, blur: 12, d: 0.6 });
    E.fadeUp(sub, T('musicians') - 0.1, { y: 24 });
    const rail = E.el('div', 'm-rail', root);
    const people = [['leo_garcia', 'Leo García'], ['manuel_orza', 'Manuel Orza'], ['niuver_usa', 'Niuver'], ['rolando_morejon', 'Rolando Morejón'], ['yan_carlos_artime', 'Yan Carlos Artime']];
    const cards = people.map(([f, n], i) => {
      const c = E.el('div', 'm-card', rail);
      E.img(`assets/img/teachers/${f}.jpg`, 'cover', c);
      E.el('div', 'm-tint', c);
      E.el('div', 'm-grad', c);
      E.el('div', 'm-name', c, `<small class="mono">Maestro</small><b>${n}</b>`);
      E.el('div', 'm-spot', c);
      return c;
    });
    TL.fromTo(cards, { autoAlpha: 0, x: 500, rotationY: -35 }, { autoAlpha: 1, x: 0, rotationY: 0, duration: 1.1, stagger: 0.11, ease: 'expo.out', immediateRender: true }, 31.6);
    TL.fromTo(rail, { x: 40 }, { x: -60, duration: 5.4, ease: 'none', immediateRender: true }, 31.5);
    // stage-light sweep on "every night"
    const tn = T('night');
    cards.forEach((c, i) => {
      const sp = c.querySelector('.m-spot');
      TL.fromTo(sp, { autoAlpha: 0, xPercent: -100 }, { autoAlpha: 1, xPercent: 100, duration: 0.9, ease: 'power2.inOut', immediateRender: true }, T('every') + i * 0.09);
      TL.fromTo(c.querySelector('img'), { filter: 'grayscale(1) contrast(1.15) brightness(.95)' }, { filter: 'grayscale(0) contrast(1.05) brightness(1)', duration: 0.6, ease: 'power2.out', immediateRender: false }, T('every') + i * 0.09 + 0.35);
      TL.to(c.querySelector('.m-tint'), { opacity: 0.0, duration: 0.6, ease: 'power2.out' }, T('every') + i * 0.09 + 0.35);
    });
    TL.to(cards[2], { scale: 1.07, boxShadow: '0 0 0 3px rgba(255,165,36,.9), 0 40px 120px rgba(255,120,40,.45)', duration: 0.5, ease: 'back.out(2)' }, tn - 0.1);
    E.burst(tn, 960, 640, { n: 40, kind: 'star', speed: 520, life: 1.2, size: 9, gravity: 200, colors: ['#FFD27A', '#FFFFFF', '#FFA524'] });
    TL.to([head, sub], { autoAlpha: 0, y: -30, duration: 0.35, ease: 'power2.in' }, 36.5);
    TL.to(rail, { autoAlpha: 0, scale: 0.92, duration: 0.35, ease: 'power2.in' }, 36.55);
    cards.forEach((c, i) => E.sfx(31.62 + i * 0.11, 'card_swoosh', 0.14, -0.3 + i * 0.15));
    E.sfx(tn - 0.05, 'sparkle', 0.24);
  });

  // ---------------------------------------------------------------- S7 · instruments on the stage plot
  E.SCENES.push(function stageScene() {
    const root = E.scene('s7', 36.8, 42.7);
    const T = (w, n = 0) => E.wordT('L07', w, n);
    const head = E.el('div', 'sp-head', root, '<div class="eyebrow">Pick your instrument</div><div class="display">Take your seat</div><div class="serif grad-text">in the orquesta.</div>');
    E.fadeUp([...head.children], 36.85, { y: 40, stagger: 0.1 });
    const plot = E.el('div', 'sp-plot', root);
    E.el('div', 'sp-riser', plot, '<span class="mono">RISER 8′×24′ · +16″</span>');
    E.el('div', 'sp-aud mono', plot, '▼ AUDIENCE ▼');
    const seats = {
      Timbal: [450, 130, 'timbal', 'Timbal'], Conga: [290, 130, 'conga', 'Congas'], Bongo: [612, 130, 'bongo', 'Bongó'], Drums: [770, 130, 'drum', 'Drums'],
      Piano: [130, 300, 'piano', 'Piano'], Bass: [290, 300, 'bass', 'Bass'], Tres: [540, 300, 'tres', 'Tres'], Guitar: [668, 300, 'guitar', 'Guitar'], Violin: [796, 300, 'violin', 'Violin'],
      Sax: [215, 455, 'sax', 'Sax'], Trumpet: [350, 455, 'trumpet', 'Trumpet'], Voice: [520, 455, 'mic', 'Voice'],
    };
    const el = {};
    Object.entries(seats).forEach(([k, [x, y, ic, label]], i) => {
      el[k] = E.el('div', 'seat', plot, `<div class="disc"><span class="ic">${I[ic]}</span></div><label>${label}</label>`, { left: x + 'px', top: y + 'px' });
    });
    TL.fromTo(plot, { autoAlpha: 0, rotationX: 50, y: 120, scale: 0.9 }, { autoAlpha: 1, rotationX: 28, y: 0, scale: 1, duration: 1.2, ease: 'expo.out', immediateRender: true }, 36.85);
    TL.fromTo(Object.values(el), { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.5, stagger: 0.03, ease: 'back.out(2)', immediateRender: true }, 37.0);
    const light = (k, t, pitch) => {
      const s = el[k];
      TL.set(s, { attr: { class: 'seat on' } }, t);
      TL.fromTo(s.querySelector('.disc'), { scale: 1 }, { scale: 1.28, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1, immediateRender: false }, t);
      E.sfx(t, 'pluck', 0.26, 0, { pitch });
    };
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    light('Timbal', T('timbales'), scale[0]);
    light('Conga', T('congas'), scale[1]);
    light('Bongo', T('bong'), scale[2]);
    light('Piano', T('piano'), scale[3]);
    light('Bass', T('bass'), scale[4]);
    light('Tres', T('tres'), scale[5]);
    const tm = T('more') + 0.15;
    ['Drums', 'Guitar', 'Violin', 'Sax', 'Trumpet', 'Voice'].forEach((k, i) => { TL.set(el[k], { attr: { class: 'seat on' } }, tm - 0.1 + i * 0.09); });
    E.sfx(tm - 0.1, 'sparkle', 0.24);
    E.burst(tm + 0.35, 1330, 560, { n: 26, kind: 'star', speed: 420, life: 1.0, size: 7, gravity: 260, colors: ['#FFD27A', '#FFA524', '#FFFFFF'] });
    TL.to(plot, { rotationX: 18, scale: 1.04, duration: 5.5, ease: 'none' }, 37.2);
    TL.to([head, plot], { autoAlpha: 0, y: -40, filter: 'blur(10px)', duration: 0.4, ease: 'power2.in', stagger: 0.05 }, 42.3);
  });

  // ---------------------------------------------------------------- S8 · every course is a path
  E.SCENES.push(function pathScene() {
    const root = E.scene('s8', 42.55, 48.85);
    const T = (w, n = 0) => E.wordT('L08', w, n);
    const head = E.el('div', 'pa-head', root, '<div class="eyebrow">Son Cubano Timbal · Your path</div><div class="pa-title"><span class="display">Every course</span> <span class="serif grad-text">is a path.</span></div>');
    E.fadeUp([...head.children], 42.6, { y: 40, stagger: 0.12 });
    const lane = E.el('div', 'pa-lane', root);
    const track = E.el('div', 'pa-track', lane);
    const steps = [
      ['Course Overview', 'play'], ['Basic Timbales', 'book'], ['Tuning', 'book'], ['First beat', 'note'], ['Stick grip', 'book'], ['Doubles', 'book'],
      ['Accents', 'book'], ['Checkpoint', 'trophy'], ['Cáscara', 'note'], ['Abanico', 'note'], ['Your first solo', 'star'],
    ];
    const pts = steps.map((s, i) => ({ x: 160 + i * 300, y: 640 + Math.sin(i * 0.95) * 110 }));
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('viewBox', `0 0 ${pts[pts.length - 1].x + 300} 1080`); svg.setAttribute('width', pts[pts.length - 1].x + 300); svg.setAttribute('height', 1080); track.appendChild(svg);
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; d += ` C${a.x + 150},${a.y} ${b.x - 150},${b.y} ${b.x},${b.y}`; }
    const base = document.createElementNS(svgNS, 'path'); base.setAttribute('d', d); base.setAttribute('class', 'pa-base'); svg.appendChild(base);
    const prog = document.createElementNS(svgNS, 'path'); prog.setAttribute('d', d); prog.setAttribute('class', 'pa-prog'); svg.appendChild(prog);
    const total = 3400; prog.style.strokeDasharray = total;
    const nodes = steps.map(([n, ic], i) => E.el('div', 'pa-node' + (ic === 'star' ? ' gold' : '') + (ic === 'trophy' ? ' trophy' : ''), track, `<div class="disc"><span class="ic">${I[ic]}</span><span class="ic ok">${I.check}</span></div><label>${n}</label>`, { left: pts[i].x + 'px', top: pts[i].y + 'px' }));
    const bub = E.el('div', 'pa-bubble', track, 'CONTINUE');
    TL.fromTo(nodes, { autoAlpha: 0, scale: 0.2 }, { autoAlpha: 1, scale: 1, duration: 0.5, stagger: 0.05, ease: 'back.out(2.2)', immediateRender: true }, 42.7);
    TL.fromTo(base, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, immediateRender: true }, 42.7);
    // camera pan along the path; completion follows the voice
    const tStart = T('step'), tEnd = T('solo') + 0.2;
    TL.fromTo(track, { x: 0 }, { x: -(pts[pts.length - 1].x - 1500), duration: tEnd - 43.2 + 0.4, ease: 'power1.inOut', immediateRender: true }, 43.2);
    const done = steps.length - 1;
    for (let i = 0; i < done; i++) {
      const t = tStart + (tEnd - 0.5 - tStart) * (i / (done - 1));
      TL.set(nodes[i], { attr: { class: 'pa-node done' + (steps[i][1] === 'trophy' ? ' trophy' : '') } }, t);
      TL.fromTo(nodes[i].querySelector('.disc'), { scale: 1 }, { scale: 1.25, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, t);
      E.sfx(t, i === 7 ? 'chime' : 'pop', i === 7 ? 0.28 : 0.2, 0, { pitch: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16][i] || 0 });
    }
    TL.fromTo(prog, { strokeDashoffset: total }, { strokeDashoffset: total * 0.06, duration: tEnd - tStart, ease: 'none', immediateRender: true }, tStart);
    E.onUpdate((t) => {
      // bubble rides on the next node to complete
      const k = E.clamp((t - tStart) / (tEnd - 0.5 - tStart));
      const f = Math.min(done, k * (done - 1) + 1), i = Math.floor(f), fr = f - i;
      const a = pts[Math.min(i, pts.length - 1)], b = pts[Math.min(i + 1, pts.length - 1)];
      const e = E.smooth(fr * 3 - 2);
      bub.style.left = (a.x + (b.x - a.x) * e) + 'px';
      bub.style.top = (a.y + (b.y - a.y) * e - 92 - Math.abs(Math.sin(t * 6)) * 10) + 'px';
      bub.style.opacity = t < 42.9 ? 0 : (t > tEnd ? 0 : 1);
    });
    // the gold finish
    const ts = T('solo');
    TL.set(nodes[done], { attr: { class: 'pa-node gold done' } }, ts);
    TL.fromTo(nodes[done].querySelector('.disc'), { scale: 1 }, { scale: 1.4, duration: 0.35, ease: 'back.out(3)', immediateRender: false }, ts);
    E.burst(ts + 0.05, 1500 + 0, 640 + Math.sin(10 * 0.95) * 110, { n: 120, kind: 'confetti', speed: 1000, life: 2.2, size: 9, gravity: 900, dir: -Math.PI / 2, spread: 2.4, colors: ['#FFA524', '#FF324D', '#2FD1B5', '#FFC94D', '#A58BFF'] });
    E.sfx(ts, 'success', 0.34);
    const tagFirst = E.el('div', 'pa-tag', root, '<span class="mono">From your very first beat</span>');
    const tagSolo = E.el('div', 'pa-tag r', root, '<span class="mono">to your first solo</span>');
    E.fadeUp(tagFirst, T('first') - 0.1, { y: 20 });
    TL.to(tagFirst, { autoAlpha: 0, duration: 0.3 }, T('to', 0) - 0.05);
    E.fadeUp(tagSolo, T('solo') - 0.4, { y: 20 });
    TL.to([head, track, tagSolo], { autoAlpha: 0, y: -40, filter: 'blur(10px)', duration: 0.4, ease: 'power2.in' }, 48.45);
  });

  // ---------------------------------------------------------------- S9 · the game loop
  E.SCENES.push(function gameScene() {
    const root = E.scene('s9', 48.6, 57.6);
    const T = (w, n = 0) => E.wordT('L09', w, n);
    const cap = E.el('div', 'g-cap', root);
    const words = [['Short lessons.', T('short')], ['Playful exercises.', T('playful')], ['Quizzes.', T('quizzes')], ['Daily streaks.', T('daily')], ['Rewards.', T('rewards')], ['Practice that feels like a game.', T('make') - 0.1]];
    const capEls = words.map(([w]) => E.el('div', 'g-capw', cap, w.includes('game') ? `<span class="display">Practice that feels like</span> <span class="serif grad-text">a game.</span>` : `<span class="display">${w}</span>`));
    words.forEach(([w, t], i) => {
      TL.fromTo(capEls[i], { autoAlpha: 0, y: 40, filter: 'blur(8px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.4, immediateRender: true }, t - 0.05);
      if (i < words.length - 1) TL.to(capEls[i], { autoAlpha: 0, y: -30, duration: 0.18, ease: 'power2.in' }, words[i + 1][1] - 0.12);
    });
    // card A: short lesson
    const A = E.el('div', 'g-card gA app', root, `<div class="g-thumb"><img class="cover" src="assets/seq/hero/f_00012.jpg" style="object-position:55% 40%"><span class="g-play">${I.play}</span><em>4 min</em></div><div class="g-body"><small>LESSON · CLASS 2</small><b>Basic Timbal Rhythm in Son</b><div class="g-bar"><i></i></div></div>`);
    // card B: playful exercise (mini highway)
    const B = E.el('div', 'g-card gB app', root, `<div class="mini-hw"><div class="lane"></div><div class="lane"></div><div class="lane"></div><div class="hitline"></div></div><div class="g-hud"><span><small>COMBO</small><b class="combo">0</b></span><span><small>ACCURACY</small><b class="acc">0%</b></span></div><div class="g-perfect">PERFECT</div>`);
    // card C: quiz
    const C = E.el('div', 'g-card gC app', root, `<small class="g-q-k">QUIZ · 3 of 5</small><b class="g-q">What is the pattern played on the shell of the timbales called?</b><div class="opt" data-k="a"><i>A</i>Tumbao</div><div class="opt good" data-k="b"><i>B</i>Cáscara<span class="ic ok">${I.check}</span></div><div class="opt" data-k="c"><i>C</i>Montuno</div><div class="g-xp">+10 XP</div>`);
    // card D: streak
    const D = E.el('div', 'g-card gD app', root, `<div class="flame"><span class="ic">${I.flame}</span></div><div><b class="streak">11</b><small>day streak</small><div class="week">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => `<span class="${i < 4 ? 'on' : ''}">${d}</span>`).join('')}</div></div>`);
    // card E: rewards
    const badges = [['First Steps', 'star', '#FFC94D'], ['Dedicated Learner', 'flame', '#FF6A3A'], ['Rising Star', 'award', '#2FD1B5'], ['Clave Keeper', 'trophy', '#A58BFF']];
    const Ecard = E.el('div', 'g-card gE app', root, `<div class="g-badges">${badges.map(([n, ic, c]) => `<div class="badge" style="--c:${c}"><div class="medal"><span class="ic">${I[ic]}</span><i class="shine"></i></div><label>${n}</label></div>`).join('')}</div><div class="xp"><span>Level 4</span><div class="xpbar"><i></i></div><span class="lvl">Level 5</span></div>`);
    const cards = [A, B, C, D, Ecard];
    const appear = [T('short') - 0.15, T('playful') - 0.15, T('quizzes') - 0.15, T('daily') - 0.15, T('rewards') - 0.15];
    cards.forEach((c, i) => {
      TL.fromTo(c, { autoAlpha: 0, y: 90, rotation: [-6, 4, -3, 5, -2][i], scale: 0.82 }, { autoAlpha: 1, y: 0, rotation: [-2, 1.5, -1, 2, 0][i], scale: 1, duration: 0.7, ease: 'back.out(1.6)', immediateRender: true }, appear[i]);
      E.sfx(appear[i], 'pop', 0.12, [-0.6, 0, 0.6, -0.5, 0.4][i], { pitch: [0, 4, 7, 9, 12][i] });
    });
    // A: lesson progress fills and checks
    TL.fromTo(A.querySelector('.g-bar i'), { scaleX: 0 }, { scaleX: 1, duration: 1.6, ease: 'power1.inOut', immediateRender: true }, appear[0] + 0.3);
    // B: falling notes and combo
    const mini = B.querySelector('.mini-hw');
    const notes = [];
    for (let i = 0; i < 8; i++) notes.push(E.el('div', 'mnote', mini));
    const tb = appear[1];
    E.onUpdate((t) => {
      if (t < tb - 0.1 || t > 57.7) return;
      notes.forEach(n => { n.style.opacity = 0; });
      const n0 = Math.max(0, Math.floor((t - tb - 0.55 - 0.12) / 0.32));
      for (let n = n0; n < n0 + 6; n++) {
        const hitT = tb + 0.55 + n * 0.32, k = 1 - (hitT - t) / 1.2;
        if (k < 0 || t > hitT + 0.12) continue;
        const el = notes[n % 8];
        el.style.opacity = 1; el.style.top = (k * 78) + '%'; el.style.left = (16 + (n * 7 % 3) * 33.3) + '%';
        el.classList.toggle('hit', t > hitT - 0.03);
      }
      const hits = Math.max(0, Math.floor((t - tb - 0.55) / 0.32) + 1);
      B.querySelector('.combo').textContent = hits; B.querySelector('.acc').textContent = (hits ? 100 : 0) + '%';
    });
    const perf = B.querySelector('.g-perfect');
    [0.55, 1.51, 2.47].forEach(dt => { TL.fromTo(perf, { autoAlpha: 0, scale: 0.6, y: 10 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.25, ease: 'back.out(3)', immediateRender: false }, tb + dt); TL.to(perf, { autoAlpha: 0, duration: 0.2 }, tb + dt + 0.45); });
    // C: answer the quiz
    const tq = T('daily') - 0.45;
    const good = C.querySelector('.opt.good');
    TL.set(good, { attr: { class: 'opt good picked' } }, tq);
    TL.fromTo(good, { scale: 1 }, { scale: 1.05, duration: 0.15, yoyo: true, repeat: 1, immediateRender: false }, tq);
    TL.fromTo(C.querySelector('.g-xp'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: -24, duration: 0.6, ease: 'back.out(2)', immediateRender: true }, tq + 0.1);
    TL.to(C.querySelector('.g-xp'), { autoAlpha: 0, y: -60, duration: 0.5 }, tq + 1.4);
    E.burst(tq + 0.05, 1555, 395, { n: 70, kind: 'confetti', speed: 700, life: 1.6, size: 7, gravity: 900, colors: ['#2FD1B5', '#FFC94D', '#FFA524', '#FF324D'] });
    E.sfx(tq, 'correct', 0.22);
    // D: streak +1
    const tdd = T('streaks') + 0.05;
    E.counter(D.querySelector('.streak'), tdd, tdd + 0.4, 11, 12);
    TL.set(D.querySelector('.week span:nth-child(5)'), { attr: { class: 'on today' } }, tdd);
    TL.fromTo(D.querySelector('.flame'), { scale: 1 }, { scale: 1.3, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, tdd);
    E.burst(tdd, 300, 720, { n: 30, kind: 'spark', speed: 500, life: 0.9, size: 4, gravity: -300, dir: -Math.PI / 2, spread: 1.2, colors: ['#FFD27A', '#FF6A3A', '#FFA524'] });
    E.sfx(tdd, 'flame', 0.15);
    // E: badges unlock, XP fills, level up
    const medals = [...Ecard.querySelectorAll('.badge')];
    medals.forEach((m, i) => {
      const t = T('rewards') + 0.1 + i * 0.22;
      TL.fromTo(m, { autoAlpha: 0.25, scale: 0.7, filter: 'grayscale(1)' }, { autoAlpha: 1, scale: 1, filter: 'grayscale(0)', duration: 0.45, ease: 'back.out(2.5)', immediateRender: true }, t);
      TL.fromTo(m.querySelector('.shine'), { xPercent: -150 }, { xPercent: 150, duration: 0.6, ease: 'power2.inOut', immediateRender: true }, t + 0.1);
      E.sfx(t, 'unlock', 0.1, -0.4 + i * 0.25, { pitch: [0, 4, 7, 12][i] });
    });
    const xpi = Ecard.querySelector('.xpbar i');
    TL.fromTo(xpi, { scaleX: 0.2 }, { scaleX: 1, duration: 1.6, ease: 'power2.inOut', immediateRender: true }, T('make'));
    const lu = E.el('div', 'levelup display', root, 'Level up!');
    const tl = T('game') - 0.05;
    TL.fromTo(lu, { autoAlpha: 0, scale: 0.3, rotation: -8 }, { autoAlpha: 1, scale: 1, rotation: -4, duration: 0.6, ease: 'back.out(2.6)', immediateRender: true }, tl);
    E.burst(tl + 0.05, 1255, 760, { n: 90, kind: 'star', speed: 900, life: 1.5, size: 10, gravity: 500, colors: ['#FFD27A', '#FFFFFF', '#FFA524', '#2FD1B5'] });
    E.sfx(tl, 'levelup', 0.22);
    // bounce to the beat while "feel like a game"
    E.beatsIn(T('make'), 57.2).forEach((b, i) => TL.fromTo(cards, { y: 0 }, { y: -14, duration: 0.14, yoyo: true, repeat: 1, ease: 'power2.out', stagger: 0.03, immediateRender: false }, b));
    TL.to([...cards, lu, cap], { autoAlpha: 0, y: 60, scale: 0.9, duration: 0.4, ease: 'power3.in', stagger: 0.03 }, 57.15);
  });

  // ---------------------------------------------------------------- S10 · kids world
  E.SCENES.push(function kidsScene() {
    const root = E.scene('s10', 57.3, 65.25, 'kids');
    const T = (w, n = 0) => E.wordT('L10', w, n);
    const stars = E.el('div', 'k-stars', root);
    const r = E.rng(77);
    const starEls = []; for (let i = 0; i < 70; i++) starEls.push(E.el('i', '', stars, null, { left: r() * 1920 + 'px', top: r() * 700 + 'px', width: (1 + r() * 3) + 'px', height: (1 + r() * 3) + 'px' }));
    E.onUpdate((t) => { if (t < 57.2 || t > 65.3) return; starEls.forEach((st, i) => { st.style.opacity = (0.35 + 0.65 * Math.abs(Math.sin(t * (0.8 + (i % 7) * 0.3) + i))).toFixed(2); }); });
    const moon = E.el('div', 'k-moon', root, '<i></i><i></i><b></b>');
    E.el('div', 'k-ground', root);
    TL.fromTo(root, { clipPath: 'circle(0% at 82% 30%)' }, { clipPath: 'circle(150% at 82% 30%)', duration: 1.0, ease: 'power3.inOut', immediateRender: true }, 57.3);
    const title = E.el('div', 'k-title', root, '<span>Even</span> <span>for</span> <span>kids</span>');
    TL.fromTo([...title.children], { autoAlpha: 0, y: 80, rotation: -12, scale: 0.5 }, { autoAlpha: 1, y: 0, rotation: 0, scale: 1, duration: 0.6, stagger: 0.1, ease: 'back.out(3)', immediateRender: true }, T('even') - 0.05);
    const corc = E.el('div', 'k-corc', root, E.corcheita());
    const corcInner = corc.firstElementChild; corcInner.style.transformOrigin = '50% 100%';
    const bubble = E.el('div', 'k-bubble', root, '<b>Hello! I’m Corcheita</b><small>Your friend in the world of music</small>');
    const tc = T('corch') - 0.25;
    TL.fromTo(corc, { x: 700, y: -500, rotation: 40, autoAlpha: 1 }, { x: 0, y: 0, rotation: 0, duration: 0.9, ease: 'bounce.out', immediateRender: true }, tc);
    E.sfx(tc + 0.3, 'boing', 0.18, 0.4);
    E.popIn(bubble, tc + 0.55, { from: 0.3, d: 0.5 });
    E.sfx(tc + 0.55, 'pop', 0.18, 0.4, { pitch: 7 });
    E.burst(tc + 0.9, 1430, 760, { n: 40, kind: 'star', speed: 520, life: 1.3, size: 9, gravity: 260, colors: ['#FFE07A', '#C5B3FF', '#FFFFFF', '#FF9DC3'] });
    // Corcheita hops on the beat and waves
    E.onUpdate((t) => {
      if (t < tc + 0.9) return;
      const b = E.DATA.beats; let last = b[0]; for (const x of b) { if (x <= t) last = x; else break; }
      const ph = (t - last) / E.DATA.period, hop = Math.sin(Math.PI * Math.min(1, ph)) * 26;
      corcInner.style.transform = `translate(0px, ${-hop}px) rotate(${Math.sin(t * 6) * 4}deg)`;
      const arms = corc.querySelector('.arms'); if (arms) arms.setAttribute('transform', `rotate(${Math.sin(t * 9) * 6} 40 80)`);
    });
    TL.to(title, { autoAlpha: 0, y: -40, duration: 0.35 }, 59.9);
    TL.to(bubble, { autoAlpha: 0, scale: 0.8, duration: 0.3 }, 61.0);
    TL.to(corc, { x: 330, y: 150, scale: 0.72, duration: 0.8, ease: 'power3.inOut' }, 60.9);
    // the worlds carousel
    const worlds = [['kids_garden', 'The note garden', 'Module 1 · Origins and note names'], ['kids_train', 'The pulse train', 'Module 2 · Pulse, meter and first readings'], ['kids_sky', 'The pitch sky', 'Module 3 · Pitch, tones and intervals'], ['kids_dino', 'The rhythmic dinosaur valley', 'Module 4 · Subdivision and rhythm']];
    const car = E.el('div', 'k-car', root);
    const slides = worlds.map(([img, t1, t2], i) => {
      const s = E.el('div', 'k-slide', car);
      E.img(`assets/img/caps/${img}.jpg`, 'cover', s);
      return s;
    });
    // module captions sit under the card, clear of the screenshots
    const labels = worlds.map(([, t1, t2]) => E.el('div', 'k-label', car, `<small>${t2}</small><b>${t1}</b>`));
    const t0 = 59.7, step = 1.15;
    gsap.set(slides, { autoAlpha: 0, transformPerspective: 1800 });
    slides.forEach((s, i) => {
      const ti = t0 + i * step;
      // each new world slides in opaque, over the previous one (DOM order keeps it on top)
      TL.set(s, { autoAlpha: 1 }, ti);
      TL.fromTo(s, { x: 1500, rotationY: -25, scale: 0.9 }, { x: 0, rotationY: 0, scale: 1, duration: 0.7, ease: 'expo.out', immediateRender: true }, ti);
      if (i < slides.length - 1) {
        TL.to(labels[i], { autoAlpha: 0, y: -12, duration: 0.18 }, ti + step - 0.12);
        TL.to(s, { x: -420, scale: 0.88, duration: 0.6, ease: 'power3.inOut' }, ti + step - 0.02);
        TL.fromTo(s, { filter: 'brightness(1)' }, { filter: 'brightness(0.45)', duration: 0.6, ease: 'power2.in', immediateRender: false }, ti + step - 0.02);
        TL.set(s, { autoAlpha: 0 }, ti + step + 0.62);
      }
      TL.fromTo(labels[i], { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'back.out(2)', immediateRender: true }, ti + 0.35);
      E.sfx(ti, 'swish_soft', 0.16, 0.4);
    });
    const meta = E.el('div', 'k-meta', root, `<span class="chip">12 modules · 149 lessons</span><span class="chip lang"><b>EN</b><b>ES</b></span>`);
    E.fadeUp(meta, 60.2, { y: 20 });
    const lang = meta.querySelector('.lang');
    TL.set(lang, { attr: { class: 'chip lang es' } }, 62.6);
    const es = E.el('div', 'k-es', root, '<b>¡Hola! Soy Corcheíta</b><small>Tu amiga en el mundo de la música</small>');
    TL.fromTo(es, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2.5)', immediateRender: true }, 62.65);
    TL.to(es, { autoAlpha: 0, scale: 0.8, duration: 0.3 }, 64.2);
    E.sfx(62.6, 'toggle', 0.22);
    TL.to(root, { autoAlpha: 0, duration: 0.45, ease: 'power2.in' }, 64.85);
  });
})();
