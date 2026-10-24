'use strict';
// seeds.js 읽고 쓰기 (find-seeds.js · pick-easy.js 가 같이 쓴다)
const fs = require('fs'), path = require('path'), vm = require('vm');
const FILE = path.join(__dirname, '..', 'seeds.js');
// 3장씩 '보통'에 쓸 쉬운 판: 풀이 도구가 이 노드 수 안에 푼 판 (전체 중 대략 절반. 이보다 오래 걸리는 판은 더미를 여러 바퀴 돌며 계획해야 해서 어렵다)
const EASY_NODES = 700;

function read() {
  const o = {};
  try { vm.runInNewContext(fs.readFileSync(FILE, 'utf8').replace(/const (SOLVABLE_SEEDS(?:_3)?|EASY_SEEDS_3)/g, 'this.$1'), o); } catch (_) {}
  return { one: o.SOLVABLE_SEEDS || [], three: o.SOLVABLE_SEEDS_3 || [], easy: o.EASY_SEEDS_3 || [] };
}
function write({ one, three, easy }) {
  fs.writeFileSync(FILE, `'use strict';
// 끝까지 풀리는 것을 확인한 판의 씨앗 (tools/find-seeds.js 로 만들었다: 풀이 도구가 찾은 풀이를 실제 규칙으로 재생해 이긴 판만)
// 1장씩 넘기기 ${one.length}개
const SOLVABLE_SEEDS = [${one.join(',')}];
// 3장씩 넘기기 ${three.length}개 (웨이스트 맨 위 한 장만 쓸 수 있는 규칙까지 그대로 따져서 풀었다)
const SOLVABLE_SEEDS_3 = [${three.join(',')}];
// 3장씩 '보통'에서 실제로 나오는 판 ${easy.length}개: 위 목록 중 풀이 도구가 ${EASY_NODES}노드 안에 푼 쉬운 판 (tools/pick-easy.js)
const EASY_SEEDS_3 = [${easy.join(',')}];
`);
}
module.exports = { read, write, EASY_NODES };
