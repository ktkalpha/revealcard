import React, { useState } from 'react'
import { Button } from './ui/button'
import Modal from './Modal'
import { api } from '../lib/api'

export default function AuthDialog({ onClose, onSuccess }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [remember, setRemember] = useState(true)
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(`/api/${mode}`, { method: 'POST', body: { username, password, remember } })
      await onSuccess()
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title={mode === 'login' ? '로그인' : '계정 만들기'} onClose={onClose}>
      <div className="segmented auth-modes" role="group" aria-label="계정">
        <button aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError('') }}>
          로그인
        </button>
        <button aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setError('') }}>
          계정 만들기
        </button>
      </div>
      <form onSubmit={submit}>
        <label className="form-label" htmlFor="auth-name">아이디</label>
        <input
          id="auth-name"
          autoFocus
          autoComplete="username"
          minLength={3}
          maxLength={32}
          pattern="[a-zA-Z0-9_-]+"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
        <label className="form-label" htmlFor="auth-password">비밀번호</label>
        <input
          id="auth-password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={10}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <label className="auth-remember"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} /><span>로그인 유지 <small>30일</small></span></label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button type="submit" disabled={busy}>
            {busy ? '확인 중…' : mode === 'login' ? '로그인' : '계정 만들기'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
