import React, { useState } from 'react'
import { CircleHelp, FileUp, Folder, FolderPlus, X, Globe2, LockKeyhole, LogIn, Play, Plus, RotateCcw, Settings2, ShieldCheck } from 'lucide-react'
import { Button } from './ui/button'
import Modal from './Modal'
import TagInput from './TagInput'
import { UNTAGGED, folderLabel, folderTree, inFolder } from '../lib/tags'

const cardCount = (deck) => deck.cardCount ?? deck.cards.length

function stats(deck, ratings, positions) {
  const total = cardCount(deck)
  const known = deck.cards.filter((card) => ratings[card.id] === 'known').length
  const again = deck.cards.filter((card) => ratings[card.id] === 'again').length
  const at = deck.cards.findIndex((card) => card.id === positions[deck.id])
  return { total, known, again, percent: total ? Math.round((known / total) * 100) : 0, at: at < 0 ? 0 : at }
}

// The start screen: continue where you left off, or pick a card set.
export default function Home({
  decks, user, ratings, positions, lastDeckId, offline, folders = {}, onFolders,
  onStudy, onManage, onCreateDeck, onImport, onLogin, onHelp, showMigration, onMigrate,
}) {
  const GUIDE_KEY = 'revealcard.guideHidden'
  const [guide, setGuide] = useState(() => { try { return localStorage.getItem(GUIDE_KEY) !== '1' } catch { return true } })
  const hideGuide = () => {
    setGuide(false)
    try { localStorage.setItem(GUIDE_KEY, '1') } catch {}
  }
  // Folders are each person's own way of filing card sets, public ones included.
  const FOLDER_KEY = 'revealcard.homeFolder'
  const [folder, setFolder] = useState(() => { try { return localStorage.getItem(FOLDER_KEY) || '' } catch { return '' } })
  const [filing, setFiling] = useState(null)
  const tagsOf = (deck) => folders[deck.id] || []
  const tree = folderTree(decks.map((deck) => ({ tags: tagsOf(deck) })))
  const unfiled = decks.filter((deck) => !tagsOf(deck).length).length
  const current = folder === UNTAGGED ? (tree.length && unfiled ? folder : '') : tree.some((item) => item.path === folder) ? folder : ''
  const pick = (next) => {
    setFolder(next)
    try { localStorage.setItem(FOLDER_KEY, next) } catch {}
  }
  const shown = decks.filter((deck) => inFolder({ tags: tagsOf(deck) }, current))
  const publicDecks = shown.filter((deck) => deck.visibility === 'public' && !deck.adminView)
  const privateDecks = shown.filter((deck) => deck.visibility !== 'public' && !deck.adminView)
  const admin = shown.filter((deck) => deck.adminView)
  const filingDeck = filing && decks.find((deck) => deck.id === filing)
  const last = decks.find((deck) => deck.id === lastDeckId && cardCount(deck) > 0)
  const recent = last || decks.find((deck) => !deck.adminView && cardCount(deck) > 0)
  const recentStats = recent && stats(recent, ratings, positions)

  const tile = (deck) => {
    const s = stats(deck, ratings, positions)
    const empty = !s.total
    return (
      <li key={deck.id} className="deck-tile">
        <button className="deck-tile-main" onClick={() => (empty ? onManage(deck.id) : onStudy(deck.id))}>
          <span className="deck-tile-top">
            {deck.adminView ? <ShieldCheck size={15} /> : deck.visibility === 'public' ? <Globe2 size={15} /> : <LockKeyhole size={15} />}
            <span>{deck.adminView ? deck.ownerName : deck.visibility !== 'public' ? '비공개' : deck.canManage ? '공개 · 내 셋' : deck.ownerName ? `공개 · ${deck.ownerName}` : '공개'}</span>
            {s.again > 0 && <em>다시 볼 {s.again}</em>}
          </span>
          <strong>{deck.name}</strong>
          <span className="deck-tile-meta">
            {empty ? '카드를 추가해 보세요' : <>{s.total}장 · 기억 {s.percent}%</>}
          </span>
          <span className="meter" aria-hidden="true"><span style={{ width: `${s.percent}%` }} /></span>
          {tagsOf(deck).length > 0 && (
            <span className="deck-tile-folders">
              {tagsOf(deck).map((tag) => <span key={tag} className="tag-chip small"><Folder size={11} /> {folderLabel(tag)}</span>)}
            </span>
          )}
        </button>
        {onFolders && (
          <Button variant="ghost" size="icon" className="deck-tile-folder" aria-label={`${deck.name} 폴더 정리`} title="폴더에 넣기" onClick={() => setFiling(deck.id)}>
            <FolderPlus size={15} />
          </Button>
        )}
        <Button variant="ghost" size="sm" className="deck-tile-manage" aria-label={`${deck.name} 카드 관리`} title="카드 관리" onClick={() => onManage(deck.id)}>
          <Settings2 size={15} /> <span>관리</span>
        </Button>
      </li>
    )
  }

  return (
    <main id="main" className="home-page">
      {recent ? (
        <section className="continue" aria-label="이어서 학습">
          <div className="continue-text">
            <p className="continue-label">{last ? (user ? `${user.username}님, 이어서 해볼까요?` : '이어서 학습') : '이 카드 셋으로 시작해 보세요'}</p>
            <h1>{recent.name}</h1>
            <p className="continue-meta">
              {recentStats.at ? `${recentStats.at + 1}번째 카드부터` : '처음부터'} · {recentStats.total}장 중 {recentStats.known}장 기억
            </p>
            <span className="meter"><span style={{ width: `${recentStats.percent}%` }} /></span>
          </div>
          <div className="continue-actions">
            <Button className="continue-start" onClick={() => onStudy(recent.id)}>
              <Play size={18} /> 학습 시작
            </Button>
            {recentStats.again > 0 && (
              <Button variant="outline" onClick={() => onStudy(recent.id, 'cards')}>
                <RotateCcw size={16} /> 다시 볼 카드 {recentStats.again}장
              </Button>
            )}
          </div>
        </section>
      ) : (
        <section className="continue continue-empty">
          <div className="continue-text">
            <h1>{user ? '첫 카드 셋을 만들어 보세요' : '가리고, 떠올리고, 기억하기'}</h1>
            <p className="continue-meta">
              {user
                ? '외울 내용을 적고 중요한 부분을 가리면 바로 학습할 수 있어요.'
                : '공개 카드 셋은 바로 학습할 수 있어요. 로그인하면 나만의 카드를 만들 수 있어요.'}
            </p>
          </div>
          <div className="continue-actions">
            {user
              ? <Button onClick={onCreateDeck} disabled={offline}><Plus size={17} /> 새 카드 셋</Button>
              : <Button onClick={onLogin} disabled={offline}><LogIn size={17} /> 로그인 · 회원가입</Button>}
          </div>
        </section>
      )}

      {guide && (
        <section className="guide" aria-label="처음 사용법">
          <div className="guide-head">
            <h2>이렇게 사용해요</h2>
            <Button variant="ghost" size="icon" aria-label="사용법 안내 닫기" title="닫기 (위쪽 ‘사용법’에서 다시 볼 수 있어요)" onClick={hideGuide}>
              <X size={16} />
            </Button>
          </div>
          <ol className="guide-steps">
            <li><span>1</span><div><strong>카드 셋 고르기</strong><p>{user ? '새 카드 셋을 만들거나' : '로그인해서 내 셋을 만들거나'} 공개 셋을 골라요.</p></div></li>
            <li><span>2</span><div><strong>쓰고 가리기</strong><p>외울 내용을 적고 중요한 단어를 골라 ‘가리기’를 눌러요.</p></div></li>
            <li><span>3</span><div><strong>떠올리고 확인하기</strong><p>빈칸의 답을 떠올린 뒤 눌러서 확인하고, 기억했는지 표시해요.</p></div></li>
          </ol>
          <Button variant="outline" size="sm" onClick={() => onHelp('start')}>
            <CircleHelp size={15} /> 자세한 사용법
          </Button>
        </section>
      )}

      {user && (
        <div className="home-toolbar">
          <Button variant="ghost" size="sm" onClick={onImport} disabled={offline}><FileUp size={15} /> 파일 불러오기</Button>
          <Button variant="outline" size="sm" onClick={onCreateDeck} disabled={offline}><Plus size={15} /> 새 카드 셋</Button>
        </div>
      )}
      {showMigration && (
        <p className="home-empty">
          이 브라우저에 예전 카드가 있어요. <button className="link-button" onClick={onMigrate}>계정으로 가져오기</button>
        </p>
      )}

      {tree.length > 0 && (
        <nav className="folder-bar home-folders" aria-label="폴더">
          <button aria-pressed={!current} onClick={() => pick('')}>
            <Folder size={14} /> 모든 카드 셋 <span>{decks.length}</span>
          </button>
          {tree.map((item) => (
            <button
              key={item.path}
              aria-pressed={current === item.path}
              title={folderLabel(item.path)}
              onClick={() => pick(current === item.path ? '' : item.path)}
            >
              {item.depth > 0 && <span className="folder-indent" aria-hidden="true">{'›'.repeat(item.depth)}</span>}
              {item.name} <span>{item.count}</span>
            </button>
          ))}
          {unfiled > 0 && (
            <button aria-pressed={current === UNTAGGED} onClick={() => pick(current === UNTAGGED ? '' : UNTAGGED)}>
              폴더 없음 <span>{unfiled}</span>
            </button>
          )}
        </nav>
      )}

      {current && !shown.length && <p className="home-empty">이 폴더에 카드 셋이 없어요.</p>}

      {publicDecks.length > 0 && (
        <section className="home-section">
          <div className="home-section-head"><h2><Globe2 size={17} /> 공개 카드 셋 <span>{publicDecks.length}</span></h2></div>
          <ul className="deck-grid">{publicDecks.map(tile)}</ul>
        </section>
      )}

      {user && (!current || privateDecks.length > 0) && (
        <section className="home-section">
          <div className="home-section-head"><h2><LockKeyhole size={17} /> 비공개 카드 셋 <span>{privateDecks.length}</span></h2></div>
          {privateDecks.length
            ? <ul className="deck-grid">{privateDecks.map(tile)}</ul>
            : <p className="home-empty">비공개 카드 셋이 없어요. 새 카드 셋은 비공개로 만들어져요.</p>}
        </section>
      )}

      {admin.length > 0 && (
        <details className="home-section home-admin">
          <summary><h2>다른 사용자의 비공개 셋 <span>{admin.length}</span></h2><small>관리자 · 열람 기록이 남아요</small></summary>
          <ul className="deck-grid">{admin.map(tile)}</ul>
        </details>
      )}

      {filingDeck && (
        <Modal title="폴더에 넣기" onClose={() => setFiling(null)}>
          <p className="modal-description">
            ‘{filingDeck.name}’을 넣을 폴더를 고르거나 새로 만들어요. <code>과학/물리</code>처럼 쓰면 폴더 안의 폴더가 돼요. 폴더는 나에게만 보여요.
          </p>
          <TagInput tags={tagsOf(filingDeck)} folders={tree} onChange={(tags) => onFolders(filingDeck.id, tags)} />
          {tree.some((item) => !tagsOf(filingDeck).includes(item.path)) && (
            <div className="folder-picks">
              {tree.filter((item) => !tagsOf(filingDeck).includes(item.path)).map((item) => (
                <button key={item.path} type="button" onClick={() => onFolders(filingDeck.id, [...tagsOf(filingDeck), item.path].slice(0, 10))}>
                  + {folderLabel(item.path)}
                </button>
              ))}
            </div>
          )}
          <div className="modal-actions">
            <Button onClick={() => setFiling(null)}>완료</Button>
          </div>
        </Modal>
      )}
    </main>
  )
}
