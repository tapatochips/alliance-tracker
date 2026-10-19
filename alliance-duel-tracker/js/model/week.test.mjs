import test from 'node:test';
import assert from 'node:assert/strict';
import { computeWeek, hasAnyMin, weeklyMinFor } from './week.js';

test('weekly minimum flags active members below the running total, including daily flags', () => {
  const d = {
    config: { minimums: { d1: 10 }, weeklyMinimum: 15 },
    members: new Map([
      ['low', { id: 'low', name: 'Low', status: 'active' }],
      ['met', { id: 'met', name: 'Met', status: 'active' }],
      ['none', { id: 'none', name: 'None', status: 'active' }],
      ['left', { id: 'left', name: 'Left', status: 'left' }],
    ]),
    weeks: new Map([['2026-10-12', { scores: {
      low: { d1: 5 },
      met: { d1: 15 },
      left: { d1: 1 },
    } }]]),
  };

  const result = computeWeek('2026-10-12', d);
  const rows = new Map(result.rows.map((row) => [row.id, row]));

  assert.equal(rows.get('low').weeklyBelow, true);
  assert.equal(rows.get('low').below, 1);
  assert.equal(rows.get('low').flags, 2);
  assert.equal(rows.get('met').weeklyBelow, false);
  assert.equal(rows.get('none').weeklyBelow, true);
  assert.equal(rows.get('none').missed, 1);
  assert.equal(rows.get('none').flags, 2);
  assert.equal(rows.get('left').weeklyBelow, false);
  assert.equal(result.weeklyMinimum, 15);
});

test('weekly minimum waits until at least one score is recorded and counts as a configured minimum', () => {
  const d = {
    config: { minimums: {}, weeklyMinimum: 15 },
    members: new Map([['one', { id: 'one', name: 'One', status: 'active' }]]),
    weeks: new Map([['2026-10-12', { scores: {} }]]),
  };

  assert.equal(computeWeek('2026-10-12', d).rows[0].weeklyBelow, false);
  assert.equal(weeklyMinFor(d.config), 15);
  assert.equal(hasAnyMin(d.config), true);
});
