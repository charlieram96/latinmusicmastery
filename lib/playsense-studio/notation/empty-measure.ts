import { Dot, StaveNote, TickContext, type RenderContext, type Stave } from 'vexflow';

export function emptyRestDuration(meter:[number,number]) {
  const qn=meter[0]*4/meter[1];
  if(qn===2)return {duration:'hr',dots:0};
  if(qn===3)return {duration:'hr',dots:1};
  if(qn===1)return {duration:'qr',dots:0};
  if(qn===6)return {duration:'wr',dots:1};
  return {duration:'wr',dots:0};
}
/** Display only: blank bars stay ready for entry and add no graded events. */
export function drawEmptyMeasure(ctx:RenderContext,stave:Stave,meter:[number,number],text?:{text:string;fontSize:number}, bounds?:{left:number;right:number}) {
  const left=Math.max(stave.getNoteStartX(),bounds?.left??-Infinity),right=Math.min(stave.getNoteEndX(),bounds?.right??Infinity);
  const center=(left+right)/2;
  ctx.save();
  if(text?.text.trim()) {
    ctx.openGroup('measure-text');
    ctx.setFont('Arial',Math.max(10,Math.min(48,text.fontSize||16)));
    // At a distant timeline zoom keep the label inside its own bar.
    const available=Math.max(0,right-left-8);
    let label=text.text;
    while(label.length>1 && ctx.measureText(label).width>available) label=label.slice(0,-2)+'…';
    if(ctx.measureText(label).width<=available) ctx.fillText(label,center-ctx.measureText(label).width/2,stave.getYForLine(0)-8);
    ctx.closeGroup();
  } else {
    const {duration,dots}=emptyRestDuration(meter);
    const note=new StaveNote({keys:['b/4'],duration});
    for(let i=0;i<dots;i++)Dot.buildAndAttach([note],{all:true});
    note.setStave(stave);
    const tick=new TickContext().addTickable(note).preFormat().setX(0);
    tick.setX(center-note.getAbsoluteX()-note.getGlyphWidth()/2);
    ctx.openGroup('empty-measure-rest');
    note.setContext(ctx).draw();
    ctx.closeGroup();
  }
  ctx.restore();
}
