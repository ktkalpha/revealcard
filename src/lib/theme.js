import { SchemeTonalSpot, Hct, argbFromHex, hexFromArgb } from '@material/material-color-utilities'

export const THEME_KEY = 'revealcard.theme.v1'
export const DEFAULT_THEME = { background: '#f7f7f3', surface: '#ffffff', text: '#242521', accent: '#242521' }
export const THEME_PRESETS = [
  { name: '기본', colors: DEFAULT_THEME },
  { name: '다크 블루', colors: { background: '#171a20', surface: '#242832', text: '#edf0f5', accent: '#a8c7fa' } },
  { name: '오션', colors: { background: '#edf5fa', surface: '#ffffff', text: '#183348', accent: '#2475a0' } },
  { name: '로즈', colors: { background: '#fbf0f3', surface: '#fffafb', text: '#4a2935', accent: '#a83f68' } },
  { name: '포레스트', colors: { background: '#eef4eb', surface: '#fafcf8', text: '#293d2c', accent: '#477549' } },
]
export const validColor = (color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)
export function loadTheme() {
  try {
    const value = JSON.parse(localStorage.getItem(THEME_KEY))
    if (value && Object.keys(DEFAULT_THEME).every((key) => validColor(value[key])))
      return { ...Object.fromEntries(Object.keys(DEFAULT_THEME).map((key) => [key, value[key]])), ...(validColor(value.seed) ? { seed: value.seed, mode: value.mode === 'dark' ? 'dark' : 'light' } : {}) }
  } catch {}
  return { ...DEFAULT_THEME }
}
export function themeFromSeed(seed, mode = 'light') {
  if (!validColor(seed)) throw new Error('Invalid theme seed')
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(seed)), mode === 'dark', 0)
  return {
    seed, mode,
    background: hexFromArgb(scheme.background),
    surface: hexFromArgb(scheme.surfaceContainerLowest),
    text: hexFromArgb(scheme.onSurface),
    accent: hexFromArgb(scheme.primary),
  }
}
const rgb = (hex) => hex.match(/[0-9a-f]{2}/gi).map((value) => parseInt(value, 16))
const mix = (a, b, amount) => '#' + rgb(a).map((value, i) => Math.round(value * (1 - amount) + rgb(b)[i] * amount).toString(16).padStart(2, '0')).join('')
const luminance = (color) => rgb(color).map((value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0)
export const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)
const tones = [
  ['242521', '242521'],
  ['293020', '293020'],
  ['343c29', '343c29'],
  ['353d28', '353d28'],
  ['35664a', '35664a'],
  ['36826a', '36826a'],
  ['373a31', '373a31'],
  ['386d68', '386d68'],
  ['414a37', '414a37'],
  ['414f31', '414f31'],
  ['415c4a', '415c4a'],
  ['44463e', '44463e'],
  ['445d49', '445d49'],
  ['45663b', '45663b'],
  ['465436', '465436'],
  ['474e3c', '474e3c'],
  ['48715c', '48715c'],
  ['4e6055', '4e6055'],
  ['4f5f49', '4f5f49'],
  ['525e3e', '525e3e'],
  ['545f45', '545f45'],
  ['596348', '596348'],
  ['626459', '626459'],
  ['667256', '667256'],
  ['66744c', '66744c'],
  ['67735b', '67735b'],
  ['68836c', '68836c'],
  ['688371', '688371'],
  ['697657', '697657'],
  ['6c775d', '6c775d'],
  ['6c7d6d', '6c7d6d'],
  ['6f8c67', '6f8c67'],
  ['72776b', '72776b'],
  ['737f62', '737f62'],
  ['74756d', '74756d'],
  ['75786b', '75786b'],
  ['767c6a', '767c6a'],
  ['767d65', '767d65'],
  ['77796e', '77796e'],
  ['777d6a', '777d6a'],
  ['777e69', '777e69'],
  ['778361', '778361'],
  ['78806c', '78806c'],
  ['7a816d', '7a816d'],
  ['7b7e71', '7b7e71'],
  ['7d8073', '7d8073'],
  ['7d8271', '7d8271'],
  ['7d8470', '7d8470'],
  ['818775', '818775'],
  ['818e6d', '818e6d'],
  ['82857a', '82857a'],
  ['828c7a', '828c7a'],
  ['838777', '838777'],
  ['838b76', '838b76'],
  ['848b77', '848b77'],
  ['858c77', '858c77'],
  ['858d76', '858d76'],
  ['879177', '879177'],
  ['888b7d', '888b7d'],
  ['89917f', '89917f'],
  ['8a8d80', '8a8d80'],
  ['8b907e', '8b907e'],
  ['8b907f', '8b907f'],
  ['8b937d', '8b937d'],
  ['8c8f80', '8c8f80'],
  ['8c9684', '8c9684'],
  ['8e9582', '8e9582'],
  ['8e9c7c', '8e9c7c'],
  ['8f9584', '8f9584'],
  ['909188', '909188'],
  ['929e7e', '929e7e'],
  ['929e90', '929e90'],
  ['939f83', '939f83'],
  ['979e89', '979e89'],
  ['9aa08e', '9aa08e'],
  ['9aa68a', '9aa68a'],
  ['9b9d91', '9b9d91'],
  ['9ba58b', '9ba58b'],
  ['9ca58d', '9ca58d'],
  ['9cae92', '9cae92'],
  ['aab59c', 'aab59c'],
  ['b4cbb0', 'b4cbb0'],
  ['bbc0ae', 'bbc0ae'],
  ['c9cdbf', 'c9cdbf'],
  ['c9cdc5', 'c9cdc5'],
  ['c9d1ba', 'c9d1ba'],
  ['cbd5c7', 'cbd5c7'],
  ['cccfc2', 'cccfc2'],
  ['cfd0c7', 'cfd0c7'],
  ['cfd5c3', 'cfd5c3'],
  ['cfd5c5', 'cfd5c5'],
  ['d2d2cb', 'd2d2cb'],
  ['d3dcd3', 'd3dcd3'],
  ['d5d9ca', 'd5d9ca'],
  ['d9dfd3', 'd9dfd3'],
  ['dce2d0', 'dce2d0'],
  ['dce2d1', 'dce2d1'],
  ['dce3cf', 'dce3cf'],
  ['ddd', 'dddddd'],
  ['dedfd5', 'dedfd5'],
  ['dedfd7', 'dedfd7'],
  ['dfe5d4', 'dfe5d4'],
  ['dfe5dd', 'dfe5dd'],
  ['e0e3d7', 'e0e3d7'],
  ['e0e8dc', 'e0e8dc'],
  ['e1e6d6', 'e1e6d6'],
  ['e1edcd', 'e1edcd'],
  ['e2e4d9', 'e2e4d9'],
  ['e3e5da', 'e3e5da'],
  ['e3e7db', 'e3e7db'],
  ['e4e6dc', 'e4e6dc'],
  ['e4e9df', 'e4e9df'],
  ['e6ebdb', 'e6ebdb'],
  ['e8ecdf', 'e8ecdf'],
  ['e9eee4', 'e9eee4'],
  ['eaece3', 'eaece3'],
  ['eaf0ec', 'eaf0ec'],
  ['eceee5', 'eceee5'],
  ['edf1e4', 'edf1e4'],
  ['edf1e5', 'edf1e5'],
  ['edf2ed', 'edf2ed'],
  ['edf3ec', 'edf3ec'],
  ['eeeee8', 'eeeee8'],
  ['eeefe8', 'eeefe8'],
  ['eef0e7', 'eef0e7'],
  ['eef4ec', 'eef4ec'],
  ['f1f3ea', 'f1f3ea'],
  ['f1f3ef', 'f1f3ef'],
  ['f1f4eb', 'f1f4eb'],
  ['f1f5ef', 'f1f5ef'],
  ['f2f3ed', 'f2f3ed'],
  ['f2f5ed', 'f2f5ed'],
  ['f2f5ef', 'f2f5ef'],
  ['f5f6ef', 'f5f6ef'],
  ['f5f7f2', 'f5f7f2'],
  ['f5f8f0', 'f5f8f0'],
  ['f7f7f3', 'f7f7f3'],
  ['f8ebcf', 'f8ebcf'],
  ['fafbf8', 'fafbf8'],
  ['fbece7', 'fbece7'],
  ['fcfcf9', 'fcfcf9'],
  ['fcfdf9', 'fcfdf9'],
  ['fff', 'ffffff'],
  ['fff4f0', 'fff4f0'],
  ['fffbeb', 'fffbeb']
]
export function applyTheme(theme) {
  const style = document.documentElement.style
  const isDefault = Object.keys(DEFAULT_THEME).every((key) => theme[key].toLowerCase() === DEFAULT_THEME[key])
  for (const [key, source] of tones) {
    if (isDefault) style.removeProperty(`--tone-${key}`)
    else {
      const [r, g, b] = rgb(source)
      const brightness = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255
      const amount = Math.max(0, Math.min(1, (1 - brightness) / 0.86))
      style.setProperty(`--tone-${key}`, mix(theme.surface, theme.text, amount))
    }
  }
  style.setProperty('--page', theme.background)
  style.setProperty('--paper', theme.surface)
  style.setProperty('--ink', theme.text)
  style.setProperty('--accent', theme.accent)
  style.setProperty('--on-accent', contrast(theme.accent, '#ffffff') >= contrast(theme.accent, '#171717') ? '#ffffff' : '#171717')
  for (const [key, amount] of [['muted', 0.65], ['line', 0.18], ['soft', 0.07]]) {
    if (isDefault) style.removeProperty(`--${key}`)
    else style.setProperty(`--${key}`, mix(theme.surface, theme.text, amount))
  }
  style.colorScheme = luminance(theme.background) < 0.2 ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.background)
}
applyTheme(loadTheme())
