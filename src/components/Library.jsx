import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckSquare,
  FolderInput,
  Download,
  FileUp,
  GripVertical,
  History,
  HardDriveDownload,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  LockKeyhole,
  Globe2,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from './ui/button'
import { masksIn, plainText } from '../lib/masks'
import { classificationData } from '../lib/classification'
import { mapQuizPlaces } from '../lib/mapquiz'
import { occlusionMasks } from '../lib/occlusion'
import { markdownExcerpt } from '../lib/markdown'

export default function Library({
  decks,
  deck,
  user,
  ratings,
  onHome,
  onStudy,
  onAdd,
  onEdit,
  onDelete,
  onRenameDeck,
  onDeleteDeck,
  onVisibility,
  onHistory,
  onExport,
  onImport,
  offline,
  offlineSaved,
  onOfflineSave,
  onOfflineRemove,
  onMove,
  onTransfer,
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const filtered = deck.cards.filter(
    (c) =>
      (filter !== 'again' || ratings[c.id] === 'again') &&
      `${c.title} ${plainText(c.body)}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  )
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [targetId, setTargetId] = useState('')
  const [transferring, setTransferring] = useState(false)
  const targets = decks.filter((item) => item.canEdit && item.id !== deck.id)
  const canTransfer = !!onTransfer && deck.canEdit && !offline && targets.length > 0
  useEffect(() => {
    setSelecting(false)
    setSelected(new Set())
    setTargetId('')
  }, [deck.id])
  // Drop selections for cards that disappeared after a refresh.
  const selectedIds = deck.cards.filter((card) => selected.has(card.id)).map((card) => card.id)
  const allFilteredSelected = filtered.length > 0 && filtered.every((card) => selected.has(card.id))
  const toggleSelected = (id) => setSelected((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const endSelecting = () => {
    setSelecting(false)
    setSelected(new Set())
  }
  const transfer = async () => {
    if (!selectedIds.length || !targets.some((item) => item.id === targetId)) return
    setTransferring(true)
    const moved = await onTransfer(selectedIds, targetId)
    setTransferring(false)
    if (moved) endSelecting()
  }
  const canReorder = deck.canEdit && !offline && !selecting && filter === 'all' && !search.trim()
  const list = useRef(null)
  const [drag, setDrag] = useState(null)
  const startDrag = (e, card, index) => {
    if (e.button > 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ id: card.id, from: index, over: index })
  }
  const moveDrag = (e) => {
    if (!drag) return
    const rows = [...list.current.children]
    let over = rows.findIndex((row) => {
      const box = row.getBoundingClientRect()
      return e.clientY < box.top + box.height / 2
    })
    if (over < 0) over = rows.length - 1
    // 내려놓는 위치는 "이동 후 최종 인덱스"이므로, 아래로 끌 때는 한 칸 보정한다.
    if (over > drag.from) over -= 1
    if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 16)
    else if (e.clientY < 60) window.scrollBy(0, -16)
    if (over !== drag.over) setDrag({ ...drag, over })
  }
  const endDrag = (e) => {
    if (!drag) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    const { from, over } = drag
    setDrag(null)
    if (over !== from) onMove(deck.cards.find((c) => c.id === drag.id), over)
  }
  const cancelDrag = () => setDrag(null)
  const known = deck.cards.filter((c) => ratings[c.id] === 'known').length
  const again = deck.cards.filter((c) => ratings[c.id] === 'again').length
  return (
    <main id="main" className="library-page">
      <div className="library-layout">
        <section className="collection-panel">
          <header className="manage-head">
            <Button variant="ghost" size="icon" className="study-back" aria-label="홈으로" title="홈으로" onClick={onHome}>
              <ArrowLeft size={19} />
            </Button>
            <div className="manage-title">
              <h1>
                {deck.name}
                {deck.canEdit && (
                  <Button variant="ghost" size="icon" aria-label="카드 셋 이름 변경" title="이름 변경" onClick={onRenameDeck}>
                    <Pencil size={14} />
                  </Button>
                )}
              </h1>
              <p>
                {deck.visibility === 'public' ? <Globe2 size={13} /> : <LockKeyhole size={13} />}
                {deck.adminView ? `${deck.ownerName}의 비공개 셋 · 읽기 전용` : deck.visibility === 'public' ? '공개' : '비공개'}
                <span>·</span> {deck.cards.length}장 <span>·</span> 기억 {known}장
                {deck.ownerName && !deck.adminView && <><span>·</span> {deck.ownerName}</>}
              </p>
            </div>
            <div className="manage-actions">
              <Button onClick={() => onStudy()} disabled={!deck.cards.length}>
                <Play size={16} /> 학습하기
              </Button>
              {deck.canEdit && !offline && (
                <Button variant="outline" onClick={onAdd} disabled={deck.cards.length >= 1000}>
                  <Plus size={16} /> 카드 추가
                </Button>
              )}
            </div>
          </header>
          <div className="manage-tools" role="toolbar" aria-label="카드 셋 도구">
            {deck.canManage && (
              <div className="segmented" role="group" aria-label="공개 설정">
                <button aria-pressed={deck.visibility === 'private'} disabled={offline} onClick={() => deck.visibility !== 'private' && onVisibility('private')}>
                  <LockKeyhole size={14} /> 비공개
                </button>
                <button aria-pressed={deck.visibility === 'public'} disabled={offline} onClick={() => deck.visibility !== 'public' && onVisibility('public')}>
                  <Globe2 size={14} /> 공개
                </button>
              </div>
            )}
            {deck.canEdit && (
              <Button variant="outline" size="sm" onClick={onImport} disabled={offline}>
                <FileUp size={15} /> 파일 불러오기
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onExport} disabled={!deck.cards.length}>
              <Download size={15} /> 파일 다운로드
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onOfflineSave}
              disabled={offline || !deck.cards.length}
              title={offlineSaved ? '기기에 저장한 카드 셋을 최신 내용으로 바꿔요' : '인터넷 없이도 학습할 수 있게 이 기기에 저장해요'}
            >
              {offlineSaved ? <RotateCcw size={15} /> : <HardDriveDownload size={15} />}
              {offlineSaved ? '오프라인 저장본 업데이트' : '오프라인 저장'}
            </Button>
            {offlineSaved && (
              <Button variant="ghost" size="sm" onClick={onOfflineRemove} title="기기에 저장한 카드 셋 삭제">
                <Trash2 size={15} /> 저장본 삭제
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onHistory} disabled={offline || !deck.id}>
              <History size={15} /> 버전 기록 {deck.historyCount || 1}
            </Button>
            {canTransfer && deck.cards.length > 0 && (
              <Button variant={selecting ? 'default' : 'outline'} size="sm" aria-pressed={selecting} onClick={() => (selecting ? endSelecting() : setSelecting(true))}>
                <CheckSquare size={15} /> {selecting ? '옮기기 끝내기' : '여러 장 옮기기'}
              </Button>
            )}
          </div>
          {deck.visibility === 'public' && deck.canEdit && (
            <p className="manage-note"><Globe2 size={13} /> 공개 셋은 누구나 볼 수 있어요. 바뀐 내용은 모두 버전 기록에 남아요.</p>
          )}
          {deck.adminView && <p className="manage-note">관리자 읽기 전용 화면이에요. 열람 기록이 활동 로그에 남아요.</p>}
          <div className="collection-tools">
            <div className="search-input">
              <Search size={17} />
              <input
                aria-label="카드 검색"
                placeholder="제목이나 내용으로 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  aria-label="검색어 지우기"
                  onClick={() => setSearch('')}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>
          <div className="collection-filters">
            <div className="filter-tabs">
              <button
                aria-pressed={filter === 'all'}
                onClick={() => setFilter('all')}
              >
                전체 <span>{deck.cards.length}</span>
              </button>
              <button
                aria-pressed={filter === 'again'}
                onClick={() => setFilter('again')}
              >
                다시 볼 카드 <span>{again}</span>
              </button>
            </div>
            <span className="collection-count">{filtered.length}장</span>
          </div>
          {selecting && (
            <div className="selection-bar" role="region" aria-label="선택한 카드 옮기기">
              <label className="selection-all">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  disabled={!filtered.length}
                  onChange={() => setSelected((prev) => {
                    const next = new Set(prev)
                    filtered.forEach((card) => allFilteredSelected ? next.delete(card.id) : next.add(card.id))
                    return next
                  })}
                />
                {search.trim() || filter !== 'all' ? '보이는 카드 모두' : '모두 선택'}
              </label>
              <span className="selection-count" aria-live="polite">{selectedIds.length}장 선택</span>
              <select aria-label="옮길 카드 셋" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">옮길 카드 셋 선택</option>
                {targets.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.cards.length}장</option>)}
              </select>
              <Button size="sm" disabled={!selectedIds.length || !targetId || transferring} onClick={transfer}>
                <FolderInput size={15} /> {transferring ? '옮기는 중…' : '옮기기'}
              </Button>
            </div>
          )}
          {!filtered.length ? (
            <div className="empty-state collection-empty">
              <BookOpen size={30} strokeWidth={1.4} />
              <h3>
                {search
                  ? '검색 결과가 없어요'
                  : filter === 'again'
                    ? '다시 볼 카드가 없어요'
                    : decks.length ? '아직 카드가 없어요' : '공개된 카드 셋이 없어요'}
              </h3>
              <p>
                {search
                  ? '다른 단어나 짧은 검색어로 찾아보세요.'
                  : filter === 'again'
                    ? '학습 중 다시 보고 싶은 카드를 표시하세요.'
                    : user ? '카드를 만들거나 카드 셋 파일을 불러오세요.' : '로그인하면 나만의 카드 셋을 만들 수 있어요.'}
              </p>
              {search ? (
                <Button variant="outline" onClick={() => setSearch('')}>
                  검색 지우기
                </Button>
              ) : (
                filter === 'all' && (
                  !offline && (deck.canEdit || !decks.length) && (
                    <Button onClick={onAdd}>
                      <Plus size={16} /> {deck.canEdit ? '첫 카드 만들기' : '로그인'}
                    </Button>
                  )
                )
              )}
            </div>
          ) : (
            <ol className="card-list" ref={list}>
              {filtered.map((card, index) => (
                <li
                  key={card.id}
                  className={selecting ? `selectable${selected.has(card.id) ? ' selected' : ''}` : drag ? [
                    drag.id === card.id && 'dragging',
                    drag.over === index && drag.over !== drag.from && (drag.over > drag.from ? 'drop-after' : 'drop-before'),
                  ].filter(Boolean).join(' ') : undefined}
                >
                  <button
                    className="card-row-main"
                    aria-pressed={selecting ? selected.has(card.id) : undefined}
                    onClick={() => selecting ? toggleSelected(card.id) : onStudy(card.id)}
                  >
                    <span className="card-number">
                      {selecting
                        ? <span className={`select-box${selected.has(card.id) ? ' checked' : ''}`} aria-hidden="true">{selected.has(card.id) && <Check size={13} />}</span>
                        : String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="card-row-content">
                      <strong>{card.title}</strong>
                      <span className="card-excerpt">
                        {card.kind === 'occlusion' ? `사진 가리개 ${occlusionMasks(card.body).length}개` : card.kind === 'classification' ? (()=>{try{return `화석 사진 ${classificationData(card.body).items.length}개 · 무작위 시대 분류`}catch{return '사진 분류 게임'}})() : card.kind === 'mapquiz' ? (()=>{try{return mapQuizPlaces(card.body).map(p=>p.name).join(' · ')}catch{return '지도 찾기 게임'}})() : markdownExcerpt(card.body)}
                      </span>
                      <span className="card-meta">
                        {card.kind === 'passage' && <span className="note-kind"><BookOpen size={12}/> 본문 · 하이라이트 {card.highlights?.length || 0}개</span>}
                        {card.kind === 'occlusion' ? <span className="note-kind">사진 가리개 카드</span> : card.kind === 'classification' ? <span className="note-kind">사진 분류 게임</span> : card.kind === 'matching' ? <span className="note-kind">스페셜 매칭 게임</span> : card.kind === 'mapquiz' ? <span className="note-kind">지도 찾기 게임</span> : <>빈칸 {masksIn(card.body).length}개</>}
                        {ratings[card.id] && (
                          <span className={`status-label ${ratings[card.id]}`}>
                            {ratings[card.id] === 'known' ? (
                              <Check size={12} />
                            ) : (
                              <RotateCcw size={12} />
                            )}{' '}
                            {ratings[card.id] === 'known'
                              ? '기억했어요'
                              : '다시 볼게요'}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                  {deck.canEdit && !selecting && <div className="card-row-actions">
                    {canReorder && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="drag-handle"
                        aria-label={`${card.title} 순서 변경 (끌어서 이동, 또는 위·아래 방향키)`}
                        onPointerDown={(e) => startDrag(e, card, index)}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={cancelDrag}
                        onKeyDown={(e) => {
                          const step = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
                          if (!step || index + step < 0 || index + step >= filtered.length) return
                          e.preventDefault()
                          onMove(card, index + step)
                        }}
                      >
                        <GripVertical size={16} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${card.title} 수정`}
                      onClick={() => onEdit(card)}
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${card.title} 삭제`}
                      onClick={() => onDelete(card)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>}
                </li>
              ))}
            </ol>
          )}
          {deck.canManage && (
            <div className="manage-danger">
              <span>카드 셋을 지우면 카드도 모두 사라져요. 지운 직후에는 알림에서 되돌릴 수 있어요.</span>
              <Button variant="ghost" size="sm" className="danger-text" onClick={onDeleteDeck} disabled={offline}>
                <Trash2 size={14} /> 카드 셋 삭제
              </Button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
