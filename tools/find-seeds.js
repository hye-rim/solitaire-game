'use strict';
// 풀 수 있는 판의 씨앗 목록(seeds.js)을 만든다: node tools/find-seeds.js [개수] [탐색 한도] [1|3 장씩]
// seeds.js 에는 1장씩(SOLVABLE_SEEDS)과 3장씩(SOLVABLE_SEEDS_3) 두 목록이 있고, 고른 쪽만 새로 만든다
const { solve, solve3 } = require('./solver.js');
const { replay } = require('./verify.js');
const { read, write, EASY_NODES } = require('./seedfile.js');
const want = Number(process.argv[2]) || 300, cap = Number(process.argv[3]) || 150000, draw = Number(process.argv[4]) === 3 ? 3 : 1;
const old = read();
const run = draw === 3 ? solve3 : solve;
const seeds = [];
for (let s = 1; seeds.length < want; s++) {
  const r = run(s, cap);
  if (r.ok && replay(s, r.path, draw) === 'won') seeds.push(s);   // 찾은 풀이를 실제 규칙으로 재생해 이긴 판만
}
const one = draw === 1 ? seeds : old.one;
const three = draw === 3 ? seeds : old.three;
// 3장씩 목록이 바뀌었으면 쉬운 판 목록도 새로 고른다
const easy = draw === 3 ? three.filter((s) => { const r = solve3(s, EASY_NODES); return r.ok && replay(s, r.path, 3) === 'won'; }) : old.easy;
write({ one, three, easy });
console.log('done', draw + '장씩', seeds.length, 'last seed', seeds[seeds.length - 1], '| 1장씩', one.length, '3장씩', three.length, '쉬운 3장씩', easy.length);
