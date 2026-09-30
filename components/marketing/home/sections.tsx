import Link from 'next/link'
import { Reveal } from '@/components/marketing/site/Reveal'
import { Accent } from '@/components/marketing/site/PageHead'
import { WaitlistSignup } from '@/components/marketing/site/WaitlistSignup'
import { StageClip } from '@/components/marketing/site/StageClip'
import { StyleAtlas } from '@/components/marketing/site/StyleAtlas'
import { PricingCalculator, type CalcInstrument } from '@/components/marketing/site/PricingCalculator'
import type { Catalog, CatalogTeacher } from '@/lib/marketing/catalog'
import type { PriceCents } from '@/lib/marketing/pricing-calc'
import { HeroKeys, type HeroChip } from './HeroKeys'
import { StagePlot, type PlotSeat } from './StagePlot'
import { GrooveSeq } from './GrooveSeq'
import { MaestroRail, RailButtons } from './MaestroRail'

type T = (key: string, params?: Record<string, string | number>) => string

const Check = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

function SecHead({ eyebrow, title, accent, children }: { eyebrow: React.ReactNode; title: string; accent: string; children: React.ReactNode }) {
  return (
    <Reveal className="sec-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="h2" style={{ marginTop: 18 }}>{title} <Accent>{accent}</Accent></h2>
      </div>
      {children}
    </Reveal>
  )
}

export function HeroSection({ t, counts, price, chip }: { t: T; counts: Catalog['counts']; price: string; chip: HeroChip | null }) {
  const k = (s: string, p?: Record<string, string | number>) => t(`marketing.site.home.hero.${s}`, p)
  return (
    <section className="hero">
      <div className="lights" aria-hidden="true"><div className="beam b1" /><div className="beam b2" /><div className="beam b3" /><div className="floor" /></div>
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="eyebrow fade-up">
            <span className="live-dot" aria-hidden="true" /><span>{k('open')}</span> · <b>{k('maestros', { n: counts.maestros })}</b> · <span>{k('instruments', { n: counts.instruments })}</span>
          </p>
          <h1 className="h1" aria-label={k('h1Label')}>
            <span className="ln" aria-hidden="true"><span>{k('line1')}</span></span>
            <span className="ln" aria-hidden="true"><span>{k('line2')}</span></span>
            <span className="ln" aria-hidden="true"><span className="serif grad-text">{k('line3')}</span></span>
          </h1>
          <p className="hero-sub fade-up">{k('subA')} <em>{k('subEm')}</em> {k('subB')}</p>
          <div className="fade-up" style={{ animationDelay: '.45s' }}><WaitlistSignup id="email-hero" /></div>
          <p className="signup-note fade-up">{k('notePrefix')} <b>{price}{k('notePer')}</b> {k('noteSuffix')}</p>
        </div>
        <HeroKeys chip={chip} />
      </div>
    </section>
  )
}

export function StageSection({ t, seats, defaultKey }: { t: T; seats: Record<string, PlotSeat>; defaultKey: string }) {
  const k = (s: string) => t(`marketing.site.home.stage.${s}`)
  return (
    <section className="sec" id="stage">
      <div className="wrap">
        <SecHead eyebrow={<><b>01</b> · <span>{k('eyebrow')}</span></>} title={k('title')} accent={k('accent')}>
          <p className="lede">{k('lede')}</p>
        </SecHead>
        <Reveal><StagePlot seats={seats} defaultKey={defaultKey} /></Reveal>
      </div>
    </section>
  )
}

export function AtlasSection({ t, countries }: { t: T; countries: Catalog['countries'] }) {
  const k = (s: string, p?: Record<string, string | number>) => t(`marketing.site.home.atlas.${s}`, p)
  return (
    <section className="sec" id="atlas" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <SecHead eyebrow={<><b>02</b> · <span>{k('eyebrow')}</span></>} title={k('title')} accent={k('accent')}>
          <p className="lede">{k('lede')}</p>
        </SecHead>
        <Reveal>
          <StyleAtlas countries={countries} labels={{ live: k('live'), soon: k('soon'), stylesLive: (live, total) => k('stylesLive', { live, total }) }} />
        </Reveal>
      </div>
    </section>
  )
}

export function GrooveSection({ t }: { t: T }) {
  const k = (s: string) => t(`marketing.site.home.groove.${s}`)
  return (
    <section className="sec" id="groove" style={{ paddingTop: 0 }}>
      <div className="wrap groove-grid">
        <Reveal>
          <p className="eyebrow"><b>03</b> · <span>{k('eyebrow')}</span></p>
          <h2 className="h2" style={{ marginTop: 18 }}>{k('title')} <Accent>{k('accent')}</Accent></h2>
          <p className="lede" style={{ marginTop: 22 }}>{k('lede')}</p>
        </Reveal>
        <Reveal><GrooveSeq /></Reveal>
      </div>
    </section>
  )
}

const FEATURE_ICONS = [
  <path key="a" d="M3 12h3l3-7 4 14 3-7h5" />,
  <g key="b"><circle cx="7" cy="17" r="3" /><circle cx="17" cy="15" r="3" /><path d="M10 17V5l10-2v12" /></g>,
  <path key="c" d="M4 7h16M4 12h16M4 17h16" />,
  <path key="d" d="M7 4v16M17 4v16M7 8h10M7 16h10" />,
]

export function PlaySenseSection({ t }: { t: T }) {
  const k = (s: string) => t(`marketing.site.home.playsense.${s}`)
  return (
    <section className="sec ps" id="playsense">
      <div className="wrap">
        <SecHead eyebrow={<><b>04</b> · PlaySense</>} title={k('title')} accent={k('accent')}>
          <p className="lede">{k('lede')}</p>
        </SecHead>
        <Reveal><StageClip /></Reveal>
        <Reveal as="ul" className="feat feat4">
          {FEATURE_ICONS.map((icon, i) => (
            <li key={i}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
              <div><b>{k(`f${i + 1}Title`)}</b><span>{k(`f${i + 1}Body`)}</span></div>
            </li>
          ))}
        </Reveal>
        <Reveal className="ps-actions"><Link className="btn btn-ghost" href="/playsense">{k('cta')}</Link></Reveal>
      </div>
    </section>
  )
}

export function MaestrosSection({ t, teachers }: { t: T; teachers: CatalogTeacher[] }) {
  const k = (s: string) => t(`marketing.site.home.maestros.${s}`)
  if (!teachers.length) return null
  return (
    <section className="sec" id="maestros">
      <div className="wrap">
        <SecHead eyebrow={<><b>{teachers.length}</b> · <span>{k('eyebrow')}</span></>} title={k('title')} accent={k('accent')}>
          <div className="sec-side">
            <p className="lede">{k('lede')}</p>
            <RailButtons railId="m-rail" />
          </div>
        </SecHead>
      </div>
      <Reveal><MaestroRail id="m-rail" teachers={teachers} label={k('railLabel')} /></Reveal>
    </section>
  )
}

export function PricingSection({ t, instruments, prices, defaultKey }: { t: T; instruments: CalcInstrument[]; prices: PriceCents; defaultKey: string }) {
  const k = (s: string) => t(`marketing.site.home.pricing.${s}`)
  return (
    <section className="sec" id="pricing" style={{ paddingTop: 'clamp(40px,5vw,80px)' }}>
      <div className="wrap">
        <SecHead eyebrow={<><b>05</b> · <span>{k('eyebrow')}</span></>} title={k('title')} accent={k('accent')}>
          <p className="lede">{k('lede')}</p>
        </SecHead>
        <Reveal className="price-grid">
          <PricingCalculator instruments={instruments} prices={prices} defaultKey={defaultKey} />
          <div className="side-cards">
            <div className="inc">
              <span className="sp-label">{k('includes')}</span>
              <ul>{[1, 2, 3, 4, 5].map(i => <li key={i}><Check /><span>{k(`inc${i}`)}</span></li>)}</ul>
            </div>
            <div className="allaccess">
              <div><b>{k('allAccess')}</b><p>{k('allAccessBody')}</p></div>
              <span className="tag">{t('marketing.site.common.comingSoon')}</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
