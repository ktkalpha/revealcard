import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BookOpen, Check, FlaskConical, Layers3, LogIn, LogOut, Palette, Plus, RotateCcw, X } from 'lucide-react'
import { Button } from './components/ui/button'
import Study from './components/Study'
import Library from './components/Library'
import Editor from './components/Editor'
import NoteEditor from './components/NoteEditor'
import PassageEditor from './components/PassageEditor'
import PassageCards from './components/PassageCards'
const editorView = kind => kind === 'passage' ? 'passage' : kind === 'note' ? 'note' : 'edit'
import ThemeDialog from './components/ThemeDialog'
import ExperimentsDialog from './components/ExperimentsDialog'
import usePet from './lib/usePet'
import { applyTheme, loadTheme, THEME_KEY } from './lib/theme'
import HistoryDialog from './components/HistoryDialog'
import AuthDialog from './components/AuthDialog'
import Modal from './components/Modal'
import { ExportDialog, ImportDialog } from './components/Transfer'
import { parseCardSet } from './cardSet'
import { api } from './lib/api'
import { emptyProgress, applyProgress } from './lib/progress'
import { offlineDecks, rememberedUser, rememberUser, removeOfflineDeck, saveOfflineDeck } from './lib/offline'
import {
  DRAFT_KEY,
  STORAGE_KEY,
  loadDraft,
  loadLibrary,
  uid,
} from './lib/storage'
import './style.css'
import './redesign.css'
import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const checkUpdate = () => {
      if (navigator.onLine && !registration.installing)
        registration.update().catch(() => {})
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkUpdate()
    })
    window.addEventListener('online', checkUpdate)
    setInterval(checkUpdate, 60 * 60 * 1000)
    checkUpdate()
  },
})

function App() {
  const [theme, setTheme] = useState(loadTheme)
  const [themeStorageError, setThemeStorageError] = useState(false)
  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem(THEME_KEY, JSON.stringify(theme)); setThemeStorageError(false) }
    catch { setThemeStorageError(true) }
  }, [theme])
  const [library, setLibrary] = useState({
    decks: [], selectedDeckId: null, ratings: {}, positions: {}, wrongMasks: {},
  })
  const [user, setUser] = useState(null)
  const companion = usePet(user?.id || null)
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState('study')
  const [draft, setDraft] = useState(null)
  const [draftOwner, setDraftOwner] = useState(null)
  const [autosaved, setAutosaved] = useState(false)
  const [serverError, setServerError] = useState('')
  const [offline, setOffline] = useState(false)
  const [offlineIds, setOfflineIds] = useState([])
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState(null)
  const [sessionVersion, setSessionVersion] = useState(0)
  const [fileBusy, setFileBusy] = useState(false)
  const fileInput = useRef(null)
  const busy = useRef(false)
  const requestVersion = useRef(0)
  const progressUser = useRef(null)
  const progressSync = useRef(Promise.resolve())
  const progressKey = id => `revealcard.progress.v1.${id || 'guest'}`
  const readLocal = key => { try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} } }
  const syncProgress = id => {
    const task = progressSync.current.catch(() => {}).then(async () => {
      if (!id || progressUser.current !== id) return
      const pendingKey = `${progressKey(id)}.pending`
      const operations = readLocal(pendingKey)
      const pending = Array.isArray(operations) ? operations : []
      const migratedKey = `${progressKey(id)}.migrated`
      if (!pending.length && localStorage.getItem(migratedKey)) return
      await api('/api/progress', { method: 'POST', body: {
        operations: pending.slice(0, 1000),
        ...(!localStorage.getItem(migratedKey) ? { legacy: readLocal(progressKey(id)) } : {}),
      } })
      const current = readLocal(pendingKey)
      localStorage.setItem(pendingKey, JSON.stringify(Array.isArray(current) ? current.slice(Math.min(pending.length, 1000)) : []))
      localStorage.setItem(migratedKey, '1')
    })
    progressSync.current = task
    return task
  }
  const recordProgress = operation => {
    ++requestVersion.current
    const id = user?.id
    if (id) {
      const key = `${progressKey(id)}.pending`
      const current = readLocal(key)
      localStorage.setItem(key, JSON.stringify([...(Array.isArray(current) ? current : []), operation]))
      syncProgress(id).catch(() => setServerError('학습 기록은 기기에 보관 중이에요. 연결되면 계정에 저장합니다.'))
    }
    setLibrary(prev => ({ ...prev, ...applyProgress(structuredClone({ ratings: prev.ratings, positions: prev.positions, wrongMasks: prev.wrongMasks }), operation) }))
  }
  const hasLegacy = (() => {
    try {
      return !!(localStorage.getItem(STORAGE_KEY) || localStorage.getItem('revealcard.cards'))
    } catch {
      return false
    }
  })()
  const deck =
    library.decks.find((d) => d.id === library.selectedDeckId) ||
    library.decks[0] ||
    { id: '', name: '카드 셋', cards: [], canEdit: false }
  const notify = (text, undo) => setNotice({ text, undo, id: uid() })

  const refresh = useCallback(async (preferredId) => {
    const version = ++requestVersion.current
    let next
    try {
      next = await api('/api/bootstrap')
      if (version !== requestVersion.current) return
      progressUser.current = next.user?.id || null
      if (next.user) {
        await syncProgress(next.user.id)
        next = await api('/api/bootstrap')
      }
    } catch (error) {
      if (version !== requestVersion.current) return
      const cachedUser = rememberedUser()
      try {
        const cached = await offlineDecks(cachedUser?.id)
        if (version !== requestVersion.current) return
        setUser(cachedUser)
        setOfflineIds(cached.savedIds)
        setLibrary((prev) => ({
          ...prev,
          ...emptyProgress(), ...readLocal(progressKey(cachedUser?.id)),
          decks: cached.decks,
          selectedDeckId: [preferredId, prev.selectedDeckId].find((id) =>
            cached.decks.some((item) => item.id === id),
          ) || cached.decks[0]?.id || null,
        }))
        setServerError(cached.decks.length
          ? '오프라인 모드 · 기기에 저장한 카드 셋으로 학습할 수 있어요.'
          : '서버에 연결할 수 없어요. 온라인일 때 카드 셋을 기기에 저장해 주세요.')
      } catch {
        setServerError('서버와 기기 저장소에 연결할 수 없어요.')
      }
      setOffline(true)
      setLoaded(true)
      throw error
    }
    if (version !== requestVersion.current) return
    rememberUser(next.user)
    try {
      const cached = await offlineDecks(next.user?.id)
      if (version !== requestVersion.current) return
      setOfflineIds(cached.savedIds)
    } catch {
      setOfflineIds([])
    }
    setUser(next.user)
    setLibrary((prev) => ({
      ...prev,
      decks: next.decks,
      ...(next.user ? (() => {
        const progress = next.progress || emptyProgress()
        const pending = readLocal(`${progressKey(next.user.id)}.pending`)
        if (Array.isArray(pending)) pending.forEach(op => applyProgress(progress, op))
        return progress
      })() : { ...emptyProgress(), ...readLocal(progressKey(null)) }),
      selectedDeckId:
        [preferredId, prev.selectedDeckId].find((id) =>
          next.decks.some((item) => item.id === id),
        ) || next.decks[0]?.id || null,
    }))
    setServerError('')
    setOffline(false)
    setLoaded(true)
  }, [])
  useEffect(() => {
    refresh().catch(() => {})
    const timer = setInterval(() => {
      if (!busy.current) refresh().catch(() => {})
    }, 15000)
    const onFocus = () => refresh().catch(() => {})
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])
  useEffect(() => {
    setDraft(loadDraft(localStorage, `${DRAFT_KEY}.${user?.id || 'guest'}`))
    setDraftOwner(user?.id || 'guest')
  }, [user?.id])
  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(
        `revealcard.progress.v1.${user?.id || 'guest'}`,
        JSON.stringify({
          ratings: library.ratings, positions: library.positions,
          wrongMasks: library.wrongMasks,
        }),
      )
    } catch {
      // Card sets remain safely stored on the server.
    }
  }, [library.ratings, library.positions, library.wrongMasks, user?.id, loaded])
  useEffect(() => {
    if (draftOwner !== (user?.id || 'guest')) return
    setAutosaved(false)
    try {
      const key = `${DRAFT_KEY}.${user?.id || 'guest'}`
      if (draft) localStorage.setItem(key, JSON.stringify(draft))
      else localStorage.removeItem(key)
      setAutosaved(!!draft)
    } catch {
      setAutosaved(false)
    }
  }, [draft, draftOwner, user?.id])
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

  const run = async (action, preferredId) => {
    if (busy.current) return null
    busy.current = true
    try {
      const result = await action()
      try {
        await refresh(preferredId || result.id)
      } catch {
        setServerError('저장됐지만 목록을 새로 읽지 못했어요. 다시 연결해 주세요.')
      }
      return result
    } catch (error) {
      notify(error.message)
      return null
    } finally {
      busy.current = false
    }
  }
  const requireOwner = () => {
    if (offline) notify('오프라인에서는 학습만 할 수 있어요. 연결 후 다시 시도해 주세요.')
    else if (!user && !deck.canEdit) setModal({ type: 'auth' })
    else if (!deck.canEdit) {
      if (!library.decks.some((item) => item.canEdit)) setModal({ type: 'create' })
      else notify('내 카드 셋을 선택하거나 새 셋을 만들어 주세요.')
    }
    return !offline && !!deck.canEdit
  }
  const downloadForOffline = async () => {
    try {
      await saveOfflineDeck(deck, user?.id)
      setOfflineIds((ids) => [...new Set([...ids, deck.id])])
      notify('카드 셋을 이 기기에 저장했어요.')
    } catch {
      notify('기기 저장 공간을 확인해 주세요. 카드 셋을 저장하지 못했어요.')
    }
  }
  const removeFromOffline = async () => {
    try {
      await removeOfflineDeck(deck.id)
      setOfflineIds((ids) => ids.filter((id) => id !== deck.id))
      if (offline) {
        const cached = await offlineDecks(user?.id)
        setLibrary((prev) => ({
          ...prev,
          decks: cached.decks,
          selectedDeckId: cached.decks[0]?.id || null,
        }))
        if (!cached.decks.length)
          setServerError('서버에 연결할 수 없어요. 온라인일 때 카드 셋을 기기에 저장해 주세요.')
      }
      notify('기기에 저장한 카드 셋을 삭제했어요.')
    } catch {
      notify('기기 저장 내용을 삭제하지 못했어요.')
    }
  }
  const selectDeck = (id) =>
    setLibrary((prev) => ({ ...prev, selectedDeckId: id }))
  const study = (cardId) => {
    if (cardId) recordProgress({ kind: 'positions', id: deck.id, value: cardId })
    setSessionVersion((v) => v + 1)
    setView('study')
  }
  const position = cardId => {
    if (library.positions[deck.id] !== cardId) recordProgress({ kind: 'positions', id: deck.id, value: cardId })
  }
  const rate = (id, value) => {
    recordProgress({ kind: 'ratings', id, value })
    if (user) companion.react(value)
  }
  const markWrong = (cardId, key, wrong) => recordProgress({ kind: 'wrong', id: cardId, key, value: wrong })
  const openDraft = (card, kind) => {
    if (!requireOwner()) return
    if (!card && deck.cards.length >= 1000) {
      notify(
        '한 카드 셋은 최대 1,000장까지 담을 수 있어요. 새 셋을 만들어 주세요.',
      )
      return
    }
    const next = {
      deckId: deck.id,
      baseVersion: deck.version,
      isNew: !card,
      card: card ? { ...card } : { id: uid(), title: '', body: '', ...(['note','passage'].includes(kind) ? { kind } : {}) },
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
    setView(editorView(card?.kind || kind))
  }
  const openEditor = (card) => openDraft(card, 'card')
  const openNote = () => openDraft(null, 'note')
  const openPassage = () => openDraft(null, 'passage')
  const saveDraft = async () => {
    const target = library.decks.find((d) => d.id === draft.deckId)
    if (!target?.canEdit) {
      notify('이 카드 셋을 수정할 수 없어요.')
      return
    }
    if (
      !target.cards.some((c) => c.id === draft.card.id) &&
      target.cards.length >= 1000
    ) {
      notify('카드 셋이 가득 찼어요. 다른 셋에 저장해 주세요.')
      return
    }
    const saved = { ...draft.card, title: draft.card.title.trim() }
    const existing = target.cards.some((card) => card.id === saved.id)
    const result = await run(
      () => api(
        `/api/decks/${target.id}/cards${existing ? `/${saved.id}` : ''}`,
        { method: existing ? 'PUT' : 'POST', body: existing ? { ...saved, baseVersion: draft.baseVersion } : { cards: [saved], baseVersion: draft.baseVersion } },
      ),
      target.id,
    )
    if (!result) return
    setDraft(null)
    setView('library')
    notify(saved.kind === 'passage' ? '본문을 저장했어요.' : saved.kind === 'note' ? '노트를 저장했어요.' : '카드를 저장했어요.')
  }
  const deleteCard = async (card) => {
    const targetId = deck.id,
      index = deck.cards.findIndex((c) => c.id === card.id)
    if (!await run(() => api(`/api/decks/${targetId}/cards/${card.id}`, { method: 'DELETE', headers: { 'If-Match': String(deck.version) } }), targetId))
      return
    setModal(null)
    notify('카드를 삭제했어요.', async () => {
      await run(
        async () => api(`/api/decks/${targetId}/cards`, {
          method: 'POST', body: { cards: [card], index, baseVersion: (await api('/api/bootstrap')).decks.find((item) => item.id === targetId)?.version },
        }),
        targetId,
      )
      setNotice(null)
    })
  }
  const deleteDeck = async () => {
    const deleted = deck
    if (!await run(() => api(`/api/decks/${deleted.id}`, { method: 'DELETE' })))
      return
    setModal(null)
    notify('카드 셋을 삭제했어요.', async () => {
      await run(() => api('/api/decks', {
        method: 'POST',
        body: {
          name: deleted.name, visibility: deleted.visibility, cards: deleted.cards,
        },
      }))
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
  const importSet = async ({ name, cards, mode }) => {
    const result = await run(() => mode === 'new'
      ? api('/api/decks', { method: 'POST', body: { name, visibility: 'private', cards } })
      : api(`/api/decks/${deck.id}/cards`, { method: 'POST', body: { cards, baseVersion: deck.version } }),
      mode === 'new' ? undefined : deck.id,
    )
    if (!result) return
    setModal(null)
    setView('library')
    notify(`${cards.length}장의 카드를 불러왔어요.`)
  }
  const namedSet = async (name) => {
    const result = await run(() => modal.type === 'rename'
      ? api(`/api/decks/${deck.id}`, { method: 'PATCH', body: { name, baseVersion: deck.version } })
      : api('/api/decks', { method: 'POST', body: { name, visibility: 'private' } }),
      modal.type === 'rename' ? deck.id : undefined,
    )
    if (!result) return
    setModal(null)
    setView('library')
  }
  const setVisibility = async (visibility) => {
    if (visibility === 'public' &&
      !window.confirm('이 카드 셋을 익명 사용자를 포함한 누구나 편집할 수 있도록 공개할까요?'))
      return
    if (await run(() => api(`/api/decks/${deck.id}`, {
      method: 'PATCH', body: { visibility, baseVersion: deck.version },
    }), deck.id))
      notify(visibility === 'public' ? '카드 셋을 공개했어요.' : '카드 셋을 비공개로 바꿨어요.')
  }
  const migrate = async () => {
    const legacy = loadLibrary(localStorage)
    if (legacy.error) {
      notify('기존 브라우저 카드를 읽지 못했어요. 파일로 먼저 보관해 주세요.')
      return
    }
    const result = await run(() => api('/api/migrate', {
      method: 'POST',
      body: {
        decks: legacy.data.decks.map(({ name, cards }) => ({
          name, cards: cards.map(({ id, ...card }) => card),
        })),
      },
    }))
    if (result) {
      setModal(null)
      setView('library')
      notify(`${result.count}개의 카드 셋을 비공개로 가져왔어요.`)
    }
  }
  if (!loaded)
    return <div className="loading-screen" role="status">카드 셋을 불러오는 중…</div>
  return (
    <div className={`app view-${view}`}>
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
            <BookOpen size={16} /> 학습하기
          </button>
          <button
            className={`nav-link ${view === 'library' ? 'active' : ''}`}
            aria-current={view === 'library' ? 'page' : undefined}
            onClick={() => setView('library')}
          >
            <Layers3 size={16} /> 카드 라이브러리
          </button>
          <button className={`nav-link ${modal?.type === 'experiments' ? 'active' : ''}`} onClick={() => setModal({ type: 'experiments' })}>
            <FlaskConical size={16} /> 실험실 <small className="labs-badge">BETA</small>
          </button>
        </nav>
        <div className="workspace-decks">
          <p className="rail-label">카드 셋 <span>{library.decks.length}</span></p>
          <div className="rail-deck-list">
            {library.decks.map((item) => (
              <button key={item.id} className={`rail-deck ${item.id === deck.id ? 'selected' : ''}`}
                aria-pressed={item.id === deck.id} onClick={() => { selectDeck(item.id); setView('study') }}>
                <span className="rail-deck-icon"><BookOpen size={15} /></span>
                <span>{item.name}</span><small>{item.cards.length}</small>
              </button>
            ))}
          </div>
          <button className="rail-create" onClick={() => offline ? notify('다시 연결한 뒤 카드 셋을 만들 수 있어요.') : user ? setModal({ type: 'create' }) : setModal({ type: 'auth' })} disabled={offline}>
            <Plus size={15} /> 새 카드 셋
          </button>
        </div>
        <div className="rail-note"><span>MAKE IT STICK.</span><p>한 장의 작은 반복,<br />오래 남는 나의 지식.</p></div>
        <div className="header-actions">
          <Button className="header-theme" variant="ghost" size="icon" aria-label="사이트 색상 설정" title="사이트 색상 설정" onClick={() => setModal({ type: 'theme' })}><Palette size={18} /></Button>
          <Button
            className="header-add"
            size="sm"
            aria-label="새 카드 만들기"
            onClick={() => openEditor()}
            disabled={offline}
          >
            <Plus size={16} />
            <span>새 카드</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={user ? `${user.username} 로그아웃` : '로그인'}
            onClick={async () => {
              if (offline && user) {
                rememberUser(null)
                setUser(null)
                const cached = await offlineDecks(null).catch(() => ({ decks: [], savedIds: [] }))
                setOfflineIds(cached.savedIds)
                setLibrary((prev) => ({
                  ...prev, ...emptyProgress(), ...readLocal(progressKey(null)), decks: cached.decks, selectedDeckId: cached.decks[0]?.id || null,
                }))
                if (!cached.decks.length)
                  setServerError('서버에 연결할 수 없어요. 온라인일 때 카드 셋을 기기에 저장해 주세요.')
                setDraft(null)
                setView('library')
              } else if (!user) {
                if (offline) notify('로그인하려면 서버에 연결해 주세요.')
                else setModal({ type: 'auth' })
              }
              else if (await run(() => api('/api/logout', { method: 'POST' }))) {
                setView('library')
                setDraft(null)
              }
            }}
          >
            {user ? <LogOut size={16} /> : <LogIn size={16} />}
            <span>{user?.username || '로그인'}</span>
          </Button>
        </div>
      </header>
      {serverError && (
        <div className="storage-alert" role="alert">
          {serverError}
          <Button size="sm" variant="outline" onClick={() => refresh().catch(() => {})}>
            다시 연결
          </Button>
        </div>
      )}
      {draft && view !== 'edit' && view !== 'note' && view !== 'passage' && (
        <div className="draft-banner">
          <span>작성 중인 {draft.card.kind === 'passage' ? '본문' : draft.card.kind === 'note' ? '노트' : '카드'}가 있어요.</span>
          <button
            onClick={() => {
              selectDeck(
                library.decks.some((d) => d.id === draft.deckId)
                  ? draft.deckId
                  : deck.id,
              )
              setView(editorView(draft.card.kind))
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
          wrongMasks={library.wrongMasks}
          onMarkWrong={markWrong}
          position={library.positions[deck.id]}
          onDeck={selectDeck}
          onRate={rate}
          onPosition={position}
          onEdit={deck.canEdit ? openEditor : null}
          onLibrary={() => setView('library')}
          onAdd={() => openEditor()}
          onImport={() => offline ? notify('불러오기는 다시 연결한 뒤 가능해요.') : user ? fileInput.current.click() : setModal({ type: 'auth' })}
          modalOpen={!!modal}
          onHighlight={highlight => setModal({type:'passage-cards',highlight})}
          companion={user ? companion : null}
          onPetSettings={() => setModal({ type: 'experiments' })}
        />
      )}
      {view === 'library' && (
        <Library
          decks={library.decks}
          deck={deck}
          user={user}
          ratings={library.ratings}
          onDeck={selectDeck}
          onStudy={study}
          onAdd={() => openEditor()}
          onNote={openNote}
          onPassage={openPassage}
          onEdit={openEditor}
          onDelete={(card) => setModal({ type: 'delete-card', card })}
          onCreateDeck={() => user ? setModal({ type: 'create' }) : setModal({ type: 'auth' })}
          onRenameDeck={() => deck.canEdit && setModal({ type: 'rename' })}
          onDeleteDeck={() => deck.canManage && setModal({ type: 'delete-deck' })}
          onVisibility={setVisibility}
          onHistory={() => setModal({ type: 'history' })}
          onMigrate={() => setModal({ type: 'migrate' })}
          showMigration={!offline && !!user && !user.migrated && hasLegacy}
          onExport={() => setModal({ type: 'export' })}
          offline={offline}
          offlineSaved={offlineIds.includes(deck.id)}
          onOfflineSave={downloadForOffline}
          onOfflineRemove={removeFromOffline}
          onImport={() => user ? fileInput.current.click() : setModal({ type: 'auth' })}
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
      {view === 'passage' && draft && <PassageEditor key={draft.card.id} draft={draft} deckName={deck.name} onChange={card => setDraft(prev => ({...prev,card}))} onSave={saveDraft} onExit={() => setView('library')} autosaved={autosaved}/>}
      {modal?.type === 'passage-cards' && <PassageCards highlight={modal.highlight} onClose={() => setModal(null)}/>}
      {view === 'note' && draft && (
        <NoteEditor
          key={draft.card.id}
          draft={draft}
          deckName={library.decks.find((d) => d.id === draft.deckId)?.name || deck.name}
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
      {modal?.type === 'experiments' && <ExperimentsDialog user={user} onLogin={() => setModal({type: 'auth'})} ready={companion.ready} pet={companion.pet} onUpdate={companion.update} error={companion.error} job={companion.job} workerOnline={companion.workerOnline} onUpload={companion.upload} onGenerate={companion.generate} onClose={() => setModal(null)} />}
      {modal?.type === 'theme' && <ThemeDialog theme={theme} onChange={setTheme} storageError={themeStorageError} onClose={() => setModal(null)} />}
      {modal?.type === 'history' && <HistoryDialog deck={deck} offline={offline} onClose={() => setModal(null)} onRestore={async (version, baseVersion) => {
        const result = await run(() => api(`/api/decks/${deck.id}/restore`, { method: 'POST', body: { version, baseVersion } }), deck.id)
        if (result) { setModal(null); notify('이전 버전을 복원했어요.') }
      }} />}
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
      {modal?.type === 'auth' && (
        <AuthDialog
          onClose={() => setModal(null)}
          onSuccess={async () => {
            await refresh()
            setModal(null)
            setView('library')
          }}
        />
      )}
      {modal?.type === 'migrate' && (
        <Modal title="브라우저 카드 가져오기" onClose={() => setModal(null)}>
          <p className="modal-description">
            이 브라우저에 저장된 카드 셋을 현재 계정으로 가져옵니다.
            모두 비공개로 시작하며 기존 브라우저 데이터는 지우지 않아요.
          </p>
          <div className="dialog-actions">
            <Button variant="outline" onClick={() => setModal(null)}>취소</Button>
            <Button onClick={migrate}>비공개로 가져오기</Button>
          </div>
        </Modal>
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
        <Modal title={`작성 중인 ${draft.card.kind === 'passage' ? '본문' : draft.card.kind === 'note' ? '노트' : '카드'}가 있어요`} onClose={() => setModal(null)}>
          <p className="modal-description">
            ‘{draft.card.title || '제목 없음'}’을 이어서 작성할 수 있어요.
          </p>
          <div className="dialog-actions">
            <Button
              variant="outline"
              onClick={() => {
                setDraft(modal.next)
                setModal(null)
                setView(editorView(modal.next.card.kind))
              }}
            >
              버리고 새로 작성
            </Button>
            <Button
              onClick={() => {
                setModal(null)
                setView(editorView(draft.card.kind))
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
