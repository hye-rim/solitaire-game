'use strict';
// 풀이 검증: solver 가 찾은 풀이를 실제 게임 규칙(logic.js)으로 처음부터 재생해서 정말 이기는지 본다
const L = require('../logic.js');
const { solve, solve3 } = require('./solver.js');

function replay(seed, path, draw = 1) {
  const st = L.newGame(draw, seed);
  const bring = (id) => {                                   // 더미를 넘겨 id 가 웨이스트 맨 위에 오게 한다
    for (let guard = 0; guard < 200; guard++) {
      if (st.waste.length && st.waste[st.waste.length - 1] === id) return true;
      if (!L.drawStock(st)) return false;
    }
    return false;
  };
  const colOf = (id) => st.tab.findIndex((col) => col.includes(id));
  for (const m of path) {
    let r;
    if (m.t === 'tf') { const c = m.c; r = L.move(st, { k: 't', c, i: st.tab[c].length - 1 }, { k: 'f' }); }
    else if (m.t === 'rf' || m.t === 'wf') { if (!bring(m.id)) return 'bring fail'; r = L.move(st, { k: 'w' }, { k: 'f' }); }
    else if (m.t === 'rt' || m.t === 'wt') { if (!bring(m.id)) return 'bring fail'; r = L.move(st, { k: 'w' }, { k: 't', c: m.d }); }
    else { r = L.move(st, { k: 't', c: m.c, i: m.i }, { k: 't', c: m.d }); }
    if (!r) return 'illegal move ' + JSON.stringify(m);
    if (!L.validState(st)) return 'invalid state after ' + JSON.stringify(m);
  }
  return L.isWon(st) ? 'won' : 'not won (found ' + st.found.map((p) => p.length).join(',') + ')';
}
module.exports = { replay };
if (require.main === module) {
  const N = Number(process.argv[2]) || 40, cap = Number(process.argv[3]) || 50000, draw = Number(process.argv[4]) === 3 ? 3 : 1;
  const run = draw === 3 ? solve3 : solve;
  let solved = 0, won = 0; const fails = [];
  for (let s = 1; s <= N; s++) {
    const r = run(s, cap);
    if (!r.ok) continue;
    solved++;
    const out = replay(s, r.path, draw);
    if (out === 'won') won++; else fails.push(s + ': ' + out);
  }
  console.log(`[${draw}장씩] 풀이를 찾은 판 ${solved}/${N}, 그 풀이를 실제 규칙으로 재생해 이긴 판 ${won}/${solved}`, fails.slice(0, 5));
}
