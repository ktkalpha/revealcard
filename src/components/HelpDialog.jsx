import React, { useState } from 'react'
import Modal from './Modal'
import { Button } from './ui/button'

// 사용법: short, task-based sections. `initial` opens a section directly.
const SECTIONS = [
  {
    id: 'start',
    title: '시작하기',
    body: (
      <>
        <ol>
          <li><strong>홈</strong>에서 카드 셋을 고르거나 <strong>새 카드 셋</strong>을 만들어요. 공개 카드 셋은 로그인하지 않아도 학습할 수 있어요.</li>
          <li>카드 셋 타일을 누르면 바로 학습이 시작되고, <strong>관리</strong>를 누르면 카드를 추가·수정할 수 있어요.</li>
          <li>홈 맨 위의 <strong>학습 시작</strong>은 마지막으로 공부하던 셋을 멈춘 카드부터 이어 줘요.</li>
        </ol>
        <p>내 카드를 만들고 기록을 계정에 저장하려면 오른쪽 위 <strong>로그인</strong>에서 회원가입하세요.</p>
      </>
    ),
  },
  {
    id: 'make',
    title: '카드 만들기',
    body: (
      <>
        <ol>
          <li>카드 관리에서 <strong>카드 추가</strong>를 누르고 제목과 내용을 적어요.</li>
          <li>외울 단어를 선택(또는 커서를 두고) <strong>가리기</strong>를 누르면 빈칸이 돼요. <code>[[정답]]</code>처럼 직접 써도 돼요.</li>
          <li><strong>탭해서 가리기</strong>로 바꾸면 단어를 눌러서 바로 가릴 수 있어요. 모바일에서 편해요.</li>
          <li><strong>표</strong>는 엑셀처럼 칸에 입력하고, 여러 칸을 골라 병합하거나 칸을 통째로 가릴 수 있어요.</li>
          <li><strong>사진</strong>은 올리기 전에 자르거나 형광펜으로 표시할 수 있어요.</li>
        </ol>
        <p>쓰는 동안 자동으로 저장돼요. 오른쪽(모바일은 아래) <strong>학습 미리보기</strong>에서 실제 모습을 확인하세요.</p>
      </>
    ),
  },
  {
    id: 'study',
    title: '학습하기',
    body: (
      <>
        <ol>
          <li>답을 먼저 떠올린 뒤 빈칸(<strong>?</strong>)을 누르거나 <strong>빈칸 하나씩 보기</strong>로 정답을 확인해요.</li>
          <li>틀린 빈칸은 옆의 <strong>✕</strong>를 눌러 표시해 두세요. 나중에 <strong>틀린 빈칸</strong>만 다시 풀 수 있어요.</li>
          <li>카드를 다 보면 <strong>기억했어요</strong> 또는 <strong>다시 볼게요</strong>를 골라 다음 카드로 넘어가요.</li>
          <li>위쪽 버튼으로 <strong>전체 · 다시 볼 카드 · 틀린 빈칸</strong> 중 학습 범위를 바꾸고, <strong>섞기</strong>로 순서를 섞을 수 있어요.</li>
          <li><strong>서술형</strong>을 켜면 빈칸의 답을 직접 써서 채점받아요. 띄어쓰기·조사·작은 오타는 너그럽게 봐 주고, 채점이 틀렸다면 결과를 뒤집을 수 있어요.</li>
        </ol>
        <p>모바일에서는 카드를 좌우로 밀어서 이전·다음 카드로 갈 수 있어요.</p>
      </>
    ),
  },
  {
    id: 'keys',
    title: '키보드 단축키',
    body: (
      <table className="help-keys">
        <tbody>
          <tr><td><kbd>Space</kbd></td><td>빈칸 하나씩 보기 → 다 보면 기억했어요</td></tr>
          <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>이전 · 다음 카드</td></tr>
          <tr><td><kbd>↑</kbd> <kbd>↓</kbd> · <kbd>Enter</kbd></td><td>빈칸 고르기 · 열기/닫기</td></tr>
          <tr><td><kbd>1</kbd> · <kbd>2</kbd></td><td>다시 볼게요 · 기억했어요</td></tr>
          <tr><td><kbd>X</kbd></td><td>고른 빈칸 틀림 표시</td></tr>
          <tr><td><kbd>A</kbd> · <kbd>R</kbd></td><td>모두 보기 · 다시 가리기</td></tr>
        </tbody>
      </table>
    ),
  },
  {
    id: 'manage',
    title: '카드 셋 관리',
    body: (
      <ul>
        <li><strong>공개 / 비공개</strong>: 공개 셋은 누구나 보고 학습할 수 있어요. 비공개 셋은 나만 볼 수 있어요.</li>
        <li><strong>파일 불러오기 · 다운로드</strong>: <code>.revealcard.json</code> 파일로 다른 기기나 친구와 카드를 주고받아요.</li>
        <li><strong>오프라인 저장</strong>: 이 기기에 저장해 두면 인터넷이 없어도 학습할 수 있어요. 카드가 바뀌면 다시 눌러 업데이트하세요.</li>
        <li><strong>버전 기록</strong>: 실수로 바꾼 카드를 예전 상태로 되돌릴 수 있어요.</li>
        <li><strong>여러 장 옮기기</strong>: 카드를 골라 다른 카드 셋으로 옮겨요. 카드 순서는 왼쪽 손잡이를 끌어서 바꿔요.</li>
      </ul>
    ),
  },
  {
    id: 'pet',
    title: '펫',
    body: (
      <ul>
        <li>위쪽 <strong>펫</strong> 버튼에서 사진을 올리면 학습 친구가 만들어져요. 표정 4가지는 자동으로 생성돼요.</li>
        <li>펫은 학습 화면에 함께 나와서 정답·오답·학습 완료에 반응해요. 끌어서 원하는 위치로 옮길 수 있어요.</li>
        <li>최대 5마리까지 만들고, 이름·크기·표시 여부와 나만의 표정을 정할 수 있어요.</li>
      </ul>
    ),
  },
]

export default function HelpDialog({ initial = 'start', onClose }) {
  const [current, setCurrent] = useState(SECTIONS.some((item) => item.id === initial) ? initial : 'start')
  const section = SECTIONS.find((item) => item.id === current)
  return (
    <Modal title="사용법" onClose={onClose} className="help-modal">
      <div className="help-tabs" role="tablist" aria-label="도움말 주제">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === current}
            onClick={() => setCurrent(item.id)}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div className="help-body" role="tabpanel">
        <h3>{section.title}</h3>
        {section.body}
      </div>
      <div className="dialog-actions">
        <Button onClick={onClose}>확인</Button>
      </div>
    </Modal>
  )
}
