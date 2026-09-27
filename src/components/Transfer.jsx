import React, { useState } from 'react'
import { Check, Download, FileJson, Share2 } from 'lucide-react'
import { Button } from './ui/button'
import Modal from './Modal'
import { exportCardSet } from '../cardSet'
import { importCards } from '../lib/storage'

export function ExportDialog({ deck, onClose, onNotice }) {
  const [name, setName] = useState(deck.name)
  const [busy, setBusy] = useState(false)
  const fileName = `${(name.trim() || 'revealcard').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 80)}.revealcard.json`
  const makeFile = () =>
    new File(
      [JSON.stringify(exportCardSet(deck.cards, name.trim()), null, 2) + '\n'],
      fileName,
      { type: 'application/json' },
    )
  const download = () => {
    const url = URL.createObjectURL(makeFile())
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    onNotice('카드 셋 파일을 내보냈어요.')
    onClose()
  }
  const share = async () => {
    setBusy(true)
    try {
      await navigator.share({ files: [makeFile()], title: name.trim() })
      onClose()
    } catch (e) {
      if (e.name !== 'AbortError')
        onNotice('공유할 수 없어요. 파일 저장을 이용해 주세요.')
    } finally {
      setBusy(false)
    }
  }
  const shareAvailable = !!navigator.canShare?.({ files: [makeFile()] })
  return (
    <Modal title="카드 셋 다운로드" onClose={onClose}>
      <p className="modal-description">
        저장한 파일을 보내면 누구나 같은 빈칸과 순서로 학습할 수 있어요.
      </p>
      <label className="form-label" htmlFor="export-name">
        카드 셋 이름
      </label>
      <input
        id="export-name"
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="file-summary">
        <FileJson size={26} strokeWidth={1.4} />
        <div>
          <strong>{fileName}</strong>
          <span>카드 {deck.cards.length}장 · 빈칸과 줄바꿈 포함</span>
        </div>
      </div>
      <p className="field-hint">
        받는 사람은 내 카드 → 불러오기에서 열면 돼요.
        <br />
        개인 학습 기록은 파일에 포함되지 않아요.
      </p>
      <div className="dialog-actions">
        {shareAvailable && (
          <Button
            variant="outline"
            onClick={share}
            disabled={!name.trim() || busy}
          >
            <Share2 size={16} /> 공유
          </Button>
        )}
        <Button onClick={download} disabled={!name.trim() || busy}>
          <Download size={16} /> 파일 저장
        </Button>
      </div>
    </Modal>
  )
}

export function ImportDialog({ data, deck, onClose, onImport }) {
  const [mode, setMode] = useState('new')
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [name, setName] = useState(data.name || '')
  const incoming = data.error
    ? []
    : importCards(
        mode === 'append' ? deck.cards : [],
        data.cards,
        skipDuplicates,
      )
  const skipped = (data.cards?.length || 0) - incoming.length
  const tooMany =
    incoming.length + (mode === 'append' ? deck.cards.length : 0) > 1000
  return (
    <Modal
      title={data.error ? '파일을 확인해 주세요' : '카드 셋 불러오기'}
      onClose={onClose}
    >
      {data.error ? (
        <>
          <p className="field-error" role="alert">
            {data.error}
          </p>
          <p className="modal-description">
            Revealcard에서 내보낸 .revealcard.json 파일을 선택해 주세요.
          </p>
          <div className="dialog-actions">
            <Button onClick={onClose}>확인</Button>
          </div>
        </>
      ) : (
        <>
          <div className="file-summary">
            <FileJson size={28} strokeWidth={1.4} />
            <div>
              <strong>{data.name}</strong>
              <span>카드 {data.cards.length}장</span>
            </div>
          </div>
          <div className="import-preview">
            {data.cards.slice(0, 3).map((card, i) => (
              <p key={i}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                {card.title}
              </p>
            ))}
            {data.cards.length > 3 && <span>외 {data.cards.length - 3}장</span>}
          </div>
          <fieldset className="import-options">
            <legend>어디에 추가할까요?</legend>
            <label>
              <input
                type="radio"
                name="import-mode"
                value="new"
                checked={mode === 'new'}
                onChange={() => setMode('new')}
              />
              새 비공개 카드 셋으로 만들기
            </label>
            <label>
              <input
                type="radio"
                name="import-mode"
                value="append"
                checked={mode === 'append'}
                disabled={!deck.canEdit}
                onChange={() => setMode('append')}
              />
              <span>
                현재 셋에 추가 <small>{deck.name}</small>
              </span>
            </label>
          </fieldset>
          {mode === 'new' && (
            <>
              <label className="form-label" htmlFor="import-name">
                카드 셋 이름
              </label>
              <input
                id="import-name"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
              />
            </>
          )}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
            />
            제목과 내용이 같은 카드는 건너뛰기
          </label>
          <p
            className={tooMany ? 'field-error' : 'field-hint'}
            aria-live="polite"
          >
            {tooMany
              ? '한 카드 셋은 최대 1,000장까지 담을 수 있어요. 새 카드 셋으로 불러와 주세요.'
              : skipped
                ? `중복 ${skipped}장을 제외하고 ${incoming.length}장을 추가해요.`
                : `${incoming.length}장을 추가해요.`}
          </p>
          <div className="dialog-actions">
            <Button variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button
              onClick={() =>
                onImport({ name: name.trim(), cards: incoming, mode })
              }
              disabled={
                !incoming.length || tooMany || (mode === 'new' && !name.trim())
              }
            >
              <Check size={16} /> {incoming.length}장 추가
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
