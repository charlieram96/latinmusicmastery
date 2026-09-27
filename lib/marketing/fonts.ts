import { Big_Shoulders, DM_Mono, Hanken_Grotesk, Instrument_Serif } from 'next/font/google'

// Marketing-only faces. The layout puts these variable classes on the `.mkt`
// wrapper; marketing.css reads them through --f-display / --f-serif / --f-body / --f-mono.
const display = Big_Shoulders({ subsets: ['latin'], weight: ['700', '800', '900'], variable: '--nf-display', display: 'swap' })
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: 'italic', variable: '--nf-serif', display: 'swap' })
const body = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--nf-body', display: 'swap' })
const mono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--nf-mono', display: 'swap' })

export const marketingFontVars = [display.variable, serif.variable, body.variable, mono.variable].join(' ')
