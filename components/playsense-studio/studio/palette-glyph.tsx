'use client';
import {useEffect,useState} from 'react';

// SMuFL glyphs have musical baselines, not visually centered text boxes.
// Fit the actual ink bounds rather than the font's line-height.
export function PaletteGlyph({glyph}:{glyph:string}) {
 const [bounds,setBounds]=useState('-20 -90 160 160');
 const [size,setSize]=useState({width:18,height:22});
 const musical=glyph.codePointAt(0)!>=0xE000;
 useEffect(()=>{
  if(!musical || !document.fonts)return;
  let cancelled=false;
  void document.fonts.load('100px LMMBravura').then(()=>{
   if(cancelled)return;
   const ctx=document.createElement('canvas').getContext('2d');if(!ctx)return;
   ctx.font='100px LMMBravura';const m=ctx.measureText(glyph);
   const w=m.actualBoundingBoxLeft+m.actualBoundingBoxRight;
   const h=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;
   if(w>0&&h>0){
    setBounds(`${-m.actualBoundingBoxLeft-4} ${-m.actualBoundingBoxAscent-4} ${w+8} ${h+8}`);
    const scale=Math.min(.22,24/(w+8),22/(h+8));
    setSize({width:(w+8)*scale,height:(h+8)*scale});
   }
  });
  return()=>{cancelled=true;};
 },[glyph,musical]);
 return musical?<svg aria-hidden viewBox={bounds} width={size.width} height={size.height} preserveAspectRatio="xMidYMid meet" className="block overflow-hidden"><text x="0" y="0" style={{fontFamily:'LMMBravura',fontSize:100}} fill="currentColor">{glyph}</text></svg>:<span className={glyph.length>4?'text-[10px] italic':'text-sm'}>{glyph}</span>;
}
