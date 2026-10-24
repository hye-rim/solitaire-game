'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { solve, solve3, reachable } = require('../tools/solver.js');
const { replay } = require('../tools/verify.js');

const seeds = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'seeds.js'), 'utf8').replace(/const (SOLVABLE_SEEDS(?:_3)?|EASY_SEEDS_3)/g, 'this.$1'), seeds);

test('draw-3: only every third card (and the last) can reach the top of the waste', () => {
  assert.deepStrictEqual(reachable(7, 0), [3, 6, 7]);
  assert.deepStrictEqual(reachable(7, 4), [3, 4, 6, 7]);                    // from position 4 the next draws land on 7, a recycle lands on 3 and 6
  assert.deepStrictEqual(reachable(24, 0), [3, 6, 9, 12, 15, 18, 21, 24]);
  assert.deepStrictEqual(reachable(2, 0), [2]);
  assert.deepStrictEqual(reachable(0, 0), []);
});

test('seed lists: 300 unique seeds for each mode', () => {
  for (const k of ['SOLVABLE_SEEDS', 'SOLVABLE_SEEDS_3']) {
    const list = seeds[k];
    assert.ok(Array.isArray(list) && list.length === 300, k);
    assert.strictEqual(new Set(list).size, 300, k + ' unique');
  }
});

test('listed draw-3 deals really are won when the solution is replayed with the real draw-3 rules', () => {
  const sample = seeds.SOLVABLE_SEEDS_3.filter((_, i) => i % 20 === 0);      // 15 deals across the list
  for (const s of sample) {
    const r = solve3(s, 150000);
    assert.ok(r.ok, 'solver finds seed ' + s);
    assert.strictEqual(replay(s, r.path, 3), 'won', 'replay wins seed ' + s);
  }
});

test('listed draw-1 deals are still won with the draw-1 rules', () => {
  const sample = seeds.SOLVABLE_SEEDS.filter((_, i) => i % 30 === 0);
  for (const s of sample) {
    const r = solve(s, 150000);
    assert.ok(r.ok, 'solver finds seed ' + s);
    assert.strictEqual(replay(s, r.path, 1), 'won', 'replay wins seed ' + s);
  }
});

test('easy draw-3 list: a subset of the solvable list, every deal solved within the node limit and won on replay', () => {
  const { EASY_NODES } = require('../tools/seedfile.js');
  const all = new Set(seeds.SOLVABLE_SEEDS_3);
  assert.ok(seeds.EASY_SEEDS_3.length >= 100, 'enough easy deals');
  assert.strictEqual(new Set(seeds.EASY_SEEDS_3).size, seeds.EASY_SEEDS_3.length, 'unique');
  for (const s of seeds.EASY_SEEDS_3) {
    assert.ok(all.has(s), 'seed ' + s + ' is in the solvable list');
    const r = solve3(s, EASY_NODES);
    assert.ok(r.ok, 'solver finds easy seed ' + s + ' within ' + EASY_NODES + ' nodes');
    assert.strictEqual(replay(s, r.path, 3), 'won', 'replay wins seed ' + s);
  }
});
