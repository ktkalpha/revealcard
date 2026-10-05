import React, { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Shuffle, X } from 'lucide-react'
import { Button } from './ui/button'
import { classificationAnswer, classificationData } from '../lib/classification'
import { shuffled } from '../lib/matching'

export default function ClassificationGame({ body, onComplete = () => {}, onReset = () => {}, onAnswer, keyboardEnabled = true }) {
  const data = useMemo(() => classificationData(body), [body])
  const [round, setRound] = useState(() => shuffled(data.items))
  const [cursor, setCursor] = useState(0)
  const [answers, setAnswers] = useState([])
  const [answer, setAnswer] = useState(null)
  const [imageState, setImageState] = useState('loading')
  const [imageVersion, setImageVersion] = useState(0)
  const [mode, setMode] = useState('all')
  const item = round[cursor]
  const done = cursor >= round.length
  const correct = answers.filter(a => a.correct).length
  const mistakes = answers.filter(a => !a.correct)

  function choose(category) {
    if (done || answer || imageState !== 'ready') return
    const result = classificationAnswer(item, category)
    setAnswer(result)
    setAnswers(previous => [...previous, result])
    onAnswer?.(result.correct)
  }
  function next() {
    if (!answer) return
    setCursor(previous => previous + 1)
    setAnswer(null)
    setImageState('loading')
    if (cursor + 1 === round.length) onComplete()
  }
  function restart(items = data.items, nextMode = 'all') {
    setRound(shuffled(items)); setCursor(0); setAnswers([]); setAnswer(null)
    setImageState('loading'); setMode(nextMode); onReset()
  }
  useEffect(() => {
    function keydown(event) {
      if (!keyboardEnabled || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('dialog,input,textarea,select,[contenteditable="true"]')) return
      if (event.key === 'Enter' && event.target.closest('button')) return
      const index = Number(event.key) - 1
      if (!answer && index >= 0 && index < data.categories.length) {
        event.preventDefault(); event.stopImmediatePropagation(); choose(data.categories[index])
      } else if (answer && event.key === 'Enter') {
        event.preventDefault(); event.stopImmediatePropagation(); next()
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })

  return <section className="classification-game" aria-label="화석 사진 시대 분류 게임" data-no-swipe>
    <p className="classification-intro">사진을 보고 학습지의 대표 시대를 골라 보세요. 이름과 해설은 답을 고른 뒤 공개돼요.</p>
    <div className="classification-stats"><span>{mode === 'wrong' ? '오답 복습' : '사진 분류'} <strong>{done ? round.length : cursor + 1} / {round.length}</strong></span><span>정답 <strong>{correct}</strong></span><span>오답 <strong>{mistakes.length}</strong></span></div>
    {!done ? <>
      <div className="classification-photo">
        <img key={`${item.id}-${imageVersion}`} src={item.image} alt={answer ? item.label : '시대를 분류할 화석 사진'} onLoad={() => setImageState('ready')} onError={() => setImageState('error')} />
        {imageState === 'loading' && <p className="classification-image-message" role="status">사진을 불러오고 있어요…</p>}
        {imageState === 'error' && <div className="classification-image-message" role="alert"><p>사진을 불러오지 못했어요.</p><Button variant="outline" onClick={() => {setImageState('loading');setImageVersion(v=>v+1)}}>사진 다시 불러오기</Button></div>}
      </div>
      <div className="classification-choices" aria-label="시대 선택">{data.categories.map((category, index) => <button type="button" key={category} className={`classification-choice ${answer && category === item.category ? 'correct' : ''} ${answer && !answer.correct && category === answer.chosen ? 'wrong' : ''}`} disabled={!!answer || imageState !== 'ready'} onClick={() => choose(category)}><span>{category}</span><kbd>{index + 1}</kbd>{answer && category === item.category && <Check size={18}/>}</button>)}</div>
      {answer && <div className={`classification-answer ${answer.correct ? 'correct' : 'wrong'}`} role="status"><p className="classification-verdict">{answer.correct ? <Check size={19}/> : <X size={19}/>} {answer.correct ? '정답이에요!' : `정답은 ${item.category}예요.`}</p><h2>{item.label}</h2><p>{item.explanation}</p>{item.source && <a href={item.source} target="_blank" rel="noopener noreferrer">사진 출처 · {item.credit || 'Wikimedia Commons'}{item.license ? ` · ${item.license}` : ''}</a>}<Button onClick={next}>{cursor + 1 === round.length ? '결과 보기' : '다음 사진'} <ArrowRight size={17}/></Button></div>}
      {!answer && <p className="classification-hint">버튼을 누르거나 숫자 키로 선택하세요.</p>}
    </> : <div className="classification-results"><span className="classification-score">{Math.round(correct / round.length * 100)}<small>%</small></span><h2>{correct} / {round.length}개 정답</h2><p>{mistakes.length ? '헷갈린 사진만 골라 다시 분류해 보세요.' : '모든 화석의 시대를 맞혔어요!'}</p><div className="classification-result-actions">{mistakes.length > 0 && <Button onClick={() => restart(round.filter(i => mistakes.some(a => a.itemId === i.id)), 'wrong')}><RotateCcw size={16}/> 오답 {mistakes.length}개 다시 풀기</Button>}<Button variant="outline" onClick={() => restart()}><Shuffle size={16}/> 모두 다시 섞기</Button></div><details><summary>사진별 정답 확인</summary><ul>{round.map(i => <li key={i.id}><img src={i.image} alt={i.label} loading="lazy"/><span><strong>{i.label}</strong><small>{i.category}</small></span>{answers.find(a=>a.itemId===i.id)?.correct ? <Check size={17}/> : <X size={17}/>}</li>)}</ul></details></div>}
    <p className="classification-scope">학습지의 대표 화석 기준입니다. 완족류·산호·양치식물 등은 여러 시대에 걸쳐 존재해요.</p>
  </section>
}
