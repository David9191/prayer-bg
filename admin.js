// 주기도문 배틀그라운드 — 관리자 화면
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getDatabase, ref, child, set, update, remove, onValue, onChildAdded, push, serverTimestamp, query, orderByChild, limitToLast } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

const FB_CONFIG = {
  apiKey: 'AIzaSyAzkaXXDwG1Zx9HU6ef-f-2GCmRwa3MWG4', authDomain: 'prayer-bg.firebaseapp.com',
  databaseURL: 'https://prayer-bg-default-rtdb.asia-southeast1.firebasedatabase.app', projectId: 'prayer-bg',
  storageBucket: 'prayer-bg.firebasestorage.app', messagingSenderId: '261758048489', appId: '1:261758048489:web:eea951a268ea583f403878',
};
const PIECES = ['부름', '이름', '나라', '뜻', '양식', '용서', '시험', '송영'];
const ZONES = [['감람산', -560, -640], ['왕궁 성채', 560, -640], ['성전 언덕', 0, 0], ['광야', -650, 0], ['시장 거리', 650, 0], ['베들레헴 마을', -560, 630], ['갈릴리 항구', 560, 620], ['대기실', -880, 880]];
const HALF = 1000;
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (ms) => { if (!isFinite(ms)) return '-'; const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

const app = initializeApp(FB_CONFIG);
const auth = getAuth(app);
const db = getDatabase(app);
const room = ref(db, 'rooms/main');
let offset = 0, st = { phase: 'lobby', round: 0, startAt: 0 }, players = {}, pos = {}, drops = {};
// 보급상자 낙하 지점 (게임 코드가 계산한 값과 같아야 함)
const DROP_PTS = [[-430, 420], [30, -300], [560, 30]];
const PLANE_SPD = 70;
function makePlanePath() {
  const a = Math.random() * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a), o = (Math.random() - 0.5) * 700, cx = -dz * o, cz = dx * o;
  return { ax: Math.round(cx - dx * 1350), az: Math.round(cz - dz * 1350), bx: Math.round(cx + dx * 1350), bz: Math.round(cz + dz * 1350) };
}

// ── 로그인: 비밀번호가 맞아야 admins/{uid}에 쓸 수 있음 (DB 규칙에서 검사) ──
async function login() {
  const pw = $('pw').value; $('loginErr').textContent = '';
  if (!pw) return;
  $('loginBtn').disabled = true;
  try {
    const cred = await signInAnonymously(auth);
    await set(ref(db, 'admins/' + cred.user.uid), pw);
    sessionStorage.setItem('pbg_admin', '1');
    start();
  } catch (e) {
    console.warn(e);
    $('loginErr').textContent = /PERMISSION/i.test(String(e)) ? '비밀번호가 틀렸어요.' : '연결에 실패했어요: ' + (e.code || e.message);
  } finally { $('loginBtn').disabled = false; }
}
$('loginBtn').onclick = login;
$('pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });

function start() {
  $('login').classList.add('hidden'); $('app').classList.remove('hidden');
  const url = new URL('./', location.href).href;
  $('url').textContent = url;
  import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm').then((m) => { const QR = m.default || m; const c = document.createElement('canvas'); QR.toCanvas(c, url, { width: 440, margin: 1 }, () => { c.style.width = c.style.height = '100%'; }); c.style.width = c.style.height = '100%'; $('qr').appendChild(c); }).catch(() => ($('qr').textContent = 'QR 생성 실패 — 주소를 직접 알려 주세요'));
  onValue(ref(db, '.info/serverTimeOffset'), (s) => (offset = s.val() || 0));
  onValue(child(room, 'state'), (s) => { st = s.val() || { phase: 'lobby', round: 0, startAt: 0 }; renderPhase(); renderRows(); });
  onValue(child(room, 'players'), (s) => { players = s.val() || {}; renderRows(); });
  onValue(child(room, 'pos'), (s) => { pos = s.val() || {}; });
  onValue(child(room, 'drops'), (s) => { drops = s.val() || {}; renderPhase(); });
  onChildAdded(query(child(room, 'feed'), orderByChild('at'), limitToLast(20)), (s) => { const v = s.val(); if (!v) return; const d = document.createElement('div'); d.innerHTML = v.html; $('feed').prepend(d); });
  requestAnimationFrame(drawLoop);
  setInterval(tick, 250);
}

// ── 게임 진행 버튼 ──
$('bReset').onclick = async () => {
  if (st.phase === 'playing' && !confirm('진행 중인 게임을 지우고 새 판을 열까요?')) return;
  await set(child(room, 'state'), { phase: 'lobby', round: Date.now(), startAt: 0 });
  await Promise.all(['players', 'pos', 'feed', 'kick', 'drops'].map((k) => remove(child(room, k))));
  $('feed').innerHTML = '';
};
$('bStart').onclick = () => update(child(room, 'state'), { phase: 'playing', startAt: serverTimestamp(), round: st.round || Date.now(), plane: makePlanePath() });
$('bDrop').onclick = () => { const n = Object.keys(drops).length + 1; if (n > 3 || st.phase !== 'playing') return; set(child(room, 'drops/' + n), { n, at: serverTimestamp() }); };
$('bWatch').onclick = () => window.open(new URL('./?watch', location.href).href, '_blank');
$('bEnd').onclick = () => { if (confirm('게임을 종료하고 최종 순위를 보여 줄까요?')) update(child(room, 'state'), { phase: 'ended', endAt: serverTimestamp() }); };

function renderPhase() {
  const el = $('phase'), ph = st.phase;
  el.className = ph; el.textContent = ph === 'lobby' ? '대기실 · 입장 중' : ph === 'playing' ? '게임 진행 중' : ph === 'ended' ? '게임 종료' : '-';
  $('bStart').disabled = ph === 'playing'; $('bEnd').disabled = ph !== 'playing';
  const nd = Object.keys(drops).length; $('bDrop').disabled = ph !== 'playing' || nd >= 3; $('bDrop').textContent = `🪂 보급 투하 (${nd}/3)` + (nd === 1 ? ' · 다음은 왕관' : '');
}
function tick() {
  const t = st.phase === 'playing' && st.startAt ? Date.now() + offset - st.startAt : st.phase === 'ended' && st.endAt && st.startAt ? st.endAt - st.startAt : 0;
  $('timer').textContent = fmt(t);
}

// ── 순위표 ──
function list() {
  return Object.entries(players).filter(([, p]) => p && p.round === st.round).map(([uid, p]) => ({ uid, ...p, time: p.cleared && p.clearAt && st.startAt ? p.clearAt - st.startAt : Infinity }))
    .sort((a, b) => (!!b.cleared - !!a.cleared) || (a.cleared ? a.time - b.time : 0) || ((b.count || 0) - (a.count || 0)) || ((a.lastAt || Infinity) - (b.lastAt || Infinity)));
}
function renderRows() {
  const L = list();
  $('rows').innerHTML = L.map((p, i) => `<tr class="${p.online ? '' : 'off'} ${p.cleared ? 'clr' : ''}">
    <td class="rk">${i + 1}</td><td class="nm" title="${esc(p.nick)}">${esc(p.nick)}</td>
    <td><div class="prog">${Array.from({ length: 8 }, (_, k) => `<i class="${k < (p.count || 0) ? 'on' : ''}"></i>`).join('')}</div></td>
    <td class="teko" style="font-size:19px">${p.cleared ? fmt(p.time) : (p.count || 0) + '/8'}</td>
    <td>${Object.values(p.mis || {}).reduce((a, b) => a + (b || 0), 0)}</td><td>${p.genie || 0}</td>
    <td><button class="mini" data-act="nick" data-uid="${p.uid}">이름</button><button class="mini" data-act="kick" data-uid="${p.uid}">퇴장</button></td></tr>`).join('');
  $('cOn').textContent = L.filter((p) => p.online).length;
  $('cClr').textContent = `${L.filter((p) => p.cleared).length}/${L.length}`;
  // 통계
  const mis = Array(9).fill(0); let genie = 0;
  for (const p of L) { genie += p.genie || 0; if (p.mis) for (let k = 1; k <= 8; k++) mis[k] += p.mis[k] || 0; }
  const top = mis.map((v, k) => [k, v]).slice(1).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  $('misTop').innerHTML = top.length ? top.map(([k, v], i) => `<li>${i + 1}. ${k}번 ${PIECES[k - 1]}<b>${v}회</b></li>`).join('') : '<li style="color:#888">아직 없음</li>';
  $('genieSum').textContent = genie;
}
$('rows').addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const uid = b.dataset.uid, p = players[uid]; if (!p) return;
  if (b.dataset.act === 'nick') {
    const n = prompt('새 닉네임 (최대 10자)', p.nick); if (n && n.trim()) await update(child(room, 'players/' + uid), { nick: n.trim().slice(0, 10) });
  } else if (b.dataset.act === 'kick') {
    if (!confirm(`${p.nick}님을 내보낼까요?`)) return;
    await set(child(room, 'kick/' + uid), serverTimestamp());
    await remove(child(room, 'players/' + uid)); await remove(child(room, 'pos/' + uid));
  }
});

// ── 지도 ──
const cv = $('map'), cx = cv.getContext('2d'), mapImg = new Image();
let mapOk = false; mapImg.onload = () => (mapOk = true); mapImg.src = './assets/map.jpg';
function drawLoop() {
  requestAnimationFrame(drawLoop);
  const W = cv.width, k = W / (HALF * 2), P = (x) => (x + HALF) * k;
  cx.fillStyle = '#2b5a6e'; cx.fillRect(0, 0, W, W);
  if (mapOk) cx.drawImage(mapImg, 0, 0, W, W);
  cx.strokeStyle = 'rgba(255,255,255,.12)'; cx.lineWidth = 1;
  for (let g = 0; g <= 8; g++) { const v = g * W / 8; cx.beginPath(); cx.moveTo(v, 0); cx.lineTo(v, W); cx.moveTo(0, v); cx.lineTo(W, v); cx.stroke(); }
  cx.font = '900 15px "Noto Sans KR"'; cx.textAlign = 'center';
  for (const [n, x, z] of ZONES) { cx.fillStyle = 'rgba(0,0,0,.55)'; const w = cx.measureText(n).width + 12; cx.fillRect(P(x) - w / 2, P(z) - 11, w, 20); cx.fillStyle = '#fff'; cx.fillText(n, P(x), P(z) + 4); }
  // 비행기 경로
  if (st.phase === 'playing' && st.plane && st.startAt) {
    const pl = st.plane, Ln = Math.hypot(pl.bx - pl.ax, pl.bz - pl.az), s = Math.max(0, (Date.now() + offset - st.startAt) / 1000) * PLANE_SPD;
    if (s <= Ln) {
      cx.save(); cx.setLineDash([10, 7]); cx.strokeStyle = 'rgba(255,255,255,.85)'; cx.lineWidth = 2.5; cx.beginPath(); cx.moveTo(P(pl.ax), P(pl.az)); cx.lineTo(P(pl.bx), P(pl.bz)); cx.stroke(); cx.restore();
      cx.font = '26px sans-serif'; cx.fillText('✈', P(pl.ax + (pl.bx - pl.ax) * s / Ln), P(pl.az + (pl.bz - pl.az) * s / Ln) + 9);
    }
  }
  // 보급상자
  for (const k in drops) { const pt = DROP_PTS[(k - 1) % 3]; if (!pt) continue; cx.fillStyle = '#e8352a'; cx.strokeStyle = '#fff'; cx.lineWidth = 2.5; cx.beginPath(); cx.arc(P(pt[0]), P(pt[1]), 11, 0, 7); cx.fill(); cx.stroke(); cx.fillStyle = '#fff'; cx.font = '900 13px "Noto Sans KR"'; cx.fillText(k, P(pt[0]), P(pt[1]) + 5); }
  const L = list(), idx = {}; L.forEach((p, i) => (idx[p.uid] = i));
  cx.font = '700 13px "Noto Sans KR"';
  for (const [uid, v] of Object.entries(pos)) {
    const p = players[uid]; if (!p || !v) continue;
    const x = P(v.x), y = P(v.z), r = idx[uid];
    cx.fillStyle = p.cleared ? '#3ecf6a' : r === 0 ? '#ffd24a' : r === 1 ? '#d9d9d9' : r === 2 ? '#d49255' : '#f2a900';
    cx.beginPath(); cx.arc(x, y, 6, 0, 7); cx.fill(); cx.strokeStyle = '#000'; cx.lineWidth = 2; cx.stroke();
    cx.fillStyle = '#fff'; cx.strokeStyle = 'rgba(0,0,0,.8)'; cx.lineWidth = 3; const t = `${p.nick} ${p.cleared ? '✔' : (p.count || 0) + '/8'}`;
    cx.strokeText(t, x, y - 10); cx.fillText(t, x, y - 10);
  }
}
if (sessionStorage.getItem('pbg_admin')) {
  // 새로고침: 이미 로그인한 상태면 바로 들어감 (권한은 DB 규칙이 다시 확인)
  auth.authStateReady().then(() => { if (auth.currentUser) start(); else sessionStorage.removeItem('pbg_admin'); });
}
