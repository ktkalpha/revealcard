import React from 'react'

const MOTION_COMPONENTS = {
  fusion: React.lazy(() => import('./motion/FusionMotion')),
  'solar-flow': React.lazy(() => import('./motion/SolarFlow')),
}

// A built-in animation from a ```motion block; unknown names stay as plain text.
export default function MotionBlock({ name }) {
  const Motion = MOTION_COMPONENTS[name]
  if (!Motion) return <pre><code>{name}</code></pre>
  return (
    <React.Suspense fallback={<div className="motion-figure motion-loading">애니메이션을 불러오는 중…</div>}>
      <Motion />
    </React.Suspense>
  )
}
