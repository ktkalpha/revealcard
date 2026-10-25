import React, { useEffect, useReducer, useRef } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import MathText from '../MathText'

// 수소 핵융합 반응 (그림 Ⅱ-18): six hydrogen nuclei collide step by step into one
// helium nucleus, giving off energy at every collision. Drawn light like the
// textbook figure so it reads well on a phone.

const R = 19
// Card text re-renders remount this block, so playback lives outside it.
const memory = { current: null }
const A = [195, 85], B = [195, 315], C = [340, 132], D = [340, 268], E = [470, 200], HE = [555, 200]
const FREE_TOP = [598, 68], FREE_BOTTOM = [598, 332]
const at = ([x, y], dx, dy) => [x + dx, y + dy]
const IDS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
const START = Object.fromEntries(IDS.map((id, i) => [id, [62, 55 + i * 58]]))
// Where every nucleus rests after each step.
const STATES = [
  START,
  { ...START, p1: at(A, -13, -10), p2: at(A, 13, 10), p5: at(B, -13, -10), p6: at(B, 13, 10) },
  { p1: at(C, -15, -12), p2: at(C, 15, -12), p3: at(C, 0, 14), p4: at(D, 0, -14), p5: at(D, 15, 12), p6: at(D, -15, 12) },
  { p1: at(HE, -14, -14), p2: at(HE, 14, -14), p6: at(HE, -14, 14), p5: at(HE, 14, 14), p3: FREE_TOP, p4: FREE_BOTTOM },
]
// Step ③: the two helium-3 nuclei meet here before the helium-4 nucleus and two protons fly apart.
const MID3 = { p1: at(E, -15, -31), p2: at(E, 15, -31), p3: at(E, 0, -8), p4: at(E, 0, 8), p5: at(E, 15, 31), p6: at(E, -15, 31) }
// One proton of each first pair becomes a neutron.
const TURNS = { p2: 1, p6: 1 }

const STEPS = [
  { dur: 2000 },
  { dur: 3000, hit: 0.55, bursts: [A, B], waves: [[A, -28], [B, 28]] },
  { dur: 3000, hit: 0.55, bursts: [C, D], waves: [[C, -42], [D, 42]] },
  { dur: 3600, hit: 0.45, bursts: [E], big: true, waves: [[E, -68]] },
  { dur: 2600 },
]
const GROUPS = [
  [],
  [{ ids: ['p1', 'p2'], label: '²H 중수소' }, { ids: ['p5', 'p6'], label: '²H 중수소', below: true }],
  [{ ids: ['p1', 'p2', 'p3'], label: '³He' }, { ids: ['p4', 'p5', 'p6'], label: '³He', below: true }],
  [{ ids: ['p1', 'p2', 'p5', 'p6'], label: '⁴He 헬륨 원자핵', below: true }, { ids: ['p3'], label: '¹H', right: true }, { ids: ['p4'], label: '¹H', right: true }],
]
const TRACKS = [
  [],
  [[START.p1, A], [START.p2, A], [START.p5, B], [START.p6, B]],
  [[A, C], [START.p3, C], [B, D], [START.p4, D]],
  [[C, E], [D, E], [E, HE], [E, FREE_TOP], [E, FREE_BOTTOM]],
]
const CAPTIONS = [
  { head: '태양 중심부 (약 1500만 K)', text: '초고온의 중심부에서 수소 원자핵(양성자)들이 매우 빠르게 움직여요.' },
  { head: String.raw`① ${'$'}{}^{1}_{1}\mathrm{H} + {}^{1}_{1}\mathrm{H} \longrightarrow {}^{2}_{1}\mathrm{H} + E$`, text: '수소 원자핵 2개 충돌 → 중수소 원자핵 + 에너지' },
  { head: String.raw`② ${'$'}{}^{2}_{1}\mathrm{H} + {}^{1}_{1}\mathrm{H} \longrightarrow {}^{3}_{2}\mathrm{He} + E$`, text: '중수소 원자핵 + 수소 원자핵 → 헬륨-3 원자핵 + 에너지' },
  { head: String.raw`③ ${'$'}{}^{3}_{2}\mathrm{He} + {}^{3}_{2}\mathrm{He} \longrightarrow {}^{4}_{2}\mathrm{He} + 2\,{}^{1}_{1}\mathrm{H} + E$`, text: '헬륨-3 원자핵 2개 충돌 → 헬륨 원자핵 + 수소 원자핵 2개 + 에너지' },
  { head: String.raw`전체 ${'$'}4\,{}^{1}_{1}\mathrm{H} \longrightarrow {}^{4}_{2}\mathrm{He} + E$`, text: String.raw`줄어든 질량(질량 결손 Δm)이 에너지로: ${'$'}E = \Delta m c^2$` },
]
const STEP_NAMES = ['시작', '①', '②', '③', '전체']

const clamp = (v) => Math.min(1, Math.max(0, v))
const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
const easeIn = (u) => u * u * u
const easeOut = (u) => 1 - (1 - u) ** 3

function position(id, step, t) {
  if (step === 0) return START[id]
  if (step === 4) return STATES[3][id]
  const { hit } = STEPS[step]
  const from = STATES[step - 1][id], to = STATES[step][id]
  if (step < 3) return mix(from, to, easeIn(clamp(t / hit)))
  if (t < hit) return mix(from, MID3[id], easeIn(clamp(t / hit)))
  return mix(MID3[id], to, easeOut(clamp((t - hit - 0.04) / 0.45)))
}

// How far a nucleus has turned from proton (0) into neutron (1).
const neutron = (id, step, t) => !TURNS[id] ? 0 : step > 1 ? 1 : step === 1 ? clamp((t - STEPS[1].hit) / 0.15) : 0

// A group is shown (star and label) from the collision that forms it until the next one.
function shown(state, step, t) {
  if (step === state) return clamp((t - STEPS[state].hit - 0.05) / 0.15)
  if (step === state + 1) return state === 3 ? 1 : 1 - clamp((t - STEPS[step].hit + 0.12) / 0.12)
  return state === 3 && step > 3 ? 1 : 0
}

const star = ([x, y], outer, inner, spikes, turn = 0) => Array.from({ length: spikes * 2 }, (_, i) => {
  const r = i % 2 ? inner : outer
  const a = (i / (spikes * 2)) * Math.PI * 2 + turn
  return `${(x + Math.cos(a) * r).toFixed(1)},${(y + Math.sin(a) * r).toFixed(1)}`
}).join(' ')

const wavePath = (() => {
  let d = 'M0 0'
  for (let i = 1; i <= 8; i++) d += ` L${i * 6} ${i % 2 ? -6 : 6}`
  return `${d} L52 0`
})()

function Wave({ origin, angle, progress, faded }) {
  const offset = 30 + 26 * easeOut(progress)
  return (
    <g transform={`translate(${origin[0]} ${origin[1]}) rotate(${angle}) translate(${offset} 0)`} opacity={faded ? 0.45 : clamp(progress * 4)}>
      <path d={wavePath} fill="none" stroke="#e8501f" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M50 -8 L66 0 L50 8 Z" fill="#e8501f" />
    </g>
  )
}

function Burst({ at: point, progress, big }) {
  const size = (big ? 92 : 62) * (0.4 + 0.8 * easeOut(progress))
  const fade = 1 - clamp((progress - 0.3) / 0.7)
  return (
    <g>
      <polygon points={star(point, size, size * 0.6, 18, progress)} fill="url(#fm-burst)" stroke="#f6a21a" strokeWidth="1.5" opacity={fade} />
      <circle cx={point[0]} cy={point[1]} r={size * (0.7 + progress * 1.1)} fill="none" stroke="#f08a1c" strokeWidth={big ? 4 : 3} opacity={fade * 0.7} />
    </g>
  )
}

function useReducedMotion() {
  const query = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')
  return !!query?.matches
}

// Arrows stop short of the nucleus they point at.
function shorten(from, to, by) {
  const dx = to[0] - from[0], dy = to[1] - from[1]
  const length = Math.hypot(dx, dy) || 1
  return [to[0] - (dx / length) * by, to[1] - (dy / length) * by]
}

export default function FusionMotion() {
  const reduced = useReducedMotion()
  const state = useRef(null)
  state.current ||= memory.current ||= { step: 0, t: reduced ? 1 : 0, playing: false, stopAfter: false, now: 0, started: false }
  const [, render] = useReducer((n) => n + 1, 0)
  const root = useRef(null)
  const visible = useRef(false)

  useEffect(() => {
    let frame = 0, last = performance.now()
    const tick = (time) => {
      const s = state.current
      const dt = Math.min(64, time - last)
      last = time
      s.now += reduced ? 0 : dt
      if (s.playing) {
        s.t += dt / STEPS[s.step].dur
        if (s.t >= 1) {
          if (s.step < 4 && !s.stopAfter) { s.step += 1; s.t = 0 }
          else { s.t = 1; s.playing = false; s.stopAfter = false }
        }
      }
      render()
      frame = visible.current ? requestAnimationFrame(tick) : 0
    }
    // Plays once when it first scrolls into view; stops drawing while off screen.
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting
      const s = state.current
      if (entry.isIntersecting && !s.started && !reduced) {
        s.started = true
        s.playing = true
      }
      if (entry.isIntersecting && !frame) {
        last = performance.now()
        frame = requestAnimationFrame(tick)
      }
    }, { threshold: 0.35 })
    observer.observe(root.current)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [reduced])

  const s = state.current
  const { step, t, now } = s
  const playAll = () => {
    if (s.playing) s.playing = false
    else {
      if (s.step === 4 && s.t >= 1) { s.step = 0; s.t = 0 }
      s.playing = !reduced
      s.stopAfter = false
      if (reduced) { s.step = Math.min(4, s.step + 1); s.t = 1 }
    }
    s.started = true
    render()
  }
  const goTo = (index) => {
    Object.assign(s, { step: index, t: reduced || index === 0 ? 1 : 0, playing: !reduced && index > 0, stopAfter: true, started: true })
    render()
  }
  const restart = () => {
    Object.assign(s, { step: 0, t: 0, playing: !reduced, stopAfter: false, started: true })
    render()
  }

  const config = STEPS[step]
  const sinceHit = config.hit ? clamp((t - config.hit) / 0.6) : 0
  const hitting = config.hit && t >= config.hit
  const shake = config.big && hitting && sinceHit < 0.25 ? (1 - sinceHit / 0.25) * 4 : 0
  const jitter = (i) => reduced ? [0, 0] : [Math.sin(now / 90 + i * 1.7) * 1.3, Math.cos(now / 110 + i * 2.3) * 1.3]
  const positions = Object.fromEntries(IDS.map((id, i) => {
    const [x, y] = position(id, step, t)
    const [jx, jy] = jitter(i)
    return [id, [x + jx, y + jy]]
  }))
  const center = (ids) => {
    const sum = ids.reduce((acc, id) => [acc[0] + positions[id][0], acc[1] + positions[id][1]], [0, 0])
    return [sum[0] / ids.length, sum[1] / ids.length]
  }
  const summary = step === 4 ? easeOut(clamp(t / 0.5)) : 0
  const caption = CAPTIONS[step]

  return (
    <figure ref={root} className="motion-figure" data-no-swipe aria-label="수소 핵융합 반응이 일어나는 과정 애니메이션">
      <svg viewBox="0 0 660 400" role="img" aria-label={`수소 핵융합 반응 ${STEP_NAMES[step]} 단계`}>
        <defs>
          <radialGradient id="fm-bg" cx="0" cy="0.5" r="0.9">
            <stop offset="0" stopColor="#ffe3b8" />
            <stop offset="0.45" stopColor="#fff6ea" />
            <stop offset="1" stopColor="#fffdf9" />
          </radialGradient>
          <radialGradient id="fm-proton" cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#ff8a73" />
            <stop offset="0.5" stopColor="#d9302a" />
            <stop offset="1" stopColor="#8e1612" />
          </radialGradient>
          <radialGradient id="fm-neutron" cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.55" stopColor="#c6cdd3" />
            <stop offset="1" stopColor="#87939b" />
          </radialGradient>
          <radialGradient id="fm-burst">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.4" stopColor="#fff6a8" />
            <stop offset="1" stopColor="#ffc93a" />
          </radialGradient>
          <marker id="fm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill="#3b3330" />
          </marker>
        </defs>
        <rect x="1" y="1" width="658" height="398" rx="18" fill="url(#fm-bg)" stroke="#e7d7c6" strokeWidth="2" />
        <g transform={shake ? `translate(${Math.sin(now / 16) * shake} ${Math.cos(now / 13) * shake})` : undefined}>
          {(step === 0 || (step === 1 && t < STEPS[1].hit)) && (
            <g opacity={step === 0 ? 1 : 1 - clamp(t / STEPS[1].hit)}>
              <rect x="30" y="22" width="64" height="356" rx="16" fill="#fbd9bd" />
              <text x="62" y="16" textAnchor="middle" className="fm-label">수소 원자핵</text>
            </g>
          )}
          {/* collision paths, drawn as each pair moves */}
          {TRACKS.map((tracks, index) => (index > 0 && (index < step || (index === step && t > 0))) && tracks.map(([from, to], k) => {
            const target = index === 3 && k > 1 ? to : shorten(from, to, 30)
            const reach = index < step ? 1 : index === 3 && k > 1 ? clamp((t - STEPS[3].hit) / 0.5) : clamp(t / STEPS[index].hit)
            if (!reach) return null
            const end = mix(from, target, index === 3 && k > 1 ? easeOut(reach) : easeIn(reach))
            return (
              <line
                key={`${index}-${k}`} x1={from[0]} y1={from[1]} x2={end[0]} y2={end[1]}
                stroke="#3b3330" strokeWidth="2.2" strokeOpacity={step === 4 ? 0.25 : index < step ? 0.45 : 0.85}
                markerEnd={reach >= 1 && step < 4 ? 'url(#fm-arrow)' : undefined}
              />
            )
          }))}
          {/* the star behind each new nucleus, as in the textbook figure */}
          {GROUPS.map((groups, index) => groups.map((group, k) => {
            const amount = shown(index, step, t)
            if (!amount || group.ids.length < 2) return null
            const size = group.ids.length > 3 ? 54 : 44
            return <polygon key={`s${index}-${k}`} points={star(center(group.ids), size, size * 0.72, 16, now / 2400)} fill="url(#fm-burst)" opacity={amount * 0.9} />
          }))}
          {STEPS.map((item, index) => item.waves && index <= step && item.waves.map(([origin, angle], k) => {
            if (index === step && t < item.hit) return null
            const progress = index < step ? 1 : clamp((t - item.hit) / 0.45)
            return <Wave key={`${index}-${k}`} origin={origin} angle={angle} progress={progress} faded={index < step} />
          }))}
          {hitting && config.bursts.map((point, k) => <Burst key={k} at={point} progress={sinceHit} big={config.big} />)}
          {IDS.map((id) => {
            const [x, y] = positions[id]
            const n = neutron(id, step, t)
            return (
              <g key={id}>
                <circle cx={x} cy={y} r={R} fill="url(#fm-proton)" stroke="#6b0f0c" strokeWidth="1.5" opacity={1 - n} />
                {n > 0 && <circle cx={x} cy={y} r={R} fill="url(#fm-neutron)" stroke="#5c676e" strokeWidth="1.5" opacity={n} />}
              </g>
            )
          })}
          {GROUPS.map((groups, index) => groups.map((group, k) => {
            const amount = shown(index, step, t)
            if (!amount) return null
            const [x, y] = center(group.ids)
            const reach = group.ids.length > 3 ? 58 : 48
            const [lx, ly, anchor] = group.right ? [x + 28, y + 6, 'start'] : [x, group.below ? y + reach + 10 : y - reach + 4, 'middle']
            return <text key={`l${index}-${k}`} x={lx} y={ly} textAnchor={anchor} className="fm-tag" opacity={amount}>{group.label}</text>
          }))}
        </g>
        <g transform="translate(470 368)" className="fm-legend">
          <rect width="176" height="24" rx="12" fill="#ffffff" stroke="#e7d7c6" />
          <circle cx="16" cy="12" r="6.5" fill="url(#fm-proton)" stroke="#6b0f0c" />
          <text x="26" y="16.5">양성자</text>
          <circle cx="76" cy="12" r="6.5" fill="url(#fm-neutron)" stroke="#5c676e" />
          <text x="86" y="16.5">중성자</text>
          <path d="M132 12 l3 -4 l3 8 l3 -8 l3 8 l3 -4" fill="none" stroke="#e8501f" strokeWidth="2" />
          <text x="152" y="16.5">E</text>
        </g>
        {summary > 0 && (
          <g opacity={summary} className="fm-summary">
            <rect x="16" y="262" width="330" height="122" rx="14" fill="#ffffff" stroke="#e7d7c6" strokeWidth="1.5" />
            <text x="32" y="292" className="fm-strong">질량 비교</text>
            <text x="32" y="322">반응 전 ¹H×4</text>
            <rect x="130" y="309" width={190 * summary} height="18" rx="5" fill="#d9302a" />
            <text x="32" y="352">반응 후 ⁴He</text>
            <rect x="130" y="339" width={172 * summary} height="18" rx="5" fill="#9aa5ad" />
            <rect x="302" y="339" width={18 * summary} height="18" rx="4" fill="#ffc93a" stroke="#e8501f" strokeDasharray="3 2" />
            <text x="311" y="375" textAnchor="middle" className="fm-mark">Δm</text>
            <text x="130" y="375" className="fm-mark">줄어든 질량 → E = Δmc²</text>
          </g>
        )}
      </svg>
      <figcaption>
        <div className="fm-caption" aria-live="polite">
          <strong><MathText text={caption.head} /></strong>
          <span><MathText text={caption.text} /></span>
        </div>
        <div className="fm-controls">
          <button type="button" className="fm-play" onClick={playAll} aria-label={s.playing ? '일시정지' : '재생'}>
            {s.playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <div className="fm-steps" role="group" aria-label="단계">
            {STEP_NAMES.map((name, index) => (
              <button type="button" key={name} aria-pressed={step === index} onClick={() => goTo(index)}>{name}</button>
            ))}
          </div>
          <button type="button" className="fm-play" onClick={restart} aria-label="처음부터">
            <RotateCcw size={16} />
          </button>
        </div>
      </figcaption>
    </figure>
  )
}
