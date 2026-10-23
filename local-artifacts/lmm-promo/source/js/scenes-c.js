/* Act III: PlaySense, results, progress, maestro feedback, community (64.9s - 104.6s). */
(function () {
  const E = window.E, TL = E.TL, I = E.ICON;
  E.SCENES = E.SCENES || [];
  const CONGA = { dir: 'assets/seq/ps_conga', count: 420, first: 0 }, PIANO = { dir: 'assets/seq/ps_piano', count: 240, first: 0 };

  // ---------------------------------------------------------------- S11 · "And then... there's PlaySense."
  E.SCENES.push(function psRevealScene() {
    const t0 = E.DATA.events.swell;
    const root = E.scene('s11', 64.85, 68.75, 'ps');
    const T = (w, n = 0) => E.wordT('L11', w, n);
    const bg = E.el('div', 'full-vid ps-bg', root);
    const bim = E.img('assets/seq/ps_conga/f_00000.jpg', 'cover ps-crop', bg);
    E.seq(bim, { ...CONGA, start: 65.0, rate: 0.5, activeFrom: 64.8, activeTo: 68.8 });
    TL.fromTo(bg, { autoAlpha: 0, scale: 1.25 }, { autoAlpha: 1, scale: 1.08, duration: 3.6, ease: 'power2.out', immediateRender: true }, 65.1);
    const line = E.el('div', 'ps-line', root);
    TL.fromTo(line, { scaleX: 0, autoAlpha: 1 }, { scaleX: 1, duration: 1.1, ease: 'expo.inOut', immediateRender: true }, t0 + 0.05);
    E.sfx(t0 + 0.05, 'whoosh_up', 0.22);
    const logo = E.el('div', 'ps-logo', root, '<span class="display">Play</span><span class="serif grad-text">Sense.</span>');
    const [pl, se] = logo.children;
    const tp = T('playsense');
    TL.fromTo(pl, { autoAlpha: 0, y: 80, scale: 1.3, filter: 'blur(20px)' }, { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.5, ease: 'expo.out', immediateRender: true }, tp - 0.12);
    TL.fromTo(se, { autoAlpha: 0, x: -60, filter: 'blur(20px)' }, { autoAlpha: 1, x: 0, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out', immediateRender: true }, tp + 0.1);
    const sub = E.el('div', 'ps-sub mono', root, 'Real-time feedback · by Latin Music Mastery');
    E.fadeUp(sub, tp + 0.4, { y: 20 });
    const teaser = E.el('div', 'ps-teaser serif', root, 'And then…');
    E.fadeUp(teaser, T('and') - 0.05, { y: 30, d: 0.8 });
    TL.to(teaser, { autoAlpha: 0, y: -30, filter: 'blur(10px)', duration: 0.35 }, tp - 0.35);
    E.flash(tp - 0.05, 0.4, 0.45, 0.05);
    E.ring(tp, 960, 520, { r0: 50, r1: 900, life: 0.9, width: 6, colors: ['#FFB55A'] });
    E.burst(tp, 960, 620, { n: 90, speed: 1200, life: 1.2, size: 4, gravity: 300, dir: 0, spread: Math.PI * 2 });
    E.sfx(tp - 0.05, 'impact_bright', 0.3);
    TL.to([logo, sub, line], { scale: 2.4, autoAlpha: 0, filter: 'blur(18px)', duration: 0.55, ease: 'power3.in' }, 68.15);
    E.sfx(68.15, 'whoosh_big', 0.22);
  });

  // ---------------------------------------------------------------- S12 · PlaySense in action
  E.SCENES.push(function psActionScene() {
    const root = E.scene('s12', 68.2, 83.55, 'ps');
    const T = (w, n = 0) => E.wordT('L12', w, n);
    // a) the exercise view: grab your instrument, press play
    const win = E.el('div', 'browser ps-win', root);
    E.el('div', 'browser-bar', win, '<i></i><i></i><i></i><div class="url">latinmusicmastery.com/lessons/tumbao · Exercise</div>');
    const body = E.el('div', 'browser-body', win);
    const shot = E.img('assets/img/caps/pv_score.jpg', 'ps-shot', body);
    const ph = E.el('div', 'ps-playhead', body);
    const hl = E.el('div', 'ps-measure', body);
    const cursor = E.el('div', 'cursor', root, `<svg viewBox="0 0 24 24"><path d="M4 2l16 9.5-7.2 1.6L9.6 20z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>`);
    const press = E.el('div', 'press-ring', root);
    TL.fromTo(win, { autoAlpha: 0, scale: 0.75, rotationX: 25, y: 120 }, { autoAlpha: 1, scale: 1, rotationX: 0, y: 0, duration: 0.9, ease: 'expo.out', immediateRender: true }, 68.2);
    const tPlay = T('play');
    TL.fromTo(cursor, { x: 1300, y: 760, autoAlpha: 0 }, { x: 192, y: 948, autoAlpha: 1, duration: 1.0, ease: 'power3.inOut', immediateRender: true }, tPlay - 1.05);
    TL.to(cursor, { autoAlpha: 0, duration: 0.2 }, tPlay + 0.35);
    TL.to(cursor, { scale: 0.85, duration: 0.08, yoyo: true, repeat: 1 }, tPlay - 0.04);
    TL.fromTo(press, { scale: 0.2, autoAlpha: 0.9 }, { scale: 2.6, autoAlpha: 0, duration: 0.6, ease: 'power2.out', immediateRender: true }, tPlay);
    E.sfx(tPlay - 0.02, 'click', 0.35);
    // score playback overlay: playhead sweeps measure by measure
    const tStart = tPlay + 0.1;
    E.onUpdate((t) => {
      if (t < 68.2 || t > 73) return;
      const beatLen = 60 / 100, k = Math.max(0, (t - tStart) / beatLen);
      const bar = Math.floor(k / 4) % 2, beat = k % 4;
      ph.style.left = (bar === 0 ? 86 + beat * 81.3 : 426 + beat * 72.7).toFixed(1) + 'px';
      ph.style.opacity = t > tStart ? 1 : 0;
      hl.style.left = (bar === 0 ? 24 : 410) + 'px'; hl.style.width = (bar === 0 ? 386 : 304) + 'px';
      hl.style.opacity = t > tStart ? 1 : 0;
    });
    TL.to(win, { scale: 1.55, x: 620, y: -100, duration: 0.7, ease: 'power3.inOut' }, tPlay + 0.12);
    TL.to(win, { scale: 1.45, x: -535, y: -231, duration: 1.0, ease: 'power3.inOut' }, T('playsense') - 0.15);
    // b) PlaySense listens
    const pill = E.el('div', 'listen-pill', root, `<span class="mic">${I.mic}</span><div><b>PlaySense is listening</b><small>Microphone · conga</small></div><div class="wave">${'<i></i>'.repeat(28)}</div>`);
    const tl0 = T('listens') - 0.25;
    TL.fromTo(pill, { autoAlpha: 0, y: 40, scale: 0.8 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(2)', immediateRender: true }, tl0);
    const bars = [...pill.querySelectorAll('.wave i')];
    E.onUpdate((t) => {
      if (t < tl0 - 0.1 || t > 78.5) return;
      const e = E.energy(t, 'mid'), o = E.energy(t, 'onset');
      bars.forEach((b, i) => { const v = 0.15 + 0.85 * Math.abs(Math.sin(i * 0.9 + t * 11)) * (0.3 + 0.7 * e) * (0.6 + 0.6 * Math.min(1, o)); b.style.transform = `scaleY(${v.toFixed(3)})`; });
    });
    for (let k = 0; k < 4; k++) E.ring(tl0 + 0.3 + k * 0.45, 666, 898, { r0: 30, r1: 230, life: 1.0, width: 3, colors: ['#2FD1B5'], alpha: 0.7 });
    E.sfx(tl0, 'pop', 0.18, -0.4, { pitch: 7 });
    // c) the live stage: every hit, every note
    const stage = E.el('div', 'full-vid stage-vid', root);
    const sim = E.img('assets/seq/ps_conga/f_00000.jpg', 'cover ps-crop', stage);
    const tStage = T('every') - 0.35;
    const tNote = T('note') - 0.12, tPerfect = T('perfect');
    E.seq(sim, { ...CONGA, start: tStage, offset: 24, activeFrom: tStage - 0.1, activeTo: tNote });
    E.seq(sim, { ...CONGA, start: tPerfect - 0.5, offset: 150, activeFrom: tPerfect - 0.4, activeTo: 83.6 });
    const piano = E.el('div', 'full-vid stage-vid', root);
    const pim = E.img('assets/seq/ps_piano/f_00000.jpg', 'cover ps-crop', piano);
    E.seq(pim, { ...PIANO, start: tNote, offset: 40, activeFrom: tNote - 0.1, activeTo: tPerfect - 0.3 });
    TL.to(pill, { autoAlpha: 0, y: 30, duration: 0.25, ease: 'power2.in' }, tStage - 0.3);
    TL.fromTo(stage, { autoAlpha: 0, scale: 1.3 }, { autoAlpha: 1, scale: 1.04, duration: 0.7, ease: 'expo.out', immediateRender: true }, tStage);
    TL.to(win, { autoAlpha: 0, duration: 0.3 }, tStage + 0.1);
    TL.fromTo(piano, { autoAlpha: 0, x: 300 }, { autoAlpha: 1, x: 0, duration: 0.35, ease: 'expo.out', immediateRender: true }, tNote);
    TL.to(piano, { autoAlpha: 0, x: -300, duration: 0.3, ease: 'power2.in' }, tPerfect - 0.45);
    TL.to(stage, { scale: 1.12, duration: 83.5 - tStage, ease: 'none' }, tStage + 0.7);
    E.sfx(tStage, 'whoosh', 0.2); E.sfx(tNote, 'whoosh_short', 0.16); E.sfx(tPerfect - 0.45, 'whoosh_short', 0.16);
    const tagHit = E.el('div', 'ps-tag', root, '<span class="display">Every hit</span>');
    const tagNote = E.el('div', 'ps-tag', root, '<span class="display">Every note</span>');
    E.fadeUp(tagHit, T('hit') - 0.15, { y: 30, d: 0.4 }); TL.to(tagHit, { autoAlpha: 0, duration: 0.15 }, tNote - 0.05);
    E.fadeUp(tagNote, tNote, { y: 30, d: 0.4 }); TL.to(tagNote, { autoAlpha: 0, duration: 0.15 }, tPerfect - 0.45);
    // judgement chips + timing meter, synced to "perfect, early, or late"
    const judge = E.el('div', 'judge', root);
    const meter = E.el('div', 'tmeter', judge, '<span class="mono e">Early</span><div class="scale"><i class="zone"></i><b class="dot"></b></div><span class="mono l">Late</span>');
    const chips = [['Perfect', 'perfect', T('perfect'), 0], ['Early', 'early', T('early'), -1], ['Late', 'late', T('late'), 1]];
    TL.fromTo(meter, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.4, immediateRender: true }, T('perfect') - 0.2);
    const dot = meter.querySelector('.dot');
    chips.forEach(([txt, cls, t, pos], i) => {
      const c = E.el('div', 'jchip ' + cls, judge, `<b>${txt}</b><small class="mono">${['± 8 ms', '− 46 ms', '+ 52 ms'][i]}</small>`);
      TL.fromTo(c, { autoAlpha: 0, scale: 0.5, y: 30 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.35, ease: 'back.out(3)', immediateRender: true }, t - 0.06);
      if (i < 2) TL.to(c, { autoAlpha: 0, scale: 0.9, y: -20, duration: 0.15 }, chips[i + 1][2] - 0.1);
      else TL.to(c, { autoAlpha: 0, duration: 0.3 }, 77.3);
      TL.to(dot, { left: (50 + pos * 38) + '%', duration: 0.3, ease: 'back.out(2)' }, t - 0.05);
      E.sfx(t - 0.04, ['tick_perfect', 'tick_early', 'tick_late'][i], 0.14);
      E.burst(t, 960, 250, { n: 24, speed: 500, life: 0.6, size: 3.5, gravity: 200, colors: [['#2FD1B5'], ['#FFC94D'], ['#FF7A5A']][i] });
    });
    const live = E.el('div', 'live-badge', root, `<i></i><span class="mono">Real time</span>`);
    TL.fromTo(live, { autoAlpha: 0, x: -30 }, { autoAlpha: 1, x: 0, duration: 0.4, immediateRender: true }, T('real') - 0.1);
    TL.to([meter, live], { autoAlpha: 0, duration: 0.3 }, 77.4);
    // d) "like having your own maestro by your side": coach tips beside the stage
    const T13 = (w, n = 0) => E.wordT('L13', w, n);
    const coach = E.el('div', 'coach glass', root, `<div class="coach-h"><span class="av">${I.headphones}</span><div><b>Your maestro, in PlaySense</b><small class="mono">Live coaching</small></div></div>`);
    const tips = [['ok', 'Steady pulse', 'Your tumbao is locked in'], ['ok', 'Slap on 2', 'Right on time'], ['tip', 'Relax the open tones', 'Let the drum ring']];
    const tipEls = tips.map(([k, a, b]) => E.el('div', 'ctip ' + k, coach, `<span class="ic">${k === 'ok' ? I.check : I.bulb}</span><div><b>${a}</b><small>${b}</small></div>`));
    const tc = T13('it') - 0.2;
    TL.fromTo(coach, { autoAlpha: 0, x: 120 }, { autoAlpha: 1, x: 0, duration: 0.7, ease: 'expo.out', immediateRender: true }, tc);
    tipEls.forEach((el, i) => { TL.fromTo(el, { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: 0.45, ease: 'back.out(2)', immediateRender: true }, tc + 0.5 + i * 0.6); E.sfx(tc + 0.5 + i * 0.6, 'notify', 0.16, 0.6, { pitch: [0, 4, 7][i] }); });
    const side = E.el('div', 'side-tag', root, '<span class="display">By your</span> <span class="serif grad-text">side.</span>');
    E.fadeUp(side, T13('side') - 0.3, { y: 30 });
    // e) swell peak: perfect run
    const peak = E.el('div', 'peak', root, '<b class="display">100%</b><span class="mono">Accuracy · combo 46</span>');
    TL.fromTo(peak, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(2.5)', immediateRender: true }, 81.3);
    E.burst(81.35, 960, 430, { n: 140, kind: 'confetti', speed: 1300, life: 2.2, size: 8, gravity: 900, colors: ['#FFA524', '#FF324D', '#2FD1B5', '#FFC94D', '#A58BFF', '#FFFFFF'] });
    E.sfx(81.3, 'success', 0.22);
    TL.to(coach, { autoAlpha: 0, x: 80, duration: 0.3, ease: 'power2.in' }, 80.95);
    TL.to([side, peak], { autoAlpha: 0, duration: 0.35 }, 82.95);
    TL.to(stage, { filter: 'brightness(1.6) blur(8px)', autoAlpha: 0, duration: 0.45, ease: 'power2.in' }, 82.95);
    E.flash(83.3, 0.5, 0.5, 0.12);
  });

  // ---------------------------------------------------------------- S13 · results & what to improve
  E.SCENES.push(function resultsScene() {
    const root = E.scene('s13', 83.2, 89.75);
    const T = (w, n = 0) => E.wordT('L14', w, n);
    const card = E.el('div', 'res glass', root);
    card.innerHTML = `
      <div class="res-h"><div><small class="mono">Take complete</small><b>Tumbao Esencial</b></div><div class="stars">${I.star}${I.star}${I.star}</div></div>
      <div class="res-main">
        <div class="score"><svg viewBox="0 0 200 200"><defs><linearGradient id="sg" x1="0" x2="1"><stop offset="0" stop-color="#2FD1B5"/><stop offset="1" stop-color="#FFA524"/></linearGradient></defs><circle cx="100" cy="100" r="86"/><circle class="fill" cx="100" cy="100" r="86"/></svg><b>0</b><small>Score</small></div>
        <div class="res-stats">
          <div class="st"><small>Accuracy</small><b class="acc">0%</b></div><div class="st"><small>Best combo</small><b class="cmb">0</b></div><div class="st"><small>On time</small><b class="ont">0%</b></div>
          <div class="hist"><div class="hb e"><i></i><span>Early</span><em>7%</em></div><div class="hb p"><i></i><span>Perfect</span><em>82%</em></div><div class="hb l"><i></i><span>Late</span><em>11%</em></div></div>
        </div>
      </div>
      <div class="bars"><span class="mono">By measure</span>${[96, 100, 92, 98, 94, 71, 97, 100].map((v, i) => `<div class="bar ${i === 5 ? 'warn' : ''}"><i style="height:${v}%"></i><small>${i + 1}</small></div>`).join('')}</div>
      <div class="tip"><span class="ic">${I.bulb}</span><div><b>Bar 6: your slaps land a little late.</b><small>Loop it at 90 BPM, then build back up.</small></div><em class="btn-orange">${I.loop}<span>Loop bar 6</span></em></div>`;
    TL.fromTo(card, { autoAlpha: 0, scale: 0.85, y: 60, filter: 'blur(12px)' }, { autoAlpha: 1, scale: 1, y: 0, filter: 'blur(0px)', duration: 1.0, ease: 'expo.out', immediateRender: true }, 83.4);
    const ring = card.querySelector('.score .fill');
    TL.fromTo(ring, { strokeDashoffset: 540 }, { strokeDashoffset: 540 * 0.08, duration: 1.8, ease: 'power3.out', immediateRender: true }, 83.8);
    E.counter(card.querySelector('.score b'), 83.8, 85.6, 0, 92);
    E.counter(card.querySelector('.acc'), 84.0, 85.6, 0, 94, v => Math.round(v) + '%');
    E.counter(card.querySelector('.cmb'), 84.1, 85.6, 0, 46);
    E.counter(card.querySelector('.ont'), 84.2, 85.6, 0, 82, v => Math.round(v) + '%');
    TL.fromTo(card.querySelectorAll('.hb i'), { scaleX: 0 }, { scaleX: 1, duration: 1.0, stagger: 0.12, ease: 'power3.out', immediateRender: true }, 84.4);
    TL.fromTo(card.querySelectorAll('.stars svg'), { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.5, stagger: 0.18, ease: 'back.out(3)', immediateRender: true }, 85.0);
    [0, 1, 2].forEach(i => E.sfx(85.0 + i * 0.18, 'star', 0.18, 0.3, { pitch: [0, 4, 7][i] }));
    TL.fromTo(card.querySelectorAll('.bar i'), { scaleY: 0 }, { scaleY: 1, duration: 0.6, stagger: 0.07, ease: 'power3.out', immediateRender: true }, 85.3);
    const warn = card.querySelector('.bar.warn');
    TL.fromTo(warn, { boxShadow: '0 0 0 0 rgba(255,90,90,0)' }, { boxShadow: '0 0 0 4px rgba(255,90,90,.6)', duration: 0.3, yoyo: true, repeat: 3, immediateRender: false }, T('improve') - 0.6);
    const tip = card.querySelector('.tip');
    TL.fromTo(tip, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'back.out(1.6)', immediateRender: true }, T('exactly') - 0.1);
    E.sfx(T('exactly') - 0.1, 'notify', 0.18, 0, { pitch: 0 });
    const btn = card.querySelector('.tip em');
    const tb = 87.55;
    TL.fromTo(btn, { scale: 1 }, { scale: 0.92, duration: 0.09, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, tb);
    TL.to(btn, { boxShadow: '0 6px 0 #B85F12, 0 0 40px rgba(255,165,36,.9)', duration: 0.3 }, tb);
    TL.to(btn.querySelector('svg'), { rotation: 720, transformOrigin: '50% 50%', duration: 2.0, ease: 'power1.inOut' }, tb);
    E.sfx(tb, 'click', 0.3);
    const b6 = card.querySelector('.bar.warn'), b6i = b6.querySelector('i');
    TL.fromTo(b6i, { height: '71%' }, { height: '97%', duration: 0.9, ease: 'power3.out', immediateRender: false }, 88.0);
    TL.set(b6, { attr: { class: 'bar' } }, 88.5);
    const plus = E.el('div', 'res-plus', b6, '+26%');
    TL.fromTo(plus, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: -10, duration: 0.5, ease: 'back.out(2.5)', immediateRender: true }, 88.4);
    E.counter(card.querySelector('.score b'), 88.2, 88.9, 92, 96);
    TL.to(ring, { strokeDashoffset: 540 * 0.04, duration: 0.7, ease: 'power2.out' }, 88.2);
    E.sfx(88.5, 'chime', 0.22, 0, { pitch: 7 });
    E.burst(88.55, 1240, 560, { n: 30, kind: 'star', speed: 380, life: 0.9, size: 7, gravity: 200, colors: ['#2FD1B5', '#FFFFFF', '#FFC94D'] });
    const hl = E.el('div', 'res-hl', root, '<span class="display">See exactly</span> <span class="serif grad-text">what to improve.</span>');
    E.fadeUp(hl, T('see') - 0.1, { y: 30 });
    TL.to([card, hl], { autoAlpha: 0, scale: 0.94, filter: 'blur(10px)', duration: 0.4, ease: 'power2.in' }, 89.3);
  });

  // ---------------------------------------------------------------- S14 · progress, goals, smart tips
  E.SCENES.push(function progressScene() {
    const root = E.scene('s14', 89.35, 94.85);
    const T = (w, n = 0) => E.wordT('L15', w, n);
    E.flash(89.38, 0.3, 0.35, 0.03); E.sfx(89.36, 'impact', 0.2);
    const head = E.el('div', 'pg-head', root, '<div class="eyebrow">My progress</div><div class="display">Track it all.</div>');
    E.fadeUp([...head.children], 89.45, { y: 30, stagger: 0.08 });
    const cal = E.el('div', 'pg-card pg-cal glass', root, `<div class="pg-t">${I.cal}<b>Practice calendar</b><small class="mono">Last 12 weeks</small></div><div class="grid"></div>`);
    const grid = cal.querySelector('.grid'); const r = E.rng(9);
    const cells = [];
    for (let w = 0; w < 12; w++) for (let d = 0; d < 7; d++) { const v = w > 8 ? 0.55 + r() * 0.45 : r() < 0.25 + w * 0.06 ? 0.2 + r() * 0.8 : 0; cells.push([E.el('i', '', grid, null, { gridColumn: w + 1, gridRow: d + 1 }), v, w, d]); }
    cells.forEach(([c, v, w, d]) => { if (!v) return; TL.fromTo(c, { backgroundColor: 'rgba(246,235,221,.06)' }, { backgroundColor: `rgba(255,${Math.round(120 + 60 * (1 - v))},40,${(0.25 + 0.75 * v).toFixed(2)})`, duration: 0.25, immediateRender: true }, 89.7 + (w + d * 0.3) * 0.085); });
    const goal = E.el('div', 'pg-card pg-goal glass', root, `<div class="pg-t">${I.target}<b>Weekly goal</b></div><div class="gring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50"/><circle class="fill" cx="60" cy="60" r="50"/></svg><div><b class="gv">3</b><small>/ 5 lessons</small></div><span class="ic done">${I.check}</span></div>`);
    const tg = T('goals') - 0.1;
    TL.fromTo(goal.querySelector('.fill'), { strokeDashoffset: 314 * 0.4 }, { strokeDashoffset: 0, duration: 0.8, ease: 'power3.out', immediateRender: true }, tg);
    E.counter(goal.querySelector('.gv'), tg, tg + 0.6, 3, 5);
    TL.fromTo(goal.querySelector('.done'), { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.4, ease: 'back.out(3)', immediateRender: true }, tg + 0.75);
    E.sfx(tg + 0.75, 'chime', 0.26);
    E.burst(tg + 0.8, 1068, 560, { n: 40, kind: 'star', speed: 450, life: 1.0, size: 7, gravity: 200, colors: ['#2FD1B5', '#FFFFFF', '#FFC94D'] });
    const stats = [['Practice time', '14h 20m', I.clock], ['Lessons done', '36', I.book], ['Accuracy', '91%', I.target], ['Day streak', '12', I.flame]];
    const tiles = stats.map(([a, b, ic], i) => E.el('div', 'pg-tile glass', root, `<span class="ic">${ic}</span><small>${a}</small><b>${b}</b>`, { left: (1240 + (i % 2) * 300) + 'px', top: (300 + Math.floor(i / 2) * 170) + 'px' }));
    TL.fromTo([cal, goal], { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'expo.out', immediateRender: true }, 89.5);
    TL.fromTo(tiles, { autoAlpha: 0, y: 40, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.08, ease: 'back.out(1.8)', immediateRender: true }, T('track') + 0.2);
    // smart tips
    const ts = T('smart') - 0.15;
    const tipsBox = E.el('div', 'pg-tips', root);
    const tipTexts = [['Warm up with the clave', '5 min at 80 BPM'], ['Your cáscara is steady', 'Ready to try 110 BPM'], ['Review: tumbao slaps', 'Bar 6 needs a little love']];
    const tEls = tipTexts.map(([a, b], i) => E.el('div', 'pg-tip', tipsBox, `<span class="ic">${i === 1 ? I.spark : I.bulb}</span><div><b>${a}</b><small>${b}</small></div>`));
    TL.fromTo(tEls, { autoAlpha: 0, x: 80 }, { autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.22, ease: 'back.out(1.8)', immediateRender: true }, ts);
    tEls.forEach((_, i) => E.sfx(ts + i * 0.22, 'notify', 0.15, 0.5, { pitch: [0, 4, 7][i] }));
    const lbl = E.el('div', 'pg-label mono', root, 'Smart tips · based on your takes');
    E.fadeUp(lbl, ts - 0.1, { y: 14 });
    TL.to([head, cal, goal, ...tiles, tipsBox, lbl], { autoAlpha: 0, y: -40, duration: 0.3, ease: 'power2.in', stagger: 0.015 }, 94.1);
  });

  // ---------------------------------------------------------------- S15 · send your maestro a clip
  E.SCENES.push(function feedbackScene() {
    const root = E.scene('s15', 94.45, 99.0);
    const T = (w, n = 0) => E.wordT('L16', w, n);
    const take = E.el('div', 'fb-take glass', root, `<div class="fb-v"><img class="cover" src="assets/seq/band/f_00001.jpg"><span class="rec"><i></i>REC</span><em>0:42</em></div><div class="fb-up"><span class="ic">${I.upload}</span><div><b>Your take · Montuno práctica</b><div class="upbar"><i></i></div></div></div><div class="fb-sent"><span class="ic">${I.check}</span>Sent to your maestro</div>`);
    E.seq(take.querySelector('img'), { dir: 'assets/seq/band', count: 275, start: 94.45, offset: 60, activeFrom: 94.4, activeTo: 99.05 });
    TL.fromTo(take, { autoAlpha: 0, x: -120, rotation: -3 }, { autoAlpha: 1, x: 0, rotation: -1.5, duration: 0.8, ease: 'expo.out', immediateRender: true }, 94.62);
    const tSend = T('clip') - 0.1;
    TL.fromTo(take.querySelector('.upbar i'), { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'power2.inOut', immediateRender: true }, tSend - 0.7);
    TL.fromTo(take.querySelector('.fb-sent'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'back.out(2)', immediateRender: true }, tSend + 0.25);
    E.sfx(tSend - 0.7, 'whoosh_up', 0.16); E.sfx(tSend + 0.25, 'sent', 0.26);
    // paper-plane flight from the take to the maestro
    const plane = E.el('div', 'plane', root, `<svg viewBox="0 0 24 24" fill="none" stroke="#FFC37A" stroke-width="2" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>`);
    TL.fromTo(plane, { x: 640, y: 640, autoAlpha: 0, rotation: 0, scale: 0.7 }, { x: 1030, y: 330, autoAlpha: 1, rotation: 12, scale: 1, duration: 0.6, ease: 'power2.inOut', immediateRender: true }, tSend + 0.2);
    TL.to(plane, { autoAlpha: 0, scale: 0.4, duration: 0.2 }, tSend + 0.8);
    const fb = E.el('div', 'fb-card glass', root, `<div class="fb-h"><span class="av">M</span><div><b>Your maestro</b><small class="mono">Replied · personal feedback</small></div></div><div class="fb-tl"><i class="m1"></i><i class="m2"></i><i class="m3"></i></div>`);
    const comments = [['0:08', 'Beautiful montuno. Your time feels great! 🔥'], ['0:21', 'Keep the left hand lighter here.'], ['0:35', 'Push the anticipation, listen to this:']];
    const cEls = comments.map(([ts, txt], i) => E.el('div', 'fb-c', fb, `<span class="mono">${ts}</span><p>${txt}</p>`));
    const voice = E.el('div', 'fb-voice', fb, `<span class="pl">${I.play}</span><div class="vw">${'<i></i>'.repeat(34)}</div><em class="mono">0:14</em>`);
    const tf = T('feedback') - 1.0;
    TL.fromTo(fb, { autoAlpha: 0, x: 140 }, { autoAlpha: 1, x: 0, duration: 0.8, ease: 'expo.out', immediateRender: true }, tSend + 0.6);
    [...cEls, voice].forEach((el, i) => { TL.fromTo(el, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'back.out(1.8)', immediateRender: true }, tf + i * 0.42); E.sfx(tf + i * 0.42, 'pop', 0.15, 0.5, { pitch: [4, 7, 9, 12][i] }); });
    TL.fromTo(fb.querySelectorAll('.fb-tl i'), { scale: 0 }, { scale: 1, duration: 0.3, stagger: 0.42, ease: 'back.out(3)', immediateRender: true }, tf);
    const vb = [...voice.querySelectorAll('.vw i')];
    E.onUpdate((t) => { if (t < tf + 1.2 || t > 99.1) return; vb.forEach((b, i) => { b.style.transform = `scaleY(${(0.25 + 0.75 * Math.abs(Math.sin(i * 1.7 + t * 9) * Math.cos(i * 0.6 + t * 3))).toFixed(3)})`; }); });
    const hl = E.el('div', 'fb-hl', root, '<span class="display">Real,</span> <span class="serif grad-text">personal feedback.</span>');
    E.fadeUp(hl, T('real') - 0.15, { y: 30 });
    TL.to([take, fb, hl], { autoAlpha: 0, scale: 0.92, duration: 0.35, ease: 'power2.in' }, 98.62);
  });

  // ---------------------------------------------------------------- S16 · Discord community
  E.SCENES.push(function communityScene() {
    const root = E.scene('s16', 98.75, 104.75);
    const T = (w, n = 0) => E.wordT('L17', w, n);
    const win = E.el('div', 'dc', root);
    win.innerHTML = `<div class="dc-side"><div class="dc-srv"><img src="assets/img/logo-solo-color.svg"></div><div class="dc-srv b">${I.discord}</div></div>
      <div class="dc-ch"><b>Latin Music Mastery</b>${['general', 'practice-room', 'show-your-take', 'challenges', 'percussion', 'piano-y-tres'].map((c, i) => `<span class="${i === 1 ? 'on' : ''}"># ${c}</span>`).join('')}</div>
      <div class="dc-main"><div class="dc-top"># practice-room</div><div class="dc-msgs"></div></div>`;
    const msgs = win.querySelector('.dc-msgs');
    const data = [
      ['Mari', '#F9A03F', 'mari_congas', 'Day 30 streak!! 🔥🔥', ['🔥', 14]],
      ['Dani', '#5BC0EB', 'dani.tres', 'Who’s in for this month’s montuno challenge?', ['🙋', 9]],
      ['Tito', '#9BC53D', 'tito_timbal', '¡Qué sabor! That cáscara is clean 👏', ['👏', 11]],
      ['Ana', '#E55934', 'ana.piano', 'Just sent my first take to my maestro 🎥', ['❤️', 8]],
      ['Jorge', '#B58BFF', 'jorge_bajo', 'Bass players: jam session Friday? 🎸', ['🎶', 6]],
    ];
    const els = data.map(([n, c, u, txt, [emo, cnt]], i) => E.el('div', 'dc-msg', msgs, `<span class="avatar" style="background:${c};width:52px;height:52px;font-size:20px">${n[0]}</span><div><b style="color:${c}">${u}</b><small>Today at ${7 + i}:${String(10 + i * 7).padStart(2, '0')} PM</small><p>${txt}</p><span class="react">${emo} <em>${Math.max(1, cnt - 3)}</em></span></div>`));
    TL.fromTo(win, { autoAlpha: 0, y: 100, rotationX: 18, scale: 0.9 }, { autoAlpha: 1, y: 0, rotationX: 0, scale: 1, duration: 0.9, ease: 'expo.out', immediateRender: true }, 98.85);
    els.forEach((el, i) => {
      const t = 99.25 + i * 0.62;
      TL.fromTo(el, { autoAlpha: 0, y: 30, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(1.8)', immediateRender: true }, t);
      E.sfx(t, 'msg', 0.2, 0.2, { pitch: [0, 2, 4, 7, 9][i] });
      const em = el.querySelector('.react em'); const cnt = data[i][4][1];
      E.counter(em, t + 0.45, t + 1.6, Math.max(1, cnt - 3), cnt);
      TL.fromTo(el.querySelector('.react'), { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.35, ease: 'back.out(3)', immediateRender: true }, t + 0.35);
    });
    TL.to(msgs, { y: -120, duration: 2.0, ease: 'power2.inOut' }, 101.4);
    const head = E.el('div', 'dc-head', root, `<span class="dlogo">${I.discord}</span><div class="eyebrow">The LMM community on Discord</div><div class="display">Musicians</div><div class="serif grad-text">just like you.</div>`);
    E.fadeUp([...head.children], T('discord') - 0.2, { y: 40, stagger: 0.1 });
    const r = E.rng(31);
    const floaters = ['🔥', '👏', '🎶', '🥁', '🎹', '❤️', '🙌', '🎺'].map((e, i) => E.el('div', 'floater', root, e, { left: (1560 + r() * 200) + 'px', top: (780 + r() * 120) + 'px' }));
    floaters.forEach((f, i) => { const t = 99.6 + i * 0.4; TL.fromTo(f, { autoAlpha: 0, y: 0, scale: 0.5 }, { autoAlpha: 1, y: -260 - r() * 160, scale: 1.1, duration: 2.2, ease: 'power1.out', immediateRender: true }, t); TL.to(f, { autoAlpha: 0, duration: 0.5 }, t + 1.7); });
    TL.to([win, head], { autoAlpha: 0, y: -60, filter: 'blur(10px)', duration: 0.4, ease: 'power2.in' }, 104.25);
  });
})();
