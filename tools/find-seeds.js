'use strict';
// 풀 수 있는 판의 씨앗 목록(seeds.js)을 만든다: node tools/find-seeds.js [개수] [탐색 한도]
const fs = require('fs'), path = require('path');
const { solve } = require('./solver.js');
const { replay } = require('./verify.js');
const want = Number(process.argv[2]) || 300, cap = Number(process.argv[3]) || 150000;
const seeds = [];
for (let s = 1; seeds.length < want; s++) {
  const r = solve(s, cap);
  if (r.ok && replay(s, r.path) === 'won') seeds.push(s);
}
const body = `'use strict';\n// 한 장씩 넘기기 기준으로 끝까지 풀리는 것을 확인한 판의 씨앗 ${seeds.length}개 (tools/find-seeds.js 로 만들었다)\nconst SOLVABLE_SEEDS = [${seeds.join(',')}];\n`;
fs.writeFileSync(path.join(__dirname, '..', 'seeds.js'), body);
console.log('done', seeds.length, 'last seed', seeds[seeds.length - 1]);
