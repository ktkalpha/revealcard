import React, { useEffect, useReducer, useRef } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'

// 태양 에너지의 전환과 흐름 (그림 Ⅱ-19): energy moves over one illustrated
// landscape (public/motion/solar-scene.webp, 1536×1024). The camera moves to each
// place in turn so the labels stay large on a phone; the moving parts are drawn
// on top of the picture.

const SCENE_IMAGE = '/motion/solar-scene.webp'
const W = 1536, H = 1024, RATIO = H / W
const PATHS = [
  { name: '태양', color: '#e8a33a' },
  { name: '물의 순환', color: '#2f7fd8' },
  { name: '바람', color: '#1f9a73' },
  { name: '태양광 발전', color: '#d9532c' },
  { name: '탄소 순환', color: '#4f8f1c' },
]
// Places in the picture.
const SUN = [765, 120], SEA = [220, 830], CLOUD = [160, 235], RESERVOIR = [275, 560], HYDRO = [422, 640]
const HUBS = [[606, 452, 52], [721, 406, 72], [856, 456, 56]]
const PANEL = '893,606 926,552 1036,551 1033,606'
const WINDOWS = [[952, 645], [1062, 642]]
const TREE = [1235, 500], FRUITS = [[1268, 515], [1192, 545], [1310, 545], [1210, 563], [1272, 567], [1168, 578]]
const COAL = [1320, 872], CHIMNEY = [1428, 462], CAR_BACK = [1282, 690]
// cam: [x, y, width] of the view; tag: [x, y] of the energy label.
const SCENES = [
  { path: 0, title: '태양 에너지', form: '일부 지구 도달', cam: [0, 0, W], tag: [765, 300], text: '태양에서 생성된 에너지는 사방으로 퍼져 나가고, 그중 일부가 지구에 도달해요.' },
  { path: 1, title: '바다 흡수', form: '열에너지', cam: [0, 560, 700], tag: [300, 950], text: '태양 에너지가 열에너지 형태로 바다에 흡수돼요.' },
  { path: 1, title: '증발 → 구름', form: '수증기', cam: [0, 130, 780], tag: [560, 230], text: '데워진 바닷물이 증발하고, 수증기는 구름이 돼요.' },
  { path: 1, title: '비·눈 내림', form: '기상 현상', cam: [0, 140, 700], tag: [530, 240], text: '구름에서 비와 눈이 내려요.' },
  { path: 1, title: '강 상류·댐', form: '위치 에너지', cam: [40, 360, 620], tag: [470, 440], text: '지상에 내린 비와 눈은 위치 에너지 형태로 강의 상류, 댐 등에 저장돼요.' },
  { path: 1, title: '수력 발전', form: '운동 → 전기', cam: [100, 440, 580], tag: [520, 520], text: '물이 흐르며 생긴 운동 에너지는 수력 발전으로 전기 에너지가 돼요.' },
  { path: 1, title: '물이 다시 바다로', form: '순환', cam: [0, 170, 900], tag: [600, 300], text: '물은 다시 바다로 흘러가 처음 단계로 돌아가는 순환 과정을 거쳐요.' },
  { path: 2, title: '대기 흡수', form: '열에너지', cam: [460, 230, 640], tag: [900, 300], text: '태양 에너지가 열에너지 형태로 대기에 흡수돼요.' },
  { path: 2, title: '바람 발생', form: '운동 에너지', cam: [430, 220, 680], tag: [930, 290], text: '데워진 공기가 움직이며 바람이 불어요. 바람은 운동 에너지예요.' },
  { path: 2, title: '대기·해수 이동', form: '운동 에너지', cam: [0, 140, 1100], tag: [560, 290], text: '바람의 운동 에너지는 대기와 바닷물(해수)을 움직여요.' },
  { path: 2, title: '풍력 발전', form: '운동 → 전기', cam: [510, 320, 500], tag: [900, 360], text: '바람의 운동 에너지로 풍력 발전기가 돌아 전기 에너지를 만들어요.' },
  { path: 3, title: '태양 전지', form: '빛에너지', cam: [790, 370, 440], tag: [1100, 440], text: '집 지붕의 태양 전지가 태양의 빛에너지를 받아요.' },
  { path: 3, title: '태양광 발전', form: '빛 → 전기', cam: [790, 370, 440], tag: [1100, 440], text: '태양광 발전으로 빛에너지가 전기 에너지로 전환돼요.' },
  { path: 3, title: '전기 제품', form: '빛·열·운동', cam: [820, 440, 400], tag: [1010, 490], text: '전기 에너지는 전등, 난방기, 선풍기 같은 전기 제품에서 빛·열·운동 에너지로 쓰여요.' },
  { path: 4, title: '광합성', form: '빛 → 화학', cam: [1040, 320, 440], tag: [1150, 360], text: '식물은 광합성으로 대기 중 이산화 탄소를 흡수해 양분을 만들어요. 빛에너지 → 화학 에너지' },
  { path: 4, title: '식물 양분', form: '화학 에너지', cam: [1060, 380, 400], tag: [1150, 420], text: '식물의 양분에 화학 에너지가 저장돼요.' },
  { path: 4, title: '화석 연료', form: '생물 유해 매몰', cam: [960, 560, 576], tag: [1180, 770], text: '생명체의 유해가 오랜 세월 땅에 묻혀 화석 연료가 돼요.' },
  { path: 4, title: '연소(차·공장)', form: '운동·열에너지', cam: [1060, 400, 476], tag: [1200, 440], text: '화석 연료의 화학 에너지는 자동차와 공장에서 연소하여 운동 에너지, 열에너지가 돼요.' },
  { path: 4, title: 'CO₂ 배출', form: '대기 중 탄소', cam: [1040, 230, 496], tag: [1210, 290], text: '탄소는 이산화 탄소로 대기 중에 배출되고, 다시 광합성에 쓰이며 순환해요.' },
  { path: 5, title: '태양 에너지의 흐름', cam: [0, 0, W], text: '지구에 도달한 태양 에너지는 다양한 에너지로 전환되고, 지구시스템의 각 권역을 이동하며 에너지 흐름을 일으켜요.' },
]
const OVERVIEW = SCENES.length - 1
const SCENE_TIME = 3000
const firstOf = (path) => SCENES.findIndex((scene) => scene.path === path)
// Card text re-renders remount this block, so playback lives outside it.
const memory = { current: null }

function useReducedMotion() {
  const query = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')
  return !!query?.matches
}

const cycle = (now, period, offset = 0) => (((now + offset) % period) + period) % period / period

function Bolt({ x, y, size = 2, opacity = 1 }) {
  return <path transform={`translate(${x} ${y}) scale(${size})`} d="M2 -14 L-7 2 L-1 2 L-3 14 L7 -3 L1 -3 Z" fill="#ffd21f" stroke="#a86f00" strokeWidth="1.4" opacity={opacity} />
}

function Co2({ x, y, opacity = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(1.9)`} opacity={opacity}>
      <text x="0" y="-9" textAnchor="middle" fontSize="9" fontWeight="800" fill="#33302c" stroke="#ffffff" strokeWidth="2.5" paintOrder="stroke">CO₂</text>
      <circle cx="-7" cy="0" r="3.6" fill="#e0483c" stroke="#fff" strokeWidth="0.8" />
      <circle cx="0" cy="0" r="4.2" fill="#3c3c3c" stroke="#fff" strokeWidth="0.8" />
      <circle cx="7" cy="0" r="3.6" fill="#e0483c" stroke="#fff" strokeWidth="0.8" />
    </g>
  )
}

// A dashed arrow whose dashes march along it.
function Flow({ d, color, now, width = 6, speed = 18, head }) {
  return (
    <g>
      <path d={d} fill="none" stroke="#ffffff" strokeWidth={width + 5} strokeLinecap="round" opacity="0.7" />
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={`${width * 3} ${width * 2.2}`} strokeDashoffset={-now / speed} />
      {head && <path transform={`translate(${head[0]} ${head[1]}) rotate(${head[2]})`} d="M0 0 L-22 -13 L-22 13 Z" fill={color} stroke="#ffffff" strokeWidth="2" />}
    </g>
  )
}

function Heat({ x, y, now, offset, rise = 80 }) {
  const u = cycle(now, 1800, offset)
  return <path d={`M${x} ${y - u * rise} q 12 -15 0 -30 q -12 -15 0 -30`} stroke="#ff7a2a" strokeWidth="6" fill="none" strokeLinecap="round" opacity={Math.sin(u * Math.PI) * 0.95} />
}

export default function SolarFlow() {
  const reduced = useReducedMotion()
  const state = useRef(null)
  state.current ||= memory.current ||= {
    index: reduced ? OVERVIEW : 0, elapsed: 0, playing: false, single: false, started: false, now: 0, cam: [...SCENES[0].cam],
  }
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
      if (s.playing && s.index < OVERVIEW) {
        s.elapsed += dt
        if (s.elapsed >= SCENE_TIME) {
          const next = s.index + 1
          if (s.single && SCENES[next].path !== SCENES[s.index].path) s.playing = false
          else { s.index = next; s.elapsed = 0 }
          if (s.index === OVERVIEW) s.playing = false
        }
      }
      // The camera glides toward the current scene.
      const target = SCENES[s.index].cam
      const k = reduced ? 1 : 1 - Math.exp(-dt / 450)
      s.cam = s.cam.map((value, i) => value + (target[i] - value) * k)
      render()
      frame = visible.current ? requestAnimationFrame(tick) : 0
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting
      const s = state.current
      if (entry.isIntersecting && !s.started && !reduced) Object.assign(s, { started: true, playing: true })
      if (entry.isIntersecting && !frame) {
        last = performance.now()
        frame = requestAnimationFrame(tick)
      }
    }, { threshold: 0.3 })
    observer.observe(root.current)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [reduced])

  const s = state.current
  const go = (patch) => {
    Object.assign(s, { elapsed: 0, started: true }, patch)
    render()
  }
  const pick = (path) => path === 5
    ? go({ index: OVERVIEW, playing: false })
    : go({ index: firstOf(path), playing: !reduced, single: true })
  const toggle = () => {
    if (s.playing) return go({ playing: false, elapsed: s.elapsed })
    if (reduced) return go({ index: Math.min(OVERVIEW, s.index + 1) })
    go(s.index === OVERVIEW ? { index: 0, playing: true, single: false } : { playing: true, single: false })
  }
  const restart = () => go(reduced ? { index: OVERVIEW } : { index: 0, playing: true, single: false })

  const scene = SCENES[s.index]
  const overview = s.index === OVERVIEW
  const { now } = s
  // A part of the picture moves once its scene is reached (and stays busy for the rest of that path).
  const on = (sceneIndex) => overview || (scene.path === SCENES[sceneIndex].path && s.index >= sceneIndex)
  const here = (sceneIndex) => s.index === sceneIndex
  const [cx, cy, cw] = s.cam
  const color = PATHS[Math.min(scene.path, 4)].color
  const pulse = (period = 400) => 0.7 + Math.sin(now / period) * 0.3

  return (
    <figure ref={root} className="motion-figure solar-scene" data-no-swipe aria-label="태양 에너지의 전환과 흐름 애니메이션">
      <svg viewBox={`${cx.toFixed(1)} ${cy.toFixed(1)} ${cw.toFixed(1)} ${(cw * RATIO).toFixed(1)}`} role="img" aria-label={`${scene.title} 장면`}>
        <defs>
          <radialGradient id="ss-glow">
            <stop offset="0" stopColor="#fff6a8" stopOpacity="0.95" />
            <stop offset="0.6" stopColor="#ffd23a" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ffb21a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ss-heat">
            <stop offset="0" stopColor="#ff8a3d" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
          </radialGradient>
        </defs>
        <image href={SCENE_IMAGE} x="0" y="0" width={W} height={H} preserveAspectRatio="none" />

        {/* sunlight reaching the Earth */}
        {/* sunlight reaching the Earth: all rays at the start and in the overview, one ray where light arrives */}
        {[[SEA[0], SEA[1] - 40, [1]], [720, 380, [7]], [960, 560, [11, 12]], [1235, 430, [14]]].map(([x, y, scenes]) => (
          here(0) || overview || scenes.includes(s.index)
            ? <line key={x} x1={SUN[0]} y1={SUN[1] + 50} x2={x} y2={y} stroke="#ffb21a" strokeWidth="7" strokeDasharray="22 16" strokeDashoffset={-now / 14} strokeLinecap="round" opacity="0.85" />
            : null
        ))}
        {here(0) && <circle cx={SUN[0]} cy={SUN[1]} r={110 + Math.sin(now / 300) * 14} fill="url(#ss-glow)" />}

        {/* 물의 순환 */}
        {on(1) && <ellipse cx={SEA[0]} cy={SEA[1] + 40} rx="260" ry="110" fill="url(#ss-heat)" opacity={pulse(500)} />}
        {on(1) && [90, 200, 310, 420].map((x, i) => <Heat key={x} x={x} y={840 + (i % 2) * 30} now={now} offset={i * 450} />)}
        {on(2) && Array.from({ length: 12 }, (_, i) => {
          const u = cycle(now, 2800, i * 233)
          const x = 60 + (i % 6) * 60 + Math.sin(now / 420 + i) * 10
          return <circle key={i} cx={x} cy={780 - u * 480} r={6 + u * 7} fill="#ffffff" stroke="#9fd0f5" strokeWidth="2" opacity={Math.sin(u * Math.PI) * 0.9} />
        })}
        {on(2) && !on(3) && <ellipse cx={CLOUD[0]} cy={CLOUD[1]} rx="170" ry="70" fill="#ffffff" opacity={0.35 + Math.sin(now / 350) * 0.2} />}
        {on(3) && Array.from({ length: 22 }, (_, i) => {
          const u = cycle(now, 850, i * 97)
          const x = 50 + (i % 11) * 22
          return <line key={i} x1={x} y1={285 + u * 140} x2={x - 7} y2={305 + u * 140} stroke="#2f7fd8" strokeWidth="4.5" strokeLinecap="round" opacity={1 - u * 0.5} />
        })}
        {on(4) && <ellipse cx={RESERVOIR[0]} cy={RESERVOIR[1]} rx="105" ry="26" fill="#ffe36b" opacity={pulse(300) * 0.7} />}
        {on(4) && <Flow d="M170 455 C 210 480, 160 510, 240 545" color="#2f7fd8" now={now} head={[244, 547, 25]} />}
        {on(5) && [215, 245, 275].map((x, i) => {
          const u = cycle(now, 700, i * 230)
          return <line key={x} x1={x} y1={600 + u * 80} x2={x} y2={625 + u * 80} stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity={1 - u} />
        })}
        {on(5) && <Bolt x={HYDRO[0]} y={HYDRO[1] - 70} size={3} opacity={pulse(130) + 0.1} />}
        {on(6) && <Flow d="M260 700 C 250 740, 200 760, 190 800" color="#2f7fd8" now={now} head={[188, 806, 100]} />}
        {on(6) && <Flow d="M70 800 C 10 650, 10 420, 55 300" color="#2f7fd8" now={-now} width={6} head={[57, 292, -80]} />}

        {/* 바람 */}
        {on(7) && [540, 640, 760, 880, 980].map((x, i) => <Heat key={x} x={x} y={560 - (i % 2) * 20} now={now} offset={i * 360} rise={110} />)}
        {on(8) && Array.from({ length: 8 }, (_, i) => {
          const u = cycle(now, 1900, i * 240)
          const y = 330 + (i % 4) * 48
          const x = 380 + u * 700
          return <path key={i} d={`M${x} ${y} q 50 -24 100 0 q 36 18 60 -8`} stroke="#ffffff" strokeWidth="7" fill="none" strokeLinecap="round" opacity={Math.sin(u * Math.PI)} />
        })}
        {on(9) && Array.from({ length: 6 }, (_, i) => {
          const u = cycle(now, 2200, i * 360)
          return <path key={`s${i}`} d={`M${40 + u * 500} ${860 + (i % 3) * 45} q 30 -14 60 0 t 60 0`} stroke="#ffffff" strokeWidth="6" fill="none" strokeLinecap="round" opacity={Math.sin(u * Math.PI) * 0.9} />
        })}
        {on(9) && <Flow d="M120 180 C 260 140, 360 150, 470 190" color="#1f9a73" now={now} head={[474, 192, 20]} />}
        {on(10) && HUBS.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="none" stroke="#1f9a73" strokeWidth="5" strokeDasharray={`${r * 0.9} ${r * 0.5}`} transform={`rotate(${now / 4 + i * 40} ${x} ${y})`} opacity="0.85" />
        ))}
        {on(10) && <Bolt x={780} y={520} size={3} opacity={pulse(120) + 0.1} />}

        {/* 태양광 발전 */}
        {on(11) && <polygon points={PANEL} fill="#ffffff" opacity={0.15 + Math.sin(now / 220) * 0.15} stroke="#ffd21f" strokeWidth="5" />}
        {on(12) && Array.from({ length: 4 }, (_, i) => {
          const u = cycle(now, 1100, i * 275)
          return <circle key={i} cx={1000 - u * 40} cy={600 + u * 45} r="8" fill="#ffd21f" stroke="#a86f00" strokeWidth="2" opacity={Math.sin(u * Math.PI)} />
        })}
        {on(12) && <Bolt x={1060} y={530} size={2.6} opacity={pulse(130) + 0.1} />}
        {on(13) && WINDOWS.map(([x, y]) => <circle key={x} cx={x} cy={y} r={46 + Math.sin(now / 260) * 6} fill="url(#ss-glow)" />)}

        {/* 탄소 순환 */}
        {on(14) && <circle cx={TREE[0]} cy={TREE[1]} r={140 + Math.sin(now / 320) * 10} fill="url(#ss-glow)" opacity="0.65" />}
        {on(14) && !on(18) && Array.from({ length: 4 }, (_, i) => {
          const u = cycle(now, 2600, i * 650)
          return <Co2 key={i} x={1420 - u * 140} y={380 + i * 26 + u * 70} opacity={Math.sin(u * Math.PI)} />
        })}
        {on(15) && FRUITS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={20 + Math.sin(now / 250 + i) * 4} fill="url(#ss-glow)" />)}
        {on(15) && Array.from({ length: 4 }, (_, i) => {
          const u = cycle(now, 1500, i * 375)
          return <circle key={i} cx={1238} cy={590 + u * 100} r="8" fill="#ffd21f" stroke="#a86f00" strokeWidth="2" opacity={Math.sin(u * Math.PI)} />
        })}
        {on(16) && <ellipse cx={COAL[0] + 10} cy={COAL[1]} rx="200" ry="44" fill="#ffb84a" fillOpacity="0.12" stroke="#ffb84a" strokeWidth="7" strokeDasharray="18 10" strokeDashoffset={now / 30} opacity={pulse(320) + 0.1} />}
        {on(16) && Array.from({ length: 6 }, (_, i) => {
          const u = cycle(now, 2400, i * 400)
          return <path key={i} transform={`translate(${1200 + i * 28} ${700 + u * 150}) rotate(${u * 160}) scale(2)`} d="M0 -5 C 5 -2 5 2 0 5 C -5 2 -5 -2 0 -5 Z" fill="#5f8f2a" stroke="#fff" strokeWidth="0.6" opacity={1 - u * 0.8} />
        })}
        {on(16) && !overview && <Flow d="M1240 690 C 1250 760, 1280 800, 1300 835" color="#4f8f1c" now={now} head={[1302, 840, 65]} />}
        {on(17) && Array.from({ length: 3 }, (_, i) => {
          const u = cycle(now, 800, i * 266)
          return <circle key={i} cx={CAR_BACK[0] - u * 70} cy={CAR_BACK[1] - u * 14} r={9 + u * 12} fill="#c4c9ce" opacity={(1 - u) * 0.9} />
        })}
        {on(17) && [0, 1, 2].map((i) => <line key={i} x1={1270 - i * 6} y1={665 + i * 13} x2={1220 - i * 6} y2={665 + i * 13} stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity={0.4 + 0.5 * Math.abs(Math.sin(now / 200 + i))} />)}
        {on(17) && <ellipse cx="1420" cy="620" rx="90" ry="34" fill="#ff8a3d" opacity={pulse(260) * 0.5} />}
        {on(17) && Array.from({ length: 5 }, (_, i) => {
          const u = cycle(now, 2600, i * 520)
          return <circle key={i} cx={CHIMNEY[0] + 10 + u * 30} cy={CHIMNEY[1] - u * 140} r={14 + u * 22} fill="#b5bbc1" opacity={(1 - u) * 0.75} />
        })}
        {on(18) && Array.from({ length: 4 }, (_, i) => {
          const u = cycle(now, 3000, i * 750)
          return <Co2 key={i} x={CHIMNEY[0] - u * 170} y={CHIMNEY[1] - 60 - Math.sin(u * Math.PI) * 60} opacity={Math.sin(u * Math.PI)} />
        })}
        {on(18) && <Flow d="M1420 400 C 1390 320, 1320 320, 1290 400" color="#4f8f1c" now={now} head={[1287, 408, 110]} />}

        {/* the energy at this place */}
        {scene.tag && scene.form && (() => {
          const fontSize = Math.max(18, cw / 21)
          const width = (scene.form.length * 0.95 + 1.6) * fontSize
          const [x, y] = scene.tag
          const pop = Math.min(1, s.elapsed / 300)
          return (
            <g transform={`translate(${x} ${y}) scale(${0.8 + 0.2 * pop})`} opacity={pop}>
              <rect x={-width / 2} y={-fontSize * 1.1} width={width} height={fontSize * 1.75} rx={fontSize * 0.5} fill="#ffffff" stroke={color} strokeWidth={fontSize / 7} />
              <text x="0" y={fontSize * 0.25} textAnchor="middle" fontSize={fontSize} fontWeight="800" fill={color}>{scene.form}</text>
            </g>
          )
        })()}
      </svg>
      <figcaption>
        <div className="fm-caption" aria-live="polite">
          <strong>
            {scene.path > 0 && scene.path < 5 && <span className="ss-path" style={{ color }}>{PATHS[scene.path].name} · </span>}
            {scene.title}
            {scene.form && <em className="sf-form" style={{ background: color }}>{scene.form}</em>}
          </strong>
          <span>{scene.text}</span>
        </div>
        <div className="fm-controls">
          <button type="button" className="fm-play" onClick={toggle} aria-label={s.playing ? '일시정지' : '재생'}>
            {s.playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <div className="fm-steps" role="group" aria-label="장면">
            {[...PATHS.slice(1).map((path, index) => ({ ...path, index: index + 1 })), { name: '전체', color: '#e8a33a', index: 5 }].map((path) => (
              <button type="button" key={path.name} aria-pressed={scene.path === path.index} onClick={() => pick(path.index)} style={{ '--sf': path.color }}>
                {path.name}
              </button>
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
