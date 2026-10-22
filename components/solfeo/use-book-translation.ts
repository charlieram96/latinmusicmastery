'use client'
import {useTranslation} from '@/components/language-provider'
import {bookText,bookSvg} from '@/lib/solfeo/book-translation'
export function useBookTranslation(){
 const {locale}=useTranslation()
 return {locale,es:locale==='es',t:(text:string)=>bookText(text,locale),svg:(text:string)=>bookSvg(text,locale)}
}
