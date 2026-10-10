import React, { useEffect, useState } from 'react'
import Modal from './Modal'
import { Button } from './ui/button'
import { api } from '../lib/api'

export default function HistoryDialog({ deck, offline, onClose, onRestore }) {
  const [revisions, setRevisions] = useState(null)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let ignore = false
    api(`/api/decks/${deck.id}/history`).then(({ revisions }) => {
      if (!ignore) { setRevisions(revisions); setSelected(revisions.at(-1)) }
    }).catch((error) => { if (!ignore) setError(error.message) })
    return () => { ignore = true }
  }, [deck.id])
  return <Modal title="카드 셋 버전 기록" onClose={onClose}>
    <p className="modal-description">공개 셋은 로그인 없이 편집할 수 있어요. 복원하면 새 버전으로 저장돼요.</p>
    {error && <p role="alert">{error}</p>}
    {!revisions && !error && <p role="status">기록을 불러오는 중…</p>}
    {revisions && <>
      <label className="form-label" htmlFor="history-version">저장된 버전</label>
      <select id="history-version" value={selected?.version ?? ''} onChange={(event) => setSelected(revisions.find((item) => item.version === Number(event.target.value)))}>
        {revisions.map((item, index) => [item, index + 1]).reverse().map(([item, number]) => <option key={item.version} value={item.version}>#{number} · {item.editor} · {new Date(item.timestamp).toLocaleString()} · {item.action}</option>)}
      </select>
      {selected && <div className="history-preview"><h3>{selected.name}</h3><p>{selected.cards.length}장</p>{selected.cards.map((card) => <details key={card.id}><summary>{card.title}</summary><pre>{card.body}</pre></details>)}</div>}
      <div className="dialog-actions"><Button variant="outline" onClick={onClose}>닫기</Button><Button disabled={offline || saving || !selected || selected.version === deck.version} onClick={async () => {
        if (!window.confirm(`#${revisions.indexOf(selected) + 1} 기록의 이름과 카드 내용을 복원할까요? 현재 내용도 기록에 보관돼요.`)) return
        setSaving(true)
        try { await onRestore(selected.version, deck.version) } finally { setSaving(false) }
      }}>이 버전 복원</Button></div>
    </>}
  </Modal>
}
