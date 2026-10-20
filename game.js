'use strict';

// 솔리테어(클론다이크): 화면·입력·흐름. 판 규칙은 logic.js (LOGIC_SOL) 에 있다.
(() => {
const L = LOGIC_SOL;
const $ = (id) => document.getElementById(id);
const board = $('board'), colEl = $('col');

const SUIT = ['♠', '♥', '♣', '♦'];
const RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RED = '#e8324f', BLACK = '#2b1d52';
const SAVE_KEY = 'solitaireSave';
const MODE_NAME = { 1: '1장씩 · 쉬움', 3: '3장씩 · 보통' };
const MODE_ICON = { 1: '🂡', 3: '🂡🂡🂡' };

// ---------- 저장소 ----------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  del(k) { try { localStorage.removeItem(k); } catch (_) {} },
};
const best = { 1: Number(store.get('solitaireBest1')) || 0, 3: Number(store.get('solitaireBest3')) || 0 };

// ---------- 소리 ----------
let audio = null;
let muted = store.get('solitaireMuted') === '1';
function tone(freq, dur, type = 'sine', vol = 0.09, slide = 0) {
  if (muted) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + dur);
  } catch (_) {}
}
const seq = (notes, step, type = 'triangle', vol = 0.09) => notes.forEach((f, i) => setTimeout(() => tone(f, step * 0.0009, type, vol), i * step));
const sfx = {
  pick: () => tone(620, 0.05, 'triangle', 0.06),
  place: () => tone(330, 0.07, 'sine', 0.1, 120),
  flip: () => tone(500, 0.06, 'triangle', 0.07, 160),
  found: (n) => tone(520 + n * 28, 0.1, 'triangle', 0.09, 200),
  draw: () => tone(280, 0.05, 'triangle', 0.07, 90),
  deal: () => { for (let i = 0; i < 6; i++) setTimeout(() => tone(260 + i * 45, 0.05, 'triangle', 0.06), i * 55); },
  nope: () => tone(190, 0.12, 'square', 0.05, -50),
  undo: () => tone(440, 0.09, 'sine', 0.08, -160),
  win: () => seq([523, 659, 784, 1047, 784, 1047, 1319], 120, 'square', 0.06),
  hint: () => tone(880, 0.12, 'sine', 0.07, 260),
};

// ---------- 상태 ----------
let st = null, hist = [], mode = 1;
let elapsed = 0, hudClock = 0, playing = false, paused = false, won = false, busy = false;
let drag = null, hintTimer = null, dealTimer = null, autoTimer = null;
let M = {};                               // 배치 치수
let lastPos = [];                         // id -> 마지막으로 놓은 자리 {x,y}
const els = [];                           // id -> 카드 요소
let colSlots = [], foundSlots = [], stockSlot = null, wasteSlot = null;

// ---------- 배치 ----------
function metrics() {
  const W = board.clientWidth, H = board.clientHeight;
  const small = W < 520;
  const gap = small ? 3 : Math.max(5, Math.round(W * 0.012)), padX = small ? 3 : Math.max(6, Math.round(W * 0.015));
  const cw = Math.floor((W - padX * 2 - gap * 6) / 7), ch = Math.round(cw * (small ? 1.5 : 1.42));
  M = { W, H, gap, padX, cw, ch, small, top: 8, tabTop: 8 + ch + 12 };
  board.style.setProperty('--cw', cw + 'px');
  board.style.setProperty('--ch', ch + 'px');
}
const colX = (c) => M.padX + c * (M.cw + M.gap);

function buildSlots() {
  board.querySelectorAll('.slot').forEach((e) => e.remove());
  colSlots = []; foundSlots = [];
  const mk = (cls, html = '') => { const e = document.createElement('div'); e.className = 'slot ' + cls; e.innerHTML = html; board.appendChild(e); return e; };
  for (let c = 0; c < 7; c++) colSlots.push(mk('', '<span class="mark">K</span>'));
  for (let s = 0; s < 4; s++) foundSlots.push(mk('mini', `<span class="mark">${SUIT[s]}</span>`));
  stockSlot = mk('mini redo', '<span class="mark">↻</span>');
  wasteSlot = mk('mini');
}
function placeSlots() {
  const put = (e, x, y) => Object.assign(e.style, { left: x + 'px', top: y + 'px', width: M.cw + 'px', height: M.ch + 'px' });
  colSlots.forEach((e, c) => put(e, colX(c), M.tabTop));
  foundSlots.forEach((e, s) => put(e, colX(3 + s), M.top));
  put(stockSlot, colX(0), M.top);
  put(wasteSlot, colX(1), M.top);
}

// 열이 길어지면 카드가 겹치는 간격을 줄인다
function offsets() {
  const avail = M.H - M.tabTop - 6;
  let up = Math.round(M.ch * 0.36), down = Math.max(5, Math.round(M.ch * 0.13));
  const need = (u, d) => Math.max(...st.tab.map((col) => col.reduce((s, id, i) => (i === col.length - 1 ? s + M.ch : s + (st.up[id] ? u : d)), 0)));
  const n0 = need(up, down);
  if (n0 > avail) {
    const f = Math.max(0.3, (avail - M.ch) / (n0 - M.ch));
    up = Math.max(Math.round(M.ch * 0.2), Math.round(up * f)); down = Math.max(3, Math.round(down * f));
  }
  return { up, down };
}

function targets() {
  const { up, down } = offsets();
  const out = new Array(L.DECK);
  st.tab.forEach((col, c) => {
    let y = M.tabTop;
    col.forEach((id, i) => { out[id] = { x: colX(c), y, z: 10 + i, up: st.up[id], vis: true }; y += st.up[id] ? up : down; });
  });
  st.stock.forEach((id, j) => { out[id] = { x: colX(0), y: M.top, z: 1 + j, up: false, vis: j >= st.stock.length - 2 }; });
  const fan = st.draw === 3 ? Math.round(M.cw * 0.3) : 0, shown = st.draw === 3 ? 3 : 1;
  st.waste.forEach((id, j) => {
    const k = j - (st.waste.length - Math.min(shown, st.waste.length));          // 보이는 카드 중 몇 번째 (음수면 안 보임)
    out[id] = { x: colX(1) + Math.max(0, k) * fan, y: M.top, z: 5 + j, up: true, vis: k >= 0 };
  });
  st.found.forEach((pile, s) => pile.forEach((id, i) => { out[id] = { x: colX(3 + s), y: M.top, z: 5 + i, up: true, vis: i >= pile.length - 1 }; }));
  return out;
}

function render() {
  if (!st) return;
  const t = targets();
  const dragging = drag && drag.started ? new Set(drag.ids) : null;
  for (let id = 0; id < L.DECK; id++) {
    const el = els[id], p = t[id];
    if (!p) continue;
    lastPos[id] = p;
    if (dragging && dragging.has(id)) continue;
    el.style.transform = `translate3d(${p.x}px,${p.y}px,0)`;
    el.style.zIndex = p.z;
    el.style.opacity = p.vis ? 1 : 0;
    el.classList.toggle('up', p.up);
  }
  colSlots.forEach((e, c) => { e.style.visibility = st.tab[c].length ? 'hidden' : 'visible'; });
  foundSlots.forEach((e, s) => { e.style.visibility = st.found[s].length ? 'hidden' : 'visible'; });
  stockSlot.style.visibility = st.stock.length ? 'hidden' : 'visible';
  stockSlot.classList.toggle('redo', !st.stock.length && st.waste.length > 0);
  stockSlot.firstChild.style.visibility = !st.stock.length && st.waste.length ? 'visible' : 'hidden';
  updateBar();
}

function buildCards() {
  els.forEach((e) => e && e.remove());
  els.length = 0;
  for (let id = 0; id < L.DECK; id++) {
    const s = L.sOf(id), r = L.rOf(id);
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.id = id;
    el.style.color = L.isRed(id) ? RED : BLACK;
    el.style.transformOrigin = '0 0';
    el.innerHTML = `<div class="face"><div class="tl"><b>${RANK[r]}</b><i>${SUIT[s]}</i></div><div class="br">${SUIT[s]}</div></div><div class="back"></div>`;
    board.appendChild(el);
    els[id] = el;
  }
}

function fit() {
  const maxW = innerWidth <= 520 ? innerWidth : Math.min(innerWidth - 16, 640);
  colEl.style.width = maxW + 'px';
  const used = $('hud').offsetHeight + $('bar').offsetHeight + 8;
  board.style.height = Math.max(320, innerHeight - 16 - used - 14) + 'px';
  metrics();
  if (!stockSlot) buildSlots();
  placeSlots();
  render();
}
addEventListener('resize', fit);

// ---------- 화면 표시 ----------
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function updateHud() {
  $('score').textContent = st ? st.score.toLocaleString() : '0';
  $('moves').textContent = st ? st.moves : 0;
  $('time').textContent = fmtTime(elapsed);
}
function updateBar() {
  $('undoBtn').disabled = !hist.length || won || busy;
  $('hintBtn').disabled = won || !playing || busy;
  $('autoBtn').hidden = !(st && playing && !won && L.canAutoFinish(st));
}
let toastT = null;
function toast(msg, ms = 1800) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms);
}
function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 350); }

function clearHint() {
  clearTimeout(hintTimer);
  board.querySelectorAll('.card.hint').forEach((e) => e.classList.remove('hint'));
  board.querySelectorAll('.slot.hint, .slot.stockhint').forEach((e) => e.classList.remove('hint', 'stockhint'));
}
function showHint() {
  if (!st || won || !playing || busy) return;
  const h = L.hint(st);
  clearHint();
  if (!h) { toast('움직일 수 있는 카드가 없어요'); sfx.nope(); return; }
  sfx.hint();
  if (h.type === 'draw') {
    toast(st.stock.length ? '더미를 눌러 카드를 넘겨요 (왼쪽 위)' : '웨이스트를 다시 더미로 뒤집어요 (왼쪽 위)');
    if (st.stock.length) els[st.stock[st.stock.length - 1]].classList.add('hint'); else stockSlot.classList.add('stockhint');
  } else {
    L.cardsOf(st, h.src).forEach((id) => els[id].classList.add('hint'));
    if (h.dest.k === 'f') {
      const card = L.cardsOf(st, h.src)[0], pile = st.found[L.sOf(card)];
      if (pile.length) els[pile[pile.length - 1]].classList.add('hint'); else foundSlots[L.sOf(card)].classList.add('hint');
    } else if (st.tab[h.dest.c].length) els[st.tab[h.dest.c][st.tab[h.dest.c].length - 1]].classList.add('hint');
    else colSlots[h.dest.c].classList.add('hint');
  }
  hintTimer = setTimeout(clearHint, 3200);
}

// ---------- 행동 ----------
function pushHist() { hist.push(L.snapshot(st)); if (hist.length > 600) hist.shift(); }

function afterAction() {
  clearHint();
  render();
  updateHud();
  save();
  if (L.isWon(st)) return win();
  if (L.isStuck(st)) toast('더 움직일 수 없어요! 되돌리기나 새 게임을 눌러 보세요', 3500);
}

function doMove(src, dest) {
  pushHist();
  const r = L.move(st, src, dest);
  if (!r) { hist.pop(); return false; }
  if (dest.k === 'f') sfx.found(st.found.reduce((s, p) => s + p.length, 0)); else sfx.place();
  if (r.flipped) setTimeout(sfx.flip, 90);
  afterAction();
  return true;
}

function doDraw() {
  if (!st || won || busy) return;
  if (!L.canDraw(st)) { toast('넘길 카드가 없어요'); sfx.nope(); return; }
  pushHist();
  const r = L.drawStock(st);
  sfx.draw();
  if (r.recycled) toast(`다시 넘겨요 (${st.draw === 1 ? '-100' : '-20'}점)`, 1400);
  afterAction();
}

function undo() {
  if (!st || won || !hist.length || busy) return;
  L.restore(st, hist.pop());
  st.moves++;                                             // 되돌리기도 한 번으로 친다
  sfx.undo();
  clearHint(); render(); updateHud(); save();
}

function autoFinish() {
  if (!st || won || busy || !L.canAutoFinish(st)) return;
  busy = true; clearHint(); pushHist(); updateBar();
  const stepOne = () => {
    const r = L.autoStep(st);
    if (!r) { busy = false; afterAction(); return; }
    sfx.found(st.found.reduce((s, p) => s + p.length, 0));
    render(); updateHud();
    autoTimer = setTimeout(stepOne, 85);
  };
  stepOne();
}

// ---------- 끌기·누르기 ----------
function srcOf(id) {
  if (st.stock.includes(id)) return { k: 'stock' };
  if (st.waste.length && st.waste[st.waste.length - 1] === id) return { k: 'w' };
  for (let c = 0; c < 7; c++) { const i = st.tab[c].indexOf(id); if (i >= 0) return st.up[id] ? { k: 't', c, i } : { k: 'down' }; }
  for (let s = 0; s < 4; s++) { const p = st.found[s]; if (p.length && p[p.length - 1] === id) return { k: 'f', s }; }
  return null;
}
board.addEventListener('pointerdown', (e) => {
  if (!st || won || !playing || paused || busy || !$('overlay').classList.contains('hidden')) return;
  const el = e.target.closest('.card');
  if (!el) { if (e.target === stockSlot || stockSlot.contains(e.target)) doDraw(); return; }
  const id = Number(el.dataset.id);
  const src = srcOf(id);
  if (!src || src.k === 'down') return;
  if (src.k === 'stock') { doDraw(); return; }
  try { board.setPointerCapture(e.pointerId); } catch (_) {}
  drag = { pid: e.pointerId, src, ids: L.cardsOf(st, src), sx: e.clientX, sy: e.clientY, started: false };
  sfx.pick();
  clearHint();
});
board.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.pid) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (!drag.started) {
    if (Math.hypot(dx, dy) < 7) return;
    drag.started = true;
    drag.ids.forEach((id, k) => { els[id].classList.add('dragging'); els[id].style.zIndex = 1000 + k; });
  }
  drag.ids.forEach((id) => {
    const p = lastPos[id];
    els[id].style.transform = `translate3d(${p.x + dx}px,${p.y + dy}px,0)`;
  });
  drag.dx = dx; drag.dy = dy;
});
function endDrag(e, cancel) {
  if (!drag || e.pointerId !== drag.pid) return;
  const d = drag; drag = null;
  d.ids.forEach((id) => els[id].classList.remove('dragging'));
  if (!d.started) {
    if (cancel) return;
    // 그냥 누름: 가장 좋은 곳으로 자동 이동
    const to = L.bestDest(st, d.src);
    if (to) doMove(d.src, to);
    else { shake(els[d.ids[0]]); sfx.nope(); toast('옮길 곳이 없어요', 1200); }
    return;
  }
  if (!cancel) {
    const p0 = lastPos[d.ids[0]];
    const cx = p0.x + (d.dx || 0) + M.cw / 2, cy = p0.y + (d.dy || 0) + M.ch / 2;
    // 윗줄(파운데이션 쪽)에 놓았으면 파운데이션
    if (d.ids.length === 1 && cy < M.tabTop - 2 && cx > colX(2) && L.canMove(st, d.src, { k: 'f' })) { if (doMove(d.src, { k: 'f' })) return; }
    // 아니면 가장 가까운 열부터 (놓을 수 있는 열만)
    const near = [0, 1, 2, 3, 4, 5, 6].sort((a, b) => Math.abs(colX(a) + M.cw / 2 - cx) - Math.abs(colX(b) + M.cw / 2 - cx)).slice(0, 3);
    for (const c of near) {
      if (Math.abs(colX(c) + M.cw / 2 - cx) > M.cw * 0.9) continue;
      if (L.canMove(st, d.src, { k: 't', c })) { if (doMove(d.src, { k: 't', c })) return; }
    }
    // 열 위쪽 빈 곳에 놓았어도 파운데이션으로 갈 수 있으면 보낸다
    if (d.ids.length === 1 && cy < M.tabTop + M.ch * 0.5 && L.canMove(st, d.src, { k: 'f' })) { if (doMove(d.src, { k: 'f' })) return; }
    sfx.nope();
  }
  render();          // 제자리로 돌아간다
}
board.addEventListener('pointerup', (e) => endDrag(e, false));
board.addEventListener('pointercancel', (e) => endDrag(e, true));

// ---------- 저장·이어하기 ----------
function save() {
  if (!st || won || !playing) return;                    // 타이틀 뒤의 빈 판은 저장하지 않는다
  store.set(SAVE_KEY, JSON.stringify({ v: 1, st: L.serialize(st), elapsed }));
}
function loadSave() {
  try {
    const o = JSON.parse(store.get(SAVE_KEY) || 'null');
    if (!o || o.v !== 1) return null;
    const s = L.deserialize(o.st);
    if (!s || L.isWon(s)) return null;
    return { st: s, elapsed: Number(o.elapsed) || 0 };
  } catch (_) { return null; }
}

// ---------- 시작·끝 ----------
// 한 장씩 넘기기 기준으로 풀리는 것을 확인한 판 중에서 고른다 (seeds.js)
function pickSeed() {
  const pool = typeof SOLVABLE_SEEDS !== 'undefined' ? SOLVABLE_SEEDS : null;
  return pool && pool.length ? pool[Math.floor(Math.random() * pool.length)] : (Math.random() * 2 ** 31) | 0;
}
function startGame(m, seed) {
  mode = m;
  clearTimeout(autoTimer); busy = false;
  st = L.newGame(m, seed === undefined ? pickSeed() : seed);
  hist = []; elapsed = 0; won = false; playing = true; paused = false;
  buildCards();
  hideOverlay();
  dealIn();
  updateHud(); save();
}
function resumeGame(data) {
  clearTimeout(autoTimer); busy = false;
  st = data.st; mode = st.draw; hist = []; elapsed = data.elapsed; won = false; playing = true; paused = false;
  buildCards();
  hideOverlay();
  metrics(); placeSlots();
  els.forEach((e) => { e.style.transition = 'none'; });
  render();
  void board.offsetWidth;
  els.forEach((e) => { e.style.transition = ''; });
  updateHud();
}
// 처음 깔 때: 더미 자리에서 열마다 차례로 날아간다
function dealIn() {
  metrics(); placeSlots();
  els.forEach((e) => { e.style.transition = 'none'; e.style.transform = `translate3d(${colX(0)}px,${M.top}px,0)`; e.style.opacity = 1; });
  void board.offsetWidth;
  let n = 0;
  for (let r = 0; r < 7; r++) for (let c = r; c < 7; c++) { const id = st.tab[c][r]; if (id !== undefined) els[id].style.transitionDelay = (n++ * 30) + 'ms'; }
  els.forEach((e) => { e.style.transition = ''; });
  render();
  sfx.deal();
  clearTimeout(dealTimer); dealTimer = setTimeout(() => els.forEach((e) => { e.style.transitionDelay = ''; }), 1500);
}

function win() {
  won = true; playing = false; busy = false;
  store.del(SAVE_KEY);
  const secs = Math.max(1, Math.round(elapsed));
  const bonus = Math.floor(700000 / Math.max(30, secs));
  const base = st.score, total = base + bonus;
  const isBest = total > best[mode];
  if (isBest) {
    best[mode] = total; store.set('solitaireBest' + mode, String(total));
    store.set('solitaireBest', String(Math.max(best[1], best[3])));
  }
  updateHud(); render();
  sfx.win();
  // 카드가 우르르 튀어 오르는 연출
  els.forEach((el, id) => { el.style.transitionDelay = (id % 13) * 40 + 'ms'; });
  setTimeout(() => showOverlay(`
    <h2>🎉 승리!</h2>
    <div class="big">${total.toLocaleString()}</div>
    <span class="tag">${isBest ? '🏆 최고 기록!' : `${MODE_NAME[mode]} 최고 ${best[mode].toLocaleString()}`}</span>
    <div class="card2"><dl class="stats">
      <dt>이동</dt><dd>${st.moves}번 → ${base.toLocaleString()}점</dd>
      <dt>걸린 시간</dt><dd>${fmtTime(secs)}</dd>
      <dt>시간 보너스</dt><dd>+${bonus.toLocaleString()}</dd>
    </dl></div>
    <button id="againBtn">새 게임</button>`), 900);
  setTimeout(() => { const b = $('againBtn'); if (b) b.onclick = () => showMenu(false); }, 950);
}

// ---------- 오버레이 ----------
function showOverlay(html) { const o = $('overlay'); o.innerHTML = html; o.classList.remove('hidden'); o.scrollTop = 0; }
function hideOverlay() { $('overlay').classList.add('hidden'); }
function choices(extra = '') {
  return `<div class="choices">${extra}
    ${[1, 3].map((m) => `<button data-mode="${m}">${MODE_ICON[m]} ${MODE_NAME[m]}<small>${best[m] ? '최고 ' + best[m].toLocaleString() : '아직 기록 없음'}</small></button>`).join('')}
  </div>`;
}
function bindChoices() {
  document.querySelectorAll('#overlay [data-mode]').forEach((b) => { b.onclick = () => startGame(Number(b.dataset.mode)); });
  const c = $('contBtn'); if (c) c.onclick = () => { const d = loadSave(); if (d) resumeGame(d); };
  const r = $('restartBtn'); if (r) r.onclick = () => startGame(st.draw, st.seed);
  const x = $('closeBtn'); if (x) x.onclick = () => { hideOverlay(); paused = false; };
}
function showTitle() {
  playing = false;
  const s = loadSave();
  showOverlay(`
    <h1>솔리테어</h1>
    <p>카드를 <b>A부터 K까지</b> 무늬별로 쌓아 올리면 승리!<br>열에서는 <b>색을 번갈아</b> 숫자를 줄여 가며 쌓아요.</p>
    ${choices(s ? `<button id="contBtn">▶ 이어서 하기<small>${MODE_NAME[s.st.draw]} · ${s.st.found.reduce((n, p) => n + p.length, 0)}/52장 · ${fmtTime(s.elapsed)}</small></button>` : '')}
    <div class="card2">
      👆 카드를 누르면 알아서 옮겨요 · 끌어서 옮겨도 돼요<br>
      🔴⚫ 빨강 7 위에는 검정 6 · 빈 열에는 K만<br>
      🂠 왼쪽 위 더미를 눌러 카드를 넘겨요
    </div>`);
  bindChoices();
}
function showMenu(canClose = true) {
  paused = true;
  showOverlay(`
    <h2>새 게임</h2>
    ${choices(st && playing && !won ? '<button id="restartBtn" class="sub">↻ 같은 판 다시 시작</button>' : '')}
    ${canClose && st && !won ? '<button id="closeBtn" class="sub">닫기</button>' : ''}`);
  bindChoices();
}
function pause() {
  if (!playing || paused || busy) return;
  paused = true;
  showOverlay(`<h2>일시정지</h2><button id="closeBtn">계속하기</button>`);
  bindChoices();
}

// ---------- 버튼·키 ----------
$('undoBtn').onclick = undo;
$('hintBtn').onclick = showHint;
$('autoBtn').onclick = autoFinish;
$('newBtn').onclick = () => { if (st && playing && !won) showMenu(true); else showMenu(false); };
$('pauseBtn').onclick = (e) => { e.currentTarget.blur(); if (paused) { hideOverlay(); paused = false; } else pause(); };
function toggleMute() { muted = !muted; store.set('solitaireMuted', muted ? '1' : '0'); $('muteBtn').textContent = muted ? '🔇' : '🔊'; }
$('muteBtn').onclick = (e) => { e.currentTarget.blur(); toggleMute(); };
$('muteBtn').textContent = muted ? '🔇' : '🔊';
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyZ' || e.code === 'KeyU') undo();
  else if (e.code === 'KeyH') showHint();
  else if (e.code === 'KeyA') autoFinish();
  else if (e.code === 'KeyD' || e.code === 'Space') { if ($('overlay').classList.contains('hidden')) { e.preventDefault(); doDraw(); } }
  else if (e.code === 'KeyM') toggleMute();
  else if (e.code === 'KeyP' || e.code === 'Escape') { if (paused) { hideOverlay(); paused = false; } else pause(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);

// ---------- 시계 ----------
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (playing && !paused && !won && !document.hidden) {
    elapsed += dt; hudClock += dt;
    if (hudClock > 0.25) { hudClock = 0; $('time').textContent = fmtTime(elapsed); }
  }
  requestAnimationFrame(tick);
}

// 시작: 타이틀 뒤에 빈 판을 깔아 둔다
st = L.newGame(1, 20241020);
buildCards();
fit();
showTitle();
requestAnimationFrame(tick);

/* @test-hooks:start */
window.__sol = { get st() { return st; }, get hist() { return hist; }, get state() { return { playing, paused, won, elapsed, busy }; }, doMove, doDraw, undo, showHint, startGame, autoFinish, render, fit, get M() { return M; }, els };
/* @test-hooks:end */
})();
