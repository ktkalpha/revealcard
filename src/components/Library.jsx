import React, { useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Download,
  FileUp,
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
import { markdownExcerpt } from '../lib/markdown'

export default function Library({
  decks,
  deck,
  user,
  ratings,
  onDeck,
  onStudy,
  onAdd,
  onNote,
  onEdit,
  onDelete,
  onCreateDeck,
  onRenameDeck,
  onDeleteDeck,
  onVisibility,
  onMigrate,
  showMigration,
  onExport,
  onImport,
  offline,
  offlineSaved,
  onOfflineSave,
  onOfflineRemove,
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
  const known = deck.cards.filter((c) => ratings[c.id] === 'known').length
  const again = deck.cards.filter((c) => ratings[c.id] === 'again').length
  const publicDecks = decks.filter((item) => item.visibility === 'public')
  const privateDecks = decks.filter((item) => item.visibility === 'private')
  const deckButton = (item) => (
    <button
      key={item.id}
      className={`deck-item ${item.id === deck.id ? 'selected' : ''}`}
      aria-pressed={item.id === deck.id}
      onClick={() => {
        onDeck(item.id)
        setSearch('')
        setFilter('all')
      }}
    >
      {item.visibility === 'public' ? <Globe2 size={17} /> : <LockKeyhole size={17} />}
      <span>{item.name}</span>
      <small>{item.cards.length}</small>
    </button>
  )
  return (
    <main id="main" className="library-page">
      <div className="section-heading">
        <div>
          <p className="overline">YOUR COLLECTION</p>
          <h1>{user ? '내 카드' : '공개 카드'}</h1>
          <p className="muted">
            {user ? `${user.username}의 카드와 서버의 공개 카드 셋` : '서버에 공개된 카드 셋'}
          </p>
        </div>
        <div className="library-actions">
          <Button variant="outline" onClick={onImport} disabled={offline}>
            <FileUp size={17} /> 불러오기
          </Button>
          <Button variant="outline" onClick={onAdd} disabled={offline || (!!user && !deck.canEdit && decks.some((item) => item.canEdit))}>
            <Plus size={17} /> 한 장 만들기
          </Button>
          <Button onClick={onNote} disabled={offline || deck.cards.length >= 1000 || (!!user && !deck.canEdit && decks.some((item) => item.canEdit))}>
            <BookOpen size={17} /> 노트 추가
          </Button>
        </div>
      </div>
      <div className="library-layout">
        <aside className="deck-sidebar">
          <div className="sidebar-title">
            <span>
              카드 셋 <span className="count">{decks.length}</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="새 카드 셋 만들기"
              onClick={onCreateDeck}
              disabled={offline}
            >
              <Plus size={17} />
            </Button>
          </div>
          <div className="desktop-decks">
            {!!publicDecks.length && <p className="deck-group-label">공개 카드 셋</p>}
            {publicDecks.map(deckButton)}
            {!!privateDecks.length && <p className="deck-group-label">내 비공개 카드 셋</p>}
            {privateDecks.map(deckButton)}
          </div>
          <div className="mobile-decks">
            <select
              aria-label="관리할 카드 셋"
              value={deck.id}
              onChange={(e) => {
                onDeck(e.target.value)
                setSearch('')
                setFilter('all')
              }}
            >
              <option value="" disabled hidden>카드 셋 선택</option>
              <optgroup label="공개 카드 셋">
                {publicDecks.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.cards.length}장</option>)}
              </optgroup>
              {user && <optgroup label="내 비공개 카드 셋">
                {privateDecks.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.cards.length}장</option>)}
              </optgroup>}
            </select>
            <ChevronDown size={15} />
          </div>
          <p className="storage-note">
            {offline ? '기기에 저장한 카드 셋을 보고 있어요.' : '카드 셋은 이 서버에 저장돼요.'}
            <br />
            {offline ? '편집은 다시 연결한 뒤 가능해요.' : '기기에 저장한 셋은 오프라인에서도 학습할 수 있어요.'}
          </p>
          {showMigration && (
            <Button className="migration-button" variant="outline" size="sm" onClick={onMigrate}>
              브라우저 카드 가져오기
            </Button>
          )}
        </aside>
        <section className="collection-panel">
          <div className="collection-heading">
            <div>
              <h2>
                {deck.name}
                {deck.canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="카드 셋 이름 변경"
                    onClick={onRenameDeck}
                  >
                    <Pencil size={14} />
                  </Button>
                )}
              </h2>
              <p>
                {deck.cards.length}장 <span>·</span> 기억한 카드 {known}장
                {deck.ownerName && <><span>·</span> {deck.ownerName}</>}
              </p>
              {deck.canEdit && (
                <div className="segmented visibility-control" role="group" aria-label="카드 셋 공개 설정">
                  <button aria-pressed={deck.visibility === 'private'} onClick={() => onVisibility('private')}>
                    <LockKeyhole size={14} /> 비공개
                  </button>
                  <button aria-pressed={deck.visibility === 'public'} onClick={() => onVisibility('public')}>
                    <Globe2 size={14} /> 공개
                  </button>
                </div>
              )}
            </div>
            <Button onClick={() => onStudy()} disabled={!deck.cards.length}>
              <Play size={16} /> 학습하기
            </Button>
          </div>
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
            <Button
              variant="outline"
              size="sm"
              onClick={onOfflineSave}
              disabled={offline || !deck.cards.length}
              title={offlineSaved ? '기기에 저장된 카드 셋 업데이트' : '오프라인 학습용으로 기기에 저장'}
            >
              {offlineSaved ? <RotateCcw size={15} /> : <Download size={15} />}
              <span>{offlineSaved ? '저장본 업데이트' : '오프라인 저장'}</span>
            </Button>
            {offlineSaved && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onOfflineRemove}
                title="기기 저장본 삭제"
                aria-label="기기 저장본 삭제"
              >
                <Trash2 size={15} />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={!deck.cards.length}
            >
              <Download size={15} />
              <span>파일 다운로드</span>
            </Button>
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
            <span>{filtered.length}장</span>
          </div>
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
                    <Button onClick={onNote}>
                      <BookOpen size={16} /> {user ? '노트 추가' : '로그인'}
                    </Button>
                  )
                )
              )}
            </div>
          ) : (
            <ol className="card-list">
              {filtered.map((card, index) => (
                <li key={card.id}>
                  <button
                    className="card-row-main"
                    onClick={() => onStudy(card.id)}
                  >
                    <span className="card-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="card-row-content">
                      <strong>{card.title}</strong>
                      <span className="card-excerpt">
                        {markdownExcerpt(card.body)}
                      </span>
                      <span className="card-meta">
                        {card.kind === 'note' && <span className="note-kind"><BookOpen size={12} /> 노트</span>}
                        {card.kind === 'matching' ? <span className="note-kind">스페셜 매칭 게임</span> : <>빈칸 {masksIn(card.body).length}개</>}
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
                  {deck.canEdit && <div className="card-row-actions">
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
          <div className="collection-bottom">
            <span>
              {!decks.length
                ? user
                  ? '새 카드 셋을 만들거나 공개 셋을 기다려 주세요.'
                  : '공개된 카드 셋을 기다려 주세요.'
                : deck.visibility === 'public'
                  ? '이 서버의 누구나 이 카드 셋을 학습할 수 있어요.'
                  : '비공개 셋은 소유자만 볼 수 있어요.'}
            </span>
            {deck.canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="danger-text"
                onClick={onDeleteDeck}
              >
                <Trash2 size={14} /> 카드 셋 삭제
              </Button>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
