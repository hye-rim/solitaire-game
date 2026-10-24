'use strict';
// 3장씩 판 목록(SOLVABLE_SEEDS_3) 중 풀이가 쉬운 판만 골라 seeds.js 의 EASY_SEEDS_3 에 넣는다: node tools/pick-easy.js
const { solve3 } = require('./solver.js');
const { replay } = require('./verify.js');
const { read, write, EASY_NODES } = require('./seedfile.js');
const cur = read();
const easy = cur.three.filter((s) => { const r = solve3(s, EASY_NODES); return r.ok && replay(s, r.path, 3) === 'won'; });
write({ ...cur, easy });
console.log(`3장씩 쉬운 판 ${easy.length}/${cur.three.length} (${EASY_NODES}노드 이내)`);
