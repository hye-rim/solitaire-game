'use strict';
// 풀이 도구: 한 장씩 넘기고 더미를 무제한 다시 넘길 수 있을 때 이 판이 풀리는지 깊이 우선 탐색으로 확인한다.
// 더미·웨이스트는 계속 넘길 수 있으니 '언제든 아무 카드나 꺼낼 수 있는 주머니'로 다룬다. (게임 화면에는 들어가지 않는다)
const L = require('../logic.js');
const { sOf, rOf, isRed } = L;

function solve(seed, maxNodes = 20000) {
  const st = L.newGame(1, seed);
  const tab = st.tab.map((c) => c.slice());
  const upN = st.tab.map((c) => c.length ? 1 : 0);                 // 앞면 장수(맨 위부터)
  const found = [0, 0, 0, 0];
  const ring = new Set(st.stock);
  let nodes = 0;
  const path = [];
  const visited = new Set();
  const key = () => tab.map((c, i) => c.join(',') + ':' + upN[i]).join('|') + '#' + found.join('') + '#' + [...ring].sort((a, b) => a - b).join(',');
  const canTab = (id, d) => {
    const col = tab[d];
    if (!col.length) return rOf(id) === 13;
    const t = col[col.length - 1];
    return isRed(t) !== isRed(id) && rOf(t) === rOf(id) + 1;     // 맨 위는 항상 앞면
  };
  const canFound = (id) => rOf(id) === found[sOf(id)] + 1;

  function dfs() {
    if (found[0] + found[1] + found[2] + found[3] === 52) return true;
    if (++nodes > maxNodes) return false;
    const k = key(); if (visited.has(k)) return false; visited.add(k);
    const moves = [];
    // 파운데이션
    for (let c = 0; c < 7; c++) { const col = tab[c]; if (col.length && canFound(col[col.length - 1])) moves.push({ pr: 100 + (upN[c] === 1 && col.length > 1 ? 20 : 0), t: 'tf', c }); }
    for (const id of ring) if (canFound(id)) moves.push({ pr: 95, t: 'rf', id });
    // 열 → 열 (앞면 묶음 통째로, 또는 맨 위 한 장)
    for (let c = 0; c < 7; c++) {
      const col = tab[c]; if (!col.length) continue;
      const first = col.length - upN[c];
      for (const i of first === col.length - 1 ? [first] : [first, col.length - 1]) {
        for (let d = 0; d < 7; d++) {
          if (d === c || !canTab(col[i], d)) continue;
          if (i === 0 && !tab[d].length) continue;                       // 맨 아래 K 를 빈 열로: 의미 없음
          const reveal = i === first && first > 0;
          moves.push({ pr: reveal ? 80 : i === 0 ? 70 : 20, t: 'tt', c, i, d });
        }
      }
    }
    // 주머니 → 열
    for (const id of ring) for (let d = 0; d < 7; d++) if (canTab(id, d)) moves.push({ pr: 50 + (tab[d].length ? 5 : -5), t: 'rt', id, d });
    moves.sort((a, b) => b.pr - a.pr);
    for (const m of moves) {
      path.push(m);
      if (m.t === 'tf') {
        const col = tab[m.c], id = col.pop(); found[sOf(id)]++; const wasUp = upN[m.c]; if (upN[m.c] > 0) upN[m.c]--; let flipped = false; if (col.length && upN[m.c] === 0) { upN[m.c] = 1; flipped = true; }
        if (dfs()) return true;
        upN[m.c] = wasUp; found[sOf(id)]--; col.push(id);
      } else if (m.t === 'rf') {
        ring.delete(m.id); found[sOf(m.id)]++;
        if (dfs()) return true;
        found[sOf(m.id)]--; ring.add(m.id);
      } else if (m.t === 'tt') {
        const col = tab[m.c], moved = col.splice(m.i); const n = moved.length; const wasUp = upN[m.c];
        upN[m.c] -= n; let flipped = false; if (col.length && upN[m.c] === 0) { upN[m.c] = 1; flipped = true; }
        tab[m.d].push(...moved); upN[m.d] += n;
        if (dfs()) return true;
        upN[m.d] -= n; tab[m.d].splice(tab[m.d].length - n); col.push(...moved); upN[m.c] = wasUp;
      } else {
        ring.delete(m.id); tab[m.d].push(m.id); upN[m.d]++;
        if (dfs()) return true;
        upN[m.d]--; tab[m.d].pop(); ring.add(m.id);
      }
      path.pop();
      if (nodes > maxNodes) return false;
    }
    return false;
  }
  const ok = dfs();
  return { ok, nodes, path: ok ? path.map((m) => ({ ...m })) : null };
}
module.exports = { solve };
