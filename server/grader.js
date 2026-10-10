// Meaning-based grading for Hard (서술형) mode through TypeSafe's Jev model.
// Only used when TYPESAFE_API_KEY is set; the browser falls back to local grading otherwise.

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
const QUESTION = {
  type: 'score',
  instructions: 'A Korean literature student wrote `student_answer` for a fill-in-the-blank whose model answer is `model_answer`. Judge whether the student answer has the same meaning as the model answer. Wording, word order, particles and paraphrase do not matter; meaning does.',
  criteria: [
    'Wrong: different meaning, unrelated, or contradicts the model answer.',
    'Partly right: gets some key idea but misses or distorts an important part.',
    'Right: same meaning as the model answer, possibly paraphrased.',
  ],
}
const PER_MINUTE = 30
const PER_DAY = 1000

export function createGrader({ apiKey = process.env.TYPESAFE_API_KEY, fetcher = fetch, timeout = 5000 } = {}) {
  const used = new Map()
  // Each account gets a small budget so a stuck client or a script cannot run up the bill.
  const allow = (userId) => {
    const now = Date.now()
    const recent = (used.get(userId) || []).filter((at) => now - at < 24 * 60 * 60 * 1000)
    if (recent.length >= PER_DAY || recent.filter((at) => now - at < 60 * 1000).length >= PER_MINUTE) return false
    recent.push(now)
    used.set(userId, recent)
    return true
  }
  return {
    enabled: () => !!apiKey,
    async grade(userId, answer, input) {
      if (!apiKey) return { error: 503 }
      if (!allow(userId)) return { error: 429 }
      const response = await fetcher(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'jev-latest',
          state: JSON.stringify({ model_answer: answer, student_answer: input }),
          questions: { grade: QUESTION },
        }),
        signal: AbortSignal.timeout(timeout),
      })
      if (!response.ok) return { error: 502 }
      const level = (await response.json())?.answers?.grade?.score
      if (typeof level !== 'number') return { error: 502 }
      // Jev's 0–2 level, weighted by probability: 1.5 and up is right, 0.6 and up partly right.
      return {
        verdict: level >= 1.5 ? 'correct' : level >= 0.6 ? 'close' : 'wrong',
        score: Math.round((level / 2) * 100) / 100,
      }
    },
  }
}
