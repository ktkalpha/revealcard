import test from 'node:test'
import assert from 'node:assert/strict'
import { availableDecks } from '../src/lib/offline.js'

test('offline snapshots expose public sets and only the current owner private sets as read-only', () => {
  const records = [
    { id: 'public', visibility: 'public', ownerId: null, deck: { id: 'public', canEdit: true, cards: [] } },
    { id: 'mine', visibility: 'private', ownerId: 'alice', deck: { id: 'mine', canEdit: true, cards: [] } },
    { id: 'other', visibility: 'private', ownerId: 'bob', deck: { id: 'other', canEdit: true, cards: [] } },
  ]
  assert.deepEqual(availableDecks(records, null).map((deck) => deck.id), ['public'])
  assert.deepEqual(availableDecks(records, 'alice').map((deck) => deck.id), ['public', 'mine'])
  assert.ok(availableDecks(records, 'alice').every((deck) => !deck.canEdit))
  assert.equal(records[0].deck.canEdit, true)
})
