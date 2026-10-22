// Resolve the written route before rendering; keep source bar indices for sync.
function traverse(rows){
 const bars=[];for(const [rowIndex,row]of rows.entries())for(const [barIndex]of row.bars.entries())bars.push({rowIndex,barIndex,style:row.barStyles?.[barIndex],nav:(row.nav||[]).filter(n=>n.bar===barIndex),ending:(row.endings||[]).find(e=>barIndex>=e.from&&barIndex<=e.to)});
 const segno=bars.findIndex(b=>b.nav.some(n=>n.symbol==='segno')),coda=bars.findIndex(b=>b.nav.some(n=>n.symbol==='coda'));
 let i=0,repeatStart=0,pass=1,jumped=false;const visits=[],repeated=new Map();
 for(let safety=0;i<bars.length&&safety<bars.length*8;safety++){
  const b=bars[i];
  if(b.ending&&!String(b.ending.number).split(/[, ]+/).includes(String(pass))){i++;continue}
  if(b.style==='repeat-start')repeatStart=i;
  visits.push({...b,index:i});
  const text=b.nav.map(n=>n.text||'').join(' ');
  if(jumped&&/\bFine\b/i.test(text)&&!/D\.[CS]\./.test(text))return visits;
  if(jumped&&/A Coda/i.test(text)){if(coda<0)throw Error('Missing Coda');i=coda;continue}
  if(!jumped&&/D\.[CS]\./.test(text)){jumped=true;pass=1;i=/D\.S\./.test(text)?segno:0;if(i<0)throw Error('Missing Segno');continue}
  if(b.style==='repeat'&&!jumped){const endingPasses=String(b.ending?.number||'1').match(/\d+/g).map(Number);const returns=Math.max(...endingPasses);const used=repeated.get(i)||0;if(used<returns){repeated.set(i,used+1);pass=used+2;i=repeatStart;continue}}
  i++;
 }
 if(i<bars.length)throw Error('Unbounded score navigation');return visits;
}
function groups(visits){const result=[];for(const v of visits){const last=result.at(-1);if(last&&last.rowIndex===v.rowIndex&&last.to+1===v.barIndex)last.to=v.barIndex;else result.push({rowIndex:v.rowIndex,from:v.barIndex,to:v.barIndex})}return result}
module.exports={traverse,groups};
