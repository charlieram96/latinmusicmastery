/* Shared visual building blocks: icons, mascot, counters and reusable motion recipes. */
(function () {
  const E = window.E;
  const sw = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const I = (E.ICON = {
    play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>`,
    check: `<svg viewBox="0 0 24 24" ${sw} stroke-width="3"><path d="M4 12.5l5 5L20 6.5"/></svg>`,
    flame: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.6 2.2c.4 2.8-.9 4.6-2.4 6.2C8.6 10.1 7 11.9 7 14.6 7 18 9.3 21 12.5 21S18 18.6 18 15.2c0-2.3-1.1-4-2.2-5.2-.2 1.6-.9 2.7-2 3.3.4-3.8-.5-7.5-1.2-11.1z"/></svg>`,
    trophy: `<svg viewBox="0 0 24 24" ${sw}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 6h3v1a3 3 0 0 1-3 3M7 6H4v1a3 3 0 0 0 3 3"/></svg>`,
    star: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>`,
    mic: `<svg viewBox="0 0 24 24" ${sw}><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7"/></svg>`,
    note: `<svg viewBox="0 0 24 24" ${sw}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    drum: `<svg viewBox="0 0 24 24" ${sw}><ellipse cx="12" cy="7" rx="8" ry="3"/><path d="M4 7v9c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 11c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>`,
    piano: `<svg viewBox="0 0 24 24" ${sw}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v10M12 4v10M16 4v10M8 14v6M12 14v6M16 14v6"/></svg>`,
    users: `<svg viewBox="0 0 24 24" ${sw}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.3a3.5 3.5 0 0 1 0 7M18 14.2A6.5 6.5 0 0 1 21.5 20"/></svg>`,
    msg: `<svg viewBox="0 0 24 24" ${sw}><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/></svg>`,
    spark: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8zM19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z"/></svg>`,
    target: `<svg viewBox="0 0 24 24" ${sw}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>`,
    chart: `<svg viewBox="0 0 24 24" ${sw}><path d="M3 20h18M6 16v-5M11 16V7M16 16v-8M21 16V4"/></svg>`,
    cal: `<svg viewBox="0 0 24 24" ${sw}><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
    upload: `<svg viewBox="0 0 24 24" ${sw}><path d="M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>`,
    video: `<svg viewBox="0 0 24 24" ${sw}><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/></svg>`,
    headphones: `<svg viewBox="0 0 24 24" ${sw}><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><rect x="2.5" y="14" width="5" height="7" rx="2"/><rect x="16.5" y="14" width="5" height="7" rx="2"/></svg>`,
    bulb: `<svg viewBox="0 0 24 24" ${sw}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>`,
    loop: `<svg viewBox="0 0 24 24" ${sw}><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>`,
    globe: `<svg viewBox="0 0 24 24" ${sw}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`,
    heart: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3 1.6-1.8 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg>`,
    award: `<svg viewBox="0 0 24 24" ${sw}><circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/></svg>`,
    book: `<svg viewBox="0 0 24 24" ${sw}><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5zM4 21.5A2.5 2.5 0 0 1 6.5 19H20"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" ${sw}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
    lock: `<svg viewBox="0 0 24 24" ${sw}><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" ${sw}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>`,
    vol: `<svg viewBox="0 0 24 24" ${sw}><path d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>`,
    arrow: `<svg viewBox="0 0 24 24" ${sw} stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
    x: `<svg viewBox="0 0 24 24" ${sw} stroke-width="3"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
    discord: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`,
    conga: `<svg viewBox="0 0 24 24" ${sw}><path d="M7 3h10l-1.2 5.5c-.3 1.5-.3 3 0 4.5L17 21H7l1.2-8c.3-1.5.3-3 0-4.5z"/><ellipse cx="12" cy="3" rx="5" ry="1.2"/></svg>`,
    timbal: `<svg viewBox="0 0 24 24" ${sw}><ellipse cx="7" cy="9" rx="5" ry="1.8"/><path d="M2 9v5c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V9"/><ellipse cx="17.5" cy="11" rx="4.5" ry="1.6"/><path d="M13 11v4.5c0 .9 2 1.6 4.5 1.6s4.5-.7 4.5-1.6V11M7 16v5M17.5 17v4"/></svg>`,
    bongo: `<svg viewBox="0 0 24 24" ${sw}><path d="M2.5 8h8l-1 9h-6z"/><path d="M13.5 9h8l-1 8h-6z"/><path d="M10.5 12h3"/></svg>`,
    bass: `<svg viewBox="0 0 24 24" ${sw}><path d="M15 3l3 3-2 2M16 5l-6.5 6.5"/><path d="M9.5 11.5c-2-.8-4.2.1-5 2-.9 2.1.3 4.1 1.8 4.8.7 1.5 2.7 2.7 4.8 1.8 1.9-.8 2.8-3 2-5"/><path d="M8 16l1 1"/></svg>`,
    guitar: `<svg viewBox="0 0 24 24" ${sw}><path d="M19 2l3 3-3 1-5.5 5.5"/><path d="M13.5 10.5c-2.3-1-5-.2-6 2.1-.6 1.4-2.3 1.3-3.4 2.4-1.7 1.7-1.2 4.4.6 5.9 1.5 1.8 4.2 2.3 5.9.6 1.1-1.1 1-2.8 2.4-3.4 2.3-1 3.1-3.7 2.1-6"/><circle cx="10" cy="15" r="1.5"/></svg>`,
    violin: `<svg viewBox="0 0 24 24" ${sw}><path d="M18 2l4 4M20 4l-6 6"/><path d="M14 10c-1.5-1.5-4-1-5 .5-.6.9-1.8.8-2.6 1.6-1.8 1.8-1.4 4.6.4 6.4s4.6 2.2 6.4.4c.8-.8.7-2 1.6-2.6 1.5-1 2-3.5.5-5"/></svg>`,
    trumpet: `<svg viewBox="0 0 24 24" ${sw}><path d="M2 10h11l6-4v12l-6-4H2zM6 10v4M9 10v4"/></svg>`,
    sax: `<svg viewBox="0 0 24 24" ${sw}><path d="M9 2v12a5 5 0 0 0 10 0v-2h3"/><path d="M9 6h3M9 9h3"/></svg>`,
    guiro: `<svg viewBox="0 0 24 24" ${sw}><ellipse cx="12" cy="12" rx="9" ry="5"/><path d="M8 8v8M11 7v10M14 7v10M17 8v8"/></svg>`,
    shaker: `<svg viewBox="0 0 24 24" ${sw}><ellipse cx="9" cy="9" rx="6" ry="6"/><path d="M13 13l8 8"/></svg>`,
    tres: `<svg viewBox="0 0 24 24" ${sw}><path d="M17 2l5 5-3 1-5 5"/><path d="M14 13c-1.8-1.6-4.6-1.4-6 .4-.5.7-1.6.8-2.4 1.6-1.6 1.6-1.3 4 .3 5.6s4 1.9 5.6.3c.8-.8.9-1.9 1.6-2.4 1.8-1.4 2-4.2.4-6z"/></svg>`,
  });

  // Corcheita, the kids course mascot (same drawing as components/solfeo-kids/answer-reaction.tsx)
  E.corcheita = (mood = 'happy') => `<svg viewBox="0 0 100 120" class="corcheita-svg"><path d="M55 80V28Q85 30 76 52Q70 43 58 42" stroke="#7251b1" stroke-width="7" fill="#bba1eb" stroke-linejoin="round"/><ellipse cx="40" cy="81" rx="22" ry="18" transform="rotate(-18 40 81)" fill="#bba1eb" stroke="#7251b1" stroke-width="3"/><path class="arms" d="M23 75L10 59M59 74L81 66M31 98L25 110H13M48 97L57 109H70" stroke="#7251b1" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="33" cy="77" r="3" fill="#283852"/><circle cx="47" cy="75" r="3" fill="#283852"/><path d="M35 86Q42 92 49 84" stroke="#283852" fill="none" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="28" cy="84" rx="4" ry="2.4" fill="#ff8fb8" opacity=".55"/><ellipse cx="52" cy="81" rx="4" ry="2.4" fill="#ff8fb8" opacity=".55"/></svg>`;

  // ---------- counters ----------
  E.counter = (node, t0, t1, from, to, fmt = (v) => Math.round(v).toString(), ease = E.easeOut) => {
    E.onUpdate((t) => { if (t < t0) return; const k = ease((t - t0) / (t1 - t0)); node.textContent = fmt(from + (to - from) * E.clamp(k)); });
  };

  // ---------- motion recipes (all added to the master timeline) ----------
  const TL = E.TL;
  E.popIn = (el, t, o = {}) => TL.fromTo(el, { autoAlpha: 0, scale: o.from ?? 0.6, y: o.y ?? 0, rotation: o.rot ?? 0 }, { autoAlpha: 1, scale: 1, y: 0, rotation: 0, duration: o.d ?? 0.6, ease: o.ease ?? 'back.out(2)', immediateRender: true }, t);
  E.fadeUp = (el, t, o = {}) => TL.fromTo(el, { autoAlpha: 0, y: o.y ?? 50, filter: o.blur === false ? 'none' : `blur(${o.blurPx ?? 12}px)` }, { autoAlpha: 1, y: 0, filter: o.blur === false ? 'none' : 'blur(0px)', duration: o.d ?? 0.9, ease: o.ease ?? 'expo.out', stagger: o.stagger ?? 0, immediateRender: true }, t);
  E.fadeOut = (el, t, o = {}) => TL.to(el, { autoAlpha: 0, y: o.y ?? 0, scale: o.scale ?? 1, filter: o.blur ? `blur(${o.blur}px)` : undefined, duration: o.d ?? 0.4, ease: o.ease ?? 'power2.in', stagger: o.stagger ?? 0 }, t);
  E.slideIn = (el, t, o = {}) => TL.fromTo(el, { autoAlpha: 0, x: o.x ?? 120, y: o.y ?? 0, rotationY: o.ry ?? 0 }, { autoAlpha: 1, x: 0, y: 0, rotationY: 0, duration: o.d ?? 0.9, ease: o.ease ?? 'expo.out', stagger: o.stagger ?? 0, immediateRender: true }, t);
  E.wordsIn = (words, times, o = {}) => words.forEach((w, i) => TL.fromTo(w, { autoAlpha: 0, y: o.y ?? 40, filter: `blur(${o.blur ?? 10}px)`, scale: o.scale ?? 1 }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', scale: 1, duration: o.d ?? 0.55, ease: o.ease ?? 'expo.out', immediateRender: true }, times[Math.min(i, times.length - 1)] + (o.lag ?? 0) * Math.max(0, i - times.length + 1)));
  E.shineAcross = (shineEl, t, d = 0.9) => TL.fromTo(shineEl, { xPercent: -120 }, { xPercent: 120, duration: d, ease: 'power2.inOut', immediateRender: true }, t);

  // ---------- small DOM factories ----------
  E.icon = (name, cls = 'ic', parent) => E.el('span', cls, parent, I[name] || '');
  E.avatar = (initials, color, parent, size = 44) => E.el('span', 'avatar', parent, initials, { width: size + 'px', height: size + 'px', background: color, fontSize: size * 0.38 + 'px' });
})();
