import Image from 'next/image'

/** Lightweight CSS artwork is available while the 3D renderer itself is loading. */
export function StageLoading() {
  return <div className="ps-stage-message ps-stage-loading" role="status" aria-live="polite">
    <div className="ps-stage-loading-content">
      <div className="ps-stage-loading-arch" aria-hidden="true">
        <Image src="/logo-solo-color.svg" alt="" width={48} height={38} />
        <div className="ps-stage-loading-rhythm"><i/><i/><i/><i/><i/></div>
      </div>
      <div className="ps-stage-loading-copy">
        <span>PlaySense</span>
        <h2>Setting your stage</h2>
        <p>Take a breath. Find your rhythm.</p>
      </div>
      <div className="ps-stage-loading-track" aria-hidden="true"><i/></div>
    </div>
    <span className="ps-stage-loading-signature" aria-hidden="true">Latin Music Mastery</span>
  </div>
}
