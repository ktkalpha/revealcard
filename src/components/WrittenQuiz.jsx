import React, { useEffect, useState } from 'react'
import { Check, LoaderCircle, Sparkles, X } from 'lucide-react'
import { Button } from './ui/button'
import { api } from '../lib/api'
import { maskKey } from '../lib/masks'

export default function WrittenQuiz({ deckId, card, masks, results, onResults }) {
  const [answers, setAnswers] = useState(() => masks.map(() => ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setAnswers(masks.map(() => ''))
    setError('')
  }, [card.id])

  const grade = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const graded = await api('/api/grade', {
        method: 'POST', body: { deckId, cardId: card.id, answers },
      })
      onResults(graded.results)
    } catch (gradeError) {
      setError(gradeError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="written-quiz" onSubmit={grade}>
      <div className="written-heading">
        <span><Sparkles size={16} /> AI 서술형 채점</span>
        <small>의미 유사도 75% 이상이면 정답</small>
      </div>
      {masks.map((mask, index) => {
        const result = results?.[index]
        return (
          <label className={`written-answer ${result ? (result.correct ? 'correct' : 'incorrect') : ''}`} key={maskKey(mask)}>
            <span>{index + 1}번 빈칸</span>
            <input
              value={answers[index]}
              onChange={(event) => setAnswers((current) => current.map((answer, answerIndex) =>
                answerIndex === index ? event.target.value : answer,
              ))}
              placeholder="답을 문장으로 입력하세요"
              disabled={busy || !!results}
              required
            />
            {result && (
              <div className="written-feedback">
                {result.correct ? <Check size={15} /> : <X size={15} />}
                <span><strong>{Math.round(result.score * 100)}%</strong> {result.feedback}</span>
              </div>
            )}
          </label>
        )
      })}
      {error && <p className="field-error" role="alert">{error}</p>}
      {!results && (
        <Button type="submit" disabled={busy || answers.some((answer) => !answer.trim())}>
          {busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
          {busy ? 'AI가 채점하는 중…' : 'AI로 채점하기'}
        </Button>
      )}
    </form>
  )
}
