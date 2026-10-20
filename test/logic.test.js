'use strict';
const test = require('node:test');
const assert = require('node:assert');
const L = require('../logic.js');

const id = (s, r) => s * 13 + (r - 1);           // 무늬(0 ♠ 1 ♥ 2 ♣ 3 ♦), 숫자 1~13
const empty = (draw = 1) => {                     // 빈 판 (카드를 직접 놓아 시험한다)
  const st = L.newGame(draw, 1);
  st.tab = Array.from({ length: 7 }, () => []); st.stock = []; st.waste = []; st.found = [[], [], [], []]; st.up = new Array(52).fill(false);
  st.score = 0; st.moves = 0; st.passes = 0;
  return st;
};
const put = (st, c, ...cards) => { for (const [x, up] of cards) { st.tab[c].push(x); st.up[x] = up !== false; } };

test('deal: columns 1..7, tops face up, 24 in stock, every card once', () => {
  const st = L.newGame(1, 123);
  assert.deepStrictEqual(st.tab.map((c) => c.length), [1, 2, 3, 4, 5, 6, 7]);
  st.tab.forEach((col) => { assert.ok(st.up[col[col.length - 1]]); col.slice(0, -1).forEach((x) => assert.ok(!st.up[x])); });
  assert.strictEqual(st.stock.length, 24);
  assert.ok(L.validState(st));
  assert.deepStrictEqual(L.newGame(1, 5).tab, L.newGame(1, 5).tab);            // same seed, same deal
});

test('tableau drop: alternate color and one lower; only a King on an empty column', () => {
  const st = empty();
  put(st, 0, [id(1, 7)]);                                                      // red 7
  assert.ok(L.canDropTab(st, id(0, 6), 0));                                    // black 6 on red 7
  assert.ok(L.canDropTab(st, id(2, 6), 0));
  assert.ok(!L.canDropTab(st, id(3, 6), 0));                                   // red on red
  assert.ok(!L.canDropTab(st, id(0, 5), 0));                                   // wrong rank
  assert.ok(L.canDropTab(st, id(0, 13), 1) && !L.canDropTab(st, id(0, 12), 1));
});

test('foundation: per suit, from the Ace up', () => {
  const st = empty();
  assert.ok(L.canDropFound(st, id(2, 1)) && !L.canDropFound(st, id(2, 2)));
  st.found[2].push(id(2, 1)); st.up[id(2, 1)] = true;
  assert.ok(L.canDropFound(st, id(2, 2)) && !L.canDropFound(st, id(1, 2)));
});

test('moving a face-up run flips the card below and scores', () => {
  const st = empty();
  put(st, 0, [id(3, 9), false], [id(0, 8)], [id(1, 7)]);                       // hidden, black 8, red 7
  put(st, 1, [id(1, 9)]);                                                      // red 9
  const r = L.move(st, { k: 't', c: 0, i: 1 }, { k: 't', c: 1 });
  assert.ok(r && r.flipped);
  assert.deepStrictEqual(st.tab[1], [id(1, 9), id(0, 8), id(1, 7)]);
  assert.ok(st.up[id(3, 9)]);
  assert.strictEqual(st.score, 5);
  assert.strictEqual(L.move(st, { k: 't', c: 0, i: 0 }, { k: 't', c: 0 }), null);   // not onto itself
});

test('scoring: waste to tableau +5, to foundation +10, tableau to foundation +10, foundation back -15 (never below 0)', () => {
  const st = empty();
  put(st, 0, [id(1, 7)]);
  st.waste.push(id(0, 6)); st.up[id(0, 6)] = true;
  L.move(st, { k: 'w' }, { k: 't', c: 0 }); assert.strictEqual(st.score, 5);
  st.waste.push(id(2, 1)); st.up[id(2, 1)] = true;
  L.move(st, { k: 'w' }, { k: 'f' }); assert.strictEqual(st.score, 15);
  put(st, 2, [id(2, 2)]);
  L.move(st, { k: 't', c: 2, i: 0 }, { k: 'f' }); assert.strictEqual(st.score, 25);
  put(st, 3, [id(1, 3)]);
  L.move(st, { k: 'f', s: 2 }, { k: 't', c: 3 }) ;                              // black 2 onto red 3
  assert.strictEqual(st.score, 10);
  st.score = 3; st.found[2].push(id(2, 2)); put(st, 4, [id(1, 3)]); L.move(st, { k: 'f', s: 2 }, { k: 't', c: 4 }); assert.strictEqual(st.score, 0);
});

test('draw: 1 or 3 at a time, recycle flips the waste back with a penalty', () => {
  for (const [draw, pen] of [[1, 100], [3, 20]]) {
    const st = L.newGame(draw, 7);
    const r = L.drawStock(st);
    assert.strictEqual(r.drawn.length, draw);
    assert.ok(r.drawn.every((x) => st.up[x]));
    while (st.stock.length) L.drawStock(st);
    assert.strictEqual(st.waste.length, 24);
    st.score = 500;
    const rc = L.drawStock(st);
    assert.ok(rc.recycled && st.stock.length === 24 && st.waste.length === 0 && st.stock.every((x) => !st.up[x]));
    assert.strictEqual(st.score, 500 - pen);
    assert.strictEqual(st.passes, 1);
    assert.ok(L.validState(st));
  }
  const e = empty(); assert.strictEqual(L.drawStock(e), null);
});

test('hint, best target and stuck detection', () => {
  const st = empty();
  put(st, 0, [id(0, 1)]);                                                      // Ace of spades alone
  assert.deepStrictEqual(L.bestDest(st, { k: 't', c: 0, i: 0 }), { k: 'f' });
  const h = L.hint(st); assert.ok(h && h.type === 'move' && h.dest.k === 'f');
  const dead = empty(); put(dead, 0, [id(0, 5)]); put(dead, 1, [id(0, 9)]);    // nothing can move anywhere
  assert.ok(L.isStuck(dead));
  assert.strictEqual(L.hint(dead), null);
});

test('auto finish: only when everything is face up and the stock is empty; plays out to a win', () => {
  const st = empty();
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) { const x = id(s, r); st.up[x] = true; }
  // put everything on the tableau in an arbitrary face-up order, columns of a mixed order
  const all = []; for (let r = 13; r >= 1; r--) for (let s = 0; s < 4; s++) all.push(id(s, r));
  all.forEach((x, i) => st.tab[i % 7].push(x));
  assert.ok(L.canAutoFinish(st));
  let guard = 0; while (L.autoStep(st) && guard++ < 100);
  assert.ok(L.isWon(st));
  const s2 = L.newGame(1, 9); assert.ok(!L.canAutoFinish(s2));
});

test('serialize / snapshot round trip and rejection of broken saves', () => {
  const st = L.newGame(3, 77);
  L.drawStock(st); const snap = L.snapshot(st);
  L.drawStock(st); L.drawStock(st);
  L.restore(st, snap); assert.strictEqual(st.waste.length, 3);
  const back = L.deserialize(JSON.parse(JSON.stringify(L.serialize(st))));
  assert.ok(back); assert.deepStrictEqual(back.tab, st.tab); assert.strictEqual(back.draw, 3);
  const bad = JSON.parse(JSON.stringify(L.serialize(st))); bad.tab[0][0] = bad.tab[1][0];
  assert.strictEqual(L.deserialize(bad), null);
  assert.strictEqual(L.deserialize({}), null);
});

test('hint never suggests shuffling the same run between columns', () => {
  const st = empty();
  put(st, 0, [id(2, 8)], [id(1, 7)]);                                          // black 8, red 7 (an already linked pair)
  put(st, 1, [id(0, 8)]);                                                      // another black 8: the red 7 could hop over
  assert.ok(L.legalMoves(st, { all: true }).some((m) => m.src.i === 1 && m.dest.c === 1));
  assert.ok(!L.legalMoves(st).some((m) => m.src.k === 't' && m.src.c === 0 && m.src.i === 1));   // but that is pointless
  assert.strictEqual(L.hint(st), null);
});

test('random playouts keep every state valid (52 cards, once each)', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const st = L.newGame(seed % 2 ? 1 : 3, seed * 31);
    let rnd = seed;
    const rand = () => { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd / 0x7fffffff; };
    for (let step = 0; step < 300 && !L.isWon(st); step++) {
      const ms = L.legalMoves(st, { foundation: true, all: true });
      if (ms.length && rand() < 0.8) { const m = ms[Math.floor(rand() * ms.length)]; assert.ok(L.move(st, m.src, m.dest)); }
      else if (L.canDraw(st)) L.drawStock(st);
      assert.ok(L.validState(st), 'invalid after step ' + step + ' seed ' + seed);
      assert.ok(st.score >= 0);
    }
  }
});
