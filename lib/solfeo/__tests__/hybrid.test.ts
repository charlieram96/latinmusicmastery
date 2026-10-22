import {describe,it,expect} from 'vitest'
import {kidsContentId,solfeoPresentation} from '../hybrid'
describe('hybrid course identity',()=>{
 it('maps classic bookmarks without changing existing child assessment IDs',()=>{expect(kidsContentId('local-solfeo-m02-c03')).toBe('local-solfeo-kids-m02-c03');expect(kidsContentId('local-solfeo-kids-m02-c03')).toBe('local-solfeo-kids-m02-c03');expect(kidsContentId('local-solfeo-m02')).toBe('local-solfeo-kids-m02');expect(kidsContentId(undefined)).toBeUndefined()})
 it('keeps both covers and language variants',()=>{expect(solfeoPresentation(true,true).title).toBe('Solfeo Infantil Aplicado');expect(solfeoPresentation(false,true).title).toBe('Solfeo Aplicado');expect(solfeoPresentation(true,false).title).toBe('Applied Solfege for Kids');expect(solfeoPresentation(true,true).thumbnailUrl).not.toBe(solfeoPresentation(false,true).thumbnailUrl)})
})
