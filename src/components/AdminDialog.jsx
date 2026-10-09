import React, { useEffect, useState } from 'react'
import { RotateCcw, UserX, UserCheck } from 'lucide-react'
import Modal from './Modal'
import { Button } from './ui/button'
import { api } from '../lib/api'

const ACTIONS = {
  login: '로그인',
  'login-failed': '로그인 실패',
  register: '회원가입',
  logout: '로그아웃',
  migrate: '브라우저 카드 가져오기',
  'create-deck': '카드 셋 만들기',
  'delete-deck': '카드 셋 삭제',
  'deck-settings': '카드 셋 설정 변경',
  'restore-deck': '버전 복원',
  'add-cards': '카드 추가',
  'edit-card': '카드 수정',
  'delete-card': '카드 삭제',
  'move-card': '카드 순서 변경',
  'transfer-cards': '카드 다른 셋으로 이동',
  'admin-view-deck': '관리자 비공개 셋 열람',
  'admin-kick': '계정 강퇴',
  'admin-unban': '강퇴 해제',
  'login-banned': '강퇴된 계정 로그인 시도',
}
const AUTH_ACTIONS = ['login', 'login-failed', 'login-banned', 'register', 'logout', 'admin-kick', 'admin-unban']
const time = (value) => value ? new Date(value).toLocaleString() : '—'
const ago = (value) => {
  if (!value) return '기록 없음'
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value)) / 1000))
  return seconds < 60 ? '방금' : seconds < 3600 ? `${Math.floor(seconds / 60)}분 전` : seconds < 86400 ? `${Math.floor(seconds / 3600)}시간 전` : time(value)
}
const detail = (event) => [
  event.deck && `‘${event.deck}’`,
  event.count !== undefined && `${event.count}장`,
  event.cards !== undefined && `카드 ${event.cards}장`,
  event.target && `→ ‘${event.target}’`,
  event.owner && `(소유자 ${event.owner})`,
].filter(Boolean).join(' ')

export default function AdminDialog({ onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [kicking, setKicking] = useState('')
  const load = async () => {
    setLoading(true)
    try {
      setData(await api('/api/admin/activity?limit=1000'))
      setError('')
    } catch (failure) {
      setError(failure.message)
    } finally {
      setLoading(false)
    }
  }
  const kick = async (account) => {
    const banned = !account.banned
    if (banned && !window.confirm(`‘${account.username}’ 계정을 강퇴할까요?\n접속 중인 모든 기기에서 로그아웃되고 다시 로그인할 수 없어요. 카드 셋은 지워지지 않아요.`)) return
    setKicking(account.username)
    try {
      setData(await api(`/api/admin/users/${encodeURIComponent(account.username)}/${banned ? 'kick' : 'unban'}`, { method: 'POST' }))
      setError('')
    } catch (failure) {
      setError(failure.message)
    } finally {
      setKicking('')
    }
  }
  useEffect(() => {
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [])
  const events = data?.events.filter((event) =>
    filter === 'all' ||
    (filter === 'auth' ? AUTH_ACTIONS.includes(event.action) : !AUTH_ACTIONS.includes(event.action)),
  ) || []
  const guests = data?.online.filter((item) => !item.username).length || 0
  return <Modal title="관리자 · 접속 기록" onClose={onClose} className="admin-modal">
    <div className="admin-toolbar">
      <p className="modal-description">최근 5분 안에 요청을 보낸 사용자를 접속 중으로 표시해요. 30초마다 새로 고쳐요.</p>
      <Button variant="outline" size="sm" disabled={loading} onClick={load}><RotateCcw size={14} /> 새로 고침</Button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!data && !error && <p role="status">기록을 불러오는 중…</p>}
    {data && <>
      <section className="admin-section">
        <h3>지금 접속 중 <span>{data.online.length}</span></h3>
        {data.online.length ? <ul className="admin-online">
          {data.online.map((item) => <li key={`${item.username || 'guest'}-${item.ip}`}>
            <strong>{item.username || '비회원'}</strong><span>{item.ip}</span><span>{ago(item.at)}</span>
          </li>)}
        </ul> : <p className="muted">지금 접속 중인 사용자가 없어요.</p>}
        {guests > 0 && <p className="muted">비회원은 IP 주소별로 따로 셉니다.</p>}
      </section>
      <section className="admin-section">
        <h3>계정 <span>{data.accounts.length}</span></h3>
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>아이디</th><th>상태</th><th>마지막 접속</th><th>마지막 로그인</th><th>관리</th></tr></thead>
          <tbody>{data.accounts.map((account) => <tr key={account.username} className={account.banned ? 'admin-banned' : undefined}>
            <td>{account.username}{account.admin && <small className="admin-badge">관리자</small>}{account.banned && <small className="admin-badge admin-badge-banned">강퇴됨</small>}</td>
            <td><span className={`admin-dot ${account.online ? 'on' : ''}`} />{account.banned ? `강퇴 ${time(account.bannedAt)}` : account.online ? '접속 중' : '오프라인'}</td>
            <td>{ago(account.lastSeen)}</td>
            <td>{time(account.lastLogin)}</td>
            <td>{!account.admin && <Button variant="outline" size="sm" className={account.banned ? undefined : 'admin-kick'} disabled={!!kicking} onClick={() => kick(account)} aria-label={`${account.username} ${account.banned ? '강퇴 해제' : '강퇴'}`}>
              {account.banned ? <><UserCheck size={14} /> 해제</> : <><UserX size={14} /> 강퇴</>}
            </Button>}</td>
          </tr>)}</tbody>
        </table></div>
        <p className="muted">마지막 접속은 서버를 다시 시작한 뒤부터 기록돼요. 강퇴하면 모든 기기에서 로그아웃되고 해제할 때까지 로그인할 수 없어요.</p>
      </section>
      <section className="admin-section">
        <div className="admin-log-head">
          <h3>활동 로그 <span>{events.length}</span></h3>
          <select aria-label="활동 로그 종류" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">전체</option>
            <option value="auth">로그인·회원가입·강퇴</option>
            <option value="edit">카드 편집</option>
          </select>
        </div>
        {events.length ? <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>시각</th><th>사용자</th><th>활동</th><th>내용</th><th>IP</th></tr></thead>
          <tbody>{events.map((event, index) => <tr key={`${event.at}-${index}`} className={['login-failed', 'login-banned', 'admin-kick'].includes(event.action) ? 'admin-warning' : undefined}>
            <td>{time(event.at)}</td>
            <td>{event.username || '비회원'}</td>
            <td>{ACTIONS[event.action] || event.action}</td>
            <td>{detail(event)}</td>
            <td>{event.ip}</td>
          </tr>)}</tbody>
        </table></div> : <p className="muted">아직 기록된 활동이 없어요.</p>}
      </section>
    </>}
  </Modal>
}
