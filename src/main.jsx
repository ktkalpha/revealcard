import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BookOpen, Check, Layers3, Plus, RotateCcw, X } from 'lucide-react'
import { Button } from './components/ui/button'
import Study from './components/Study'
import Library from './components/Library'
import Editor from './components/Editor'
import Modal from './components/Modal'
import { ExportDialog, ImportDialog } from './components/Transfer'
import { parseCardSet } from './cardSet'
import {
  DRAFT_KEY,
  STORAGE_KEY,
  loadDraft,
  loadLibrary,
  uid,
} from './lib/storage'
import './style.css'

function App() {
  const [initial] = useState(() => loadLibrary(window.localStorage))
  const [library, setLibrary] = useState(initial.data)
  const [view, setView] = useState('study')
  const [draft, setDraft] = useState(() => loadDraft(window.localStorage))
  const [autosaved, setAutosaved] = useState(false)
  const [storageError, setStorageError] = useState(initial.error)
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState(null)
  const [sessionVersion, setSessionVersion] = useState(0)
  const [fileBusy, setFileBusy] = useState(false)
  const fileInput = useRef(null)
  const deck =
    library.decks.find((d) => d.id === library.selectedDeckId) ||
    library.decks[0]
  const notify = (text, undo) => setNotice({ text, undo, id: uid() })

  useEffect(() => {
    if (initial.error) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(library))
      setStorageError('')
    } catch {
      setStorageError(
        '브라우저에 저장할 공간이 부족하거나 저장이 차단됐어요. 현재 카드를 내보내기로 보관해 주세요.',
      )
    }
  }, [library, initial.error])
  useEffect(() => {
    setAutosaved(false)
    try {
      if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      else localStorage.removeItem(DRAFT_KEY)
      setAutosaved(!!draft)
    } catch {
      setAutosaved(false)
    }
  }, [draft])
  useEffect(() => {
    if (!notice || notice.undo) return
    const timeout = setTimeout(() => setNotice(null), 4500)
    return () => clearTimeout(timeout)
  }, [notice])
  useEffect(() => {
    if (!draft || autosaved) return
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [draft, autosaved])

  const updateDeck = (id, fn) =>
    setLibrary((prev) => ({
      ...prev,
      decks: prev.decks.map((d) => (d.id === id ? fn(d) : d)),
    }))
  const selectDeck = (id) =>
    setLibrary((prev) => ({ ...prev, selectedDeckId: id }))
  const study = (cardId) => {
    if (cardId)
      setLibrary((prev) => ({
        ...prev,
        positions: { ...prev.positions, [deck.id]: cardId },
      }))
    setSessionVersion((v) => v + 1)
    setView('study')
  }
  const position = (cardId) =>
    setLibrary((prev) =>
      prev.positions[deck.id] === cardId
        ? prev
        : { ...prev, positions: { ...prev.positions, [deck.id]: cardId } },
    )
  const rate = (id, value) =>
    setLibrary((prev) => ({
      ...prev,
      ratings: { ...prev.ratings, [id]: value },
    }))
  const openEditor = (card) => {
    if (!card && deck.cards.length >= 1000) {
      notify(
        '한 카드 셋은 최대 1,000장까지 담을 수 있어요. 새 셋을 만들어 주세요.',
      )
      return
    }
    const next = {
      deckId: deck.id,
      isNew: !card,
      card: card ? { ...card } : { id: uid(), title: '', body: '' },
    }
    if (
      draft &&
      (draft.card.title.trim() || draft.card.body.trim()) &&
      draft.card.id !== card?.id
    ) {
      setModal({ type: 'draft', next })
      return
    }
    setDraft(draft && card && draft.card.id === card.id ? draft : next)
    setView('edit')
  }
  const saveDraft = () => {
    const target = library.decks.find((d) => d.id === draft.deckId) || deck
    if (
      !target.cards.some((c) => c.id === draft.card.id) &&
      target.cards.length >= 1000
    ) {
      notify('카드 셋이 가득 찼어요. 다른 셋에 저장해 주세요.')
      return
    }
    const saved = { ...draft.card, title: draft.card.title.trim() }
    setLibrary((prev) => ({
      ...prev,
      selectedDeckId: target.id,
      decks: prev.decks.map((d) =>
        d.id === target.id
          ? {
              ...d,
              cards: d.cards.some((c) => c.id === saved.id)
                ? d.cards.map((c) => (c.id === saved.id ? saved : c))
                : [...d.cards, saved],
            }
          : d,
      ),
      positions: { ...prev.positions, [target.id]: saved.id },
      ratings: Object.fromEntries(
        Object.entries(prev.ratings).filter(([id]) => id !== saved.id),
      ),
    }))
    setDraft(null)
    setView('library')
    notify('카드를 저장했어요.')
  }
  const deleteCard = (card) => {
    const targetId = deck.id,
      index = deck.cards.findIndex((c) => c.id === card.id)
    updateDeck(targetId, (d) => ({
      ...d,
      cards: d.cards.filter((c) => c.id !== card.id),
    }))
    setModal(null)
    notify('카드를 삭제했어요.', () => {
      updateDeck(targetId, (d) => {
        if (d.cards.some((c) => c.id === card.id)) return d
        const cards = [...d.cards]
        cards.splice(Math.min(index, cards.length), 0, card)
        return { ...d, cards }
      })
      setNotice(null)
    })
  }
  const deleteDeck = () => {
    const deleted = deck,
      index = library.decks.findIndex((d) => d.id === deck.id)
    const replacement = { id: uid(), name: '나의 암기 카드', cards: [] }
    setLibrary((prev) => {
      const remaining = prev.decks.filter((d) => d.id !== deleted.id)
      return {
        ...prev,
        decks: remaining.length ? remaining : [replacement],
        selectedDeckId: remaining[0]?.id || replacement.id,
      }
    })
    setModal(null)
    notify('카드 셋을 삭제했어요.', () => {
      setLibrary((prev) => {
        const decks = prev.decks.filter(
          (d) =>
            d.id !== replacement.id ||
            d.cards.length ||
            d.name !== replacement.name,
        )
        decks.splice(Math.min(index, decks.length), 0, deleted)
        return { ...prev, decks, selectedDeckId: deleted.id }
      })
      setNotice(null)
    })
  }
  const readFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFileBusy(true)
    try {
      if (file.size > 25 * 1024 * 1024)
        throw new Error('파일 크기는 25MB 이하여야 해요.')
      setModal({ type: 'import', data: parseCardSet(await file.text()) })
    } catch (error) {
      setModal({ type: 'import', data: { error: error.message } })
    } finally {
      setFileBusy(false)
    }
  }
  const importSet = ({ name, cards, mode }) => {
    if (mode === 'new') {
      const id = uid()
      setLibrary((prev) => ({
        ...prev,
        decks: [...prev.decks, { id, name, cards }],
        selectedDeckId: id,
      }))
    } else updateDeck(deck.id, (d) => ({ ...d, cards: [...d.cards, ...cards] }))
    setModal(null)
    setView('library')
    notify(`${cards.length}장의 카드를 불러왔어요.`)
  }
  const namedSet = (name) => {
    if (modal.type === 'rename') updateDeck(deck.id, (d) => ({ ...d, name }))
    else {
      const id = uid()
      setLibrary((prev) => ({
        ...prev,
        decks: [...prev.decks, { id, name, cards: [] }],
        selectedDeckId: id,
      }))
    }
    setModal(null)
    setView('library')
  }
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        본문으로 이동
      </a>
      <header className="topbar">
        <button
          className="brand"
          onClick={() => setView('study')}
          aria-label="Revealcard 학습 홈"
        >
          <span className="brand-mark">
            <Layers3 size={19} strokeWidth={1.8} />
          </span>
          <span>
            revealcard<span className="brand-dot">.</span>
          </span>
        </button>
        <nav aria-label="주 메뉴">
          <button
            className={`nav-link ${view === 'study' ? 'active' : ''}`}
            aria-current={view === 'study' ? 'page' : undefined}
            onClick={() => setView('study')}
          >
            학습하기
          </button>
          <button
            className={`nav-link ${view === 'library' ? 'active' : ''}`}
            aria-current={view === 'library' ? 'page' : undefined}
            onClick={() => setView('library')}
          >
            내 카드
          </button>
        </nav>
        <Button
          className="header-add"
          size="sm"
          aria-label="새 카드 만들기"
          onClick={() => openEditor()}
        >
          <Plus size={16} />
          <span>새 카드</span>
        </Button>
      </header>
      {storageError && (
        <div className="storage-alert" role="alert">
          {storageError}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setModal({ type: 'export' })}
            disabled={!deck.cards.length}
          >
            현재 셋 내보내기
          </Button>
        </div>
      )}
      {draft && view !== 'edit' && (
        <div className="draft-banner">
          <span>작성 중인 카드가 있어요.</span>
          <button
            onClick={() => {
              selectDeck(
                library.decks.some((d) => d.id === draft.deckId)
                  ? draft.deckId
                  : deck.id,
              )
              setView('edit')
            }}
          >
            이어서 작성 <ArrowIcon />
          </button>
          <button
            aria-label="임시 카드 버리기"
            className="draft-close"
            onClick={() => setModal({ type: 'discard-draft' })}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {view === 'study' && (
        <Study
          key={`${deck.id}-${sessionVersion}`}
          deck={deck}
          decks={library.decks}
          ratings={library.ratings}
          position={library.positions[deck.id]}
          onDeck={selectDeck}
          onRate={rate}
          onPosition={position}
          onEdit={openEditor}
          onLibrary={() => setView('library')}
          onAdd={() => openEditor()}
          onImport={() => fileInput.current.click()}
          modalOpen={!!modal}
        />
      )}
      {view === 'library' && (
        <Library
          decks={library.decks}
          deck={deck}
          ratings={library.ratings}
          onDeck={selectDeck}
          onStudy={study}
          onAdd={() => openEditor()}
          onEdit={openEditor}
          onDelete={(card) => setModal({ type: 'delete-card', card })}
          onCreateDeck={() => setModal({ type: 'create' })}
          onRenameDeck={() => setModal({ type: 'rename' })}
          onDeleteDeck={() => setModal({ type: 'delete-deck' })}
          onExport={() => setModal({ type: 'export' })}
          onImport={() => fileInput.current.click()}
        />
      )}
      {view === 'edit' && draft && (
        <Editor
          key={draft.card.id}
          draft={draft}
          deckName={
            library.decks.find((d) => d.id === draft.deckId)?.name || deck.name
          }
          onChange={(card) => setDraft((prev) => ({ ...prev, card }))}
          onSave={saveDraft}
          onExit={() => {
            if (!draft.card.title.trim() && !draft.card.body.trim())
              setDraft(null)
            setView('library')
          }}
          autosaved={autosaved}
        />
      )}
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="카드 셋 파일"
        onChange={readFile}
      />
      {fileBusy && (
        <div className="toast" role="status">
          카드 셋 파일을 확인하고 있어요…
        </div>
      )}
      {modal?.type === 'export' && (
        <ExportDialog
          deck={deck}
          onClose={() => setModal(null)}
          onNotice={notify}
        />
      )}
      {modal?.type === 'import' && (
        <ImportDialog
          data={modal.data}
          deck={deck}
          onClose={() => setModal(null)}
          onImport={importSet}
        />
      )}
      {['create', 'rename'].includes(modal?.type) && (
        <NameDialog
          name={modal.type === 'rename' ? deck.name : ''}
          title={modal.type === 'rename' ? '카드 셋 이름 변경' : '새 카드 셋'}
          onClose={() => setModal(null)}
          onSave={namedSet}
        />
      )}
      {modal?.type === 'delete-card' && (
        <Modal title="이 카드를 삭제할까요?" onClose={() => setModal(null)}>
          <p className="modal-description">{modal.card.title}</p>
          <p className="field-hint">삭제 후 알림에서 되돌릴 수 있어요.</p>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setModal(null)}>
              취소
            </Button>
            <Button onClick={() => deleteCard(modal.card)}>카드 삭제</Button>
          </div>
        </Modal>
      )}
      {modal?.type === 'delete-deck' && (
        <Modal title="카드 셋을 삭제할까요?" onClose={() => setModal(null)}>
          <p className="modal-description">
            ‘{deck.name}’의 카드 {deck.cards.length}장이 함께 삭제돼요.
          </p>
          <p className="field-hint">
            파일로 보관하려면 먼저 내보내기를 해주세요.
          </p>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setModal(null)}>
              취소
            </Button>
            <Button onClick={deleteDeck}>카드 셋 삭제</Button>
          </div>
        </Modal>
      )}
      {modal?.type === 'draft' && (
        <Modal title="작성 중인 카드가 있어요" onClose={() => setModal(null)}>
          <p className="modal-description">
            ‘{draft.card.title || '제목 없는 카드'}’를 이어서 작성할 수 있어요.
          </p>
          <div className="dialog-actions">
            <Button
              variant="outline"
              onClick={() => {
                setDraft(modal.next)
                setModal(null)
                setView('edit')
              }}
            >
              버리고 새로 작성
            </Button>
            <Button
              onClick={() => {
                setModal(null)
                setView('edit')
              }}
            >
              이어서 작성
            </Button>
          </div>
        </Modal>
      )}
      {modal?.type === 'discard-draft' && (
        <Modal title="임시 카드를 버릴까요?" onClose={() => setModal(null)}>
          <p className="modal-description">
            아직 저장하지 않은 작성 내용이 사라져요.
          </p>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setModal(null)}>
              계속 보관
            </Button>
            <Button
              onClick={() => {
                setDraft(null)
                setModal(null)
              }}
            >
              임시 카드 버리기
            </Button>
          </div>
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          <span>{notice.text}</span>
          {notice.undo && (
            <button onClick={notice.undo}>
              <RotateCcw size={14} /> 되돌리기
            </button>
          )}
          <button
            aria-label="알림 닫기"
            className="toast-close"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <footer>
        <span>revealcard.</span>
        <span>가리고, 떠올리고, 기억하기.</span>
      </footer>
    </div>
  )
}
function ArrowIcon() {
  return <span aria-hidden="true">→</span>
}
function NameDialog({ title, name, onClose, onSave }) {
  const [value, setValue] = useState(name)
  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim()) onSave(value.trim())
        }}
      >
        <label className="form-label" htmlFor="deck-name">
          카드 셋 이름
        </label>
        <input
          id="deck-name"
          placeholder="예: 생명과학 · 1단원"
          data-autofocus
          autoFocus
          maxLength={100}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
        <div className="dialog-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={!value.trim()}>
            저장
          </Button>
        </div>
      </form>
    </Modal>
  )
}
createRoot(document.getElementById('root')).render(<App />)
