/* Boot: load data and fonts, build every scene onto the master timeline, signal readiness. */
(async function () {
  const E = window.E;
  E.DATA = await (await fetch('data/' + (new URLSearchParams(location.search).get('tl') || 'timeline.json'))).json();
  const faces = ['900 100px BigShoulders', '800 100px BigShoulders', '700 100px BigShoulders', 'italic 400 100px InstrumentSerif', '400 20px Hanken', '500 20px Hanken', '600 20px Hanken', '700 20px Hanken', '800 20px Hanken', '400 20px DMMono', '500 20px DMMono', '400 20px Inter', '500 20px Inter', '600 20px Inter', '700 20px Inter', '800 20px Inter', '700 20px Montserrat', '800 20px Montserrat'];
  await Promise.all(faces.map(f => document.fonts.load(f).catch(() => null)));
  await document.fonts.ready;
  for (const build of E.SCENES) { try { build(); } catch (e) { console.error('scene build failed', build.name, e); window.BUILD_ERRORS = (window.BUILD_ERRORS || []).concat(build.name + ': ' + e.message); } }
  E.TL.set({}, {}, E.DATA.duration);
  // preload every image referenced in the DOM
  await Promise.all([...document.images].map(im => im.decode ? im.decode().catch(() => null) : null));
  E.TL.time(0.001, true); E.TL.time(0, true);
  window.READY = true;
})();
