export const STORAGE_KEY = 'revealcard.library.v2'
export const DRAFT_KEY = 'revealcard.draft.v1'
export const uid = () => crypto.randomUUID()
const validCard = (c) =>
  c &&
  typeof c.id === 'string' &&
  typeof c.title === 'string' &&
  typeof c.body === 'string'
const starterCards = [
  {
    id: 'welcome-1',
    title: '기억을 꺼내는 연습',
    body: '그냥 읽는 것보다\n[[스스로 떠올리는 연습]]이 중요해요.\n\n빈칸을 눌러 답을 확인하고,\n기억났다면 [[기억했어요]]를 눌러보세요.',
  },
  {
    id: 'welcome-2',
    title: '나만의 빈칸 만들기',
    body: '[[단어]]만 가려도 좋고,\n[[이렇게 한 줄 전체를 가려도 좋아요.]]\n\n카드 편집에서 가릴 부분을 선택하세요.',
  },
  {
    id: 'welcome-3',
    title: '조금씩, 다시 한 번',
    body: '잘 기억나지 않는 카드는 [[다시 볼게요]]로 표시해요.\n\n학습을 마친 뒤\n[[헷갈린 카드만 다시 학습]]할 수 있어요.',
  },
]
export function loadLibrary(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      if (
        !Array.isArray(saved.decks) ||
        !saved.decks.length ||
        !saved.decks.every(
          (d) =>
            typeof d.id === 'string' &&
            typeof d.name === 'string' &&
            Array.isArray(d.cards) &&
            d.cards.every(validCard),
        )
      )
        throw new Error('invalid library')
      return {
        data: {
          ...saved,
          ratings: saved.ratings || {},
          positions: saved.positions || {},
        },
        error: '',
      }
    }
    const legacy = storage.getItem('revealcard.cards')
    const cards = legacy ? JSON.parse(legacy) : starterCards
    if (!Array.isArray(cards) || !cards.every(validCard))
      throw new Error('invalid cards')
    return {
      data: {
        decks: [{ id: 'default', name: '나의 암기 카드', cards }],
        selectedDeckId: 'default',
        ratings: {},
        positions: {},
      },
      error: '',
    }
  } catch {
    return {
      data: {
        decks: [{ id: 'recovery', name: '새 카드 셋', cards: [] }],
        selectedDeckId: 'recovery',
        ratings: {},
        positions: {},
      },
      error:
        '저장된 카드를 읽지 못했어요. 원본을 보호하기 위해 자동 저장을 멈췄습니다. 새 내용은 내보내기로 보관해 주세요.',
    }
  }
}
export function loadDraft(storage) {
  try {
    const draft = JSON.parse(storage.getItem(DRAFT_KEY))
    return draft && validCard(draft.card) && typeof draft.deckId === 'string'
      ? draft
      : null
  } catch {
    return null
  }
}
export function importCards(existing, incoming, skipDuplicates) {
  const seen = new Set(existing.map((c) => JSON.stringify([c.title, c.body, c.answerMode || 'reveal'])))
  const added = []
  for (const card of incoming) {
    const signature = JSON.stringify([card.title, card.body, card.answerMode || 'reveal'])
    if (skipDuplicates && seen.has(signature)) continue
    seen.add(signature)
    added.push({ ...card, id: uid() })
  }
  return added
}
