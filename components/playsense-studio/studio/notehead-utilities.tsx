'use client';
import {ChevronDown,Settings2} from 'lucide-react';
import type {PercussionNotehead} from '../shared/score-model/types';
import type {PercStroke} from '@/lib/playsense-studio/perc-strokes';
import {PERCUSSION_GLYPHS} from '@/lib/playsense-studio/percussion-noteheads';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuSub,DropdownMenuSubTrigger,DropdownMenuSubContent,DropdownMenuPortal} from '@/components/ui/dropdown-menu';
import {PaletteGlyph} from './palette-glyph';
import {useStudioText} from './use-studio-text';
const heads: [PercussionNotehead,string][] = [['normal','Normal'],['plus','Plus'],['x','Cross'],['ornate-x','Ornate cross'],['circled','Circled'],['slash','Slash'],['slashed','Slashed'],['diamond','Diamond'],['triangle-up','Triangle up'],['triangle-down','Triangle down'],['square','Square']];
const glyph=(head:PercussionNotehead)=>head==='normal'?'\uE0A4':PERCUSSION_GLYPHS[head];
export function NoteheadUtilities({enabled,onPick,strokes,instrumentName,onStroke}:{enabled:boolean;onPick:(head:PercussionNotehead|null)=>void;strokes?:PercStroke[]|null;instrumentName?:string;onStroke?:(strokeId:string)=>void}) {
 const st=useStudioText();
 return <DropdownMenu>
  <DropdownMenuTrigger asChild><button type="button" data-score-preserve-selection className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-2 text-xs"><Settings2 size={14}/>{st('Utilities')}<ChevronDown size={12}/></button></DropdownMenuTrigger>
  <DropdownMenuContent align="end" data-score-preserve-selection onKeyDown={e=>e.stopPropagation()} className="w-52 rounded-xl p-1.5">
   <DropdownMenuSub>
    <DropdownMenuSubTrigger>{st('Noteheads')}</DropdownMenuSubTrigger>
    <DropdownMenuPortal><DropdownMenuSubContent data-score-preserve-selection onKeyDown={e=>e.stopPropagation()} className="max-h-[min(70vh,560px)] w-72 overflow-y-auto rounded-xl p-1.5">
     {!enabled&&<DropdownMenuLabel className="whitespace-normal text-xs font-normal text-muted-foreground">{st('Select notes or measures first.')}</DropdownMenuLabel>}
     {!!strokes?.length&&<>
      <DropdownMenuLabel>{st('Instrument legend')}{instrumentName?` · ${st(instrumentName)}`:''}</DropdownMenuLabel>
      {strokes.map(stroke=><DropdownMenuItem key={stroke.id} disabled={!enabled||!onStroke} onSelect={()=>onStroke?.(stroke.id)}>
       <PaletteGlyph glyph={glyph(stroke.notehead??stroke.noteType??'normal')}/><span className="flex-1">{st(stroke.label)}{stroke.marcato?' ^':''}</span><span className="text-xs text-muted-foreground">{stroke.staffLine.replace('/','').toUpperCase()}</span>
      </DropdownMenuItem>)}
      <DropdownMenuSeparator/>
     </>}
     <DropdownMenuSub>
      <DropdownMenuSubTrigger>{st('Other noteheads')}</DropdownMenuSubTrigger>
      <DropdownMenuPortal><DropdownMenuSubContent data-score-preserve-selection onKeyDown={e=>e.stopPropagation()} className="max-h-[70vh] w-52 overflow-y-auto rounded-xl p-1.5">
       {heads.map(([head,label])=><DropdownMenuItem key={head} disabled={!enabled} onSelect={()=>onPick(head)}><PaletteGlyph glyph={glyph(head)}/>{st(label)}</DropdownMenuItem>)}
      </DropdownMenuSubContent></DropdownMenuPortal>
     </DropdownMenuSub>
     <DropdownMenuSeparator/>
     <DropdownMenuItem disabled={!enabled} onSelect={()=>onPick(null)}>{st('Restore instrument legend')}</DropdownMenuItem>
    </DropdownMenuSubContent></DropdownMenuPortal>
   </DropdownMenuSub>
  </DropdownMenuContent>
 </DropdownMenu>;
}
