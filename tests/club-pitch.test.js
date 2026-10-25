import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// The club page is one static HTML file; its pitch/stretch engine is a pure block between markers.
// club/ is gitignored (members-only), so a fresh clone has no page to test: skip instead of failing.
const html = await readFile(new URL('../club/index.html', import.meta.url), 'utf8').catch(() => null)
const skip = html === null && 'club/index.html is not in this checkout'
const block = html ? html.slice(html.indexOf('/* @engine-start'), html.indexOf('/* @engine-end */')) : ''
if (html) assert.ok(block.length > 500, 'engine block found')
const { detectPitch, noteOfMidi, timeStretch, fxPlan } = html
  ? new Function(`${block}\nreturn { detectPitch, noteOfMidi, timeStretch, fxPlan }`)()
  : {}

const sr = 44100
const tone = (hz, seconds, harmonics = [1]) => {
  const out = new Float32Array(Math.floor(sr * seconds))
  for (let i = 0; i < out.length; i++) out[i] = 0.4 * harmonics.reduce((sum, amp, k) => sum + amp * Math.sin(2 * Math.PI * hz * (k + 1) * i / sr), 0)
  return out
}

test('detects the note of steady tones, including a low bass', { skip }, () => {
  for (const [hz, note] of [[55, 'A1'], [110, 'A2'], [220, 'A3'], [440, 'A4'], [261.63, 'C4']]) {
    const r = detectPitch(tone(hz, 0.5), sr, 0, 0.5)
    assert.ok(r.ok, `${hz} Hz detected`)
    assert.equal(r.note, note)
    assert.ok(Math.abs(r.cents) <= 5, `${hz} Hz within 5 cents, got ${r.cents}`)
  }
  assert.equal(detectPitch(tone(196, 0.5, [1, 0.5, 0.33, 0.25]), sr, 0, 0.5).note, 'G3')
})

test('reports why there is no pitch instead of guessing', { skip }, () => {
  assert.deepEqual(detectPitch(Float32Array.from({ length: sr / 2 }, () => Math.random() * 0.8 - 0.4), sr, 0, 0.5), { ok: false, why: 'noisy' })
  assert.deepEqual(detectPitch(new Float32Array(sr), sr, 0, 1), { ok: false, why: 'quiet' })
  assert.deepEqual(detectPitch(tone(220, 0.5), sr, 0, 0.03), { ok: false, why: 'short' })
})

test('flags a sound whose pitch moves', { skip }, () => {
  const glide = new Float32Array(sr)
  let phase = 0
  for (let i = 0; i < glide.length; i++) { phase += 2 * Math.PI * 220 * Math.pow(2, i / sr) / sr; glide[i] = 0.4 * Math.sin(phase) }
  assert.ok(detectPitch(glide, sr, 0, 1).spread > 60)
})

test('names notes from midi numbers', { skip }, () => {
  assert.deepEqual(noteOfMidi(60), { note: 'C4', cents: 0 })
  assert.deepEqual(noteOfMidi(69.25), { note: 'A4', cents: 25 })
  assert.equal(noteOfMidi(61).note, 'C♯4')
})

test('time stretching changes length but keeps pitch and stays finite', { skip }, () => {
  for (const tempo of [0.5, 0.8, 1.25, 2]) {
    const [y] = timeStretch([tone(220, 1, [1, 0.4, 0.2])], sr, tempo)
    assert.equal(y.length, Math.round(sr / tempo))
    assert.ok(y.every(Number.isFinite))
    const r = detectPitch(y, sr, 0, y.length / sr)
    assert.ok(r.ok && Math.abs(r.hz - 220) < 2, `tempo ${tempo}: ${r.hz} Hz`)
  }
  const stereo = timeStretch([tone(330, 2), tone(330, 2)], sr, 1.5)
  assert.equal(stereo.length, 2)
  assert.equal(stereo[0].length, stereo[1].length)
  assert.ok(timeStretch([tone(220, 0.004)], sr, 2)[0].every(Number.isFinite), 'tiny slices survive')
})

test('pitch and speed are independent: the stretcher only supplies the difference', { skip }, () => {
  assert.deepEqual(fxPlan(0, 1), { P: 1, T: 1 })
  assert.deepEqual(fxPlan(1200, 1), { P: 2, T: 0.5 })   // up an octave, same length -> stretch to half tempo, play twice as fast
  assert.deepEqual(fxPlan(1200, 2), { P: 2, T: 1 })     // an octave up and twice as fast is plain resampling
})
