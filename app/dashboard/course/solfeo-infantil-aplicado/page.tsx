import { redirect } from 'next/navigation'
export default async function Page({searchParams}:{searchParams:Promise<{class?:string;module?:string}>}) {const query=await searchParams;const params=new URLSearchParams();if(query.class)params.set('class',query.class);if(query.module)params.set('module',query.module);redirect('/dashboard/course/solfeo-aplicado'+(params.size?'?'+params.toString():''))}
