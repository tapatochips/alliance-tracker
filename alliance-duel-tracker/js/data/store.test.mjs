import test from 'node:test';
import assert from 'node:assert/strict';
import { data, deserialize, emptyData, removeMember, renameMember, replaceAll } from './store.js';

test('deserializes optional weekly minimums without breaking older saved data', () => {
  assert.equal(deserialize({ config: { minimums: {}, weeklyMinimum: 12 } }).config.weeklyMinimum, 12);
  assert.equal(deserialize({ config: { minimums: {} } }).config.weeklyMinimum, null);
});

test('deleting a member removes their saved scores from all weeks', () => {
  const d = emptyData();
  d.members.set('member-1', { id: 'member-1', name: 'Member', status: 'active' });
  d.weeks.set('2026-10-12', { scores: { 'member-1': { d1: 100 }, other: { d1: 200 } } });
  d.weeks.set('2026-10-19', { scores: { 'member-1': { d2: 300 } } });
  replaceAll(d);

  removeMember('member-1');

  assert.equal(data().members.has('member-1'), false);
  assert.deepEqual(data().weeks.get('2026-10-12').scores, { other: { d1: 200 } });
  assert.deepEqual(data().weeks.get('2026-10-19').scores, {});
});

test('renaming a member keeps the previous name as a matching alias', () => {
  const d = emptyData();
  d.members.set('member-2', { id: 'member-2', name: 'Old Name', aliases: [], status: 'active' });
  replaceAll(d);

  renameMember('member-2', 'New Name');

  assert.equal(data().members.get('member-2').name, 'New Name');
  assert.deepEqual(data().members.get('member-2').aliases, ['Old Name']);
});
