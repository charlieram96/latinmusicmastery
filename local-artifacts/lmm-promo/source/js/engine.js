/* Deterministic motion engine: everything is a pure function of time t (seconds).
   The renderer calls window.seek(t) for each frame, then screenshots the stage. */
(function () {
  const W = 1920, H = 1080, FPS = 30;
  gsap.ticker.sleep();
  gsap.ticker.lagSmoothing(0);
  gsap.defaults({ ease: 'expo.out', duration: 0.8 });
  const TL = gsap.timeline({ paused: true, autoRemoveChildren: false, smoothChildTiming: false });
  const updaters = [], seqs = [], SFX = [];
  const E = (window.E = { W, H, FPS, TL, updaters, seqs, SFX, DATA: null });

  // ---------- DOM helpers ----------
  E.el = (tag, cls, parent, html, style) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    if (style) Object.assign(n.style, style);
    if (parent) parent.appendChild(n);
    return n;
  };
  E.img = (src, cls, parent, style) => { const n = E.el('img', cls, parent, null, style); n.src = src; n.decoding = 'sync'; return n; };
  E.splitWords = (node) => {
    const words = node.textContent.split(/(\s+)/);
    node.innerHTML = '';
    return words.filter(w => w.length).map(w => {
      if (/^\s+$/.test(w)) { node.appendChild(document.createTextNode(' ')); return null; }
      return E.el('span', 'word', node, w);
    }).filter(Boolean);
  };
  E.splitChars = (node) => {
    const txt = node.textContent; node.innerHTML = '';
    return [...txt].map(c => c === ' ' ? (node.appendChild(document.createTextNode(' ')), null) : E.el('span', 'char', node, c)).filter(Boolean);
  };

  // ---------- scenes ----------
  E.scene = (id, tIn, tOut, cls = '') => {
    const root = E.el('div', 'scene ' + cls, document.getElementById('scenes'));
    root.id = id;
    TL.set(root, { autoAlpha: 1 }, tIn);
    if (tOut != null) TL.set(root, { autoAlpha: 0 }, tOut);
    root.dataset.tin = tIn; root.dataset.tout = tOut;
    return root;
  };

  // ---------- image sequences ----------
  // cfg: {dir, count, start (abs t), fps, rate, offset (frame), loop, pingpong, ext, mode: 'img'|'bg', hold}
  E.seq = (target, cfg) => {
    const c = Object.assign({ fps: 30, rate: 1, offset: 0, loop: false, ext: 'jpg', mode: 'img', first: 1 }, cfg);
    const s = { target, c, cur: null };
    s.frameAt = (t) => {
      if (c.until != null && t > c.until) return null;
      let f = Math.floor((t - c.start) * c.fps * c.rate + c.offset + 1e-6);
      if (c.pingpong) { const n = c.count, m = 2 * n - 2; f = ((f % m) + m) % m; if (f >= n) f = m - f; }
      else if (c.loop) f = ((f % c.count) + c.count) % c.count;
      else f = Math.max(0, Math.min(c.count - 1, f));
      return `${c.dir}/f_${String(f + c.first).padStart(5, '0')}.${c.ext}`;
    };
    s.update = async (t) => {
      const tin = c.activeFrom ?? -1e9, tout = c.activeTo ?? 1e9;
      if (t < tin || t > tout) return;
      const src = s.frameAt(t);
      if (!src || src === s.cur) return;
      s.cur = src;
      if (c.mode === 'img') { target.src = src; try { await target.decode(); } catch (e) {} }
      else { const im = new Image(); im.src = src; try { await im.decode(); } catch (e) {} target.style.backgroundImage = `url(${src})`; }
    };
    seqs.push(s);
    return s;
  };

  // ---------- per-frame updaters, sfx ----------
  E.onUpdate = (fn) => updaters.push(fn);
  E.sfx = (t, name, gain = 1, pan = 0, opts = {}) => SFX.push(Object.assign({ t: +t.toFixed(3), name, gain, pan }, opts));

  // ---------- data access ----------
  E.vo = (id) => E.DATA.vo.find(v => v.id === id);
  E.word = (id, i) => { const v = E.vo(id); return v.words ? v.words[i].t : v.split[i].at; };
  E.wordT = (id, text, nth = 0) => {
    const v = E.vo(id); const ws = v.words.filter(w => w.w.toLowerCase().replace(/[^a-záéíóúüñ']/g, '').startsWith(text.toLowerCase()));
    if (!ws[nth]) { console.warn('word not found', id, text); return v.start; }
    return ws[nth].t;
  };
  E.beatsIn = (a, b) => E.DATA.beats.filter(x => x >= a && x < b);
  E.nextBeat = (t) => E.DATA.beats.find(x => x >= t) ?? t;
  E.energy = (t, band = 'low') => { const arr = E.DATA.energy[band]; const f = Math.max(0, Math.min(arr.length - 1, Math.round(t * FPS))); return arr[f]; };

  // ---------- deterministic randomness ----------
  E.rng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  E.clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  E.smooth = (x) => { x = E.clamp(x); return x * x * (3 - 2 * x); };
  E.easeOut = (x) => 1 - Math.pow(1 - E.clamp(x), 3);

  // ---------- particle bursts on the fx canvas (analytic, stateless) ----------
  const fx = document.getElementById('fx'), ctx = fx.getContext('2d');
  const bursts = [];
  // kind: 'spark' | 'confetti' | 'dust' | 'ring' | 'star'
  E.burst = (t0, x, y, o = {}) => {
    const b = Object.assign({ t0, x, y, n: 60, life: 1.4, speed: 900, spread: Math.PI * 2, dir: -Math.PI / 2, gravity: 900, size: 6, kind: 'spark', colors: ['#FFA524', '#FF6A3A', '#FF324D', '#FFE2B0'], seed: Math.floor(t0 * 1000 + x), drag: 1.6 }, o);
    const r = E.rng(b.seed);
    b.p = Array.from({ length: b.n }, () => {
      const a = b.dir + (r() - 0.5) * b.spread, v = b.speed * (0.35 + 0.65 * r());
      return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: b.colors[Math.floor(r() * b.colors.length)], s: b.size * (0.5 + r()), rot: r() * 6.28, vr: (r() - 0.5) * 14, life: b.life * (0.6 + 0.4 * r()), wob: r() * 6.28 };
    });
    bursts.push(b);
    return b;
  };
  function drawBursts(t) {
    ctx.clearRect(0, 0, W, H);
    for (const b of bursts) {
      const dt = t - b.t0;
      if (dt < 0 || dt > b.life * 1.05) continue;
      if (b.kind === 'ring') {
        const k = dt / b.life, rad = b.r0 + (b.r1 - b.r0) * E.easeOut(k);
        ctx.globalAlpha = (1 - k) * (b.alpha ?? 0.9);
        ctx.strokeStyle = b.colors[0]; ctx.lineWidth = (b.width ?? 6) * (1 - k * 0.7);
        ctx.beginPath(); ctx.arc(b.x, b.y, rad, 0, Math.PI * 2); ctx.stroke();
        continue;
      }
      for (const p of b.p) {
        if (dt > p.life) continue;
        const k = dt / p.life;
        const damp = (1 - Math.exp(-b.drag * dt)) / b.drag;
        const x = b.x + p.vx * damp + (b.kind === 'confetti' ? Math.sin(p.wob + dt * 6) * 18 : 0);
        const y = b.y + p.vy * damp + 0.5 * b.gravity * dt * dt;
        const a = b.kind === 'dust' ? Math.sin(Math.PI * k) * 0.8 : (1 - k * k);
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = p.c;
        if (b.kind === 'confetti') {
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot + p.vr * dt); ctx.scale(1, Math.cos(p.wob + dt * 9));
          ctx.fillRect(-p.s, -p.s * 0.5, p.s * 2, p.s); ctx.restore();
        } else if (b.kind === 'star') {
          const s = p.s * (1 - k * 0.5);
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot + p.vr * dt * 0.3);
          ctx.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? s * 0.35 : s; ctx.lineTo(Math.cos(i * Math.PI / 4) * rr, Math.sin(i * Math.PI / 4) * rr); } ctx.closePath(); ctx.fill(); ctx.restore();
        } else {
          const s = p.s * (b.kind === 'dust' ? 1 : (1 - k * 0.6));
          ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
          if (b.kind === 'spark' && b.trail !== false) {
            ctx.globalAlpha *= 0.35; ctx.strokeStyle = p.c; ctx.lineWidth = s;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 0.025 * Math.exp(-b.drag * dt), y - (p.vy * Math.exp(-b.drag * dt) + b.gravity * dt) * 0.025); ctx.stroke();
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  E.ring = (t0, x, y, o = {}) => bursts.push(Object.assign({ t0, x, y, kind: 'ring', life: 0.9, r0: 20, r1: 420, colors: ['#FFB55A'], width: 5 }, o));

  // ---------- flash / shake ----------
  const flashes = [], shakes = [];
  E.flash = (t0, dur = 0.5, peak = 0.9, attack = 0.04) => flashes.push({ t0, dur, peak, attack });
  E.shake = (t0, dur = 0.4, amp = 14) => shakes.push({ t0, dur, amp });
  const flashEl = document.getElementById('flash'), scenesEl = document.getElementById('scenes');
  function applyFlashShake(t) {
    let f = 0;
    for (const x of flashes) { const d = t - x.t0; if (d < -x.attack || d > x.dur) continue; f = Math.max(f, d < 0 ? x.peak * (1 + d / x.attack) : x.peak * Math.pow(1 - d / x.dur, 2)); }
    flashEl.style.opacity = f.toFixed(3);
    let sx = 0, sy = 0;
    for (const s of shakes) { const d = t - s.t0; if (d < 0 || d > s.dur) continue; const k = 1 - d / s.dur; sx += Math.sin(d * 87) * s.amp * k; sy += Math.cos(d * 71) * s.amp * k * 0.7; }
    scenesEl.style.transform = (sx || sy) ? `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px)` : '';
  }

  // ---------- atmosphere ----------
  E.atmos = { glow: 0.55, grid: 0, hue: 0 };
  const a1 = document.querySelector('.aurora.a1'), a2 = document.querySelector('.aurora.a2'), a3 = document.querySelector('.aurora.a3'), grid = document.querySelector('.bg-grid');
  function atmosphere(t) {
    const g = E.atmos.glow, pulse = 0.85 + 0.15 * (E.DATA ? E.energy(t, 'low') : 0);
    a1.style.transform = `translate(${Math.sin(t * 0.21) * 120}px, ${Math.cos(t * 0.17) * 80}px) scale(${1 + 0.08 * Math.sin(t * 0.3)})`;
    a2.style.transform = `translate(${Math.cos(t * 0.19) * 140}px, ${Math.sin(t * 0.23) * 90}px)`;
    a3.style.transform = `translate(${Math.sin(t * 0.13 + 1) * 200}px, ${Math.cos(t * 0.11) * 120}px)`;
    a1.style.opacity = (g * pulse).toFixed(3); a2.style.opacity = (g * 0.9 * pulse).toFixed(3); a3.style.opacity = (g * 0.7).toFixed(3);
    grid.style.opacity = E.atmos.grid.toFixed(3);
    grid.style.transform = `translate(${(-t * 18) % 80}px, ${(-t * 10) % 80}px)`;
  }

  // ---------- film grain ----------
  const grainC = document.getElementById('grain'), gctx = grainC.getContext('2d');
  const gimg = gctx.createImageData(480, 270);
  function grain(t) {
    const r = E.rng(Math.floor(t * FPS / 2) * 7919 + 13);
    const d = gimg.data;
    for (let i = 0; i < d.length; i += 4) { const v = (r() * 255) | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    gctx.putImageData(gimg, 0, 0);
  }

  // ---------- seek ----------
  E.updateAll = (t) => { atmosphere(t); for (const u of updaters) u(t); drawBursts(t); applyFlashShake(t); grain(t); };
  window.seek = async (t) => {
    TL.time(Math.max(0, Math.min(t, TL.duration())), true);
    E.updateAll(t);
    await Promise.all(seqs.map(s => s.update(t)));
    return true;
  };
  window.E = E;
})();
