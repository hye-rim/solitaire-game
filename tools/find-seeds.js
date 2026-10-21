'use strict';
// 풀 수 있는 판의 씨앗 목록(seeds.js)을 만든다: node tools/find-seeds.js [개수] [탐색 한도] [1|3 장씩]
// seeds.js 에는 1장씩(SOLVABLE_SEEDS)과 3장씩(SOLVABLE_SEEDS_3) 두 목록이 있고, 고른 쪽만 새로 만든다
const fs = require('fs'), path = require('path'), vm = require('vm');
const { solve, solve3 } = require('./solver.js');
const { replay } = require('./verify.js');
const want = Number(process.argv[2]) || 300, cap = Number(process.argv[3]) || 150000, draw = Number(process.argv[4]) === 3 ? 3 : 1;
const file = path.join(__dirname, '..', 'seeds.js');
const old = {};
try { vm.runInNewContext(fs.readFileSync(file, 'utf8').replace(/const (SOLVABLE_SEEDS(?:_3)?)/g, 'this.$1'), old); } catch (_) {}
const run = draw === 3 ? solve3 : solve;
const seeds = [];
for (let s = 1; seeds.length < want; s++) {
  const r = run(s, cap);
  if (r.ok && replay(s, r.path, draw) === 'won') seeds.push(s);   // 찾은 풀이를 실제 규칙으로 재생해 이긴 판만
}
const one = draw === 1 ? seeds : old.SOLVABLE_SEEDS || [];
const three = draw === 3 ? seeds : old.SOLVABLE_SEEDS_3 || [];
const body = `'use strict';
// 끝까지 풀리는 것을 확인한 판의 씨앗 (tools/find-seeds.js 로 만들었다: 풀이 도구가 찾은 풀이를 실제 규칙으로 재생해 이긴 판만)
// 1장씩 넘기기 ${one.length}개
const SOLVABLE_SEEDS = [${one.join(',')}];
// 3장씩 넘기기 ${three.length}개 (웨이스트 맨 위 한 장만 쓸 수 있는 규칙까지 그대로 따져서 풀었다)
const SOLVABLE_SEEDS_3 = [${three.join(',')}];
`;
fs.writeFileSync(file, body);
console.log('done', draw + '장씩', seeds.length, 'last seed', seeds[seeds.length - 1], '| 1장씩', one.length, '3장씩', three.length);
