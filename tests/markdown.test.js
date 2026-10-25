import test from 'node:test'
import assert from 'node:assert/strict'
import { markdownExcerpt, prepareMarkdown, remarkMasks } from '../src/lib/markdown.js'
import { exportCardSet, parseCardSet } from '../src/cardSet.js'
import { remark } from 'remark'

test('masks keep their source IDs while markdown remains parseable', () => {
  const { source, masks } = prepareMarkdown('**앞 [[정답]]**\n- [[둘째]]')
  assert.equal(masks.length, 2)
  assert.equal(masks[0].id, '4')
  assert.match(source, /^\*\*앞 \uE000rc0\uE001\*\*/)
  assert.match(source, /- \uE000rc1\uE001$/)
})

test('markdown tokens become links in prose and remain available in code', () => {
  const { source, masks } = prepareMarkdown('[[답]]')
  const token = source
  const tree = {
    type: 'root',
    children: [
      { type: 'paragraph', children: [{ type: 'text', value: `앞 ${token} 뒤` }] },
      { type: 'code', value: token },
      { type: 'inlineCode', value: token },
    ],
  }
  remarkMasks({ masks })(tree)
  assert.equal(tree.children[0].children[1].url, '#revealcard-mask-0')
  assert.equal(tree.children[1].value, token)
  assert.equal(tree.children[2].value, token)
})

test('a masked answer inside link text is split out of the anchor', () => {
  const { source, masks } = prepareMarkdown('[앞 [[답]] 뒤](https://example.com)')
  const tree = {
    type: 'root',
    children: [{
      type: 'paragraph',
      children: [{
        type: 'link',
        url: 'https://example.com',
        children: [{ type: 'text', value: `앞 ${source.match(/\uE000rc0\uE001/)[0]} 뒤` }],
      }],
    }],
  }
  remarkMasks({ masks })(tree)
  assert.deepEqual(
    tree.children[0].children.map((node) => node.url),
    ['https://example.com', '#revealcard-mask-0', 'https://example.com'],
  )
})

test('alignment round-trips through v1 card sets and old files default to center', () => {
  const cards = [
    { title: '왼쪽', body: '**강조**', align: 'left' },
    { title: '기본', body: '내용' },
  ]
  assert.deepEqual(parseCardSet(JSON.stringify(exportCardSet(cards))), {
    name: '나의 암기 카드',
    cards,
  })
  assert.throws(
    () => parseCardSet(JSON.stringify(exportCardSet([
      { title: '오류', body: '내용', align: 'justify' },
    ]))),
    /정렬/,
  )
})

test('card list excerpt omits markdown punctuation but keeps answers', () => {
  assert.equal(
    markdownExcerpt('**중요한 [[정답]]**\n- 첫 항목\n`코드`와 [링크](https://example.com)'),
    '중요한 정답 첫 항목 코드와 링크',
  )
})

test('a cover right after ^ becomes a note above the word or bold run before it', () => {
  const { source, masks } = prepareMarkdown('**생사(生死)**^[[삶과 죽음]] 길흔^[[발음]] 끝 ^ [[보통]]')
  const tree = remark.parse(source)
  remarkMasks({ masks })(tree)
  const paragraph = tree.children[0].children
  const notes = paragraph.filter((node) => node.type === 'annotation')
  assert.equal(notes.length, 2)
  const [first, second] = notes
  assert.equal(first.children[0].children[0].type, 'strong')
  assert.equal(first.children[1].children[0].url, '#revealcard-mask-0')
  assert.deepEqual(second.children[0].children[0], { type: 'text', value: '길흔' })
  assert.ok(paragraph.some((node) => node.type === 'text' && node.value.endsWith('^ ')))
  assert.equal(markdownExcerpt('길흔^[[발음]] 뒤'), '길흔 발음 뒤')
})

test('formulas read as their source in excerpts and stay one word for tap covers', async () => {
  const { markdownExcerpt } = await import('../src/lib/markdown.js')
  const { tapTokens } = await import('../src/lib/editing.js')
  assert.equal(markdownExcerpt('힘은 $F = ma$ 이다'), '힘은 F = ma 이다')
  assert.equal(markdownExcerpt('$$\n\\frac{1}{2}mv^2\n$$'), '\\frac{1}{2}mv^2')
  const words = tapTokens('힘은 $F = ma$ 이다').filter((token) => token.type === 'word').map((token) => token.text)
  assert.deepEqual(words, ['힘은', '$F = ma$', '이다'])
})

test('a one-line $$ formula becomes a display formula', async () => {
  const { displayLines } = await import('../src/lib/math.js')
  assert.equal(displayLines('앞\n$$x = \\frac{1}{2}$$\n뒤'), '앞\n$$\nx = \\frac{1}{2}\n$$\n뒤')
  assert.equal(displayLines('글 $$x$$ 글'), '글 $$x$$ 글')
})

test('an animation block is one untouchable piece in excerpts and tap covers', async () => {
  const { markdownExcerpt } = await import('../src/lib/markdown.js')
  const { tapTokens } = await import('../src/lib/editing.js')
  const body = '앞\n\n```motion\nfusion\n```\n\n뒤'
  assert.equal(markdownExcerpt(body), '앞 [애니메이션: 수소 핵융합 반응] 뒤')
  assert.deepEqual(tapTokens(body).filter((token) => token.type === 'word').map((token) => token.text), ['앞', '뒤'])
})
