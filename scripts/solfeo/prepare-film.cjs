function prepareFilm(film){
if(film.module===11||(film.module===10&&film.number===5)){
 const {traverse,groups}=require('./repertoire-traversal.cjs');
 const notation=film.scenes.filter(s=>['score','grand-study'].includes(s.diagram?.kind));
 const rows=notation.map(s=>s.diagram.rows?.[0]||s.diagram.upperRow);
 if(rows.length){
  let bpm=96;const {tempo}=require('./score-audio.cjs');
  const tempi=rows.map(r=>{bpm=tempo(r.tempo,bpm);const initial=bpm;for(const n of r.nav||[])bpm=tempo(n.text,bpm);return initial});
  const ordered=groups(traverse(rows)).map(g=>({...notation[g.rowIndex],range:[g.from,g.to],bpm:tempi[g.rowIndex],traversalResolved:true}));
  film={...film,scenes:[...film.scenes.filter(s=>s.kind!=='completion'&&!['score','grand-study'].includes(s.diagram?.kind)),...ordered,film.scenes.at(-1)]};
 }
}
return film;
}
module.exports={prepareFilm};
