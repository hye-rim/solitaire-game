'use strict';

// 솔리테어(클론다이크): 판 규칙만 모아 둔 파일 (그리기·입력 없음). 브라우저와 테스트(Node)가 같이 쓴다.
//
// - 52장. 7개 열에 1장, 2장 … 7장씩 깔고 각 열의 맨 위 한 장만 앞면. 나머지 24장은 더미(stock)
// - 열 위에는 '색이 다르고 숫자가 1 작은' 카드를 올린다 (빨강 7 위에 검정 6). 앞면인 카드는 묶음으로 옮길 수 있다. 빈 열에는 K만
// - 오른쪽 위 4칸(파운데이션)에 같은 무늬로 A→K 순서로 쌓는다. 4무늬를 모두 K까지 쌓으면 승리
// - 더미를 누르면 1장(쉬움) 또는 3장(보통)을 넘겨 웨이스트에 펼친다. 더미가 비면 웨이스트를 뒤집어 다시 더미로 (무제한)
// - 점수(윈도우 방식): 웨이스트→열 +5, →파운데이션 +10, 뒤집기 +5, 파운데이션→열 -15, 더미 다시 넘기기 -100(1장)/-20(3장)
//
// 카드 번호 0~51: 무늬 = floor(id / 13) (0 ♠ · 1 ♥ · 2 ♣ · 3 ♦), 숫자 = id % 13 + 1 (1 = A … 13 = K)
// 상태(st): { draw, seed, tab:[[id]×7], up:[bool×52], stock:[id], waste:[id], found:[[id]×4 (무늬별)], score, moves, passes }
const LOGIC_SOL = (() => {
const TAB = 7, DECK = 52, KING = 13;
const sOf = (id) => Math.floor(id / 13), rOf = (id) => (id % 13) + 1;
const isRed = (id) => { const s = sOf(id); return s === 1 || s === 3; };

function rng(seed) {                                     // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(seed) {
  const order = Array.from({ length: DECK }, (_, i) => i);
  const rand = rng(seed);
  for (let i = DECK - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order;
}

function newGame(draw = 1, seed = (Math.random() * 2 ** 31) | 0) {
  const order = shuffled(seed);
  const st = { draw, seed, tab: Array.from({ length: TAB }, () => []), up: new Array(DECK).fill(false), stock: [], waste: [], found: [[], [], [], []], score: 0, moves: 0, passes: 0 };
  let p = 0;
  for (let c = 0; c < TAB; c++) {
    for (let i = 0; i <= c; i++) st.tab[c].push(order[p++]);
    st.up[st.tab[c][c]] = true;
  }
  st.stock = order.slice(p);                             // 넘길 때는 맨 뒤에서 꺼낸다
  return st;
}

const topOf = (arr) => arr[arr.length - 1];

// ---- 놓을 수 있는가 ----
function canDropTab(st, id, c) {
  const col = st.tab[c];
  if (!col.length) return rOf(id) === KING;
  const t = topOf(col);
  return st.up[t] && isRed(t) !== isRed(id) && rOf(t) === rOf(id) + 1;
}
function canDropFound(st, id) {
  const pile = st.found[sOf(id)];
  return rOf(id) === pile.length + 1;                    // 무늬별 칸: A부터 차례로
}

// ---- 옮기기 ----
// src: { k:'t', c, i } 열 c 의 i 번째부터 끝까지 · { k:'w' } 웨이스트 맨 위 · { k:'f', s } 파운데이션 s 의 맨 위
// dest: { k:'t', c } · { k:'f' } (파운데이션은 카드의 무늬 칸으로 간다)
function cardsOf(st, src) {
  if (src.k === 't') { const col = st.tab[src.c]; return src.i >= 0 && src.i < col.length && st.up[col[src.i]] ? col.slice(src.i) : null; }
  if (src.k === 'w') return st.waste.length ? [topOf(st.waste)] : null;
  if (src.k === 'f') { const p = st.found[src.s]; return p && p.length ? [topOf(p)] : null; }
  return null;
}
function canMove(st, src, dest) {
  const cs = cardsOf(st, src);
  if (!cs) return false;
  if (dest.k === 'f') return cs.length === 1 && src.k !== 'f' && canDropFound(st, cs[0]);
  if (src.k === 't' && src.c === dest.c) return false;
  return canDropTab(st, cs[0], dest.c);
}
function flipTop(st, c) {
  const col = st.tab[c];
  if (col.length && !st.up[topOf(col)]) { st.up[topOf(col)] = true; return true; }
  return false;
}
const bump = (st, n) => { st.score = Math.max(0, st.score + n); };

// 돌려주는 값: { cards, flipped, gain } (안 되면 null)
function move(st, src, dest) {
  if (!canMove(st, src, dest)) return null;
  const cs = cardsOf(st, src);
  let gain = 0, flipped = false;
  if (src.k === 't') st.tab[src.c].splice(src.i);
  else if (src.k === 'w') st.waste.pop();
  else st.found[src.s].pop();
  if (dest.k === 'f') st.found[sOf(cs[0])].push(cs[0]); else st.tab[dest.c].push(...cs);
  if (src.k === 'w') gain += dest.k === 'f' ? 10 : 5;
  else if (src.k === 't') { if (dest.k === 'f') gain += 10; flipped = flipTop(st, src.c); if (flipped) gain += 5; }
  else gain -= 15;
  bump(st, gain); st.moves++;
  return { cards: cs, flipped, gain };
}

// ---- 더미 ----
const canDraw = (st) => st.stock.length > 0 || st.waste.length > 0;
// 더미에서 넘긴다. 더미가 비었으면 웨이스트를 뒤집어 더미로. 돌려주는 값: { drawn:[id], recycled } (안 되면 null)
function drawStock(st) {
  if (st.stock.length) {
    const n = Math.min(st.draw, st.stock.length), drawn = [];
    for (let i = 0; i < n; i++) { const id = st.stock.pop(); st.up[id] = true; st.waste.push(id); drawn.push(id); }
    st.moves++;
    return { drawn, recycled: false };
  }
  if (st.waste.length) {
    st.stock = st.waste.slice().reverse(); st.waste = [];
    for (const id of st.stock) st.up[id] = false;
    st.passes++; st.moves++;
    bump(st, st.draw === 1 ? -100 : -20);
    return { drawn: [], recycled: true };
  }
  return null;
}

// ---- 지금 할 수 있는 옮기기 ----
// 힌트와 '막혔는지' 판정에는 의미 있는 옮기기만 쓴다: 파운데이션·웨이스트에서 오는 것, 뒷면 카드를 드러내거나 열을 비우는 것,
// 이어진 묶음의 일부를 떼어 낼 땐 아래 카드가 파운데이션으로 올라갈 수 있을 때만. (같은 묶음을 이 열에서 저 열로 되풀이해 옮기는 걸 막는다)
function isUseful(st, m) {
  if (m.dest.k === 'f' || m.src.k !== 't') return true;
  const col = st.tab[m.src.c], firstUp = col.findIndex((x) => st.up[x]);
  if (m.src.i === firstUp) return firstUp > 0 || st.tab[m.dest.c].length > 0;     // 뒷면이 드러남 · 열이 통째로 빔
  return canDropFound(st, col[m.src.i - 1]);
}
// opts.all 이면 규칙상 가능한 모든 옮기기, opts.foundation 이면 파운데이션에서 열로 내리는 것도
function legalMoves(st, opts = {}) {
  const out = [];
  const add = (src, dest) => { if (canMove(st, src, dest)) out.push({ src, dest }); };
  if (st.waste.length) {
    add({ k: 'w' }, { k: 'f' });
    for (let c = 0; c < TAB; c++) add({ k: 'w' }, { k: 't', c });
  }
  for (let c = 0; c < TAB; c++) {
    const col = st.tab[c];
    if (!col.length) continue;
    let firstUp = col.findIndex((id) => st.up[id]);
    add({ k: 't', c, i: col.length - 1 }, { k: 'f' });
    for (let i = firstUp; i < col.length; i++) {
      for (let d = 0; d < TAB; d++) {
        if (d === c || !canMove(st, { k: 't', c, i }, { k: 't', c: d })) continue;
        if (!col.length || (i === 0 && rOf(col[0]) === KING && !st.tab[d].length)) continue;   // 맨 아래 K 를 빈 열로 옮기는 건 의미 없다
        out.push({ src: { k: 't', c, i }, dest: { k: 't', c: d } });
      }
    }
  }
  if (opts.foundation) for (let s = 0; s < 4; s++) for (let c = 0; c < TAB; c++) add({ k: 'f', s }, { k: 't', c });
  return opts.all ? out : out.filter((m) => isUseful(st, m));
}

// 옮기기의 좋고 나쁨 (힌트와 탭 자동 이동이 고른다)
function rate(st, m) {
  let s = 0;
  if (m.dest.k === 'f') return 100 + (m.src.k === 't' && m.src.i > 0 && !st.up[st.tab[m.src.c][m.src.i - 1]] ? 20 : 0);
  if (m.src.k === 't') {
    const col = st.tab[m.src.c];
    if (m.src.i > 0 && !st.up[col[m.src.i - 1]]) s += 60;               // 뒤집힌 카드가 드러난다
    else if (m.src.i === 0) s += st.tab[m.dest.c].length ? 25 : -5;      // 열이 통째로 비면 새 자리
    else s -= 8;                                                         // 이미 이어진 묶음을 쪼갠다
  } else if (m.src.k === 'w') s += 30;
  if (!st.tab[m.dest.c].length) s -= 10;                                 // 빈 열은 K 를 위해 아낀다
  return s;
}
function bestMove(st, filter) {
  let best = null, bs = -Infinity;
  for (const m of legalMoves(st)) {
    if (filter && !filter(m)) continue;
    const s = rate(st, m);
    if (s > bs) { bs = s; best = m; }
  }
  return best;
}
// 이 카드(들)를 옮길 가장 좋은 곳 (탭 자동 이동). 없으면 null
function bestDest(st, src) {
  const cs = cardsOf(st, src);
  if (!cs) return null;
  if (src.k === 'f') {
    for (let c = 0; c < TAB; c++) if (canMove(st, src, { k: 't', c })) return { k: 't', c };
    return null;
  }
  const pool = [];
  if (cs.length === 1 && canMove(st, src, { k: 'f' })) pool.push({ src, dest: { k: 'f' } });
  for (let c = 0; c < TAB; c++) if (canMove(st, src, { k: 't', c })) pool.push({ src, dest: { k: 't', c } });
  let best = null, bs = -Infinity;
  for (const m of pool) { const s = rate(st, m); if (s > bs) { bs = s; best = m; } }
  return best ? best.dest : null;
}

// 힌트: 옮길 수 있으면 { type:'move', src, dest }, 더미를 넘길 수 있으면 { type:'draw' }, 아무것도 없으면 null
function hint(st) {
  const m = bestMove(st);
  if (m && rate(st, m) > -5) return { type: 'move', ...m };
  if (canDraw(st) && stockOrWastePlayable(st)) return { type: 'draw' };
  if (m) return { type: 'move', ...m };
  return null;                                                              // 더 옮길 것도, 넘겨서 나올 것도 없다 (더미만 계속 넘기라고 권하지 않는다)
}
// 더미를 계속 넘기다 보면 웨이스트 맨 위에 놓을 수 있는 카드가 나오는가. 실제로 넘겨 보는 것처럼 따라가 본다.
// (3장씩 넘기면 맨 위에 올라오는 건 3장째마다뿐이라, 더미 어딘가에 놓을 수 있는 카드가 '있기만' 해서는 영영 안 나올 수 있다.
//  열은 안 바뀌니 한 바퀴만 돌아보면 충분하다)
function stockOrWastePlayable(st) {
  const playable = (id) => {
    if (canDropFound(st, id)) return true;
    for (let c = 0; c < TAB; c++) if (canDropTab(st, id, c)) return true;
    return false;
  };
  let stock = st.stock.slice(), waste = st.waste.slice();
  if (waste.length && playable(waste[waste.length - 1])) return true;
  let recycled = 0;
  for (let guard = 0; guard < 2 * (stock.length + waste.length) + 4; guard++) {
    if (!stock.length) {
      if (!waste.length || recycled >= 2) return false;
      stock = waste.slice().reverse(); waste = []; recycled++;
      continue;
    }
    const n = Math.min(st.draw, stock.length);
    for (let i = 0; i < n; i++) waste.push(stock.pop());
    if (playable(waste[waste.length - 1])) return true;
  }
  return false;
}

const isWon = (st) => st.found.every((p) => p.length === KING);
// 더 할 수 있는 게 없다: 쓸 만한 옮기기도, 넘겨서 나올 카드도 없다
const isStuck = (st) => !isWon(st) && legalMoves(st).length === 0 && !stockOrWastePlayable(st);

// 자동 마무리: 뒷면 카드와 더미·웨이스트가 모두 없으면 나머지는 파운데이션으로 올리기만 하면 된다
const canAutoFinish = (st) => !isWon(st) && st.stock.length === 0 && st.waste.length === 0 && st.tab.every((col) => col.every((id) => st.up[id]));
// 파운데이션으로 올릴 수 있는 가장 낮은 카드를 한 장 올린다
function autoStep(st) {
  let best = null;
  for (let c = 0; c < TAB; c++) { const col = st.tab[c]; if (col.length && canDropFound(st, topOf(col)) && (!best || rOf(topOf(col)) < best.r)) best = { src: { k: 't', c, i: col.length - 1 }, r: rOf(topOf(col)) }; }
  if (st.waste.length && canDropFound(st, topOf(st.waste)) && (!best || rOf(topOf(st.waste)) < best.r)) best = { src: { k: 'w' }, r: rOf(topOf(st.waste)) };
  return best ? move(st, best.src, { k: 'f' }) : null;
}

// 되돌리기용 복사본
const snapshot = (st) => ({ tab: st.tab.map((c) => c.slice()), up: st.up.slice(), stock: st.stock.slice(), waste: st.waste.slice(), found: st.found.map((p) => p.slice()), score: st.score, moves: st.moves, passes: st.passes });
function restore(st, snap) {
  st.tab = snap.tab.map((c) => c.slice()); st.up = snap.up.slice(); st.stock = snap.stock.slice(); st.waste = snap.waste.slice();
  st.found = snap.found.map((p) => p.slice()); st.score = snap.score; st.moves = snap.moves; st.passes = snap.passes;
}

// 저장·불러오기 (이어하기)
const serialize = (st) => ({ draw: st.draw, seed: st.seed, tab: st.tab, up: st.up.map((u) => (u ? 1 : 0)), stock: st.stock, waste: st.waste, found: st.found, score: st.score, moves: st.moves, passes: st.passes });
function deserialize(o) {
  try {
    const st = { draw: o.draw === 3 ? 3 : 1, seed: o.seed, tab: o.tab, up: o.up.map((u) => !!u), stock: o.stock, waste: o.waste, found: o.found, score: Number(o.score) || 0, moves: Number(o.moves) || 0, passes: Number(o.passes) || 0 };
    return validState(st) ? st : null;
  } catch (_) { return null; }
}
// 상태가 앞뒤가 맞는가 (52장이 한 번씩, 뒷면은 열의 아래쪽에만, 더미는 뒷면·웨이스트는 앞면, 파운데이션은 무늬별 A부터)
function validState(st) {
  if (!Array.isArray(st.tab) || st.tab.length !== TAB || !Array.isArray(st.found) || st.found.length !== 4 || st.up.length !== DECK) return false;
  const seen = new Set();
  const add = (id) => { if (!Number.isInteger(id) || id < 0 || id >= DECK || seen.has(id)) return false; seen.add(id); return true; };
  for (const col of st.tab) {
    if (!Array.isArray(col)) return false;
    let faceUp = false;
    for (const id of col) { if (!add(id)) return false; if (st.up[id]) faceUp = true; else if (faceUp) return false; }
    if (col.length && !st.up[topOf(col)]) return false;
  }
  for (const id of st.stock) { if (!add(id) || st.up[id]) return false; }
  for (const id of st.waste) { if (!add(id) || !st.up[id]) return false; }
  for (let s = 0; s < 4; s++) {
    if (!Array.isArray(st.found[s])) return false;
    for (let i = 0; i < st.found[s].length; i++) { const id = st.found[s][i]; if (!add(id) || sOf(id) !== s || rOf(id) !== i + 1 || !st.up[id]) return false; }
  }
  return seen.size === DECK;
}

return { TAB, DECK, KING, sOf, rOf, isRed, shuffled, newGame, canDropTab, canDropFound, cardsOf, canMove, move, canDraw, drawStock, legalMoves, rate, bestMove, bestDest, hint, stockOrWastePlayable, isWon, isStuck, canAutoFinish, autoStep, snapshot, restore, serialize, deserialize, validState };
})();
if (typeof module !== 'undefined') module.exports = LOGIC_SOL;
