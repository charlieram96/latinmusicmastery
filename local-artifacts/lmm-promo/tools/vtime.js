// Virtual clock for deterministic frame capture. Passthrough until __vt.enable().
(() => {
  if (window.__vt) return;
  const R = { raf: window.requestAnimationFrame.bind(window), caf: window.cancelAnimationFrame.bind(window), st: window.setTimeout.bind(window), si: window.setInterval.bind(window), ct: window.clearTimeout.bind(window), ci: window.clearInterval.bind(window), pnow: performance.now.bind(performance), dnow: Date.now };
  let on = false, base = 0, vnow = 0, dateBase = 0;
  let rafQ = new Map(), rafId = 1e7;
  const timers = new Map(); let tid = 1e7;
  const anims = new WeakMap();
  performance.now = () => on ? vnow : R.pnow();
  Date.now = () => on ? dateBase + (vnow - base) : R.dnow();
  window.requestAnimationFrame = cb => { if (!on) return R.raf(cb); const id = ++rafId; rafQ.set(id, cb); return id; };
  window.cancelAnimationFrame = id => { if (rafQ.delete(id)) return; R.caf(id); };
  window.setTimeout = (fn, ms = 0, ...a) => { if (!on) return R.st(fn, ms, ...a); const id = ++tid; timers.set(id, { at: vnow + Math.max(0, +ms || 0), fn, a, iv: 0 }); return id; };
  window.setInterval = (fn, ms = 0, ...a) => { if (!on) return R.si(fn, ms, ...a); const id = ++tid; const iv = Math.max(1, +ms || 0); timers.set(id, { at: vnow + iv, fn, a, iv }); return id; };
  window.clearTimeout = id => { if (timers.delete(id)) return; R.ct(id); };
  window.clearInterval = id => { if (timers.delete(id)) return; R.ci(id); };
  const syncAnims = () => {
    for (const a of document.getAnimations()) {
      let st = anims.get(a);
      if (st === undefined) { st = vnow - (a.currentTime || 0); anims.set(a, st); try { a.pause(); } catch {} }
      try { a.currentTime = vnow - st; } catch {}
    }
  };
  window.__vt = {
    enable() { if (on) return; base = R.pnow(); vnow = base; dateBase = R.dnow(); on = true; syncAnims(); },
    now: () => vnow,
    advance(ms) {
      const target = vnow + ms;
      for (let guard = 0; guard < 10000; guard++) {
        let best = null;
        for (const [id, t] of timers) if (t.at <= target && (!best || t.at < best[1].at)) best = [id, t];
        if (!best) break;
        const [id, t] = best; vnow = Math.max(vnow, t.at);
        if (t.iv) t.at += t.iv; else timers.delete(id);
        try { typeof t.fn === 'function' ? t.fn(...t.a) : (0, eval)(t.fn); } catch (e) { console.error(e); }
      }
      vnow = target;
      const q = rafQ; rafQ = new Map();
      for (const cb of q.values()) { try { cb(vnow); } catch (e) { console.error(e); } }
      syncAnims();
    },
  };
})();
