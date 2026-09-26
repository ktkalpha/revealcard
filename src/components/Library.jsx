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
  Trash2,
  X,
} from 'lucide-react'
import { Button } from './ui/button'
import { masksIn, plainText } from '../lib/masks'

export default function Library({
  decks,
  deck,
  ratings,
  onDeck,
  onStudy,
  onAdd,
  onBulk,
  onEdit,
  onDelete,
  onCreateDeck,
  onRenameDeck,
  onDeleteDeck,
  onExport,
  onImport,
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
  return (
    <main id="main" className="library-page">
      <div className="section-heading">
        <div>
          <p className="overline">YOUR COLLECTION</p>
          <h1>내 카드</h1>
          <p className="muted">기억할 내용을 모으고, 필요한 만큼 반복하세요.</p>
        </div>
        <div className="library-actions">
          <Button variant="outline" onClick={onImport}>
            <FileUp size={17} /> 불러오기
          </Button>
          <Button variant="outline" onClick={onAdd}>
            <Plus size={17} /> 한 장 만들기
          </Button>
          <Button onClick={onBulk} disabled={deck.cards.length >= 1000}>
            <Plus size={17} /> 여러 장 만들기
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
            >
              <Plus size={17} />
            </Button>
          </div>
          <div className="desktop-decks">
            {decks.map((d) => (
              <button
                key={d.id}
                className={`deck-item ${d.id === deck.id ? 'selected' : ''}`}
                aria-pressed={d.id === deck.id}
                onClick={() => {
                  onDeck(d.id)
                  setSearch('')
                  setFilter('all')
                }}
              >
                <BookOpen size={17} />
                <span>{d.name}</span>
                <small>{d.cards.length}</small>
              </button>
            ))}
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
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.cards.length}장
                </option>
              ))}
            </select>
            <ChevronDown size={15} />
          </div>
          <p className="storage-note">
            이 브라우저에 자동 저장돼요.
            <br />
            파일로 내보내면 다른 기기에서도 학습할 수 있어요.
          </p>
        </aside>
        <section className="collection-panel">
          <div className="collection-heading">
            <div>
              <h2>
                {deck.name}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="카드 셋 이름 변경"
                  onClick={onRenameDeck}
                >
                  <Pencil size={14} />
                </Button>
              </h2>
              <p>
                {deck.cards.length}장 <span>·</span> 기억한 카드 {known}장
              </p>
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
              onClick={onExport}
              disabled={!deck.cards.length}
            >
              <Download size={15} />
              <span>내보내기</span>
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
                    : '아직 카드가 없어요'}
              </h3>
              <p>
                {search
                  ? '다른 단어나 짧은 검색어로 찾아보세요.'
                  : filter === 'again'
                    ? '학습 중 다시 보고 싶은 카드를 표시하세요.'
                    : '직접 만들거나 카드 셋 파일을 불러오세요.'}
              </p>
              {search ? (
                <Button variant="outline" onClick={() => setSearch('')}>
                  검색 지우기
                </Button>
              ) : (
                filter === 'all' && (
                  <Button onClick={onBulk}>
                    <Plus size={16} /> 카드 여러 장 만들기
                  </Button>
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
                        {plainText(card.body).replace(/\n/g, ' ')}
                      </span>
                      <span className="card-meta">
                        빈칸 {masksIn(card.body).length}개
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
                  <div className="card-row-actions">
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
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className="collection-bottom">
            <span>카드 셋을 파일로 공유해 함께 학습하세요.</span>
            <Button
              variant="ghost"
              size="sm"
              className="danger-text"
              onClick={onDeleteDeck}
            >
              <Trash2 size={14} /> 카드 셋 삭제
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}
