'use client';
import {useTranslation} from '@/components/language-provider';
export function PrecountControl({bars,onChange,remaining=0}:{bars:0|1|2;onChange:(bars:0|1|2)=>void;remaining?:number}) {
 const {locale}=useTranslation(),es=locale==='es';
 return <div className="flex flex-wrap items-center gap-2 text-xs"><label className="flex items-center gap-2">{es?'Cuenta previa':'Pre-count'}<select aria-label={es?'Cuenta previa':'Pre-count'} value={bars} onChange={e=>onChange(Number(e.target.value) as 0|1|2)} className="rounded border border-border bg-background px-2 py-1 text-foreground"><option value="0">{es?'Desactivada':'Off'}</option><option value="1">{es?'1 compás':'1 measure'}</option><option value="2">{es?'2 compases':'2 measures'}</option></select></label>{remaining>0&&<output role="status" className="font-mono text-xl font-bold text-primary">{remaining}</output>}</div>;
}
