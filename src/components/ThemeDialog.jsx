import React, { useEffect, useState } from 'react'
import Modal from './Modal'
import { Button } from './ui/button'
import { DEFAULT_THEME, THEME_PRESETS, contrast, validColor, themeFromSeed } from '../lib/theme'

function ColorField({ label, value, onChange }) {
  const [hex, setHex] = useState(value)
  const [error, setError] = useState(false)
  useEffect(() => { setHex(value); setError(false) }, [value])
  return <label className="theme-field">
    <span>{label}</span>
    <div><input type="color" aria-label={`${label} 색상 선택`} value={value} onChange={(event) => { setHex(event.target.value); setError(false); onChange(event.target.value) }} />
      <input type="text" aria-label={`${label} HEX`} value={hex} maxLength={7} spellCheck={false} aria-invalid={error} onChange={(event) => {
        setHex(event.target.value)
        setError(false)
        if (validColor(event.target.value)) onChange(event.target.value)
      }} onBlur={() => {
        if (!validColor(hex)) { setError(true); setHex(value) }
      }} /></div>
    {error && <span role="alert">#123ABC 형식으로 입력해 주세요.</span>}
  </label>
}
export default function ThemeDialog({ theme, onChange, storageError, onClose }) {
  return <Modal title="사이트 색상 설정" onClose={onClose}>
    <p className="modal-description">메인 컬러 하나를 고르면 어울리는 배경·글자·버튼 색상이 자동으로 설정돼요. 이 브라우저에 자동 저장됩니다.</p>
    <ColorField label="메인 컬러" value={theme.seed || theme.accent} onChange={(seed) => onChange(themeFromSeed(seed, theme.mode || 'light'))} />
    <div className="theme-mode" role="group" aria-label="화면 모드">
      {[['light', '라이트'], ['dark', '다크']].map(([mode, label]) => <Button key={mode} variant={theme.mode === mode ? 'default' : 'outline'} size="sm" aria-pressed={(theme.mode || 'light') === mode} onClick={() => onChange(themeFromSeed(theme.seed || theme.accent, mode))}>{label}</Button>)}
    </div>
    <div className="theme-presets" role="group" aria-label="추천 색상">
      {THEME_PRESETS.map(({ name, colors }) => <Button key={name} variant="outline" size="sm" aria-pressed={name === '기본' ? Object.keys(colors).every((key) => theme[key].toLowerCase() === colors[key]) : theme.seed === colors.accent} onClick={() => onChange(name === '기본' ? { ...DEFAULT_THEME } : themeFromSeed(colors.accent, name === '다크 블루' ? 'dark' : (theme.mode || 'light')))}><i aria-hidden="true" style={{ background: colors.accent }} />{name}</Button>)}
    </div>
    <details className="theme-advanced"><summary>개별 색상 직접 조정</summary><div className="theme-fields">{[['background', '페이지 배경'], ['surface', '카드 배경'], ['text', '글자색'], ['accent', '강조색']].map(([key, label]) => <ColorField key={key} label={label} value={theme[key]} onChange={(color) => onChange({ ...theme, [key]: color })} />)}</div></details>
    <div className="theme-preview"><strong>가리고, 떠올리고, 기억하기.</strong><p>카드와 메뉴에도 선택한 색상이 적용돼요.</p><Button>강조색 미리보기</Button></div>
    {(contrast(theme.text, theme.surface) < 4.5 || contrast(theme.text, theme.background) < 4.5) && <p className="theme-note" role="status">배경과 글자색이 비슷해요. 읽기 편하도록 명암 차이를 키워보세요.</p>}
    {storageError && <p className="theme-note" role="alert">색상은 적용됐지만 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.</p>}
    <div className="dialog-actions"><Button variant="outline" onClick={() => onChange({ ...DEFAULT_THEME })}>기본 색상으로 초기화</Button><Button onClick={onClose}>완료</Button></div>
  </Modal>
}
