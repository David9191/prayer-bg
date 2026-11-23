// 주기도문 배틀그라운드 — 1단계 (혼자 플레이 버전)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const $ = (id) => document.getElementById(id);
const IS_TOUCH = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
const LOW = IS_TOUCH;
if (IS_TOUCH) document.body.classList.add('touch');

// ───────────────────────── 데이터 ─────────────────────────
const PIECES = [
  { n: 1, name: '부름', verse: '하늘에 계신 우리 아버지여', q: '100문', note: '자녀가 아버지께 나아가듯, 존경과 신뢰로 함께 기도해요' },
  { n: 2, name: '이름', verse: '이름이 거룩히 여김을 받으시오며', q: '101문', note: '하나님이 모든 일에서 영광 받으시기를 구해요' },
  { n: 3, name: '나라', verse: '나라이 임하옵시며', q: '102문', note: '은혜의 나라가 넓어지고, 영광의 나라가 속히 오기를 구해요' },
  { n: 4, name: '뜻', verse: '뜻이 하늘에서 이룬 것 같이 땅에서도 이루어지이다', q: '103문', note: '천사들처럼 하나님의 뜻을 알고 기꺼이 순종하기를 구해요' },
  { n: 5, name: '양식', verse: '오늘날 우리에게 일용할 양식을 주옵시고', q: '104문', note: '필요한 것을 하나님의 선물로 받고, 그 복을 누리기를 구해요' },
  { n: 6, name: '용서', verse: '우리가 우리에게 죄 지은 자를 사하여 준 것 같이 우리 죄를 사하여 주옵시고', q: '105문', note: '그리스도 때문에 용서받고, 우리도 용서하는 사람이 되기를 구해요' },
  { n: 7, name: '시험', verse: '우리를 시험에 들게 하지 마옵시고 다만 악에서 구하옵소서', q: '106문', note: '죄의 시험에서 지켜 주시고, 시험당할 때 건져 주시기를 구해요' },
  { n: 8, name: '송영', verse: '대개 나라와 권세와 영광이 아버지께 영원히 있사옵나이다', q: '107문', note: '기도의 힘은 하나님께만 있음을 고백하며 찬양해요' },
];
const ZONES = {
  olive:  { name: '감람산',     en: 'MOUNT OF OLIVES', x: -560, z: -640, r: 230 },
  palace: { name: '왕궁 성채',  en: 'ROYAL CASTLE',    x: 560,  z: -640, r: 220 },
  temple: { name: '성전 언덕',  en: 'TEMPLE HILL',     x: 0,    z: 0,    r: 210 },
  wild:   { name: '광야',       en: 'WILDERNESS',      x: -650, z: 0,    r: 210 },
  market: { name: '시장 거리',  en: 'MARKET STREET',   x: 650,  z: 0,    r: 190 },
  beth:   { name: '베들레헴 마을', en: 'BETHLEHEM',     x: -560, z: 630,  r: 220 },
  harbor: { name: '갈릴리 항구', en: 'GALILEE HARBOR',  x: 560,  z: 620,  r: 220 },
};
const DIST = {
  1: { olive: 2, palace: 2, temple: 3, wild: 2, market: 2, beth: 2, harbor: 2 },
  2: { olive: 5, palace: 5, temple: 5 },
  3: { olive: 4, palace: 6, temple: 5 },
  4: { olive: 5, palace: 4, temple: 6 },
  5: { market: 4, beth: 7, harbor: 4 },
  6: { market: 4, beth: 5, harbor: 6 },
  7: { wild: 7, market: 4, harbor: 4 },
  8: { olive: 2, palace: 2, temple: 3, wild: 2, market: 2, beth: 2, harbor: 2 },
};
const MSG_GENIE = '이건 하나님이 우리에게 주신 기도가 아닌 것 같은데..?\n다른 걸 찾아보자고!';

// ───────────────────────── 난수 · 노이즈 ─────────────────────────
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry32(20261122);
function hash2(ix, iz) { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1;
}
function fbm(x, z, o) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, z * f); f *= 2; a *= 0.5; } return s; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gauss = (x, z, cx, cz, r) => { const dx = x - cx, dz = z - cz; return Math.exp(-(dx * dx + dz * dz) / (r * r)); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function lerpAngle(a, b, t) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; }

// ───────────────────────── 지형 ─────────────────────────
const SIZE = 2000, HALF = 1000, N = 256, CELL = SIZE / N;
const TOWN_LEVEL = { beth: 7, market: 6, harbor: 4 };
function zoneMask(key, x, z) { const Z = ZONES[key]; const d = Math.hypot(x - Z.x, z - Z.z); return 1 - smooth(Z.r * 0.55, Z.r * 0.95, d); }
function catmull(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
// 요단강: 서쪽 바다 → 동쪽 바다. 북쪽(하나님에 관한 간구)과 남쪽(우리 필요)을 나눈다
const RIVER = catmull([[-1080, 330], [-820, 300], [-600, 345], [-400, 305], [-200, 255], [0, 272], [200, 330], [400, 290], [600, 252], [820, 300], [1080, 265]], 8);
const riverHalfW = (x) => 24 + Math.sin(x * 0.004) * 5;
function riverDist(x, z) {
  if (z < 110 || z > 490) return 1e9;
  let best = 1e9;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const a = RIVER[i], b = RIVER[i + 1];
    if ((a[0] < x - 150 && b[0] < x - 150) || (a[0] > x + 150 && b[0] > x + 150)) continue;
    const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L, 0, 1);
    const d = Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)); if (d < best) best = d;
  }
  return best;
}
function riverZAt(x) { let best = 0, bd = 1e9; for (const p of RIVER) { const d = Math.abs(p[0] - x); if (d < bd) { bd = d; best = p[1]; } } return best; }
function coastT(x, z) {
  const wx = x + fbm(x * 0.0025 + 11, z * 0.0025, 3) * 120, wz = z + fbm(x * 0.0025, z * 0.0025 - 7, 3) * 120;
  const r4 = Math.pow(Math.pow(Math.abs(wx), 4) + Math.pow(Math.abs(wz), 4), 0.25);
  const edge = 880 + fbm(x * 0.004 - 5, z * 0.004 + 9, 3) * 80;
  let zm = 0; for (const k in ZONES) zm = Math.max(zm, zoneMask(k, x, z));
  return smooth(edge - 80, edge + 25, r4) * (1 - 0.9 * zm);
}
const forestDensity = (x, z) => fbm(x * 0.0055 + 40, z * 0.0055, 4);
function rawHeight(x, z) {
  let h = 6 + fbm(x * 0.004 + 3.1, z * 0.004 - 1.7, 5) * 16 + smooth(320, -420, z) * 10;
  h += gauss(x, z, 0, 0, 150) * 112;
  h += gauss(x, z, -560, -640, 190) * 90 * (0.85 + 0.3 * fbm(x * 0.01, z * 0.01, 2));
  h += fbm(x * 0.02, z * 0.02, 3) * 12 * gauss(x, z, -560, -640, 260);
  const dp = Math.hypot(x - 560, z + 640);
  h += (1 - smooth(120, 230, dp)) * 26;
  // 광야: 미라마풍 계단식 메사
  const rw = gauss(x, z, -650, 0, 240);
  if (rw > 0.02) {
    let m = (1 - Math.abs(fbm(x * 0.009, z * 0.009, 4))) * 34 + fbm(x * 0.03, z * 0.03, 2) * 3;
    const t = m / 8, fl = Math.floor(t); m = (fl + smooth(0.75, 1, t - fl)) * 8;
    h = lerp(h, 4 + m, smooth(0.08, 0.6, rw));
  }
  for (const k in TOWN_LEVEL) { const m = zoneMask(k, x, z); h = h * (1 - m) + TOWN_LEVEL[k] * m; }
  const pm = 1 - smooth(60, 95, dp); h = h * (1 - pm) + 38 * pm;
  h = Math.max(h, 2.6 + fbm(x * 0.01, z * 0.01, 2) * 1.2);
  const rd = riverDist(x, z);
  if (rd < 140) { const hw = riverHalfW(x); h = Math.min(h, lerp(h, 2.6, smooth(hw + 70, hw + 10, rd))); h = lerp(h, -5.5, smooth(hw + 5, hw - 7, rd)); }
  const t = coastT(x, z); h = h * (1 - t) - 14 * t;
  const bay = smooth(0.25, 0.6, gauss(x, z, 560, 870, 150)); h = h * (1 - bay) - 10 * bay;
  h = Math.max(h, gauss(x, z, 840, -870, 60) * 16 - 3); // 등대섬
  return h;
}
const HG = new Float32Array((N + 1) * (N + 1));
for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) HG[iz * (N + 1) + ix] = rawHeight(-HALF + ix * CELL, -HALF + iz * CELL);
function terrainH(x, z) {
  const fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  if (ix < 0 || iz < 0 || ix >= N || iz >= N) return -14;
  const tx = fx - ix, tz = fz - iz, W = N + 1;
  const a = HG[iz * W + ix], b = HG[(iz + 1) * W + ix], d = HG[iz * W + ix + 1], c = HG[(iz + 1) * W + ix + 1];
  if (tx + tz <= 1) return a + (d - a) * tx + (b - a) * tz;
  return c + (b - c) * (1 - tx) + (d - c) * (1 - tz);
}

// ───────────────────────── 도로망 · 다리 ─────────────────────────
const ROADS = [];   // { ctrl, w, kind, trees, pts }
const BRIDGES = []; // { x, zr, z0, z1, y }
function addRoad(ctrl, w = 7.5, kind = 'asphalt', trees = false) { ROADS.push({ ctrl, w, kind, trees, pts: catmull(ctrl, 3) }); }
function bridgeAt(x) { const zr = riverZAt(x); BRIDGES.push({ x, zr }); return [[x, zr + 85], [x, zr + 40], [x, zr - 40], [x, zr - 85]]; }
function defineRoads() {
  addRoad([[-560, 600], [-490, 505], [-410, 440], ...bridgeAt(-350), [-375, 150], [-470, 60], [-590, -90], [-630, -280], [-570, -470]], 7.5, 'asphalt', true);
  addRoad([[560, 590], [520, 485], [455, 420], ...bridgeAt(430), [455, 160], [540, 40], [640, -140], [640, -340], [585, -530], [560, -585]], 7.5, 'asphalt', true);
  addRoad([[-430, 612], [-220, 562], [0, 532], [220, 562], [430, 602]], 7.5, 'asphalt', true);
  addRoad([[0, 532], [25, 455], ...bridgeAt(40), [40, 185], [12, 150]], 6.5);
  addRoad([[-570, -470], [-400, -432], [-200, -332], [0, -302], [200, -352], [420, -472], [585, -530]], 7, 'asphalt', true);
  addRoad([[0, -302], [0, -225], [0, -150]], 6);
  addRoad([[-470, 60], [-330, 10], [-170, -15]], 5, 'dirt');
  addRoad([[840, 5], [650, 0], [480, 10], [300, 0], [170, -10]], 7);
}
function defineAlleys() {
  const spec = { beth: 6, harbor: 4, market: 3 };
  for (const [key, n] of Object.entries(spec)) {
    const Z = ZONES[key];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng() * 0.5, dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx, j = (rng() - 0.5) * 40;
      const p1 = [Z.x + dx * 14, Z.z + dz * 14], p2 = [Z.x + dx * Z.r * 0.45 + px * j, Z.z + dz * Z.r * 0.45 + pz * j], p3 = [Z.x + dx * Z.r * 0.85 + px * j * 0.5, Z.z + dz * Z.r * 0.85 + pz * j * 0.5];
      if (terrainH(p3[0], p3[1]) < 1.5 || riverDist(p3[0], p3[1]) < 45) continue;
      addRoad([p1, p2, p3], 4.5, 'dirt');
    }
  }
}
const RG = 16, roadGrid = new Map();
function indexRoads() {
  roadGrid.clear();
  for (const r of ROADS) for (const p of r.pts) {
    const k = gkey(Math.floor(p[0] / RG), Math.floor(p[1] / RG));
    if (!roadGrid.has(k)) roadGrid.set(k, []);
    roadGrid.get(k).push([p[0], p[1], r.w / 2, r]);
  }
}
function roadInfo(x, z) {
  let best = 1e9, bp = null; const gx = Math.floor(x / RG), gz = Math.floor(z / RG);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const l = roadGrid.get(gkey(gx + a, gz + b)); if (!l) continue;
    for (const p of l) { const d = Math.hypot(p[0] - x, p[1] - z) - p[2]; if (d < best) { best = d; bp = p; } }
  }
  return { d: best, p: bp };
}
const roadDist = (x, z) => roadInfo(x, z).d;
const onBridge = (x, z) => BRIDGES.some((b) => Math.abs(x - b.x) < 6.5 && z > b.z0 - 0.5 && z < b.z1 + 0.5);

// ───────────────────────── 충돌 (고체 상자 · 원기둥) ─────────────────────────
const solids = [], circles = [];
const GRID = 20, STEP = 0.45, R = 0.35;
const solidGrid = new Map(), circleGrid = new Map();
const gkey = (gx, gz) => (gx + 500) * 1000 + (gz + 500);
function addSolid(minX, minY, minZ, maxX, maxY, maxZ) {
  const i = solids.length; solids.push({ minX, minY, minZ, maxX, maxY, maxZ });
  for (let gx = Math.floor(minX / GRID); gx <= Math.floor(maxX / GRID); gx++)
    for (let gz = Math.floor(minZ / GRID); gz <= Math.floor(maxZ / GRID); gz++) {
      const k = gkey(gx, gz); if (!solidGrid.has(k)) solidGrid.set(k, []); solidGrid.get(k).push(i);
    }
}
function addCircle(x, z, r, maxY) {
  const i = circles.length; circles.push({ x, z, r, maxY });
  const k = gkey(Math.floor(x / GRID), Math.floor(z / GRID)); if (!circleGrid.has(k)) circleGrid.set(k, []); circleGrid.get(k).push(i);
}
let stampS = 1, stampC = 1; const solidStamp = [], circleStamp = [];
function forSolids(x, z, pad, fn) {
  stampS++;
  const x0 = Math.floor((x - pad) / GRID), x1 = Math.floor((x + pad) / GRID), z0 = Math.floor((z - pad) / GRID), z1 = Math.floor((z + pad) / GRID);
  for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
    const l = solidGrid.get(gkey(gx, gz)); if (!l) continue;
    for (const i of l) { if (solidStamp[i] === stampS) continue; solidStamp[i] = stampS; fn(solids[i]); }
  }
}
function forCircles(x, z, fn) {
  stampC++;
  const x0 = Math.floor((x - 3) / GRID), x1 = Math.floor((x + 3) / GRID), z0 = Math.floor((z - 3) / GRID), z1 = Math.floor((z + 3) / GRID);
  for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
    const l = circleGrid.get(gkey(gx, gz)); if (!l) continue;
    for (const i of l) { if (circleStamp[i] === stampC) continue; circleStamp[i] = stampC; fn(circles[i]); }
  }
}
function groundAt(x, z, y) {
  let g = terrainH(x, z);
  forSolids(x, z, 0.5, (s) => { if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ && s.maxY <= y + STEP && s.maxY > g) g = s.maxY; });
  return g;
}
function insideSolid(x, y, z, pad = 0.2) {
  let hit = false;
  forSolids(x, z, 1, (s) => { if (x > s.minX - pad && x < s.maxX + pad && z > s.minZ - pad && z < s.maxZ + pad && y > s.minY && y < s.maxY + pad) hit = true; });
  return hit;
}
function footprintBlocked(x, z, pad) {
  let hit = false;
  forSolids(x, z, pad + 1, (s) => { if (x > s.minX - pad && x < s.maxX + pad && z > s.minZ - pad && z < s.maxZ + pad) hit = true; });
  return hit;
}
function resolveXZ(nx, nz, y, h) {
  for (let it = 0; it < 2; it++) {
    forSolids(nx, nz, 1.5, (s) => {
      if (s.maxY <= y + STEP || s.minY >= y + h) return;
      const ex0 = s.minX - R, ex1 = s.maxX + R, ez0 = s.minZ - R, ez1 = s.maxZ + R;
      if (nx > ex0 && nx < ex1 && nz > ez0 && nz < ez1) {
        const dl = nx - ex0, dr = ex1 - nx, du = nz - ez0, dd = ez1 - nz, m = Math.min(dl, dr, du, dd);
        if (m === dl) nx = ex0; else if (m === dr) nx = ex1; else if (m === du) nz = ez0; else nz = ez1;
      }
    });
  }
  forCircles(nx, nz, (c) => {
    if (c.maxY <= y + STEP) return;
    const dx = nx - c.x, dz = nz - c.z, rr = c.r + R, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); nx = c.x + dx / d * rr; nz = c.z + dz / d * rr; }
  });
  return [nx, nz];
}

// ───────────────────────── 렌더러 · 씬 ─────────────────────────
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.25 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
renderer.shadowMap.enabled = !LOW;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const FOG_COLOR = new THREE.Color(0xcbd6db);
scene.fog = new THREE.Fog(FOG_COLOR, LOW ? 90 : 140, LOW ? 430 : 700);
scene.background = FOG_COLOR;
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 5000);

const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 34), THREE.MathUtils.degToRad(150));
const sky = new Sky(); sky.scale.setScalar(4000);
const su = sky.material.uniforms;
su.turbidity.value = 2.6; su.rayleigh.value = 1.9; su.mieCoefficient.value = 0.0035; su.mieDirectionalG.value = 0.82;
su.sunPosition.value.copy(sunDir);
// 화면용 하늘: 지평선 색을 안개색과 맞춘 그라데이션 돔
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x5a95dc) }, hor: { value: FOG_COLOR }, sunDir: { value: sunDir } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; varying vec3 vDir; void main(){ vec3 d = normalize(vDir); float h = max(d.y, 0.0); vec3 c = mix(hor, top, pow(smoothstep(0.0, 0.55, h), 0.8)); float s = max(dot(d, sunDir), 0.0); c += vec3(1.0, 0.92, 0.75) * pow(s, 900.0) * 6.0 + vec3(1.0, 0.85, 0.6) * pow(s, 10.0) * 0.18; gl_FragColor = vec4(c, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n }',
}));
skyDome.renderOrder = -1; scene.add(skyDome);
{
  const pm = new THREE.PMREMGenerator(renderer);
  const s2 = new THREE.Scene(); const sk2 = new Sky(); sk2.scale.setScalar(1000);
  for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) sk2.material.uniforms[k].value = su[k].value;
  sk2.material.uniforms.sunPosition.value.copy(sunDir); s2.add(sk2);
  scene.environment = pm.fromScene(s2).texture;
  scene.environmentIntensity = 0.45;
}
const hemi = new THREE.HemisphereLight(0xdbe8ff, 0x5a4a30, 0.85); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe4c2, 2.4);
sun.castShadow = !LOW;
sun.shadow.mapSize.set(2048, 2048);
const SC = sun.shadow.camera; SC.left = -70; SC.right = 70; SC.top = 70; SC.bottom = -70; SC.near = 1; SC.far = 500;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun); scene.add(sun.target);

// ───────────────────────── 사진 텍스처 · 하늘 (Poly Haven, CC0) ─────────────────────────
const TEX_AVG = { sparse_grass: 0.0513, dry_ground_01: 0.1972, rocky_terrain_02: 0.0731, coast_sand_01: 0.1768, asphalt_02: 0.1016, painted_concrete: 0.1272, corrugated_iron: 0.4374, grey_roof_tiles: 0.1081, red_brick_03: 0.1004, brushed_concrete: 0.1273, brown_planks_05: 0.3006, rusty_metal_02: 0.2985 };
const TEX_FALLBACK = { sparse_grass: 0x5d7a34, dry_ground_01: 0xa08a68, rocky_terrain_02: 0x7b7a6a, coast_sand_01: 0xc8b58a, asphalt_02: 0x55524e, painted_concrete: 0xbdbdbd, corrugated_iron: 0xd0d0d0, grey_roof_tiles: 0x7a7570, red_brick_03: 0x9a5040, brushed_concrete: 0x8c8a86, brown_planks_05: 0xb8a68c, rusty_metal_02: 0xb08a60 };
const ARRAY_LAYERS = ['painted_concrete', 'corrugated_iron', 'grey_roof_tiles', 'red_brick_03', 'brushed_concrete', 'brown_planks_05', 'rusty_metal_02'];
const TEX = {};
function loadImage(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error(src)); im.src = src; }); }
function solidTex(hex) { const c = new THREE.Color(hex); const t = new THREE.DataTexture(new Uint8Array([c.r * 255, c.g * 255, c.b * 255, 255].map((v, i) => (i < 3 ? Math.round(Math.pow(v / 255, 1 / 2.2) * 255) : v))), 1, 1); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; }
function flatNormal() { const t = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1); t.needsUpdate = true; return t; }
async function loadTextures(onProgress) {
  const names = Object.keys(TEX_AVG), imgs = {}, list = [];
  for (const n of names) for (const k of ['diff', 'nor']) list.push([n, k]);
  let done = 0;
  await Promise.all(list.map(async ([n, k]) => { imgs[n + '_' + k] = await loadImage(`assets/${n}_${k}.jpg`); onProgress && onProgress(++done / list.length); }));
  for (const n of names) {
    const d = new THREE.Texture(imgs[n + '_diff']); d.colorSpace = THREE.SRGBColorSpace; d.wrapS = d.wrapT = THREE.RepeatWrapping; d.anisotropy = LOW ? 2 : 8; d.needsUpdate = true;
    const nm = new THREE.Texture(imgs[n + '_nor']); nm.wrapS = nm.wrapT = THREE.RepeatWrapping; nm.anisotropy = 4; nm.needsUpdate = true;
    TEX[n] = { map: d, normal: nm, avg: TEX_AVG[n] };
  }
  const S = LOW ? 256 : 512, L = ARRAY_LAYERS.length, data = new Uint8Array(S * S * 4 * L), cv = document.createElement('canvas');
  cv.width = cv.height = S; const cx = cv.getContext('2d', { willReadFrequently: true });
  ARRAY_LAYERS.forEach((n, i) => { cx.drawImage(imgs[n + '_diff'], 0, 0, S, S); data.set(cx.getImageData(0, 0, S, S).data, i * S * S * 4); });
  const ndata = new Uint8Array(S * S * 4 * L);
  ARRAY_LAYERS.forEach((n, i) => { cx.drawImage(imgs[n + '_nor'], 0, 0, S, S); ndata.set(cx.getImageData(0, 0, S, S).data, i * S * S * 4); });
  setArray(data, S, ndata);
}
function setArray(data, S, ndata) {
  const mk = (d, srgb) => {
    const arr = new THREE.DataArrayTexture(d, S, S, ARRAY_LAYERS.length);
    if (srgb) arr.colorSpace = THREE.SRGBColorSpace;
    arr.wrapS = arr.wrapT = THREE.RepeatWrapping; arr.magFilter = THREE.LinearFilter;
    arr.minFilter = S > 1 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; arr.generateMipmaps = S > 1; arr.anisotropy = 4; arr.needsUpdate = true; return arr;
  };
  TEX.array = mk(data, true); TEX.arrayAvg = ARRAY_LAYERS.map((n) => TEX[n].avg);
  if (!ndata) { ndata = new Uint8Array(S * S * 4 * ARRAY_LAYERS.length); for (let i = 0; i < ndata.length; i += 4) ndata.set([128, 128, 255, 255], i); }
  TEX.narray = mk(ndata, false);
}
function useFallbackTextures() {
  for (const n of Object.keys(TEX_AVG)) { const c = new THREE.Color(TEX_FALLBACK[n]); TEX[n] = { map: solidTex(TEX_FALLBACK[n]), normal: flatNormal(), avg: 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b }; }
  const data = new Uint8Array(4 * ARRAY_LAYERS.length);
  ARRAY_LAYERS.forEach((n, i) => { const c = new THREE.Color(TEX_FALLBACK[n]); const g = (v) => Math.round(Math.pow(v, 1 / 2.2) * 255); data.set([g(c.r), g(c.g), g(c.b), 255], i * 4); });
  setArray(data, 1);
}
async function loadSky() {
  const tex = await new THREE.TextureLoader().loadAsync('assets/sky_2k.jpg');
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
  // 하늘 사진 속 해 위치(고도 48°)에 햇빛 방향을 맞춤
  const phi = 0.5967, lat = 0.836;
  sunDir.set(Math.cos(phi) * Math.cos(lat), Math.sin(lat), Math.sin(phi) * Math.cos(lat)).normalize();
  const BI = 1.35;
  FOG_COLOR.setRGB(0.548 * BI, 0.572 * BI, 0.642 * BI); scene.fog.color.copy(FOG_COLOR);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromEquirectangular(tex).texture; scene.environmentIntensity = 0.85;
  scene.background = tex; scene.backgroundIntensity = BI;
  skyDome.visible = false;
  hemi.intensity = 0.35; sun.intensity = 2.4;
}

// ───────────────────────── 지형 메시 ─────────────────────────
function detailTexture() {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d');
  const img = x.createImageData(S, S), d = img.data, r = mulberry32(7);
  for (let i = 0; i < S * S; i++) { const px = i % S, py = (i / S) | 0; const n = vnoise(px / 9, py / 9) * 0.5 + vnoise(px / 3, py / 3) * 0.25; const v = 226 + n * 26 + (r() - 0.5) * 30; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = clamp(v, 150, 255); d[i * 4 + 3] = 255; }
  for (let k = 0; k < 900; k++) { const bx = r() * S, by = r() * S, l = 3 + r() * 5; x.strokeStyle = `rgba(${r() < 0.5 ? '255,255,235' : '60,70,40'},${0.12 + r() * 0.12})`; x.lineWidth = 1; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + (r() - 0.5) * 2, by - l); x.stroke(); }
  x.putImageData(img, 0, 0);
  for (let k = 0; k < 1400; k++) { const bx = r() * S, by = r() * S, l = 2 + r() * 5; x.strokeStyle = `rgba(${r() < 0.5 ? '255,255,230' : '40,55,25'},${0.1 + r() * 0.15})`; x.lineWidth = 1; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + (r() - 0.5) * 2.5, by - l); x.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}
function buildTerrain() {
  const W = N + 1, pos = new Float32Array(W * W * 3), col = new Float32Array(W * W * 3), spl = new Float32Array(W * W * 4);
  for (let iz = 0; iz < W; iz++) for (let ix = 0; ix < W; ix++) {
    const i = iz * W + ix; pos[i * 3] = -HALF + ix * CELL; pos[i * 3 + 1] = HG[i]; pos[i * 3 + 2] = -HALF + iz * CELL;
  }
  const idx = [];
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
    const a = iz * W + ix, b = (iz + 1) * W + ix, c = (iz + 1) * W + ix + 1, d = iz * W + ix + 1;
    idx.push(a, b, d, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const uv = new Float32Array(W * W * 2); for (let i = 0; i < W * W; i++) { uv[i * 2] = pos[i * 3] / 3.5; uv[i * 2 + 1] = pos[i * 3 + 2] / 3.5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const nrm = g.attributes.normal.array, c = new THREE.Color();
  const forestTint = new THREE.Color(0.7, 0.78, 0.66), dryTint = new THREE.Color(1.1, 1.03, 0.82), desertTint = new THREE.Color(1.18, 0.95, 0.74), wetTint = new THREE.Color(0.55, 0.55, 0.52);
  for (let i = 0; i < W * W; i++) {
    const x = pos[i * 3], h = pos[i * 3 + 1], z = pos[i * 3 + 2], ny = nrm[i * 3 + 1];
    let wg = 1, wd = 0, wr = 0, ws = 0;
    const dry = smooth(0.1, 0.45, fbm(x * 0.006 + 7, z * 0.006 - 3, 3));
    wd += dry * 0.12;
    let tm = 0; for (const k in TOWN_LEVEL) tm = Math.max(tm, zoneMask(k, x, z));
    wd += tm * 0.75; wg *= 1 - tm * 0.35;
    const rw = gauss(x, z, -650, 0, 240), des = smooth(0.18, 0.5, rw);
    ws += des * 1.3; wd += des * 0.9; wg *= 1 - smooth(0.12, 0.45, rw);
    wr += smooth(0.88, 0.7, ny) * 3.2;
    if (h < 2.4) ws += smooth(2.4, 0.9, h) * 3;
    spl[i * 4] = wg; spl[i * 4 + 1] = wd; spl[i * 4 + 2] = wr; spl[i * 4 + 3] = ws;
    c.setRGB(1, 1, 1);
    const v = 0.92 + fbm(x * 0.03, z * 0.03, 3) * 0.16; c.multiplyScalar(v);
    c.lerp(forestTint, smooth(0.0, 0.25, forestDensity(x, z)) * 0.6);
    c.lerp(dryTint, dry * 0.5);
    c.lerp(desertTint, des * 0.8);
    if (h < 0.2) c.lerp(wetTint, 0.6);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('splat', new THREE.BufferAttribute(spl, 4));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, normalMap: TEX.sparse_grass.normal, normalScale: new THREE.Vector2(0.8, 0.8) });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      tG: { value: TEX.sparse_grass.map }, tD: { value: TEX.dry_ground_01.map }, tR: { value: TEX.rocky_terrain_02.map }, tS: { value: TEX.coast_sand_01.map },
      uAvgT: { value: new THREE.Vector4(TEX.sparse_grass.avg, TEX.dry_ground_01.avg, TEX.rocky_terrain_02.avg, TEX.coast_sand_01.avg) },
      uLevel: { value: new THREE.Vector4(MODELS.grassR ? 0.13 : 0.2, 0.26, 0.2, 0.34) },
    });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 splat; varying vec4 vSplat; varying vec2 vTUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSplat = splat; vTUv = position.xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tG, tD, tR, tS; uniform vec4 uAvgT, uLevel; varying vec4 vSplat; varying vec2 vTUv;')
      .replace('#include <map_fragment>', `
  vec3 tg = texture2D(tG, vTUv / 4.0).rgb; tg = mix(tg, texture2D(tG, vTUv / 19.0).rgb, 0.45); tg = mix(tg * vec3(0.8, 1.05, 0.55), vec3(dot(tg, vec3(0.333))) * vec3(0.62, 1.0, 0.36) * 1.45, 0.55);
  vec3 td = texture2D(tD, vTUv / 9.0).rgb; td = mix(td, texture2D(tD, vTUv / 31.0).rgb, 0.5); td = mix(vec3(dot(td, vec3(0.333))), td, 0.6) * vec3(1.05, 0.95, 0.82);
  vec3 tr = texture2D(tR, vTUv / 7.0).rgb; vec3 ts = texture2D(tS, vTUv / 6.0).rgb;
  vec4 sw = vSplat / max(dot(vSplat, vec4(1.0)), 0.001);
  diffuseColor.rgb = tg / uAvgT.x * uLevel.x * sw.x + td / uAvgT.y * uLevel.y * sw.y + tr / uAvgT.z * uLevel.z * sw.z + ts / uAvgT.w * uLevel.w * sw.w;`);
  };
  mat.customProgramCacheKey = () => 'terrain-splat';
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true; scene.add(m);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x24505f, roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.88 }));
  water.position.y = 0; scene.add(water);
}

function buildBridges() { lay(4, _buildBridges); }
function _buildBridges() {
  for (const b of BRIDGES) {
    const y = 3.4, x = b.x;
    let z0 = b.zr, z1 = b.zr;
    for (let k = 0; k < 160 && terrainH(x, z0) < y - 0.35; k++) z0 -= 1;
    for (let k = 0; k < 160 && terrainH(x, z1) < y - 0.35; k++) z1 += 1;
    b.z0 = z0; b.z1 = z1; b.y = y;
    const len = z1 - z0, mid = (z0 + z1) / 2;
    box(x, y - 1.4, mid, 10, 1.4, len, 0x8d8a84);
    box(x, y, mid, 7.4, 0.05, len, 0x4a4946, false);
    for (const s of [-1, 1]) {
      box(x + s * 5.1, y, mid, 0.35, 1.1, len, 0xb9b5ad);
      box(x + s * 5.1, y + 6, mid, 0.45, 0.45, len - 4, 0x6f7d86, false);
      for (let zz = z0 + 2; zz <= z1 - 2; zz += 8) box(x + s * 5.1, y + 1.1, zz, 0.35, 4.9, 0.35, 0x6f7d86, false);
    }
    for (let zz = z0 + 2; zz <= z1 - 2; zz += 8) box(x, y + 6, zz, 10.6, 0.3, 0.3, 0x6f7d86, false);
    for (let zz = z0 + 8; zz < z1 - 4; zz += 14) for (const s of [-1, 1]) cyl(x + s * 3, -7, zz, 0.9, 1.0, y - 1.4 + 7, 0x8d8a84, 10);
  }
}

function buildRoadMeshes() {
  const groups = { asphalt: { pos: [], idx: [], uv: [] }, dirt: { pos: [], idx: [], uv: [] } }, line = { pos: [], idx: [] };
  for (const r of ROADS) {
    const G = groups[r.kind], P = r.pts, hw = r.w / 2, lift = r.kind === 'asphalt' ? 0.14 : 0.09;
    let prev = -1, dist = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
      const px = -tz, pz = tx, x = P[i][0], z = P[i][1];
      if (i > 0) dist += Math.hypot(x - P[i - 1][0], z - P[i - 1][1]);
      const hl = terrainH(x + px * hw, z + pz * hw), hr = terrainH(x - px * hw, z - pz * hw);
      if (Math.min(hl, hr) < 0.4 || onBridge(x, z)) { prev = -1; continue; }
      const base = G.pos.length / 3;
      G.pos.push(x + px * hw, hl + lift, z + pz * hw, x - px * hw, hr + lift, z - pz * hw);
      G.uv.push((x + px * hw) / 7, (z + pz * hw) / 7, (x - px * hw) / 7, (z - pz * hw) / 7);
      if (prev >= 0) G.idx.push(prev, prev + 1, base, prev + 1, base + 1, base);
      prev = base;
      if (r.kind === 'asphalt' && i < P.length - 1 && dist % 9 < 4.5) {
        const n = P[i + 1], w = 0.11, hc = terrainH(x, z) + lift + 0.04, hn = terrainH(n[0], n[1]) + lift + 0.04, lb = line.pos.length / 3;
        line.pos.push(x + px * w, hc, z + pz * w, x - px * w, hc, z - pz * w, n[0] + px * w, hn, n[1] + pz * w, n[0] - px * w, hn, n[1] - pz * w);
        line.idx.push(lb, lb + 1, lb + 2, lb + 1, lb + 3, lb + 2);
      }
    }
  }
  const mk = (G, T, level, tint) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(G.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2)); g.setIndex(G.idx); g.computeVertexNormals();
    const color = new THREE.Color(tint).multiplyScalar(level / T.avg);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: T.map, normalMap: T.normal, color, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide }));
    m.receiveShadow = true; scene.add(m);
  };
  mk(groups.asphalt, TEX.asphalt_02, 0.11, 0xffffff); mk(groups.dirt, TEX.dry_ground_01, 0.26, 0xffe8cc);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(line.pos, 3)); lg.setIndex(line.idx);
  scene.add(new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: 0xd9c98a, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })));
}

// 밭 · 마당 (지형 위에 얇게 덮는 판)
const FIELDS = [];
const CROP_MAP = { rice: '#c9a446', green: '#6f9a3e', plowed: '#7a5c3c', cabbage: '#8db35a', pepper: '#a4503a', dirt: '#a88f6a' };
function cropTexture(kind) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), r = mulberry32(kind.length * 99);
  const soil = '#6e5638';
  if (kind === 'dirt') { x.fillStyle = '#a88f6a'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '70,55,35' : '220,205,170'},${0.15 + r() * 0.2})`; x.fillRect(r() * 128, r() * 128, 2, 2); } }
  else if (kind === 'rice') { x.fillStyle = '#b7923a'; x.fillRect(0, 0, 128, 128); for (let c = 0; c < 128; c += 8) { x.fillStyle = '#d8b65a'; x.fillRect(c, 0, 5, 128); } }
  else if (kind === 'plowed') { x.fillStyle = '#7a5c3c'; x.fillRect(0, 0, 128, 128); for (let c = 0; c < 128; c += 8) { x.fillStyle = '#5e4630'; x.fillRect(c, 0, 3, 128); } }
  else { x.fillStyle = soil; x.fillRect(0, 0, 128, 128); for (let c = 0; c < 128; c += 16) { x.fillStyle = CROP_MAP[kind]; if (kind === 'cabbage' || kind === 'pepper') { for (let y = 4; y < 128; y += 9) { x.beginPath(); x.arc(c + 6, y, 4 + r() * 1.5, 0, 6.29); x.fill(); } } else x.fillRect(c + 2, 0, 9, 128); } }
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(0,0,0,${r() * 0.08})`; x.fillRect(r() * 128, r() * 128, 3, 3); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function inField(x, z, m = 0) { for (const f of FIELDS) if (x > f.x0 - m && x < f.x1 + m && z > f.z0 - m && z < f.z1 + m) return f; return null; }
function fieldFree(x0, z0, x1, z1) {
  if (inFieldRect(x0, z0, x1, z1, 3)) return false;
  let ok = true; forSolids((x0 + x1) / 2, (z0 + z1) / 2, Math.max(x1 - x0, z1 - z0) / 2 + 4, (s) => { if (x1 + 2 > s.minX && x0 - 2 < s.maxX && z1 + 2 > s.minZ && z0 - 2 < s.maxZ) ok = false; });
  if (!ok) return false;
  let mn = 1e9, mx = -1e9;
  for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 4) for (let z = z0; z <= z1 + 0.01; z += (z1 - z0) / 4) {
    const h = terrainH(x, z); mn = Math.min(mn, h); mx = Math.max(mx, h);
    if (h < 1.8 || roadDist(x, z) < 2 || riverDist(x, z) < 38) return false;
  }
  return mx - mn < 3;
}
function inFieldRect(x0, z0, x1, z1, m) { for (const f of FIELDS) if (x1 + m > f.x0 && x0 - m < f.x1 && z1 + m > f.z0 && z0 - m < f.z1) return true; return false; }
function addField(cx, cz, w, d, crop, alongX = rng() < 0.5) {
  const f = { x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, crop, alongX };
  if (!fieldFree(f.x0, f.z0, f.x1, f.z1)) return null;
  FIELDS.push(f); return f;
}
function buildFieldMeshes() {
  const byCrop = {};
  for (const f of FIELDS) {
    if (!f.crop) continue;
    const w = f.x1 - f.x0, d = f.z1 - f.z0, g = new THREE.PlaneGeometry(w, d, Math.ceil(w / 4), Math.ceil(d / 4)).rotateX(-Math.PI / 2);
    g.translate((f.x0 + f.x1) / 2, 0, (f.z0 + f.z1) / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i); p.setY(i, terrainH(x, z) + 0.07);
      const u = (f.alongX ? z : x) / 10, v = (f.alongX ? x : z) / 10; uv.setXY(i, u, v);
    }
    g.computeVertexNormals();
    (byCrop[f.crop] = byCrop[f.crop] || []).push(g);
  }
  for (const [crop, list] of Object.entries(byCrop)) {
    const m = new THREE.Mesh(mergeGeometries(list, false), new THREE.MeshStandardMaterial({ map: cropTexture(crop), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    m.receiveShadow = true; scene.add(m);
  }
}

// ───────────────────────── 건물 생성 도우미 ─────────────────────────
const visParts = [];
const tmpCol = new THREE.Color();
let LAYER = 0;
const lay = (l, fn) => { const p = LAYER; LAYER = l; try { return fn(); } finally { LAYER = p; } };
function pushGeo(g, color, layer = LAYER) {
  if (g.index) g = g.toNonIndexed();
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (!g.attributes.normal) g.computeVertexNormals();
  tmpCol.set(color);
  const p = g.attributes.position, n = p.count, a = new Float32Array(n * 3);
  const gnd = new Float32Array(n);
  for (let i = 0; i < n; i++) { a[i * 3] = tmpCol.r; a[i * 3 + 1] = tmpCol.g; a[i * 3 + 2] = tmpCol.b; gnd[i] = terrainH(p.getX(i), p.getZ(i)); }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.setAttribute('gnd', new THREE.BufferAttribute(gnd, 1));
  g.setAttribute('layer', new THREE.BufferAttribute(new Float32Array(n).fill(layer), 1));
  visParts.push(g);
}
function box(cx, y0, cz, w, h, d, color, solid = true) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(cx, y0 + h / 2, cz); pushGeo(g, color);
  if (solid) addSolid(cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2);
}
function cyl(cx, y0, cz, rt, rb, h, color, seg = 12) { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(cx, y0 + h / 2, cz); pushGeo(g, color); }
function roofGeo(w, d, h) {
  const x = w / 2, z = d / 2;
  const v = [
    -x, 0, -z, x, h, 0, x, 0, -z, -x, 0, -z, -x, h, 0, x, h, 0,
    -x, 0, z, x, 0, z, x, h, 0, -x, 0, z, x, h, 0, -x, h, 0,
    -x, 0, -z, -x, 0, z, -x, h, 0,
    x, 0, -z, x, h, 0, x, 0, z,
  ];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
}
function minGround(cx, cz, w, d) { let m = Infinity; for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) m = Math.min(m, terrainH(cx + a * w / 2, cz + b * d / 2)); return m; }
function maxGround(cx, cz, w, d) { let m = -Infinity; for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) m = Math.max(m, terrainH(cx + a * w / 2, cz + b * d / 2)); return m; }
// 계단: edge(꼭대기 칸이 닿는 위치)에서 dir 방향으로 내려가며 땅에 닿을 때까지 만든다
function stairsDown(axis, a0, a1, edge, dir, topY, rise, run, color) {
  const mid = (a0 + a1) / 2, gh = (s) => (axis === 'z' ? terrainH(mid, s) : terrainH(s, mid));
  let n = 1;
  while (n < 140 && topY - n * rise > gh(edge + dir * run * n) + 0.05) n++;
  for (let i = 0; i < n; i++) {
    const s0 = edge + dir * run * i, s1 = edge + dir * run * (i + 1), c = (s0 + s1) / 2, top = topY - i * rise;
    const bottom = Math.min(gh(s0), gh(s1)) - 1;
    if (axis === 'z') box(mid, bottom, c, a1 - a0, top - bottom, run, color);
    else box(c, bottom, mid, run, top - bottom, a1 - a0, color);
  }
}
const specials = { olive: [], palace: [], temple: [] };
const signs = [];

function buildPalace() {
  const Z = ZONES.palace, b = 38, S = 0xb8ad97, T = 0xa69b86, H = 45;
  const ws = (x0, z0, x1, z1) => box((x0 + x1) / 2, b - 2, (z0 + z1) / 2, x1 - x0, 12, z1 - z0, S);
  ws(Z.x - H, Z.z - H, Z.x + H, Z.z - H + 3);                 // 북쪽 벽
  ws(Z.x - H, Z.z - H, Z.x - H + 3, Z.z + H);                 // 서쪽 벽
  ws(Z.x + H - 3, Z.z - H, Z.x + H, Z.z + H);                 // 동쪽 벽
  ws(Z.x - H, Z.z + H - 3, Z.x - 6, Z.z + H);                 // 남쪽 벽 (성문 좌)
  ws(Z.x + 6, Z.z + H - 3, Z.x + H, Z.z + H);                 // 남쪽 벽 (성문 우)
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const tx = Z.x + sx * (H - 1.5), tz = Z.z + sz * (H - 1.5);
    box(tx, b - 2, tz, 9, 19, 9, T);
    for (let i = 0; i < 4; i++) box(tx + (i % 2 ? 3.2 : -3.2), b + 17, tz + (i < 2 ? 3.2 : -3.2), 1.6, 1.6, 1.6, T, false);
  }
  for (let i = -H + 4; i < H - 4; i += 3.2) { // 성가퀴
    box(Z.x + i, b + 10, Z.z - H + 0.5, 1.4, 1.2, 0.8, T, false);
    box(Z.x - H + 0.5, b + 10, Z.z + i, 0.8, 1.2, 1.4, T, false);
    box(Z.x + H - 0.5, b + 10, Z.z + i, 0.8, 1.2, 1.4, T, false);
  }
  box(Z.x, b + 7, Z.z + H - 1.5, 12, 3, 3, S); // 성문 위
  // 성벽 계단 (서쪽 벽 안쪽)
  stairsDown('z', Z.x - H + 3, Z.x - H + 7, Z.z + 8, 1, b + 10, 0.4, 0.5, T);
  // 본성 (Keep)
  box(Z.x, b - 2, Z.z, 20, 18, 20, 0xc4b9a2);
  stairsDown('z', Z.x + 10, Z.x + 14, Z.z - 10, 1, b + 16, 0.4, 0.5, T);
  for (let i = 0; i < 6; i++) { box(Z.x - 9.4 + i * 3.75, b + 16, Z.z - 9.6, 1.4, 1.2, 0.8, T, false); box(Z.x - 9.4 + i * 3.75, b + 16, Z.z + 9.6, 1.4, 1.2, 0.8, T, false); }
  // 깃발
  for (const [fx, fz] of [[-1, -1], [1, 1]]) { const px = Z.x + fx * (H - 1.5), pz = Z.z + fz * (H - 1.5); cyl(px, b + 17, pz, 0.1, 0.1, 7, 0x333333, 6); box(px + 1.6, b + 22, pz, 3, 1.8, 0.08, 0x8e1b1b, false); }
  // 특수 위치: 본성 꼭대기·성벽 위
  for (const [ox, oz] of [[0, 0], [-6, -6], [6, 6], [-6, 6], [6, -6]]) specials.palace.push({ x: Z.x + ox, z: Z.z + oz, y: b + 16 });
  for (const t of [-30, -10, 10, 30]) specials.palace.push({ x: Z.x - H + 1.5, z: Z.z + t, y: b + 10 });
  for (const t of [-25, 0, 25]) specials.palace.push({ x: Z.x + t, z: Z.z - H + 1.5, y: b + 10 });
}
function buildTemple() {
  const Z = ZONES.temple, b = terrainH(Z.x, Z.z), M = 0xece6da, M2 = 0xd8cfbf;
  box(Z.x, b - 8, Z.z, 34, 8 + 1.2, 24, M2);
  const top = b + 1.2;
  stairsDown('z', Z.x - 8, Z.x + 8, Z.z + 12, 1, top, 0.4, 0.8, M2);
  for (let i = 0; i < 6; i++) for (const sz of [-1, 1]) {
    const x = Z.x - 13.5 + i * 5.4, z = Z.z + sz * 9.5; cyl(x, top, z, 0.6, 0.7, 8, M, 12); addCircle(x, z, 0.7, top + 8);
  }
  for (const sx of [-1, 1]) for (const z of [-4, 0, 4]) { const x = Z.x + sx * 15.5; cyl(x, top, Z.z + z, 0.6, 0.7, 8, M, 12); addCircle(x, Z.z + z, 0.7, top + 8); }
  box(Z.x, top + 8, Z.z, 34, 1.2, 23, M, false);
  const rg = roofGeo(35, 24, 4.2); rg.translate(Z.x, top + 9.2, Z.z); pushGeo(rg, 0xcfc4b0);
  box(Z.x, top, Z.z - 3, 4, 1.4, 2.4, 0xb59a5a); // 제단
  for (const [ox, oz] of [[-10, -5], [10, -5], [-10, 5], [10, 5], [0, 4], [-5, -6]]) specials.temple.push({ x: Z.x + ox, z: Z.z + oz, y: top });
}
function buildOlive() {
  const Z = ZONES.olive;
  // 정상 근처 최고점 탐색
  let px = Z.x, pz = Z.z, ph = -1;
  for (let a = -60; a <= 60; a += 6) for (let c = -60; c <= 60; c += 6) { const h = terrainH(Z.x + a, Z.z + c); if (h > ph) { ph = h; px = Z.x + a; pz = Z.z + c; } }
  Z.peak = { x: px, z: pz, y: ph };
  const b = minGround(px, pz, 6, 6) - 0.5, top = ph + 12;
  box(px, b, pz, 6, top - b, 6, 0x6d5a43);
  for (const [lx, lz] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]]) cyl(px + lx, top, pz + lz, 0.12, 0.12, 1.1, 0x3b2f22, 5);
  const rg = roofGeo(7.5, 7.5, 2.2); rg.translate(px, top + 2.6, pz); pushGeo(rg, 0x5e3a24);
  for (const [lx, lz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) cyl(px + lx, top, pz + lz, 0.1, 0.1, 2.6, 0x3b2f22, 5);
  stairsDown('z', px + 3, px + 5.5, pz - 3, 1, top, 0.4, 0.5, 0x7a6248);
  specials.olive.push({ x: px - 1.5, z: pz - 1.5, y: top }, { x: px + 1.5, z: pz + 1.5, y: top });
  // 작은 기도처
  const sx = px - 30, sz = pz + 20; ruralHouse(sx, sz, 7, 6, '+z');
}
const WALL_COLS = [0xf1ede4, 0xe6dcc8, 0xd8d4cc, 0xefe6d2, 0xcfc6b6, 0xe9e2d0];
const CONC_COLS = [0xc9c6bf, 0xd8cfc0, 0xbfb7aa, 0xe2ddd3, 0xb7a58e, 0xcbbca4, 0xd6c3a5];
const ROOF_COLS = [0x3a6ea5, 0x4f8a5b, 0xa8443a, 0xc8743a, 0x6d7a86, 0x2f5d8a, 0x8a3b2a, 0x5f8f7a];
const pick = (a) => a[(rng() * a.length) | 0];
function shade(c, k) { const t = new THREE.Color(c); t.multiplyScalar(k); return t.getHex(); }
function rectFree(cx, cz, w, d, m = 2) {
  let ok = true;
  forSolids(cx, cz, Math.max(w, d) / 2 + m + 2, (s) => { if (cx + w / 2 + m > s.minX && cx - w / 2 - m < s.maxX && cz + d / 2 + m > s.minZ && cz - d / 2 - m < s.maxZ) ok = false; });
  if (!ok) return false;
  if (inFieldRect(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, m)) return false;
  const sx = Math.max(1, Math.ceil(w / 6)), sz = Math.max(1, Math.ceil(d / 6));
  for (let i = 0; i <= sx; i++) for (let j = 0; j <= sz; j++) {
    const x = cx - w / 2 - m + (w + 2 * m) * i / sx, z = cz - d / 2 - m + (d + 2 * m) * j / sz;
    if (roadDist(x, z) < 0.5 || terrainH(x, z) < 1.6 || riverDist(x, z) < 40) return false;
  }
  return maxGround(cx, cz, w, d) - minGround(cx, cz, w, d) < 3.5;
}
function doorDir(cx, cz) {
  const { p } = roadInfo(cx, cz);
  if (!p) return pick(['+x', '-x', '+z', '-z']);
  const dx = p[0] - cx, dz = p[1] - cz;
  return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? '+x' : '-x') : (dz > 0 ? '+z' : '-z');
}
// 창문은 인스턴싱(창틀·창턱·유리)으로 따로 그림 — 벽에 붙은 어두운 상자 대신 오목한 실제 창
const WIN = [];
const drng = mulberry32(777), dpick = (a) => a[(drng() * a.length) | 0]; // 장식용 난수 (맵 배치 난수와 분리)
const FRAME_COLS = [0xeeece6, 0xeeece6, 0xeeece6, 0xd9d6cf, 0xd9d6cf, 0xb4b8bb, 0x8d9296, 0x5a4636];
function facadeDetail(...args) { lay(7, () => _facadeDetail(...args)); }
function _facadeDetail(cx, cz, w, d, gy, floors, fh, door, winC = 0x1e252c) {
  const wood = winC !== 0x1e252c, fc = wood ? dpick([0x5a4030, 0x6b4a32, 0x4a3a2c]) : dpick(FRAME_COLS);
  const ww = wood ? 1.0 : 1.25 + (drng() < 0.3 ? 0.5 : 0), wh = 1.35;
  const addWin = (x, y, z, ry) => WIN.push({ x, y, z, ry, sx: ww / 1.25, sy: wh / 1.35, fc, cur: drng() < 0.3 });
  for (let f = 0; f < floors; f++) {
    const wy = gy + 1.0 + f * fh, nx = Math.max(1, Math.floor(w / 3.3)), nz = Math.max(1, Math.floor(d / 3.3));
    for (let i = 0; i < nx; i++) {
      const xx = cx - w / 2 + (i + 0.5) * (w / nx);
      for (const s of [1, -1]) { if (f === 0 && door === (s > 0 ? '+z' : '-z') && i === Math.floor(nx / 2)) continue; addWin(xx, wy, cz + s * d / 2, s > 0 ? 0 : Math.PI); }
    }
    for (let i = 0; i < nz; i++) {
      const zz = cz - d / 2 + (i + 0.5) * (d / nz);
      for (const s of [1, -1]) { if (f === 0 && door === (s > 0 ? '+x' : '-x') && i === Math.floor(nz / 2)) continue; addWin(cx + s * w / 2, wy, zz, s > 0 ? Math.PI / 2 : -Math.PI / 2); }
    }
  }
  // 현관: 문짝 + 문틀 + 차양 + 디딤판
  const dc = wood ? 0x4a3a2c : dpick([0x4a3a2c, 0x5b3b2a, 0x3d4a52, 0x6f7477, 0x2f4f3f]);
  const ax = door === '+x' || door === '-x', sg = door[0] === '+' ? 1 : -1;
  const fx = ax ? cx + sg * w / 2 : cx, fz = ax ? cz : cz + sg * d / 2;
  const B = (along, out, y0, lw, h, dep, col) => box(fx + (ax ? sg * out : along), y0, fz + (ax ? along : sg * out), ax ? dep : lw, h, ax ? lw : dep, col, false);
  B(0, 0.03, gy, 1.5, 2.3, 0.08, dc);
  B(-0.82, 0.07, gy, 0.14, 2.45, 0.14, fc); B(0.82, 0.07, gy, 0.14, 2.45, 0.14, fc); B(0, 0.07, gy + 2.31, 1.78, 0.14, 0.14, fc);
  B(0, 0.08, gy + 1.05, 0.06, 0.06, 0.05, 0xc8c0a0);
  lay(4, () => { B(0, 0.55, gy + 2.62, 2.4, 0.12, 1.1, 0xb9b4aa); B(0, 0.45, gy - 0.4, 2.2, 0.55, 0.9, 0xa9a49a); });
}
function buildWindows() {
  if (!WIN.length) return;
  // 창틀 템플릿 (폭 1.25, 높이 1.35, 벽면 z=0에서 바깥쪽 +z)
  const W = 1.25, H = 1.35, t = 0.075, D = 0.12, parts = [];
  const bx = (w, h, d, x, y, z) => parts.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  bx(W, t, D, 0, t / 2, D / 2 - 0.02); bx(W, t, D, 0, H - t / 2, D / 2 - 0.02); bx(t, H, D, -W / 2 + t / 2, H / 2, D / 2 - 0.02); bx(t, H, D, W / 2 - t / 2, H / 2, D / 2 - 0.02);
  bx(0.05, H - 2 * t, 0.05, 0, H / 2, 0.03); bx(W - 2 * t, 0.04, 0.05, 0, H * 0.68, 0.03);
  bx(W + 0.22, 0.06, 0.2, 0, -0.03, 0.09);
  const frameGeo = mergeGeometries(parts, false);
  const glassGeo = new THREE.PlaneGeometry(W - 0.1, H - 0.1).translate(0, H / 2, 0.012);
  const frameMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1 });
  const glassMat = new THREE.MeshStandardMaterial({ roughness: 0.06, metalness: 0.55, envMapIntensity: 1.3 });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  // 유리: 맵 전체 한 번에 (가볍다) · 창틀: 250m 구역별로 나눠 거리 컬링
  const glass = new THREE.InstancedMesh(glassGeo, glassMat, WIN.length);
  WIN.forEach((o, i) => {
    q.setFromAxisAngle(up, o.ry); sc.set(o.sx, o.sy, 1); pp.set(o.x, o.y, o.z); m4.compose(pp, q, sc); glass.setMatrixAt(i, m4);
    c.setHex(o.cur ? dpick([0x9a8a70, 0x7e8f96, 0xa89a80]) : 0x557080).multiplyScalar(0.6 + drng() * 0.35); glass.setColorAt(i, c);
  });
  glass.receiveShadow = !LOW; scene.add(glass);
  const CH = 250, buckets = new Map();
  for (const o of WIN) { const k = Math.floor((o.x + HALF) / CH) * 100 + Math.floor((o.z + HALF) / CH); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(o); }
  for (const arr of buckets.values()) {
    const im = new THREE.InstancedMesh(frameGeo, frameMat, arr.length); let cx = 0, cz = 0;
    arr.forEach((o, i) => { q.setFromAxisAngle(up, o.ry); sc.set(o.sx, o.sy, 1); pp.set(o.x, o.y, o.z); m4.compose(pp, q, sc); im.setMatrixAt(i, m4); im.setColorAt(i, c.setHex(o.fc)); cx += o.x; cz += o.z; });
    im.computeBoundingSphere(); im.receiveShadow = !LOW; im.userData.cx = cx / arr.length; im.userData.cz = cz / arr.length; im.userData.far = 330;
    scene.add(im); chunkMeshes.push(im);
  }
  console.log('창문', WIN.length);
}
function gable(cx, y, cz, w, d, rh, color, over = 0.6) {
  const rg = w >= d ? roofGeo(w + over * 2, d + over * 2, rh) : roofGeo(d + over * 2, w + over * 2, rh).rotateY(Math.PI / 2);
  rg.translate(cx, y, cz); pushGeo(rg, color);
  // 처마 밑 판재 · 물받이 · 선홈통
  lay(7, () => {
    const ax = w >= d, L = (ax ? w : d) + over * 2, E = (ax ? d : w) / 2 + over, fc = dpick([0xeeece6, 0xd9d6cf, 0x6d6a66, 0x4a3a2c]), gc = dpick([0xb9bcbf, 0xe6e4de, 0x5c5f62]);
    for (const sg of [-1, 1]) {
      if (ax) { box(cx, y - 0.22, cz + sg * E, L, 0.24, 0.05, fc, false); box(cx, y - 0.3, cz + sg * (E + 0.08), L, 0.12, 0.14, gc, false); }
      else { box(cx + sg * E, y - 0.22, cz, 0.05, 0.24, L, fc, false); box(cx + sg * (E + 0.08), y - 0.3, cz, 0.14, 0.12, L, gc, false); }
    }
    const px = ax ? cx + (w / 2 - 0.15) : cx + (w / 2 + 0.08), pz = ax ? cz + (d / 2 + 0.08) : cz + (d / 2 - 0.15), g0 = terrainH(px, pz) - 0.2;
    box(px, g0, pz, 0.1, y - 0.3 - g0, 0.1, gc, false);
    if (ax) box(px, y - 0.42, pz + over / 2 + 0.04, 0.1, 0.1, over + 0.04, gc, false); else box(px + over / 2 + 0.04, y - 0.42, pz, over + 0.04, 0.1, 0.1, gc, false);
  });
}
// 벽걸이 에어컨 실외기
function acUnit(cx, cz, w, d, y, face) {
  const ax = face === '+x' || face === '-x', sg = face[0] === '+' ? 1 : -1;
  const x = ax ? cx + sg * (w / 2 + 0.2) : cx + (drng() - 0.5) * (w - 2.5), z = ax ? cz + (drng() - 0.5) * (d - 2.5) : cz + sg * (d / 2 + 0.2);
  box(x, y, z, ax ? 0.38 : 0.9, 0.62, ax ? 0.9 : 0.38, 0xdedcd6, false);
  box(x + (ax ? sg * 0.2 : 0.12), y + 0.1, z + (ax ? 0.12 : sg * 0.2), ax ? 0.02 : 0.46, 0.44, ax ? 0.46 : 0.02, 0x55585a, false);
  box(x - (ax ? sg * 0.1 : 0), y - 0.1, z - (ax ? 0 : sg * 0.1), ax ? 0.16 : 0.6, 0.1, ax ? 0.6 : 0.16, 0x6a6c6e, false);
}
function yardWall(...args) { const brick = rng() < 0.3; lay(brick ? 3 : 4, () => _yardWall(brick, ...args)); }
function _yardWall(brick, cx, cz, W, D, door, gy) {
  const c = brick ? 0xe3d9cf : pick([0xd8d2c6, 0xc9c2b4, 0xe2dccf, 0xbdb3a2]), t = 0.3, top = gy + 1.5, g = 2.2;
  const seg = (x0, z0, x1, z1) => { const w = Math.max(t, x1 - x0), d = Math.max(t, z1 - z0); const b = minGround((x0 + x1) / 2, (z0 + z1) / 2, w, d) - 0.3; box((x0 + x1) / 2, b, (z0 + z1) / 2, w, top - b, d, c); };
  const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
  if (door === '-z') { seg(x0, z0, cx - g, z0 + t); seg(cx + g, z0, x1, z0 + t); } else seg(x0, z0, x1, z0 + t);
  if (door === '+z') { seg(x0, z1 - t, cx - g, z1); seg(cx + g, z1 - t, x1, z1); } else seg(x0, z1 - t, x1, z1);
  if (door === '-x') { seg(x0, z0 + t, x0 + t, cz - g); seg(x0, cz + g, x0 + t, z1 - t); } else seg(x0, z0 + t, x0 + t, z1 - t);
  if (door === '+x') { seg(x1 - t, z0 + t, x1, cz - g); seg(x1 - t, cz + g, x1, z1 - t); } else seg(x1 - t, z0 + t, x1, z1 - t);
}
function ruralHouse(cx, cz, w, d, door, yard = false) {
  const gy = maxGround(cx, cz, w, d), base = minGround(cx, cz, w, d) - 0.5, H = 3.3, wc = pick(WALL_COLS);
  const brk = rng() < 0.22, tile = rng() < 0.3;
  lay(brk ? 3 : 0, () => box(cx, base, cz, w, gy - base + H, d, brk ? 0xe9e1d8 : wc));
  lay(4, () => box(cx, base, cz, w + 0.3, gy - base + 0.45, d + 0.3, 0xbdb6aa, false));
  lay(tile ? 2 : 1, () => gable(cx, gy + H, cz, w, d, Math.min(w, d) * 0.2 + 0.4, tile ? pick([0xe0d8d0, 0xc8c0b8, 0xb4c0cc]) : pick(ROOF_COLS), 0.7));
  facadeDetail(cx, cz, w, d, gy, 1, 3, door);
  if (yard) yardWall(cx, cz, w + 9, d + 9, door, gy);
}
function signBand(cx, cz, w, d, y, door, c) {
  if (door === '+z') box(cx, y, cz + d / 2 + 0.12, w * 0.85, 0.8, 0.2, c, false);
  else if (door === '-z') box(cx, y, cz - d / 2 - 0.12, w * 0.85, 0.8, 0.2, c, false);
  else if (door === '+x') box(cx + w / 2 + 0.12, y, cz, 0.2, 0.8, d * 0.85, c, false);
  else box(cx - w / 2 - 0.12, y, cz, 0.2, 0.8, d * 0.85, c, false);
}
function flatBuilding(cx, cz, w, d, floors, door, col = pick(CONC_COLS), shop = false) {
  const gy = maxGround(cx, cz, w, d), base = minGround(cx, cz, w, d) - 0.5, fh = 3.1, H = floors * fh + 0.3, pc = shade(col, 0.8);
  const wl = +wpick({ 0: 0.55, 3: 0.25, 4: 0.2 }), wcol = wl === 3 ? 0xe6ddd4 : wl === 4 ? shade(col, 1.15) : col;
  lay(wl, () => box(cx, base, cz, w, gy - base + H, d, wcol));
  lay(4, () => {
    box(cx, gy + H, cz - d / 2 + 0.15, w, 0.8, 0.3, pc, false); box(cx, gy + H, cz + d / 2 - 0.15, w, 0.8, 0.3, pc, false);
    box(cx - w / 2 + 0.15, gy + H, cz, 0.3, 0.8, d, pc, false); box(cx + w / 2 - 0.15, gy + H, cz, 0.3, 0.8, d, pc, false);
    box(cx, gy + H - 0.05, cz, w - 0.4, 0.1, d - 0.4, 0xa9a6a0, false);
    for (let f = 1; f < floors; f++) box(cx, gy + f * fh - 0.1, cz, w + 0.18, 0.24, d + 0.18, pc, false);
  });
  facadeDetail(cx, cz, w, d, gy, floors, fh, door);
  lay(7, () => {
    const gc = dpick([0xb9bcbf, 0xe6e4de, 0x5c5f62]);
    for (const [sx, sz] of [[-1, 1], [1, -1]]) { const px = cx + sx * (w / 2 + 0.07), pz = cz + sz * (d / 2 - 0.3), g0 = terrainH(px, pz) - 0.2; box(px, g0, pz, 0.12, gy + H + 0.5 - g0, 0.12, gc, false); }
    const faces = ['+x', '-x', '+z', '-z'].filter((f) => f !== door), na = (drng() * 3) | 0;
    for (let k = 0; k < na; k++) acUnit(cx, cz, w, d, gy + 0.25 + ((drng() * floors) | 0) * fh + (drng() < 0.5 ? 2.0 : 0), dpick(faces));
  });
  if (shop) lay(7, () => signBand(cx, cz, w, d, gy + 2.55, door, pick([0xc0392b, 0x2e86c1, 0x27ae60, 0xd68910, 0x7d3c98, 0x16a085])));
  if (rng() < 0.7) cyl(cx + w * 0.22, gy + H, cz - d * 0.15, 0.9, 0.9, 1.7, pick([0x2e6fb0, 0xe8e8e8, 0xd9d9d9]), 10);
  if (rng() < 0.6) box(cx - w * 0.25, gy + H, cz + d * 0.15, 1.4, 1.0, 1.0, 0x9aa0a6, false);
  if (floors >= 2 && rng() < 0.5) lay(wl, () => box(cx + w * 0.3, gy + H, cz + d * 0.22, 2.8, 2.6, 2.8, wcol, false));
  return gy;
}
function warehouse(...args) { lay(1, () => _warehouse(...args)); }
function _warehouse(cx, cz, w, d, door, col = pick([0x9fb3c3, 0xc0c8cd, 0xab7a5f, 0x7f9a88, 0xd7d2c6])) {
  const gy = maxGround(cx, cz, w, d), base = minGround(cx, cz, w, d) - 0.5, H = 6.5;
  box(cx, base, cz, w, gy - base + H, d, col);
  gable(cx, gy + H, cz, w, d, 1.8, pick([0x5f6b73, 0x3a6ea5, 0x7d8a8f, 0x8a3b2a]), 0.3);
  const dc = 0x3b4045, dw = Math.min(6, Math.max(w, d) * 0.3);
  if (door === '+z') box(cx, gy, cz + d / 2 + 0.05, Math.min(dw, w * 0.6), 4.6, 0.15, dc, false);
  else if (door === '-z') box(cx, gy, cz - d / 2 - 0.05, Math.min(dw, w * 0.6), 4.6, 0.15, dc, false);
  else if (door === '+x') box(cx + w / 2 + 0.05, gy, cz, 0.15, 4.6, Math.min(dw, d * 0.6), dc, false);
  else box(cx - w / 2 - 0.05, gy, cz, 0.15, 4.6, Math.min(dw, d * 0.6), dc, false);
  const rc = shade(col, 0.85);
  for (let i = 1; i < 6; i++) { box(cx - w / 2 + (w * i) / 6, gy, cz + d / 2 + 0.06, 0.2, H, 0.12, rc, false); box(cx - w / 2 + (w * i) / 6, gy, cz - d / 2 - 0.06, 0.2, H, 0.12, rc, false); }
}
function greenhouse(cx, cz, len, alongX) {
  const gy = minGround(cx, cz, alongX ? len : 6, alongX ? 6 : len) - 0.1;
  const parts = [
    new THREE.CylinderGeometry(3, 3, len, 14, 1, true, 0, Math.PI).rotateZ(Math.PI / 2),
    new THREE.CircleGeometry(3, 14, 0, Math.PI).rotateY(Math.PI / 2).translate(len / 2, 0, 0),
    new THREE.CircleGeometry(3, 14, 0, Math.PI).rotateY(-Math.PI / 2).translate(-len / 2, 0, 0),
  ];
  for (const g of parts) { if (!alongX) g.rotateY(Math.PI / 2); g.translate(cx, gy, cz); pushGeo(g, 0xdfe8e2, 7); }
  if (alongX) addSolid(cx - len / 2, gy - 1, cz - 3, cx + len / 2, gy + 2.6, cz + 3); else addSolid(cx - 3, gy - 1, cz - len / 2, cx + 3, gy + 2.6, cz + len / 2);
}
function chimney(x, z) { lay(4, () => _chimney(x, z)); }
function _chimney(x, z) {
  const b = terrainH(x, z) - 0.5, n = 9, hh = 4.4;
  for (let i = 0; i < n; i++) cyl(x, b + i * hh, z, 1.8 - i * 0.06, 1.86 - i * 0.06, hh, i % 2 ? 0xe8e4dc : 0xa8322a, 14);
  addSolid(x - 1.9, b, z - 1.9, x + 1.9, b + n * hh, z + 1.9);
  for (const [lx, lz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { cyl(x + lx, b, z + lz, 0.16, 0.24, n * hh * 0.85, 0x3a3a3a, 5); addCircle(x + lx, z + lz, 0.3, b + 30); }
  for (let k = 1; k < 7; k++) box(x, b + k * 5, z, 6.4, 0.2, 6.4, 0x3a3a3a, false);
}
function car(...args) { lay(7, () => _car(...args)); }
// 주차된 차: 실사 3D 모델(덮개 씌운 차, Poly Haven covered_car, CC0)을 인스턴싱. 모델이 없으면 상자 차
const CARS = [];
function _car(cx, cz, alongX, col = pick([0xc0392b, 0x2e86c1, 0xe8e8e8, 0x2c2c2c, 0xd4ac0d, 0x7f8c8d, 0x1e8449, 0xf0f0f0])) {
  const gy = terrainH(cx, cz), L = 4.2, W = 1.8, bw = alongX ? L : W, bd = alongX ? W : L;
  if (MODELS.car) { CARS.push({ x: cx, z: cz, y: gy, ry: (alongX ? Math.PI / 2 : 0) + (drng() < 0.5 ? Math.PI : 0) + (drng() - 0.5) * 0.12 }); addSolid(cx - bw / 2, gy - 0.5, cz - bd / 2, cx + bw / 2, gy + 1.45, cz + bd / 2); return; }
  box(cx, gy + 0.3, cz, bw, 0.75, bd, col, false);
  box(cx + (alongX ? -0.25 : 0), gy + 1.05, cz + (alongX ? 0 : -0.25), alongX ? 2.3 : 1.62, 0.62, alongX ? 1.62 : 2.3, 0x27313a, false);
  box(cx + (alongX ? -0.25 : 0), gy + 1.62, cz + (alongX ? 0 : -0.25), alongX ? 2.1 : 1.5, 0.08, alongX ? 1.5 : 2.1, col, false);
  for (const a of [-1.35, 1.35]) for (const b of [-0.88, 0.88]) {
    const g = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10); if (alongX) g.rotateX(Math.PI / 2); else g.rotateZ(Math.PI / 2);
    g.translate(cx + (alongX ? a : b), gy + 0.36, cz + (alongX ? b : a)); pushGeo(g, 0x1a1a1a);
  }
  addSolid(cx - bw / 2, gy - 0.5, cz - bd / 2, cx + bw / 2, gy + 1.6, cz + bd / 2);
}
function parkCar(cx, cz, w, d, door) {
  const off = 4.2;
  let x = cx, z = cz, ax = true;
  if (door === '+z') { z = cz + d / 2 + off; x = cx + w * 0.3; } else if (door === '-z') { z = cz - d / 2 - off; x = cx - w * 0.3; }
  else if (door === '+x') { x = cx + w / 2 + off; z = cz + d * 0.3; ax = false; } else { x = cx - w / 2 - off; z = cz - d * 0.3; ax = false; }
  if (rectFree(x, z, ax ? 4.4 : 2, ax ? 2 : 4.4, 0.3)) car(x, z, ax);
}
function wpick(mix) { let s = 0; for (const k in mix) s += mix[k]; let r = rng() * s; for (const k in mix) { r -= mix[k]; if (r <= 0) return k; } return Object.keys(mix)[0]; }
function scatterBuildings(key, count, mix, rMax = 0.9, floorsMax = 3) {
  const Z = ZONES[key]; let made = 0;
  for (let t = 0; t < count * 60 && made < count; t++) {
    const a = rng() * 6.283, dd = Z.r * rMax * Math.pow(rng(), 0.7), cx = Z.x + Math.cos(a) * dd, cz = Z.z + Math.sin(a) * dd;
    if (roadDist(cx, cz) > 26 && rng() < 0.75) continue;
    const type = wpick(mix);
    if (type === 'rural') {
      const w = 8 + rng() * 3.5, d = 7 + rng() * 2.5, yard = rng() < 0.35;
      if (!rectFree(cx, cz, yard ? w + 9 : w, yard ? d + 9 : d, 2)) continue;
      const door = doorDir(cx, cz); ruralHouse(cx, cz, w, d, door, yard); if (!yard && rng() < 0.2) parkCar(cx, cz, w, d, door);
    } else if (type === 'flat') {
      const w = 9 + rng() * 6, d = 9 + rng() * 4;
      if (!rectFree(cx, cz, w, d, 2.5)) continue;
      const door = doorDir(cx, cz); flatBuilding(cx, cz, w, d, 1 + ((rng() * floorsMax) | 0), door, undefined, rng() < 0.5); if (rng() < 0.3) parkCar(cx, cz, w, d, door);
    } else if (type === 'ware') {
      const w = 16 + rng() * 10, d = 12 + rng() * 5;
      if (!rectFree(cx, cz, w, d, 3)) continue;
      warehouse(cx, cz, w, d, doorDir(cx, cz));
    } else if (type === 'apt') {
      const ax = rng() < 0.5, w = ax ? 30 : 12, d = ax ? 12 : 30;
      if (!rectFree(cx, cz, w, d, 4)) continue;
      flatBuilding(cx, cz, w, d, 5, doorDir(cx, cz), pick([0xe9e4da, 0xd9d2c4, 0xc9d3d9]));
    }
    made++;
  }
  return made;
}
function placeNear(x, z, w, d, m, fn, tries = 80, spread = 40) {
  for (let t = 0; t < tries; t++) {
    const cx = x + (t ? (rng() - 0.5) * spread : 0), cz = z + (t ? (rng() - 0.5) * spread : 0);
    if (rectFree(cx, cz, w, d, m)) { fn(cx, cz); return true; }
  }
  return false;
}
function utilityPole(x, z) { lay(4, () => _utilityPole(x, z)); }
function _utilityPole(x, z) {
  const b = terrainH(x, z) - 0.3;
  cyl(x, b, z, 0.13, 0.17, 9, 0x7b7468, 6); box(x, b + 8.2, z, 1.8, 0.14, 0.14, 0x5a544b, false); addCircle(x, z, 0.25, b + 9);
}
function solarArray(cx, cz) {
  const rows = 6, len = 26;
  if (!fieldFree(cx - len / 2 - 2, cz - 3, cx + len / 2 + 2, cz + rows * 5)) return;
  FIELDS.push({ x0: cx - len / 2 - 2, x1: cx + len / 2 + 2, z0: cz - 3, z1: cz + rows * 5, crop: null });
  for (let r = 0; r < rows; r++) {
    const z = cz + r * 5, gy = terrainH(cx, z);
    const g = new THREE.BoxGeometry(len, 0.12, 3).rotateX(-0.5); g.translate(cx, gy + 1.35, z); pushGeo(g, 0x1c2a44, 7);
    for (let k = -len / 2 + 1; k <= len / 2 - 1; k += 6) cyl(cx + k, gy - 0.2, z, 0.07, 0.07, 1.4, 0x8a8a8a, 5);
    addSolid(cx - len / 2, gy - 0.3, z - 1.4, cx + len / 2, gy + 2.0, z + 1.4);
  }
}

// ───── 구역별 건설 ─────
function buildBeth() {
  const Z = ZONES.beth, gy = TOWN_LEVEL.beth;
  FIELDS.push({ x0: Z.x - 16, x1: Z.x + 16, z0: Z.z - 16, z1: Z.z + 16, crop: 'dirt', alongX: true }); // 광장
  cyl(Z.x - 6, gy - 0.3, Z.z + 6, 1.4, 1.5, 1.2, 0x9a8f80, 14); addCircle(Z.x - 6, Z.z + 6, 1.5, gy + 0.9);
  cyl(Z.x - 6, gy + 0.9, Z.z + 6, 0.08, 0.08, 1.8, 0x5a3d26, 6);
  placeNear(Z.x + 28, Z.z - 2, 14, 11, 1.5, (x, z) => { const g = flatBuilding(x, z, 14, 11, 1, '-x', 0xf3e3c0, true); signs.push({ text: '빵집', x: x - 7.25, y: g + 4.4, z, rotY: -Math.PI / 2 }); });
  // 학교 (운동장 + 담장)
  placeNear(Z.x + 140, Z.z + 90, 64, 48, 2, (x, z) => {
    const g = flatBuilding(x, z - 15, 52, 12, 3, '+z', 0xeadfc6);
    box(x, g, z - 8.6, 10, 9.6, 2.6, 0xd9cdb2);
    FIELDS.push({ x0: x - 28, x1: x + 28, z0: z - 7, z1: z + 21, crop: 'dirt', alongX: true });
    for (const s of [-1, 1]) { const px = x + s * 25, gz = z + 7; box(px, terrainH(px, gz), gz - 2.4, 0.15, 2.4, 0.15, 0xffffff, false); box(px, terrainH(px, gz), gz + 2.4, 0.15, 2.4, 0.15, 0xffffff, false); box(px, terrainH(px, gz) + 2.4, gz, 0.15, 0.15, 4.95, 0xffffff, false); }
    yardWall(x, z, 64, 48, '+z', g);
    signs.push({ text: '학교', x, y: g + 8.2, z: z - 8.6 + 1.4, rotY: 0 });
  }, 120, 80);
  // 비닐하우스 단지
  placeNear(Z.x - 150, Z.z - 70, 46, 60, 2, (x, z) => { for (let i = 0; i < 6; i++) greenhouse(x - 20 + i * 8, z, 56, false); FIELDS.push({ x0: x - 24, x1: x + 24, z0: z - 30, z1: z + 30, crop: null }); }, 120, 90);
  solarArray(Z.x - 120, Z.z + 120);
  scatterBuildings('beth', 78, { rural: 0.62, flat: 0.3, ware: 0.08 }, 0.86, 2);
}
function buildHarbor() {
  const Z = ZONES.harbor, lv = TOWN_LEVEL.harbor;
  // 부두 (만 쪽으로)
  for (const ox of [-60, 0, 60]) {
    const cx = Z.x + ox; let z0 = Z.z + 60; while (terrainH(cx, z0) > 0.6 && z0 < Z.z + 260) z0 += 2;
    const len = 90, cz = z0 - 6 + len / 2;
    lay(5, () => box(cx, -4, cz, 7, 6.4, len, 0xd8c8b0));
    for (let p = 0; p < len; p += 10) { cyl(cx - 3.6, -4, z0 - 6 + p, 0.3, 0.3, 7, 0x3d2c1e, 6); cyl(cx + 3.6, -4, z0 - 6 + p, 0.3, 0.3, 7, 0x3d2c1e, 6); }
    if (ox !== 0) { const bx = cx + (ox > 0 ? 9 : -9), bz = cz + 10; box(bx, -0.6, bz, 4, 1.6, 10, 0xe6e2d8, false); box(bx, 1, bz + 1, 2.6, 1.6, 3, 0x2e5fa3, false); }
  }
  const wc = [0x6f7c86, 0x8a4f3c, 0x5d6b5a, 0x9aa5ad];
  [[-85, -60], [-5, -75], [80, -60], [120, 10]].forEach(([ox, oz], k) => placeNear(Z.x + ox, Z.z + oz, 30, 16, 2, (x, z) => warehouse(x, z, 30, 16, '+z', wc[k]), 40, 30));
  const cc = [0xb23a2e, 0x2e5fa3, 0x3e8a4a, 0xd98c22, 0x7a7f86, 0x8a2f6a];
  for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) {
    if (rng() < 0.25) continue;
    const cx = Z.x - 75 + k * 14, cz = Z.z + 10 + r * 9;
    if (!rectFree(cx, cz, 12, 2.6, 0.5)) continue;
    const b = minGround(cx, cz, 12, 2.6) - 0.3;
    lay(1, () => { box(cx, b, cz, 12, lv - b + 2.6, 2.6, pick(cc)); if (rng() < 0.4) box(cx, lv + 2.6, cz, 12, 2.6, 2.6, pick(cc)); });
  }
  // 공장 + 굴뚝 (미라마풍 랜드마크)
  placeNear(Z.x + 110, Z.z - 120, 50, 30, 2, (x, z) => { warehouse(x + 6, z, 38, 22, '-z', 0xa9a39a); chimney(x - 20, z + 6); chimney(x - 20, z - 6); }, 120, 60);
  const kx = Z.x + 40, kz = Z.z + 50, kb = terrainH(kx, kz);
  lay(6, () => { box(kx, kb, kz, 2, 24, 2, 0xffd36a); box(kx, kb + 24, kz + 8, 1.6, 1.6, 22, 0xffd36a, false); });
  scatterBuildings('harbor', 40, { rural: 0.4, flat: 0.35, ware: 0.25 }, 0.9, 3);
}
function buildMarket() {
  const Z = ZONES.market, canopy = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22];
  for (let k = 0; k < 26; k++) {
    const side = k % 2 ? 1 : -1, cx = Z.x - 160 + Math.floor(k / 2) * 26 + rng() * 4, cz = Z.z + side * 10;
    if (!rectFree(cx, cz, 5.2, 3.6, 0.3)) continue;
    const b = terrainH(cx, cz);
    lay(5, () => box(cx, b - 0.3, cz, 4.4, 1.3, 2, 0xd8c0a0));
    lay(7, () => box(cx, b + 2.6, cz - side * 0.3, 5.2, 0.12, 3.6, canopy[k % canopy.length], false));
    for (const [px, pz] of [[-2.4, -1.6], [2.4, -1.6], [-2.4, 1.6], [2.4, 1.6]]) cyl(cx + px, b, cz + pz, 0.06, 0.06, 2.6, 0x3b2a1a, 5);
  }
  for (let x = Z.x - 170; x <= Z.x + 170; x += 17) for (const s of [-1, 1]) {
    const w = 13 + rng() * 3, d = 11 + rng() * 3, cz = Z.z + s * (21 + d / 2);
    if (rectFree(x, cz, w, d, 1)) flatBuilding(x, cz, w, d, 2 + ((rng() * 2) | 0), s > 0 ? '-z' : '+z', undefined, true);
  }
  for (const [ox, oz] of [[-90, -75], [20, -80], [-40, 80], [90, 75]]) placeNear(Z.x + ox, Z.z + oz, 30, 12, 4, (x, z) => flatBuilding(x, z, 30, 12, 5, doorDir(x, z), pick([0xe9e4da, 0xd9d2c4, 0xc9d3d9])), 40, 30);
  placeNear(640, -190, 22, 30, 2, (x, z) => {
    const gy = terrainH(x, z);
    box(x, gy - 0.3, z + 4, 22, 0.4, 16, 0x8d8a84, false);
    for (const [px, pz] of [[-6, 0], [6, 0], [-6, 8], [6, 8]]) { cyl(x + px, gy, z + pz, 0.25, 0.25, 5, 0xd8d8d8, 8); addCircle(x + px, z + pz, 0.3, gy + 5); }
    box(x, gy + 5, z + 4, 16, 0.7, 11, 0xf2f2f2, false); box(x, gy + 5.45, z + 4, 16.2, 0.35, 11.2, 0xc0392b, false);
    for (const px of [-3, 3]) box(x + px, gy, z + 4, 1, 1.6, 0.7, 0x2e5fa3);
    flatBuilding(x, z - 10, 12, 7, 1, '+z', 0xf0ece2, true);
  }, 80, 60);
  signs.push({ text: '시장', x: Z.x - 185, y: terrainH(Z.x - 185, Z.z) + 6, z: Z.z, rotY: Math.PI / 2 });
  scatterBuildings('market', 18, { flat: 0.6, rural: 0.3, ware: 0.1 }, 0.95, 3);
}
function buildWild() {
  const Z = ZONES.wild;
  for (let k = 0; k < 4; k++) {
    const a = k * 1.7, x = Z.x + Math.cos(a) * 40, z = Z.z + Math.sin(a) * 40;
    if (!rectFree(x, z, 6, 6, 1)) continue;
    const b = terrainH(x, z), g = new THREE.ConeGeometry(3.4, 3.6, 4); g.rotateY(Math.PI / 4); g.translate(x, b + 1.8, z); pushGeo(g, 0x8a6e48);
    addCircle(x, z, 2.6, b + 3.6);
  }
  let made = 0;
  for (let t = 0; t < 600 && made < 12; t++) {
    const a = rng() * 6.28, dd = 30 + rng() * 150, x = Z.x + 60 + Math.cos(a) * dd, z = Z.z + 40 + Math.sin(a) * dd * 0.7, w = 7 + rng() * 5, d = 6 + rng() * 4;
    if (!rectFree(x, z, w, d, 3)) continue;
    const gy = maxGround(x, z, w, d), base = minGround(x, z, w, d) - 0.5, H = 3.2 + (rng() < 0.3 ? 3 : 0), c = pick([0xc9a06a, 0xd4ae7a, 0xb88a58, 0xdcc19a]);
    box(x, base, z, w, gy - base + H, d, c);
    box(x, gy + H, z, w + 0.2, 0.5, d + 0.2, shade(c, 0.85), false);
    for (let i = 0; i < 4; i++) cyl(x - w / 2 + 1 + i * (w - 2) / 3, gy + H - 0.6, z + d / 2 + 0.3, 0.12, 0.12, 0.2, 0x5a3d26, 5);
    facadeDetail(x, z, w, d, gy, 1, 3, doorDir(x, z), 0x3a2c22);
    made++;
  }
  placeNear(Z.x + 90, Z.z - 20, 8, 8, 2, (x, z) => { const b = terrainH(x, z); for (const [lx, lz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { cyl(x + lx, b, z + lz, 0.15, 0.2, 10, 0x6b5a48, 5); addCircle(x + lx, z + lz, 0.25, b + 10); } cyl(x, b + 10, z, 2.8, 2.8, 4, 0x9fa7a8, 16); }, 60, 60);
}
function buildFarmsteads() {
  let made = 0;
  for (let t = 0; t < 4000 && made < 40; t++) {
    const r = ROADS[(rng() * 8) | 0], P = r.pts, i = (rng() * (P.length - 2)) | 0, a = P[i], b = P[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L, side = rng() < 0.5 ? -1 : 1, off = 16 + rng() * 16;
    const cx = a[0] - dz * off * side, cz = a[1] + dx * off * side;
    let inZone = false; for (const k in ZONES) if (Math.hypot(cx - ZONES[k].x, cz - ZONES[k].z) < ZONES[k].r + 15) inZone = true;
    if (inZone) continue;
    const w = 8 + rng() * 3, d = 7 + rng() * 2, yard = rng() < 0.55;
    if (!rectFree(cx, cz, yard ? w + 9 : w + 2, yard ? d + 9 : d + 2, 2)) continue;
    const door = doorDir(cx, cz); ruralHouse(cx, cz, w, d, door, yard);
    if (rng() < 0.4) { const bx = cx + (rng() < 0.5 ? -1 : 1) * (w / 2 + 12); placeNear(bx, cz, 14, 10, 2, (x, z) => warehouse(x, z, 14, 10, doorDir(x, z)), 10, 8); }
    for (let f = 0; f < 3; f++) {
      const fw = 26 + rng() * 30, fd = 20 + rng() * 26, fx = cx + (rng() - 0.5) * 120, fz = cz + (rng() - 0.5) * 120;
      addField(fx, fz, fw, fd, cz > 280 ? pick(['rice', 'green', 'plowed', 'cabbage', 'green', 'rice']) : pick(['green', 'plowed', 'cabbage', 'rice']));
    }
    made++;
  }
}
function buildFieldsAround() {
  for (const key of ['beth', 'harbor']) {
    const Z = ZONES[key];
    for (let t = 0; t < 420; t++) {
      const a = rng() * 6.28, dd = Z.r * (0.95 + rng() * 0.8), w = 24 + rng() * 34, d = 18 + rng() * 28;
      addField(Z.x + Math.cos(a) * dd, Z.z + Math.sin(a) * dd, w, d, pick(['rice', 'rice', 'green', 'plowed', 'cabbage', 'green']));
    }
  }
  for (let t = 0; t < 400; t++) {
    const x = (rng() * 2 - 1) * 700, z = -560 + rng() * 760, w = 22 + rng() * 26, d = 18 + rng() * 22;
    if (terrainH(x, z) > 32 || gauss(x, z, -650, 0, 240) > 0.15) continue;
    addField(x, z, w, d, pick(['green', 'plowed', 'cabbage', 'rice']));
  }
  for (let t = 0; t < 800; t++) {
    const x = (rng() * 2 - 1) * 820, z = 360 + rng() * 420, w = 24 + rng() * 34, d = 18 + rng() * 28;
    addField(x, z, w, d, pick(['rice', 'green', 'plowed', 'cabbage', 'green']));
  }
}
function buildFences() {
  for (const f of FIELDS) {
    if (!f.crop || f.crop === 'dirt' || rng() < 0.55) continue;
    const c = 0x8a7a62, post = (x, z) => cyl(x, terrainH(x, z) - 0.2, z, 0.06, 0.06, 1.3, c, 4);
    for (let x = f.x0; x <= f.x1; x += 4) { post(x, f.z0 - 0.6); post(x, f.z1 + 0.6); }
    for (let z = f.z0; z <= f.z1; z += 4) { post(f.x0 - 0.6, z); post(f.x1 + 0.6, z); }
  }
}
function buildPoles() {
  for (const r of ROADS) {
    if (r.kind !== 'asphalt') continue;
    let acc = 0;
    for (let i = 1; i < r.pts.length - 1; i++) {
      const a = r.pts[i - 1], b = r.pts[i + 1], p = r.pts[i];
      acc += Math.hypot(p[0] - a[0], p[1] - a[1]) / 2; if (acc < 42) continue; acc = 0;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, px = -(b[1] - a[1]) / L, pz = (b[0] - a[0]) / L;
      const x = p[0] + px * (r.w / 2 + 2.2), z = p[1] + pz * (r.w / 2 + 2.2);
      if (terrainH(x, z) < 1 || onBridge(x, z) || footprintBlocked(x, z, 1) || inField(x, z)) continue;
      utilityPole(x, z);
    }
  }
}
function buildLighthouse() {
  const x = 840, z = -870, b = terrainH(x, z) - 0.5;
  for (let i = 0; i < 6; i++) cyl(x, b + i * 3.4, z, 2.4 - i * 0.12, 2.5 - i * 0.12, 3.4, i % 2 ? 0xc0392b : 0xf2f2f2, 16);
  cyl(x, b + 20.4, z, 1.6, 1.6, 2.2, 0xf6e7a0, 12); cyl(x, b + 22.6, z, 0.2, 2, 1.6, 0x333333, 12);
}

function plasterTexture() {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d'), img = x.createImageData(S, S), d = img.data, r = mulberry32(31);
  for (let i = 0; i < S * S; i++) { const px = i % S, py = (i / S) | 0; const n = vnoise(px / 22, py / 22) * 0.55 + vnoise(px / 6, py / 6) * 0.25; const v = 228 + n * 22 + (r() - 0.5) * 14; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = clamp(v, 170, 255); d[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  for (let k = 0; k < 40; k++) { const sx = r() * S, sy = r() * S, h = 20 + r() * 60; const g = x.createLinearGradient(0, sy, 0, sy + h); g.addColorStop(0, 'rgba(60,55,45,0)'); g.addColorStop(1, 'rgba(60,55,45,0.10)'); x.fillStyle = g; x.fillRect(sx, sy, 2 + r() * 5, h); }
  x.strokeStyle = 'rgba(0,0,0,0.05)'; for (let y = 0; y < S; y += 32) { x.beginPath(); x.moveTo(0, y); x.lineTo(S, y); x.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function finishBuildings() {
  const merged = mergeGeometries(visParts, false);
  const bm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 });
  bm.onBeforeCompile = (sh) => {
    sh.uniforms.uArr = { value: TEX.array }; sh.uniforms.uNor = { value: TEX.narray }; sh.uniforms.uAvg = { value: TEX.arrayAvg };
    sh.uniforms.uScale = { value: [4.5, 2.0, 2.4, 2.6, 3.4, 2.4, 2.6] };
    sh.uniforms.uNStr = { value: [0.9, 1.1, 1.3, 1.4, 0.8, 1.2, 1.0] };
    sh.uniforms.uRough = { value: [0.93, 0.42, 0.62, 0.86, 0.9, 0.8, 0.62, 0.7] };
    sh.uniforms.uMetal = { value: [0.0, 0.45, 0.0, 0.0, 0.0, 0.0, 0.3, 0.0] };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float layer; attribute float gnd; varying float vLayer; varying float vGnd; varying vec3 vWPos; varying vec3 vWNrm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vLayer = layer; vGnd = gnd; vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNrm = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform highp sampler2DArray uArr; uniform highp sampler2DArray uNor; uniform float uAvg[7]; uniform float uScale[7]; uniform float uNStr[7]; uniform float uRough[8]; uniform float uMetal[8];
varying float vLayer; varying float vGnd; varying vec3 vWPos; varying vec3 vWNrm;
float bHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bHash(i), bHash(i + vec2(1.0, 0.0)), f.x), mix(bHash(i + vec2(0.0, 1.0)), bHash(i + vec2(1.0, 1.0)), f.x), f.y); }
float bTexL = 0.5;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  int bL = int(vLayer + 0.5);
  vec3 bN = normalize(vWNrm);
  vec3 bw = pow(abs(bN), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
  if (bL < 7) {
    float sc = uScale[bL], lf = float(bL);
    vec3 tx3 = texture(uArr, vec3(vWPos.zy / sc, lf)).rgb * bw.x + texture(uArr, vec3(vWPos.xz / sc, lf)).rgb * bw.y + texture(uArr, vec3(vWPos.xy / sc, lf)).rgb * bw.z;
    float lum = dot(tx3, vec3(0.2126, 0.7152, 0.0722));
    if (bL <= 1) tx3 = vec3(lum);
    vec3 tn = tx3 / uAvg[bL]; if (bL == 0) tn = mix(vec3(1.0), tn, 0.75);
    bTexL = lum / uAvg[bL];
    diffuseColor.rgb *= tn;
  }
  // 바닥 쪽 그늘 · 흙탕 자국, 빗물 얼룩, 건물마다 다른 낡음
  float hA = vWPos.y - vGnd;
  float side = 1.0 - smoothstep(0.55, 0.8, abs(bN.y));
  float horiz = dot(vWPos.xz, abs(bN.x) > abs(bN.z) ? vec2(0.0, 1.0) : vec2(1.0, 0.0));
  float ao = mix(0.62, 1.0, smoothstep(-0.3, 1.4, hA + bNoise(vec2(horiz * 1.3, 0.0)) * 0.5));
  float dirt = (1.0 - smoothstep(0.0, 0.9 + bNoise(vec2(horiz * 0.7, 3.0)) * 0.8, hA)) * side;
  float streak = smoothstep(0.45, 0.95, bNoise(vec2(horiz * 2.2, vWPos.y * 0.06))) * bNoise(vec2(horiz * 9.0, vWPos.y * 0.5)) * side;
  float age = bNoise(vWPos.xz * 0.035) * 0.16 + bNoise(vWPos.xz * 0.21 + vWPos.y * 0.13) * 0.08;
  if (bL < 7) {
    diffuseColor.rgb *= ao * (1.0 - streak * 0.28) * (0.96 - age * 0.5 + 0.08);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.7, 0.58), dirt * 0.55);
  } else diffuseColor.rgb *= mix(0.75, 1.0, smoothstep(-0.3, 1.0, hA));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  { int rL = int(vLayer + 0.5); roughnessFactor = clamp(uRough[rL] + (0.5 - bTexL * 0.5) * 0.12 + streak * 0.05, 0.05, 1.0);
    if (rL == 7 && dot(vColor, vec3(0.333)) < 0.03) roughnessFactor = 0.08; }`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = uMetal[int(vLayer + 0.5)];')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (bL < 7) {
    float sc = uScale[bL], lf = float(bL), ns = uNStr[bL];
    vec3 tX = texture(uNor, vec3(vWPos.zy / sc, lf)).xyz * 2.0 - 1.0;
    vec3 tY = texture(uNor, vec3(vWPos.xz / sc, lf)).xyz * 2.0 - 1.0;
    vec3 tZ = texture(uNor, vec3(vWPos.xy / sc, lf)).xyz * 2.0 - 1.0;
    tX = vec3(tX.xy * ns + bN.zy, bN.x); tY = vec3(tY.xy * ns + bN.xz, bN.y); tZ = vec3(tZ.xy * ns + bN.xy, bN.z);
    vec3 nW = normalize(tX.zyx * bw.x + tY.xzy * bw.y + tZ.xyz * bw.z);
    normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
  }`);
  };
  bm.customProgramCacheKey = () => 'bld-array-2';
  const m = new THREE.Mesh(merged, bm);
  m.castShadow = !LOW; m.receiveShadow = !LOW; scene.add(m);
  visParts.length = 0;
  buildWindows(); buildCars();
}
function buildCars() {
  if (!CARS.length || !MODELS.car) return;
  const im = new THREE.InstancedMesh(MODELS.car.geometry, MODELS.car.material, CARS.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1), pp = new THREE.Vector3(), c = new THREE.Color();
  CARS.forEach((o, i) => { q.setFromAxisAngle(up, o.ry); pp.set(o.x, o.y - 0.03, o.z); m4.compose(pp, q, sc); im.setMatrixAt(i, m4); im.setColorAt(i, c.setHex(dpick([0xffffff, 0xd8e0e8, 0xe8e0c8, 0xc8d8c0, 0xf0f0f0])).multiplyScalar(1.0 + drng() * 0.5)); });
  im.castShadow = !LOW; im.receiveShadow = !LOW; im.computeBoundingSphere(); scene.add(im);
}

// ───────────────────────── 글자 텍스처 ─────────────────────────
function labelTexture(text, opts = {}) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 112;
  const x = cv.getContext('2d');
  x.fillStyle = opts.bg || 'rgba(12,12,12,.72)';
  x.fillRect(8, 10, 240, 82);
  x.fillStyle = opts.accent || '#f2a900'; x.fillRect(8, 10, 8, 82);
  x.fillStyle = '#fff'; x.font = `900 ${opts.size || 56}px "Noto Sans KR", sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 134, 53);
  x.fillStyle = opts.bg || 'rgba(12,12,12,.72)';
  x.beginPath(); x.moveTo(116, 92); x.lineTo(140, 92); x.lineTo(128, 106); x.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function glowTexture(inner, outer) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(0.35, outer); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function woodTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  x.fillStyle = '#8a6438'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#7c5730' : '#946c3e'; x.fillRect(0, i * 32 + 2, 128, 28); }
  x.strokeStyle = '#4a321a'; x.lineWidth = 8; x.strokeRect(4, 4, 120, 120);
  x.beginPath(); x.moveTo(8, 8); x.lineTo(120, 120); x.stroke();
  x.fillStyle = '#f2a900'; x.fillRect(50, 54, 28, 20);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildSigns() {
  for (const s of signs) {
    const t = labelTexture(s.text, { size: 60 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.9), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.7 }));
    m.position.set(s.x, s.y, s.z); m.rotation.y = s.rotY; scene.add(m);
  }
}

// ───────────────────────── 식생: 바람 셰이더 · 풀 · 잎 카드 ─────────────────────────
// (참고 예시의 TSL 바람 셰이더를 WebGL용 onBeforeCompile로 옮김)
const WIND = { time: { value: 0 } };
const WIND_GLSL = `
#ifdef USE_INSTANCING
  vec3 iOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float iScale = length(instanceMatrix[0].xyz);
#else
  vec3 iOrigin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float iScale = 1.0;
#endif
  float wPhase = iOrigin.x * uWindFreq + iOrigin.z * uWindFreq * 0.75;
  float hW = clamp((transformed.y - uWindMinY) / uWindH, 0.0, 1.5); hW *= hW;
  float gust = 0.5 * sin(uTime * uWindSpeed * 0.45 + wPhase * 0.5) + 0.75;
  float wave = sin(uTime * uWindSpeed + wPhase) * gust + cos(uTime * uWindSpeed * 2.3 + transformed.x + wPhase) * 0.18;
  vec3 wOff = vec3(wave, -abs(wave) * 0.22, wave * 0.55) * uWindStrength * hW;
#ifdef USE_INSTANCING
  transformed += (transpose(mat3(instanceMatrix)) * wOff) / max(iScale * iScale, 0.0001);
#else
  transformed += wOff;
#endif
#ifdef GRASS_FADE
  transformed *= 1.0 - smoothstep(uFadeStart, uFadeEnd, distance(iOrigin.xz, cameraPosition.xz));
#endif
`;
function addWind(mat, o) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = WIND.time;
    for (const [k, v] of [['uWindSpeed', o.speed], ['uWindStrength', o.strength], ['uWindFreq', o.freq], ['uWindMinY', o.minY], ['uWindH', o.h], ['uFadeStart', o.fade ? o.fade[0] : 0], ['uFadeEnd', o.fade ? o.fade[1] : 1]]) sh.uniforms[k] = { value: v };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uWindSpeed, uWindStrength, uWindFreq, uWindMinY, uWindH, uFadeStart, uFadeEnd;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + WIND_GLSL);
    if (o.keepNormal) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);');
  };
  const tag = `wind-${o.fade ? 'g' : 't'}-${o.keepNormal ? 'n' : ''}-${o.strength}-${o.minY}`;
  mat.customProgramCacheKey = () => tag;
  if (o.fade) mat.defines = { ...(mat.defines || {}), GRASS_FADE: '' };
  return mat;
}
function crossedGeo(w, h, n = 3, upNormals = true, segY = 2) {
  const list = [];
  for (let i = 0; i < n; i++) { const p = new THREE.PlaneGeometry(w, h, 1, segY); p.translate(0, h / 2, 0); p.rotateY((i * Math.PI) / n); list.push(p); }
  const g = mergeGeometries(list, false);
  if (upNormals) { const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0); }
  return g;
}
function paintColor(g, color, vary = 0.15, seed = 1) {
  const r = mulberry32(seed), c = leafTint(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const k = 1 - vary / 2 + r() * vary; a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
function grassTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'), r = mulberry32(42);
  for (let i = 0; i < 14; i++) {
    const bx = 24 + r() * 208, w = 10 + r() * 8, h = 150 + r() * 104, lean = (r() - 0.5) * 50, hue = 78 + r() * 18, l = 38 + r() * 18, tipX = bx + lean, tipY = 256 - h;
    const g = x.createLinearGradient(0, 256, 0, tipY);
    g.addColorStop(0, `hsl(${hue - 10},50%,16%)`); g.addColorStop(0.35, `hsl(${hue},56%,${l * 0.72}%)`); g.addColorStop(0.8, `hsl(${hue + 4},62%,${l}%)`); g.addColorStop(1, `hsl(${hue + 10},68%,${l + 12}%)`);
    x.fillStyle = g; x.beginPath(); x.moveTo(bx - w / 2, 256);
    x.quadraticCurveTo(bx - w * 0.35 + lean * 0.35, 256 - h * 0.55, tipX, tipY);
    x.quadraticCurveTo(bx + w * 0.35 + lean * 0.35, 256 - h * 0.55, bx + w / 2, 256); x.closePath(); x.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function leafTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'), r = mulberry32(7);
  for (let i = 0; i < 320; i++) {
    const a = r() * 6.283, d = Math.sqrt(r()) * 104, cx = 128 + Math.cos(a) * d, cy = 128 + Math.sin(a) * d * 0.92;
    x.fillStyle = `hsl(0,0%,${48 + r() * 50}%)`;
    x.save(); x.translate(cx, cy); x.rotate(r() * 6.283); x.beginPath(); x.ellipse(0, 0, 8 + r() * 6, 3.8 + r() * 2.4, 0, 0, 6.283); x.fill(); x.restore();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// 사진 잎 · 나무껍질 (Poly Haven island_tree_01, CC0) — 잎 사진을 조합해 만든 잎뭉치 카드
const FOL = { leaf: null, bark: null, barkN: null, avg: new THREE.Color(1, 1, 1) };
// 실사 3D 모델 묶음 (Poly Haven CC0: island_tree_02 줄기, quiver_tree_02, covered_car) + 실제 3D 잎·솔잎·풀을 렌더링해 만든 텍스처
const MODELS = {};
const CANOPY_PTS = [[-0.982, 2.147, 1.491], [1.901, 3.063, 2.578], [0.968, 1.899, -0.773], [-1.402, 2.701, -0.969], [1.182, 1.74, 1.255], [-0.721, 1.257, -0.09], [0.269, 3.192, 0.854], [0.277, 2.872, 2.545], [-0.214, 1.461, 2.448], [-1.809, 2.374, 0.416], [-0.228, 2.552, -0.271], [-1.642, 2.397, 2.624], [1.629, 1.779, 2.477], [1.689, 2.869, 0.892], [-0.031, 1.319, 1.177], [0.48, 1.808, 0.255], [0.242, 2.324, 1.542], [1.134, 2.616, 1.976], [-0.515, 2.019, 0.567], [-0.592, 2.408, 2.377], [-1.64, 1.653, 1.993], [-0.81, 3.276, -0.497], [0.938, 2.206, 2.88], [0.672, 2.642, -0.199], [0.86, 2.511, 0.791], [-0.605, 1.997, -0.857], [1.848, 2.298, 1.54], [1.672, 3.278, 1.767], [-1.022, 2.538, 0.121], [-1.303, 1.432, 1.172]];
const CANOPY_CTR = [0.075, 2.288, 1.069];
async function loadModels() {
  const L = new THREE.TextureLoader();
  const [{ default: b64 }, leafC, pineC, shrubC, grassR] = await Promise.all([import('./assets/models.js'), ...['leaf_cluster', 'pine_cluster', 'shrub_dry', 'grass_real'].map((n) => L.loadAsync(`assets/${n}.png`))]);
  for (const t of [leafC, pineC, shrubC, grassR]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; }
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(bin, '', res, rej));
  gltf.scene.traverse((o) => { if (!o.isMesh) return; o.material.roughness = 0.92; if (o.name === 'trunk_broad') MODELS.trunk = o; if (o.name === 'quiver') MODELS.quiver = o; if (o.name === 'covered_car') { MODELS.car = o; o.material.roughness = 0.75; } });
  Object.assign(MODELS, { leafC, pineC, shrubC, grassR });
  MODELS.leafAvg = new THREE.Color().setRGB(64 / 255, 66 / 255, 35 / 255, THREE.SRGBColorSpace);
  MODELS.pineAvg = new THREE.Color().setRGB(50 / 255, 53 / 255, 34 / 255, THREE.SRGBColorSpace);
  MODELS.shrubAvg = new THREE.Color().setRGB(82 / 255, 76 / 255, 55 / 255, THREE.SRGBColorSpace);
}
async function loadFoliage() {
  const L = new THREE.TextureLoader();
  const [leaf, bark, barkN] = await Promise.all(['assets/foliage.png', 'assets/bark_diff.jpg', 'assets/bark_nor.jpg'].map((u) => L.loadAsync(u)));
  leaf.colorSpace = THREE.SRGBColorSpace; leaf.anisotropy = 4;
  bark.colorSpace = THREE.SRGBColorSpace; bark.wrapS = bark.wrapT = THREE.RepeatWrapping; bark.anisotropy = 4;
  barkN.wrapS = barkN.wrapT = THREE.RepeatWrapping;
  Object.assign(FOL, { leaf, bark, barkN });
  FOL.avg.setRGB(82 / 255, 90 / 255, 29 / 255, THREE.SRGBColorSpace); // 잎 사진의 평균색
}
// 원하는 잎 색을 내도록 사진 평균색으로 나눈 정점색
function leafTint(hex, k = 0.8, avg = FOL.avg) { const c = new THREE.Color(hex); return c.setRGB(c.r / avg.r * k, c.g / avg.g * k, c.b / avg.b * k); }
// 잎 카드로 만든 나무 수관 (교차 사각형 여러 장, 바깥쪽을 향하는 법선)
function canopyGeo(color, seed, { rad = 2.4, cy = 4.7, n = 12, size = 3.0, flat = 1, cone = 0, pts = null, ctr = null, S = 1, atlas = false, avg = FOL.avg, k = 0.8, mirror = 1 } = {}) {
  const r = mulberry32(seed), base = leafTint(color, k, avg), pos = [], nrm = [], uv = [], col = [], idx = [];
  let cx0 = 0, cz0 = 0;
  if (pts) { n = pts.length; cy = ctr[1] * S; cx0 = ctr[0] * S; cz0 = ctr[2] * S * mirror; }
  for (let i = 0; i < n; i++) {
    let ox, oy, oz;
    if (pts) { const p = pts[i]; ox = p[0] * S + (r() - 0.5) * 0.4 - cx0; oy = p[1] * S + (r() - 0.5) * 0.3; oz = p[2] * S * mirror + (r() - 0.5) * 0.4 - cz0; }
    else if (cone) { const tt = r(), a = r() * 6.283, rr = rad * (1 - tt) * (0.35 + r() * 0.7); ox = Math.cos(a) * rr; oz = Math.sin(a) * rr; oy = cy + tt * cone; }
    else { const a = r() * 6.283, e = (r() - 0.35) * 1.3, d = rad * (0.3 + r() * 0.65); ox = Math.cos(a) * Math.cos(e) * d; oy = cy + Math.sin(e) * d * 0.75 * flat; oz = Math.sin(a) * Math.cos(e) * d; }
    for (let k = 0; k < 2; k++) {
      const rot = r() * 3.1416 + k * 1.5708, tilt = (r() - 0.5) * 0.9, ux = Math.cos(rot), uz = Math.sin(rot);
      const vx = -Math.sin(tilt) * uz, vy = Math.cos(tilt), vz = Math.sin(tilt) * ux, s = (size * (0.75 + r() * 0.5)) / 2;
      const shadeK = (cone ? 0.7 + 0.45 * (oy - cy) / cone : oy < cy ? 0.78 : 1.0) * (0.85 + r() * 0.3), b = pos.length / 3;
      const cell = atlas ? (r() * 4) | 0 : 0, u0 = atlas ? (cell % 2) * 0.5 : 0, v0 = atlas ? (cell >> 1) * 0.5 : 0, us = atlas ? 0.25 : 0.5;
      for (const [cu, cv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const px = ox + ux * cu * s + vx * cv * s, py = oy + vy * cv * s, pz = oz + uz * cu * s + vz * cv * s;
        pos.push(px + cx0, py, pz + cz0);
        const nx = px, ny = (py - cy - cone * 0.4) + 1.2, nz = pz, L = Math.hypot(nx, ny, nz) || 1; nrm.push(nx / L, ny / L, nz / L);
        uv.push(u0 + (cu + 1) * us, v0 + (cv + 1) * us); col.push(base.r * shadeK, base.g * shadeK, base.b * shadeK);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  return g;
}

// 플레이어 주변 풀 (16m 타일을 재활용하며 따라다님)
const GRASS = { T: 16, R: LOW ? 3 : 4, PER: LOW ? 240 : 460, tiles: new Map(), pool: [], queue: [], cx: null, cz: null };
function initGrass() {
  const real = !!MODELS.grassR;
  const geo = real ? crossedGeo(1.2, 0.6, 3, true, 2) : crossedGeo(1.1, 0.85, 3, true, 2);
  if (real) { const uv = geo.attributes.uv, per = uv.count / 3; for (let i = 0; i < 3; i++) for (let j = 0; j < per; j++) { const q = i * per + j; uv.setY(q, (i % 2) * 0.5 + uv.getY(q) * 0.5); } }
  const mat = new THREE.MeshStandardMaterial({ map: real ? MODELS.grassR : grassTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 });
  const far = GRASS.R * GRASS.T;
  addWind(mat, { speed: 2.4, strength: 0.4, freq: 0.12, minY: 0, h: 1.0, fade: [far - 16, far - 2], keepNormal: true });
  const n = (GRASS.R * 2 + 1) ** 2;
  for (let i = 0; i < n; i++) {
    const im = new THREE.InstancedMesh(geo, mat, GRASS.PER);
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(GRASS.PER * 3), 3);
    im.count = 0; im.visible = false; im.receiveShadow = !LOW; im.castShadow = false;
    scene.add(im); GRASS.pool.push(im);
  }
}
const _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _gq2 = new THREE.Quaternion(), _gs = new THREE.Vector3(), _gp = new THREE.Vector3(), _gn = new THREE.Vector3(), _gu = new THREE.Vector3(0, 1, 0), _gc = new THREE.Color();
function fillGrassTile(im, tx, tz) {
  const T = GRASS.T, x0 = tx * T, z0 = tz * T, r = mulberry32(((tx * 73856093) ^ (tz * 19349663)) >>> 0);
  const fl = FIELDS.filter((f) => f.x1 > x0 - 1 && f.x0 < x0 + T + 1 && f.z1 > z0 - 1 && f.z0 < z0 + T + 1);
  let k = 0, hs = 0;
  for (let i = 0; i < GRASS.PER * 1.4 && k < GRASS.PER; i++) {
    const x = x0 + r() * T, z = z0 + r() * T, h = terrainH(x, z);
    if (h < 1.3) continue;
    let bad = false; for (const f of fl) if (x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1) { bad = true; break; }
    if (bad || roadDist(x, z) < 0.6 || footprintBlocked(x, z, 0.25)) continue;
    const rw = gauss(x, z, -650, 0, 240); if (rw > 0.3 && r() > (MODELS.grassR ? 0.12 : 0.22)) continue;
    let tm = 0; for (const kk in TOWN_LEVEL) tm = Math.max(tm, zoneMask(kk, x, z)); if (tm > 0.3 && r() > 0.4) continue;
    const hx = terrainH(x + 1, z) - h, hz = terrainH(x, z + 1) - h; if (Math.abs(hx) + Math.abs(hz) > 1.6) continue;
    _gn.set(-hx, 1, -hz).normalize().lerp(_gu, 0.6).normalize();
    _gq.setFromUnitVectors(_gu, _gn); _gq2.setFromAxisAngle(_gu, r() * 6.283); _gq.multiply(_gq2);
    const sxz = 0.8 + r() * 0.6; _gs.set(sxz, 0.55 + r() * 0.6, sxz); _gp.set(x, h - 0.05, z);
    _gm.compose(_gp, _gq, _gs); im.setMatrixAt(k, _gm);
    if (MODELS.grassR) { const kk = 2.0 + r() * 0.6 - smooth(0, 0.25, forestDensity(x, z)) * 0.4, dry = Math.max(smooth(0.12, 0.3, rw), smooth(2.6, 2.0, h) * 0.8, smooth(0.1, 0.5, fbm(x * 0.006 + 7, z * 0.006 - 3, 3)) * 0.35); _gc.setRGB(kk * (1 + dry * 0.95), kk * (1 + dry * 0.5), kk * (1 - dry * 0.45)); }
    else if (rw > 0.3) _gc.setHSL(0.11 + r() * 0.03, 0.42, 0.42 + r() * 0.12);
    else _gc.setHSL(0.19 + (r() - 0.5) * 0.05 - smooth(0.1, 0.45, fbm(x * 0.006 + 7, z * 0.006 - 3, 3)) * 0.05, 0.32 + r() * 0.16, 0.3 + r() * 0.12 - smooth(0, 0.25, forestDensity(x, z)) * 0.08);
    im.setColorAt(k, _gc); hs += h; k++;
  }
  im.count = k; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
  im.boundingSphere = new THREE.Sphere(new THREE.Vector3(x0 + T / 2, k ? hs / k : 0, z0 + T / 2), T * 0.75 + 3);
}
function updateGrass(force = false) {
  const T = GRASS.T, R = GRASS.R, cx = Math.floor(P.x / T), cz = Math.floor(P.z / T);
  if (cx !== GRASS.cx || cz !== GRASS.cz) {
    GRASS.cx = cx; GRASS.cz = cz;
    const need = new Set();
    for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) need.add(`${cx + a},${cz + b}`);
    for (const [k, im] of GRASS.tiles) if (!need.has(k)) { GRASS.tiles.delete(k); im.visible = false; GRASS.pool.push(im); }
    GRASS.queue = [...need].filter((k) => !GRASS.tiles.has(k)).sort((p, q) => { const [a1, b1] = p.split(',').map(Number), [a2, b2] = q.split(',').map(Number); return (a1 - cx) ** 2 + (b1 - cz) ** 2 - ((a2 - cx) ** 2 + (b2 - cz) ** 2); });
  }
  let budget = force ? 9999 : 3;
  while (budget-- > 0 && GRASS.queue.length) {
    const k = GRASS.queue.shift(); if (GRASS.tiles.has(k)) continue;
    const im = GRASS.pool.pop(); if (!im) break;
    const [tx, tz] = k.split(',').map(Number); fillGrassTile(im, tx, tz); im.visible = true; GRASS.tiles.set(k, im);
  }
}

// ───────────────────────── 나무 · 바위 (구역별 인스턴싱) ─────────────────────────
function mergedColored(parts) { const arr = parts.map(([g, c]) => { const gg = g.index ? g.toNonIndexed() : g; if (gg.attributes.uv) gg.deleteAttribute('uv'); tmpCol.set(c); const n = gg.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = tmpCol.r; a[i * 3 + 1] = tmpCol.g; a[i * 3 + 2] = tmpCol.b; } gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); return gg; }); return mergeGeometries(arr, false); }
const chunkMeshes = [];
function scatterInstanced(parts, list) {
  const CH = 250, buckets = new Map();
  for (const it of list) { const k = Math.floor((it.x + HALF) / CH) * 100 + Math.floor((it.z + HALF) / CH); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(it); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (const arr of buckets.values()) {
    let cx = 0, cz = 0; for (const it of arr) { cx += it.x; cz += it.z; } cx /= arr.length; cz /= arr.length;
    for (const part of parts) {
      const im = new THREE.InstancedMesh(part.geo, part.mat, arr.length);
      arr.forEach((it, i) => { e.set(0, it.rot, 0); q.setFromEuler(e); s.setScalar(it.s); p.set(it.x, it.y, it.z); m4.compose(p, q, s); im.setMatrixAt(i, m4); });
      im.computeBoundingSphere(); im.castShadow = !!part.cast && !LOW; im.receiveShadow = false;
      if (part.depth) im.customDepthMaterial = part.depth;
      im.userData.cx = cx; im.userData.cz = cz;
      scene.add(im); chunkMeshes.push(im);
    }
  }
}
const TREE_SPOTS = [];
function buildNature(itemSpots) {
  const canopy = (c, s = 1) => [
    [new THREE.CylinderGeometry(0.2, 0.32, 3.2, 6).translate(0, 1.6, 0), 0x4e3a28],
    [new THREE.IcosahedronGeometry(2.3 * s, 0).translate(0, 4.4, 0), c],
    [new THREE.IcosahedronGeometry(1.7 * s, 0).translate(1.2, 5.3, 0.4), c],
    [new THREE.IcosahedronGeometry(1.6 * s, 0).translate(-1.0, 5.0, -0.7), c],
  ];
  const G = {
    pine: mergedColored([
      [new THREE.CylinderGeometry(0.18, 0.28, 3, 6).translate(0, 1.5, 0), 0x4b3523],
      [new THREE.ConeGeometry(2.4, 4.2, 7).translate(0, 4.2, 0), 0x2f4a26],
      [new THREE.ConeGeometry(1.9, 3.6, 7).translate(0, 6.2, 0), 0x35552b],
      [new THREE.ConeGeometry(1.3, 3.0, 7).translate(0, 8.0, 0), 0x3c5f2f],
    ]),
    broad: mergedColored(canopy(0x4f7a32)),
    broad2: mergedColored(canopy(0x6a8a3a, 0.9)),
    orange: mergedColored(canopy(0xd27a2c)),
    red: mergedColored(canopy(0xb8432c, 0.95)),
    yellow: mergedColored(canopy(0xd9aa3a)),
    olive: mergedColored([
      [new THREE.CylinderGeometry(0.22, 0.35, 2.4, 6).translate(0, 1.2, 0), 0x5a4632],
      [new THREE.IcosahedronGeometry(2.1, 0).scale(1.2, 0.8, 1.2).translate(0, 3.2, 0), 0x6f7d4a],
    ]),
    bush: mergedColored([[new THREE.IcosahedronGeometry(0.9, 0).scale(1.3, 0.75, 1.1).translate(0, 0.45, 0), 0x587a34]]),
    dry: mergedColored([[new THREE.IcosahedronGeometry(0.7, 0).scale(1.4, 0.6, 1.2).translate(0, 0.3, 0), 0x8a7550]]),
    cactus: mergedColored([
      [new THREE.CylinderGeometry(0.32, 0.36, 3.2, 7).translate(0, 1.6, 0), 0x4f7a3a],
      [new THREE.CylinderGeometry(0.2, 0.2, 1.2, 6).rotateZ(Math.PI / 2).translate(0.6, 1.6, 0), 0x4f7a3a],
      [new THREE.CylinderGeometry(0.2, 0.2, 1.1, 6).translate(1.15, 2.1, 0), 0x4f7a3a],
    ]),
    rock: mergedColored([[new THREE.DodecahedronGeometry(1, 0).scale(1, 0.7, 1.1), 0x8a8376]]),
  };
  const L = {}; for (const k in G) L[k] = [];
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const nearItem = (x, z) => { for (const s of itemSpots) if ((s.x - x) ** 2 + (s.z - z) ** 2 < 9) return true; return false; };
  const blocked = (x, z, r) => footprintBlocked(x, z, r) || inField(x, z, 1.5) || roadDist(x, z) < 2.5 || riverDist(x, z) < riverHalfW(x) + 8 || onBridge(x, z) || nearItem(x, z);
  const plant = (kind, x, z, h, s, collide = true) => {
    L[kind].push({ x, y: h - 0.2, z, s, rot: rng() * 6.28 });
    if (collide) addCircle(x, z, (kind === 'pine' ? 0.4 : 0.45) * s, h + 4);
    TREE_SPOTS.push([x, z, kind]);
  };
  const species = (x, z) => {
    if (Math.hypot(x - ZONES.olive.x, z - ZONES.olive.z) < 260 && rng() < 0.65) return 'olive';
    const r = rng();
    if (z < 250) return r < 0.55 ? 'pine' : r < 0.78 ? (rng() < 0.5 ? 'broad' : 'broad2') : pick(['orange', 'red', 'yellow']);
    return r < 0.2 ? 'pine' : r < 0.6 ? (rng() < 0.5 ? 'broad' : 'broad2') : pick(['orange', 'red', 'yellow', 'orange']);
  };
  // 숲 (밀도 노이즈를 따라 무리 지어)
  const target = LOW ? 2300 : 4600;
  let n = 0;
  for (let t = 0; t < 90000 && n < target; t++) {
    const x = (rng() * 2 - 1) * 920, z = (rng() * 2 - 1) * 920, h = terrainH(x, z);
    if (h < 2.5 || gauss(x, z, -650, 0, 240) > 0.22) continue;
    let tm = 0; for (const k in TOWN_LEVEL) tm = Math.max(tm, zoneMask(k, x, z));
    if (tm > 0.2 && rng() < 0.85) continue;
    if (Math.hypot(x - 560, z + 640) < 105 || Math.hypot(x, z) < 45) continue;
    const slope = Math.abs(terrainH(x + 2, z) - h) + Math.abs(terrainH(x, z + 2) - h); if (slope > 2.4) continue;
    const f = forestDensity(x, z), p = f > 0.1 ? 0.95 : f > -0.02 ? 0.4 : 0.05;
    if (rng() > p || blocked(x, z, 2)) continue;
    plant(species(x, z), x, z, h, 0.8 + rng() * 0.6); n++;
  }
  // 가로수
  ROADS.forEach((r, ri) => {
    if (!r.trees) return;
    for (let i = 2; i < r.pts.length - 2; i += 4) {
      const a = r.pts[i - 1], b = r.pts[i + 1], p = r.pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, px = -(b[1] - a[1]) / len, pz = (b[0] - a[0]) / len;
      for (const s of [-1, 1]) {
        const x = p[0] + px * s * (r.w / 2 + 3.4), z = p[1] + pz * s * (r.w / 2 + 3.4), h = terrainH(x, z);
        if (h < 1.5 || footprintBlocked(x, z, 1.5) || inField(x, z) || onBridge(x, z) || riverDist(x, z) < riverHalfW(x) + 6 || nearItem(x, z) || roadDist(x, z) < 1.6) continue;
        plant(ri % 2 ? (i % 8 < 4 ? 'yellow' : 'broad') : 'broad2', x, z, h, 0.85);
      }
    }
  });
  // 덤불 · 광야 식생 · 바위
  for (let t = 0; t < (LOW ? 1500 : 3200); t++) {
    const x = (rng() * 2 - 1) * 900, z = (rng() * 2 - 1) * 900, h = terrainH(x, z);
    if (h < 2 || inField(x, z) || roadDist(x, z) < 3 || footprintBlocked(x, z, 1)) continue;
    const desert = gauss(x, z, -650, 0, 240) > 0.3;
    L[desert ? 'dry' : 'bush'].push({ x, y: h - 0.1, z, s: 0.7 + rng() * 0.9, rot: rng() * 6.28 });
  }
  let c = 0;
  for (let t = 0; t < 4000 && c < 80; t++) {
    const a = rng() * 6.28, dd = Math.sqrt(rng()) * 240, x = ZONES.wild.x + Math.cos(a) * dd, z = ZONES.wild.z + Math.sin(a) * dd, h = terrainH(x, z);
    if (h < 2 || blocked(x, z, 2)) continue;
    plant('cactus', x, z, h, 0.8 + rng() * 0.5); c++;
  }
  for (let t = 0; t < 20000 && L.rock.length < 360; t++) {
    const inWild = L.rock.length < 240, a = rng() * 6.28, dd = Math.sqrt(rng()) * 250;
    const x = inWild ? ZONES.wild.x + Math.cos(a) * dd : (rng() * 2 - 1) * 850, z = inWild ? ZONES.wild.z + Math.sin(a) * dd : (rng() * 2 - 1) * 850, h = terrainH(x, z);
    if (h < 2 || blocked(x, z, 3)) continue;
    const s = inWild ? 1 + rng() * rng() * 5 : 0.6 + rng() * 1.6;
    L.rock.push({ x, y: h - 0.3 * s, z, s, rot: rng() * 6.28 }); addCircle(x, z, s * 0.85, h + s * 0.6);
  }
  const leafTex = FOL.leaf || leafTexture();
  const leafMat = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, map: leafTex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.8 }), { speed: 1.4, strength: 0.16, freq: 0.05, minY: 2.4, h: 5, keepNormal: true });
  const bushMat = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, map: leafTex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.8 }), { speed: 1.8, strength: 0.1, freq: 0.08, minY: 0, h: 1.4, keepNormal: true });
  const leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafTex, alphaTest: 0.42 });
  // 나무 줄기: 사진 나무껍질 (UV 유지)
  const barkMat = FOL.bark ? new THREE.MeshStandardMaterial({ map: FOL.bark, normalMap: FOL.barkN, color: 0xb0a090, roughness: 0.95 }) : mat;
  const uvCyl = (rt, rb, h, seg, tf, rep = 1) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, true); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rep, uv.getY(i) * h / 1.6); tf(g); return g; };
  const trunkParts = (h, r0, r1, branches) => {
    const list = [uvCyl(r0, r1, h, 8, (g) => g.translate(0, h / 2, 0), 2)];
    if (branches) list.push(uvCyl(0.05, 0.09, 1.2, 5, (g) => g.rotateZ(0.7).translate(0.38, h * 0.95, 0)), uvCyl(0.05, 0.09, 1.1, 5, (g) => g.rotateX(-0.7).translate(0, h * 0.93, 0.34)));
    const m = mergeGeometries(list, false); if (!FOL.bark) { m.deleteAttribute('uv'); paintColor(m, 0x4e3a28, 0, 1); } return m;
  };
  const trunk = trunkParts(4.2, 0.18, 0.32, true);
  const oliveTrunk = trunkParts(2.6, 0.2, 0.36, false);
  const pineTrunk = trunkParts(7.5, 0.12, 0.3, false);
  const part = (geo, m, cast, depth) => ({ geo, mat: m, cast, depth });
  const tree = (color, seed, o) => [part(trunk, barkMat, true), part(canopyGeo(color, seed, { n: 15, ...o }), leafMat, true, leafDepth)];
  const PARTS = {
    pine: [part(pineTrunk, barkMat, true), part(canopyGeo(0x2c4a24, 21, { rad: 2.7, cy: 2.6, n: 22, size: 2.6, cone: 6.2 }), leafMat, true, leafDepth)],
    broad: tree(0x4f7a32, 11), broad2: tree(0x6a8a3a, 12, { rad: 2.1, n: 13 }),
    orange: tree(0xb87a3a, 13), red: tree(0x9c4a32, 14, { rad: 2.2 }), yellow: tree(0xc0a048, 15),
    olive: [part(oliveTrunk, barkMat, true), part(canopyGeo(0x7d8a5a, 16, { rad: 2.3, cy: 3.3, n: 13, size: 2.6, flat: 0.55 }), leafMat, true, leafDepth)],
    bush: [part(paintColor(crossedGeo(2.0, 1.3, 3, true, 1), 0x587a34, 0.25, 3), bushMat, false)],
    dry: [part(paintColor(crossedGeo(1.8, 1.0, 3, true, 1), 0x8a7550, 0.25, 4), bushMat, false)],
    cactus: [part(G.cactus, mat, true)], rock: [part(G.rock, mat, true)],
  };
  // 실사 모델이 있으면 교체: 실제 나무 줄기 메시 + 실제 3D 잎/솔잎을 렌더링한 잎뭉치 카드
  if (MODELS.trunk) {
    const windO = { speed: 1.4, strength: 0.16, freq: 0.05, minY: 2.2, h: 5, keepNormal: true };
    const mk = (tex, w) => addWind(new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.82 }), w);
    const dep = (tex) => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.4 });
    const leafM = mk(MODELS.leafC, windO), pineM = mk(MODELS.pineC, { ...windO, minY: 1.5, h: 7 }), bushM = mk(MODELS.leafC, { speed: 1.8, strength: 0.1, freq: 0.08, minY: 0, h: 1.4, keepNormal: true }), dryM = mk(MODELS.shrubC, { speed: 1.8, strength: 0.1, freq: 0.08, minY: 0, h: 1.4, keepNormal: true });
    const leafD = dep(MODELS.leafC), pineD = dep(MODELS.pineC);
    const TS = 2.0, trunkGeo = MODELS.trunk.geometry.clone().scale(TS, TS, TS), oliveGeo = MODELS.trunk.geometry.clone().scale(1.5, 1.35, 1.5);
    const realTree = (hex, seed, mirror = 1, S = TS, geo = trunkGeo) => [part(geo, MODELS.trunk.material, true), part(canopyGeo(hex, seed, { pts: CANOPY_PTS, ctr: CANOPY_CTR, S, size: 1.4 * S, atlas: true, avg: MODELS.leafAvg, k: 1, mirror }), leafM, true, leafD)];
    // 덤불: 교차 카드마다 아틀라스 칸 하나씩
    const atlasCross = (w, h, n, hex, avg, seed) => { const g = crossedGeo(w, h, n, true, 1), uv = g.attributes.uv, r = mulberry32(seed), per = uv.count / n;
      for (let i = 0; i < n; i++) { const cell = (r() * 4) | 0, u0 = (cell % 2) * 0.5, v0 = (cell >> 1) * 0.5; for (let j = 0; j < per; j++) { const q = i * per + j; uv.setXY(q, u0 + uv.getX(q) * 0.5, v0 + uv.getY(q) * 0.5); } }
      const c = leafTint(hex, 1, avg), col = new Float32Array(uv.count * 3); for (let q = 0; q < uv.count; q++) { const kk = 0.85 + r() * 0.3; col[q * 3] = c.r * kk; col[q * 3 + 1] = c.g * kk; col[q * 3 + 2] = c.b * kk; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; };
    Object.assign(PARTS, {
      broad: realTree(0x4a5a2c, 11), broad2: realTree(0x56652f, 12, -1),
      orange: realTree(0x74552e, 13), red: realTree(0x663a2a, 14, -1), yellow: realTree(0x7a6c38, 15),
      olive: realTree(0x5f6445, 16, 1, 1.5, oliveGeo),
      pine: [part(pineTrunk, barkMat, true), part(canopyGeo(0x35452b, 21, { rad: 2.6, cy: 2.2, n: 58, size: 1.5, cone: 6.6, atlas: true, avg: MODELS.pineAvg, k: 1 }), pineM, true, pineD)],
      bush: [part(atlasCross(2.0, 1.4, 3, 0x4c5c2e, MODELS.leafAvg, 3), bushM, false)],
      dry: [part(atlasCross(1.9, 1.5, 3, 0x7a6e50, MODELS.shrubAvg, 4), dryM, false)],
      cactus: [part(MODELS.quiver.geometry.clone().scale(3.2, 3.2, 3.2), MODELS.quiver.material, true)],
    });
  }
  for (const k in PARTS) if (L[k].length) scatterInstanced(PARTS[k], L[k]);
}

// ───────────────────────── 아이템 ─────────────────────────
const items = [];
const placed = [];
const geoCache = {};
function farFromPlaced(x, z, y, min) { for (const p of placed) if ((p.x - x) ** 2 + (p.z - z) ** 2 < min * min && Math.abs(p.y - y) < 3) return false; return true; }
function groundSpot(key, { minH = -99, rFrac = 0.9, inner = 0 } = {}) {
  const Z = ZONES[key];
  for (let t = 0; t < 600; t++) {
    const a = rng() * Math.PI * 2, d = Z.r * (inner + (rFrac - inner) * Math.sqrt(rng()));
    const x = Z.x + Math.cos(a) * d, z = Z.z + Math.sin(a) * d, h = terrainH(x, z);
    if (h < 1.2 || h < minH || footprintBlocked(x, z, 1.4) || !farFromPlaced(x, z, h, 4.5)) continue;
    return { x, z, y: h };
  }
  for (let t = 0; t < 600; t++) { const a = rng() * 6.28, d = Z.r * Math.sqrt(rng()), x = Z.x + Math.cos(a) * d, z = Z.z + Math.sin(a) * d, h = terrainH(x, z); if (h > 1.2 && !footprintBlocked(x, z, 1)) return { x, z, y: h }; }
  return { x: Z.x, z: Z.z, y: terrainH(Z.x, Z.z) };
}
function specialSpot(key) { const l = specials[key]; while (l && l.length) { const s = l.splice((rng() * l.length) | 0, 1)[0]; if (farFromPlaced(s.x, s.z, s.y, 2.5)) return s; } return null; }

const MAT = {};
function initItemAssets() {
  geoCache.scroll = mergedColored([
    [new THREE.CylinderGeometry(0.2, 0.2, 0.78, 14).rotateZ(Math.PI / 2), 0xf0e3bf],
    [new THREE.CylinderGeometry(0.26, 0.26, 0.07, 12).rotateZ(Math.PI / 2).translate(0.43, 0, 0), 0x6b3f1e],
    [new THREE.CylinderGeometry(0.26, 0.26, 0.07, 12).rotateZ(Math.PI / 2).translate(-0.43, 0, 0), 0x6b3f1e],
    [new THREE.CylinderGeometry(0.205, 0.205, 0.12, 14).rotateZ(Math.PI / 2), 0xb3261e],
  ]);
  geoCache.beam = new THREE.CylinderGeometry(0.1, 0.32, 70, 8, 1, true).translate(0, 35, 0);
  geoCache.bag = mergedColored([
    [new THREE.SphereGeometry(0.34, 14, 10).scale(1, 0.95, 1), 0xb89257],
    [new THREE.CylinderGeometry(0.08, 0.16, 0.2, 10).translate(0, 0.38, 0), 0xb89257],
    [new THREE.TorusGeometry(0.1, 0.03, 6, 12).rotateX(Math.PI / 2).translate(0, 0.33, 0), 0x6b4a22],
    [new THREE.BoxGeometry(0.2, 0.22, 0.04).translate(0, 0.02, -0.33), 0x2e7d32],
  ]);
  geoCache.trophy = mergedColored([
    [new THREE.BoxGeometry(0.34, 0.08, 0.34), 0x3a2a1a],
    [new THREE.CylinderGeometry(0.05, 0.08, 0.26, 10).translate(0, 0.17, 0), 0xffc93c],
    [new THREE.CylinderGeometry(0.24, 0.1, 0.32, 16, 1, false).translate(0, 0.46, 0), 0xffc93c],
    [new THREE.TorusGeometry(0.1, 0.025, 6, 12).translate(0.25, 0.46, 0), 0xffc93c],
    [new THREE.TorusGeometry(0.1, 0.025, 6, 12).translate(-0.25, 0.46, 0), 0xffc93c],
  ]);
  const crownParts = [[new THREE.CylinderGeometry(0.3, 0.28, 0.16, 18, 1, true), 0xffc93c]];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; crownParts.push([new THREE.ConeGeometry(0.06, 0.18, 6).translate(Math.cos(a) * 0.29, 0.17, Math.sin(a) * 0.29), 0xffc93c]); crownParts.push([new THREE.SphereGeometry(0.035, 8, 6).translate(Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3), i % 2 ? 0xc62828 : 0x1565c0]); }
  geoCache.crown = mergedColored(crownParts);
  geoCache.crate = new THREE.BoxGeometry(0.95, 0.62, 0.65);
  geoCache.lid = new THREE.BoxGeometry(0.99, 0.12, 0.69).translate(0, 0.06, 0.345);
  MAT.scroll = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, emissive: 0x2a1c00, emissiveIntensity: 0.6 });
  MAT.beam = new THREE.MeshBasicMaterial({ color: 0xffa31a, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  MAT.gold = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.85, emissive: 0x3a2600, emissiveIntensity: 0.4 });
  MAT.bag = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  MAT.wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.85 });
  MAT.glowPiece = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,236,170,1)', 'rgba(255,200,60,.35)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  MAT.glowGenie = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,250,200,1)', 'rgba(255,190,40,.45)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  MAT.labels = PIECES.map((p) => new THREE.SpriteMaterial({ map: labelTexture(p.name), depthWrite: false, transparent: true }));
}
function makePieceObj(n) {
  const g = new THREE.Group();
  const s = new THREE.Mesh(geoCache.scroll, MAT.scroll); s.position.y = 1.0; s.castShadow = !LOW; g.add(s);
  const gl = new THREE.Sprite(MAT.glowPiece); gl.scale.setScalar(1.8); gl.position.y = 1.0; g.add(gl);
  const beam = new THREE.Mesh(geoCache.beam, MAT.beam); g.add(beam);
  const lab = new THREE.Sprite(MAT.labels[n - 1]); lab.scale.set(2.6, 1.14, 1); lab.position.y = 2.6; g.add(lab);
  return { g, spin: s, glow: gl, beam, label: lab };
}
function makeGenieObj(kind) {
  const g = new THREE.Group();
  const geo = kind === 0 ? geoCache.bag : kind === 1 ? geoCache.trophy : geoCache.crown;
  const m = new THREE.Mesh(geo, kind === 0 ? MAT.bag : MAT.gold); m.position.y = kind === 2 ? 0.9 : 0.7; m.castShadow = !LOW; g.add(m);
  const gl = new THREE.Sprite(MAT.glowGenie); gl.scale.setScalar(2.6); gl.position.y = 0.95; g.add(gl);
  return { g, spin: m, glow: gl };
}
function addItem(type, data, spot) {
  const it = { type, ...data, x: spot.x, y: spot.y, z: spot.z, active: true, phase: rng() * 6.28 };
  let o;
  if (type === 'piece') o = makePieceObj(it.n);
  else if (type === 'genie') o = makeGenieObj(it.kind);
  else {
    const g = new THREE.Group();
    const body = new THREE.Mesh(geoCache.crate, MAT.wood); body.position.y = 0.31; body.castShadow = !LOW; g.add(body);
    const hinge = new THREE.Group(); hinge.position.set(0, 0.62, -0.345); g.add(hinge);
    const lid = new THREE.Mesh(geoCache.lid, MAT.wood); hinge.add(lid);
    g.rotation.y = rng() * 6.28;
    o = { g, hinge };
  }
  o.g.position.set(spot.x, spot.y, spot.z);
  scene.add(o.g);
  it.obj = o; items.push(it); placed.push(spot);
  return it;
}
function placeItems() {
  const godZones = ['olive', 'palace', 'temple'];
  const minH = { olive: 50, temple: 62, palace: 0 };
  for (const p of PIECES) {
    for (const [zk, cnt] of Object.entries(DIST[p.n])) {
      for (let i = 0; i < cnt; i++) {
        let spot = null;
        if (godZones.includes(zk) && p.n >= 2 && p.n <= 4 && rng() < 0.45) spot = specialSpot(zk);
        if (!spot) {
          if (godZones.includes(zk) && p.n >= 2 && p.n <= 4) spot = groundSpot(zk, { minH: minH[zk], rFrac: zk === 'palace' ? 0.55 : 0.9 });
          else if (['beth', 'harbor', 'market'].includes(zk)) spot = groundSpot(zk, { rFrac: 0.78 });
          else spot = groundSpot(zk, { rFrac: 0.9 });
        }
        addItem('piece', { n: p.n }, spot);
      }
    }
  }
  // 지니 아이템 150 (시장 50)
  let gk = 0;
  for (let i = 0; i < 50; i++) addItem('genie', { kind: gk++ % 3 }, groundSpot('market', { rFrac: 0.85 }));
  const others = ['olive', 'palace', 'temple', 'wild', 'beth', 'harbor'];
  for (let i = 0; i < 100; i++) addItem('genie', { kind: gk++ % 3 }, groundSpot(others[i % 6], { rFrac: 0.95 }));
  // 상자 40 (내용물 위치마다 고정)
  const south = { beth: [1, 2, 3, 4, 1, 2, 'g', 'e'], harbor: [3, 4, 1, 2, 3, 4, 'g', 'e'] };
  const rest = []; for (let i = 0; i < 10; i++) rest.push('g'); for (let i = 0; i < 14; i++) rest.push('e');
  for (let i = rest.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const toContent = (c) => (c === 'g' ? { type: 'genie', kind: (rng() * 3) | 0 } : c === 'e' ? { type: 'empty' } : { type: 'piece', n: c });
  for (const zk of ['beth', 'harbor']) for (const c of south[zk]) addItem('box', { content: toContent(c), opened: false }, groundSpot(zk, { rFrac: 0.85 }));
  const restZ = { olive: 5, palace: 5, temple: 5, wild: 5, market: 4 }; let ri = 0;
  for (const [zk, cnt] of Object.entries(restZ)) for (let i = 0; i < cnt; i++) addItem('box', { content: toContent(rest[ri++]), opened: false }, groundSpot(zk, { rFrac: 0.85 }));
  for (const it of items) if (it.type === 'box') addSolid(it.x - 0.5, it.y - 0.2, it.z - 0.5, it.x + 0.5, it.y + 0.62, it.z + 0.5);
}

// ───────────────────────── 캐릭터 (배그풍 병사) ─────────────────────────
function buildSoldier() {
  const M = (c, r = 0.85, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const mt = { shirt: M(0xd6d0c2), vest: M(0x4b5536), pants: M(0x33435c), boot: M(0x1c1c1c), skin: M(0xc49577), helmet: M(0x56603f, 0.6), pack: M(0x6a5838), strap: M(0x262a20) };
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);
  const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; };
  hips.add(mesh(new THREE.BoxGeometry(0.34, 0.2, 0.22), mt.pants));
  hips.add(mesh(new THREE.BoxGeometry(0.36, 0.05, 0.24), mt.strap, 0, 0.08, 0));
  const torso = new THREE.Group(); torso.position.y = 0.08; hips.add(torso);
  torso.add(mesh(new THREE.BoxGeometry(0.4, 0.54, 0.22), mt.shirt, 0, 0.27, 0));
  torso.add(mesh(new THREE.BoxGeometry(0.44, 0.38, 0.28), mt.vest, 0, 0.3, 0));
  torso.add(mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), mt.strap, -0.1, 0.2, -0.16));
  torso.add(mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), mt.strap, 0.1, 0.2, -0.16));
  torso.add(mesh(new THREE.BoxGeometry(0.34, 0.44, 0.2), mt.pack, 0, 0.32, 0.23));
  torso.add(mesh(new THREE.BoxGeometry(0.3, 0.12, 0.12), mt.strap, 0, 0.58, 0.24));
  torso.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 8), mt.skin, 0, 0.58, 0));
  const head = new THREE.Group(); head.position.y = 0.72; torso.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.12, 16, 12), mt.skin));
  const helm = mesh(new THREE.SphereGeometry(0.142, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mt.helmet, 0, 0.02, 0.01); helm.scale.set(1, 0.92, 1.08); head.add(helm);
  head.add(mesh(new THREE.CylinderGeometry(0.152, 0.158, 0.026, 18), mt.helmet, 0, 0.02, 0.01));
  head.add(mesh(new THREE.BoxGeometry(0.17, 0.04, 0.03), mt.strap, 0, 0.0, -0.112));
  const limbArm = (sx) => {
    const sh = new THREE.Group(); sh.position.set(sx, 0.5, 0); torso.add(sh);
    sh.add(mesh(new THREE.CylinderGeometry(0.056, 0.05, 0.3, 8), mt.shirt, 0, -0.15, 0));
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    el.add(mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.27, 8), mt.skin, 0, -0.135, 0));
    el.add(mesh(new THREE.SphereGeometry(0.052, 8, 6), mt.skin, 0, -0.29, 0));
    return { sh, el };
  };
  const limbLeg = (sx) => {
    const hp = new THREE.Group(); hp.position.set(sx, -0.06, 0); hips.add(hp);
    hp.add(mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.44, 8), mt.pants, 0, -0.22, 0));
    const kn = new THREE.Group(); kn.position.y = -0.44; hp.add(kn);
    kn.add(mesh(new THREE.CylinderGeometry(0.068, 0.058, 0.4, 8), mt.pants, 0, -0.2, 0));
    kn.add(mesh(new THREE.BoxGeometry(0.11, 0.09, 0.25), mt.boot, 0, -0.41, -0.04));
    return { hp, kn };
  };
  const S = { root, body, hips, torso, head, aL: limbArm(-0.27), aR: limbArm(0.27), lL: limbLeg(-0.1), lR: limbLeg(0.1), phase: 0 };
  scene.add(root);
  return S;
}
function approach(o, k, target, t) { o[k] += (target - o[k]) * t; }
// 실사형 병사 모델 (three.js 예제 Soldier.glb · Mixamo 애니메이션: Idle/Walk/Run)
async function buildSoldierGLB() {
  const { default: b64 } = await import('./assets/soldier.js');
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(bin, '', res, rej));
  SOLDIER_TPL = gltf;
  return soldierFromTpl(gltf.scene, true);
}
let SOLDIER_TPL = null;
// 다른 플레이어용 병사 복제 (뼈대까지 복제)
function soldierFromTpl(src, own = false) {
  const gltf = SOLDIER_TPL;
  const root = new THREE.Group(), model = own ? src : SkeletonUtils.clone(src); root.add(model);
  model.traverse((o) => { if (o.isMesh) { o.castShadow = own || !LOW; o.receiveShadow = true; o.frustumCulled = false; if (o.material) { o.material.envMapIntensity = 0.7; } } });
  const bone = (re) => { let b = null; model.traverse((o) => { if (!b && o.isBone && re.test(o.name)) b = o; }); return b; };
  const B = { hips: bone(/Hips$/), spine: bone(/Spine$/), spine1: bone(/Spine1$/), lUp: bone(/LeftUpLeg$/), lLeg: bone(/LeftLeg$/), rUp: bone(/RightUpLeg$/), rLeg: bone(/RightLeg$/), lArm: bone(/LeftArm$/), rArm: bone(/RightArm$/) };
  const mixer = new THREE.AnimationMixer(model), act = {};
  for (const c of gltf.animations) { if (c.name === 'TPose') continue; const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(c.name === 'Idle' ? 1 : 0); act[c.name] = a; }
  scene.add(root);
  return { glb: true, root, model, mixer, act, B, w: { Idle: 1, Walk: 0, Run: 0 }, crouch: 0, prone: 0, air: 0, phase: 0 };
}
const _bq = new THREE.Quaternion(), _bq2 = new THREE.Quaternion(), _bax = new THREE.Vector3();
function bendBone(b, axis, ang) {
  if (!b || Math.abs(ang) < 1e-4) return;
  b.parent.getWorldQuaternion(_bq); _bq2.setFromAxisAngle(axis, ang);
  b.quaternion.premultiply(_bq.clone().invert().multiply(_bq2).multiply(_bq)); b.updateMatrixWorld(true);
}
function animateGLB(S, dt, speed, stance, grounded, sprint) {
  const t = 1 - Math.exp(-10 * dt);
  S.phase += dt * speed * 1.9;
  const moving = speed > 0.3;
  const tw = { Idle: moving ? 0 : 1, Walk: moving && (speed < 3.2 || stance !== 'stand') ? 1 : 0, Run: moving && speed >= 3.2 && stance === 'stand' ? 1 : 0 };
  for (const k in S.act) { S.w[k] += (tw[k] - S.w[k]) * t; S.act[k].setEffectiveWeight(S.w[k]); }
  if (S.act.Walk) S.act.Walk.timeScale = stance === 'prone' ? clamp(speed / 1.4, 0.3, 1) : clamp(speed / 1.6, 0.5, 1.7);
  if (S.act.Run) S.act.Run.timeScale = clamp(speed / 5.2, 0.7, 1.35);
  S.crouch += ((stance === 'crouch' ? 1 : 0) - S.crouch) * t;
  S.prone += ((stance === 'prone' ? 1 : 0) - S.prone) * t;
  S.air += ((!grounded && stance === 'stand' ? 1 : 0) - S.air) * (1 - Math.exp(-14 * dt));
  S.mixer.update(dt);
  const c = S.crouch, p = S.prone, a = S.air;
  S.model.rotation.x = -Math.PI / 2 * p;
  S.model.position.set(0, -0.5 * c + 0.16 * p, 0.85 * p);
  S.root.updateMatrixWorld(true);
  _bax.set(1, 0, 0).applyQuaternion(S.root.quaternion);
  const B = S.B;
  bendBone(B.spine, _bax, -0.22 * c - (sprint ? 0.12 : 0)); bendBone(B.spine1, _bax, -0.12 * c);
  for (const [up, lo] of [[B.lUp, B.lLeg], [B.rUp, B.rLeg]]) { bendBone(up, _bax, 1.25 * c + 0.55 * a); bendBone(lo, _bax, -2.05 * c - 0.9 * a); }
  bendBone(B.lArm, _bax, 2.4 * p); bendBone(B.rArm, _bax, 2.4 * p);
}
function animateSoldier(S, dt, speed, stance, grounded, sprint) {
  if (S.glb) return animateGLB(S, dt, speed, stance, grounded, sprint);
  const t = 1 - Math.exp(-14 * dt);
  S.phase += dt * speed * (stance === 'prone' ? 3.2 : 1.9);
  const ph = S.phase, moving = speed > 0.15;
  const amp = moving ? Math.min(0.95, 0.25 + speed * 0.1) : 0;
  const sL = Math.sin(ph), sR = Math.sin(ph + Math.PI), cL = Math.cos(ph), cR = Math.cos(ph + Math.PI);
  let hipY = 0.95, bodyX = 0, bodyY = 0, bodyZ = 0, torX = 0.04;
  let hL = sL * amp, hR = sR * amp, kL = -Math.max(0, cL) * amp * 1.4 - 0.04, kR = -Math.max(0, cR) * amp * 1.4 - 0.04;
  let aL = -sL * amp * 0.9, aR = -sR * amp * 0.9, eL = 0.25 + Math.max(0, sL) * 0.6 * amp, eR = 0.25 + Math.max(0, sR) * 0.6 * amp;
  if (stance === 'stand') {
    hipY = 0.95 + (moving ? Math.abs(Math.sin(ph)) * 0.05 : Math.sin(performance.now() / 700) * 0.006);
    torX = sprint ? 0.2 : moving ? 0.08 : 0.03;
    if (sprint) { eL += 0.7; eR += 0.7; }
    if (!grounded) { hL = 0.5; hR = -0.15; kL = -0.9; kR = -0.4; aL = -0.6; aR = -0.6; }
  } else if (stance === 'crouch') {
    hipY = 0.62; torX = 0.35;
    hL = 1.0 + sL * amp * 0.45; hR = 1.0 + sR * amp * 0.45; kL = -1.7 - Math.max(0, cL) * 0.3 * amp; kR = -1.7 - Math.max(0, cR) * 0.3 * amp;
    aL = 0.35 - sL * amp * 0.3; aR = 0.35 - sR * amp * 0.3; eL = 0.7; eR = 0.7;
  } else {
    hipY = 0.95; bodyX = -Math.PI / 2; bodyY = 0.18; bodyZ = 0.85; torX = 0;
    hL = sL * amp * 0.3; hR = sR * amp * 0.3; kL = -Math.max(0, sL) * amp * 0.9; kR = -Math.max(0, sR) * amp * 0.9;
    aL = 2.75 + sL * amp * 0.35; aR = 2.75 + sR * amp * 0.35; eL = 0.9; eR = 0.9;
  }
  approach(S.hips.position, 'y', hipY, t); approach(S.body.rotation, 'x', bodyX, t);
  approach(S.body.position, 'y', bodyY, t); approach(S.body.position, 'z', bodyZ, t);
  approach(S.torso.rotation, 'x', torX, t);
  approach(S.lL.hp.rotation, 'x', hL, t); approach(S.lR.hp.rotation, 'x', hR, t);
  approach(S.lL.kn.rotation, 'x', kL, t); approach(S.lR.kn.rotation, 'x', kR, t);
  approach(S.aL.sh.rotation, 'x', aL, t); approach(S.aR.sh.rotation, 'x', aR, t);
  approach(S.aL.el.rotation, 'x', eL, t); approach(S.aR.el.rotation, 'x', eR, t);
  S.aL.sh.rotation.z = -0.08; S.aR.sh.rotation.z = 0.08;
}

// ───────────────────────── 지도 미리 그리기 ─────────────────────────
const MAPPX = 1024;
const mapCanvas = document.createElement('canvas'); mapCanvas.width = mapCanvas.height = MAPPX;
function buildMapImage() {
  const x = mapCanvas.getContext('2d'), img = x.createImageData(MAPPX, MAPPX), d = img.data, s = SIZE / MAPPX;
  const L = new THREE.Vector3(-0.6, 0.7, -0.4).normalize();
  for (let j = 0; j < MAPPX; j++) for (let i = 0; i < MAPPX; i++) {
    const wx = -HALF + (i + 0.5) * s, wz = -HALF + (j + 0.5) * s, h = terrainH(wx, wz);
    let r, g, b;
    if (h < 0.05) { const k = clamp(-h / 14, 0, 1); r = 64 - 26 * k; g = 112 - 38 * k; b = 132 - 28 * k; }
    else {
      const hx = terrainH(wx + 3, wz) - terrainH(wx - 3, wz), hz = terrainH(wx, wz + 3) - terrainH(wx, wz - 3);
      const nx = -hx / 6, nz = -hz / 6, nl = Math.hypot(nx, 1, nz), shade = clamp((nx * L.x + L.y + nz * L.z) / nl, 0.35, 1.15);
      if (h < 2.2) { r = 200; g = 186; b = 142; }
      else { const t = clamp(h / 120, 0, 1); r = 112 + 50 * t; g = 132 + 22 * t; b = 72 + 26 * t; }
      const rw = gauss(wx, wz, -650, 0, 240); if (rw > 0.3) { r = lerp(r, 196, 0.75); g = lerp(g, 150, 0.75); b = lerp(b, 98, 0.75); }
      let tm = 0; for (const k in TOWN_LEVEL) tm = Math.max(tm, zoneMask(k, wx, wz)); r = lerp(r, 158, tm * 0.4); g = lerp(g, 138, tm * 0.4); b = lerp(b, 100, tm * 0.4);
      r *= shade; g *= shade; b *= shade;
    }
    const k = (j * MAPPX + i) * 4; d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const sc = MAPPX / SIZE, P = (v) => (v + HALF) * sc;
  for (const f of FIELDS) { if (!f.crop) continue; x.fillStyle = CROP_MAP[f.crop]; x.globalAlpha = 0.85; x.fillRect(P(f.x0), P(f.z0), (f.x1 - f.x0) * sc, (f.z1 - f.z0) * sc); }
  x.globalAlpha = 1;
  for (const [tx, tz, kind] of TREE_SPOTS) { x.fillStyle = kind === 'orange' || kind === 'red' || kind === 'yellow' ? 'rgba(150,80,30,.55)' : 'rgba(30,52,24,.55)'; x.fillRect(P(tx) - 1, P(tz) - 1, 2.2, 2.2); }
  x.lineCap = 'round'; x.lineJoin = 'round';
  for (const r of ROADS) {
    x.strokeStyle = r.kind === 'asphalt' ? '#3d3b38' : '#8b7656'; x.lineWidth = Math.max(1.6, r.w * sc * 0.9);
    x.beginPath(); r.pts.forEach((p, i) => (i ? x.lineTo(P(p[0]), P(p[1])) : x.moveTo(P(p[0]), P(p[1])))); x.stroke();
  }
  x.strokeStyle = 'rgba(230,220,190,.45)'; x.lineWidth = 0.7;
  for (const r of ROADS) { if (r.kind !== 'asphalt') continue; x.beginPath(); r.pts.forEach((p, i) => (i ? x.lineTo(P(p[0]), P(p[1])) : x.moveTo(P(p[0]), P(p[1])))); x.stroke(); }
  x.fillStyle = '#5b5752';
  for (const so of solids) if (so.maxY - so.minY > 3 && so.maxX - so.minX > 2 && so.maxZ - so.minZ > 2) x.fillRect(P(so.minX), P(so.minZ), Math.max(1.5, (so.maxX - so.minX) * sc), Math.max(1.5, (so.maxZ - so.minZ) * sc));
}

// ───────────────────────── 상태 ─────────────────────────
const P = { x: 0, y: 0, z: 0, vy: 0, grounded: true, stance: 'stand', eye: 1.65, speed: 0, charYaw: 0 };
const cam = { yaw: 0, pitch: -0.12, fpp: false, free: false, freeReturn: false, savedPitch: 0, dist: 1 };
const state = {
  playing: false, nick: '', next: 1, found: [], mistakes: Array(9).fill(0), genie: 0, boxes: 0,
  startTime: 0, clearTime: 0, cleared: false, amenReady: false, halfAnnounced: false, zone: null,
};
const keys = {};
const ui = { map: false, inv: false, pauseBlocked: false };
let pointerLocked = false, dragLook = false, dragging = false;
let soldier;

// ───────────────────────── 오디오 ─────────────────────────
// 효과음: Kenney Impact Sounds (CC0) · 배경음악: "Determined Pursuit" by Emma_MA (OpenGameArt, CC0)
let actx = null;
const AUD = { raw: {}, buf: {}, bgmOn: true, master: null, sfxGain: null, bgmGain: null, bgmSrc: null, stepPh: 0, wasGrounded: true, fallVy: 0 };
try { AUD.bgmOn = localStorage.getItem('pbg_bgm') !== '0'; } catch { /* 무시 */ }
function preloadAudio() {
  const list = [['bgm', 'assets/bgm.mp3'], ['jump', 'assets/sfx/impactSoft_medium_000.mp3'], ['land0', 'assets/sfx/impactSoft_heavy_000.mp3'], ['land1', 'assets/sfx/impactSoft_heavy_001.mp3']];
  for (const s of ['grass', 'concrete', 'wood', 'snow']) for (let i = 0; i < 5; i++) list.push([`step_${s}_${i}`, `assets/sfx/step_${s}_${i}.mp3`]);
  AUD.ready = Promise.all(list.map(async ([k, u]) => { try { const r = await fetch(u); if (r.ok) AUD.raw[k] = await r.arrayBuffer(); } catch { /* 무시 */ } }));
}
function initAudio() {
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { actx = null; return; }
  AUD.master = actx.createGain(); AUD.master.connect(actx.destination);
  AUD.sfxGain = actx.createGain(); AUD.sfxGain.gain.value = 0.9; AUD.sfxGain.connect(AUD.master);
  AUD.bgmGain = actx.createGain(); AUD.bgmGain.gain.value = 0; AUD.bgmGain.connect(AUD.master);
  (AUD.ready || Promise.resolve()).then(async () => {
    await Promise.all(Object.entries(AUD.raw).map(async ([k, ab]) => { try { AUD.buf[k] = await actx.decodeAudioData(ab.slice(0)); } catch { /* 무시 */ } }));
    if (AUD.buf.bgm) { const s = actx.createBufferSource(); s.buffer = AUD.buf.bgm; s.loop = true; s.connect(AUD.bgmGain); s.start(); AUD.bgmSrc = s; setBgm(AUD.bgmOn); }
  });
}
function setBgm(on) {
  AUD.bgmOn = on; try { localStorage.setItem('pbg_bgm', on ? '1' : '0'); } catch { /* 무시 */ }
  if (AUD.bgmGain) AUD.bgmGain.gain.setTargetAtTime(on ? 0.2 : 0, actx.currentTime, 0.5);
  document.querySelectorAll('.bgmBtn').forEach((b) => { b.textContent = on ? '♪ BGM ON' : '♪ BGM OFF'; b.classList.toggle('off', !on); });
}
function playBuf(name, vol = 1, rate = 1) {
  if (!actx || !AUD.buf[name]) return;
  const s = actx.createBufferSource(), g = actx.createGain(); s.buffer = AUD.buf[name]; s.playbackRate.value = rate; g.gain.value = vol;
  s.connect(g).connect(AUD.sfxGain); s.start();
}
// 발밑 재질: 다리·부두 = 나무, 길·건물 위 = 콘크리트, 광야·모래 = 모래(서걱), 나머지 = 풀
function surfaceAt(x, z, y) {
  const th = terrainH(x, z);
  if (onBridge(x, z)) return 'wood';
  if (y > th + 0.25) return th < 0.8 ? 'wood' : 'concrete';
  if (roadDist(x, z) < 0.3) return 'concrete';
  if (gauss(x, z, -650, 0, 240) > 0.3 || th < 2.0) return 'snow';
  return 'grass';
}
function footstep(vol) {
  const s = surfaceAt(P.x, P.z, P.y), k = s === 'snow' ? 0.7 : s === 'wood' ? 0.85 : 1;
  playBuf(`step_${s}_${(Math.random() * 5) | 0}`, vol * k, 0.9 + Math.random() * 0.2);
}
function updateSteps(dt, moving) {
  if (!actx) return;
  const landing = P.grounded && !AUD.wasGrounded;
  if (landing && AUD.fallVy < -2.5) { const v = clamp(-AUD.fallVy / 9, 0.25, 1); playBuf(Math.random() < 0.5 ? 'land0' : 'land1', 0.35 * v); footstep(0.9 * v + 0.3); AUD.stepPh = 0.5; }
  if (!P.grounded) AUD.fallVy = P.vy;
  AUD.wasGrounded = P.grounded;
  if (!P.grounded || !moving) { AUD.stepPh = Math.min(AUD.stepPh, 0.6); return; }
  const prone = P.stance === 'prone', rate = prone ? 1.1 : 1.1 + 0.33 * P.speed;
  AUD.stepPh += dt * rate;
  if (AUD.stepPh >= 1) {
    AUD.stepPh -= 1;
    const vol = prone ? 0.25 : P.stance === 'crouch' ? 0.35 : P.speed < 2.5 ? 0.3 : P.speed > 6 ? 0.85 : 0.65;
    footstep(vol);
  }
}
function sfx(kind) {
  if (!actx) return;
  const now = actx.currentTime;
  const tone = (f, t0, dur, type = 'sine', vol = 0.12, f2) => {
    const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.setValueAtTime(f, now + t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + t0 + dur);
    g.gain.setValueAtTime(0.0001, now + t0); g.gain.exponentialRampToValueAtTime(vol, now + t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
    o.connect(g).connect(AUD.sfxGain || actx.destination); o.start(now + t0); o.stop(now + t0 + dur + 0.05);
  };
  if (kind === 'get') { tone(660, 0, 0.12, 'triangle'); tone(880, 0.09, 0.12, 'triangle'); tone(1320, 0.18, 0.25, 'triangle'); }
  else if (kind === 'bad') { tone(180, 0, 0.22, 'square', 0.06, 120); }
  else if (kind === 'genie') { tone(520, 0, 0.18, 'sawtooth', 0.05, 420); tone(400, 0.18, 0.35, 'sawtooth', 0.05, 260); }
  else if (kind === 'box') { tone(140, 0, 0.12, 'square', 0.07, 90); }
  else if (kind === 'info') { tone(500, 0, 0.1, 'sine', 0.06); }
  else if (kind === 'drop') { tone(300, 0, 0.5, 'sawtooth', 0.05, 900); tone(900, 0.5, 0.3, 'triangle', 0.08); }
  else if (kind === 'whoosh') { tone(900, 0, 0.6, 'sawtooth', 0.025, 200); }
  else if (kind === 'chute') { tone(120, 0, 0.25, 'square', 0.06, 60); }
  else if (kind === 'amen') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.5, 'triangle', 0.1)); }
}

// ───────────────────────── HUD ─────────────────────────
const fmtTime = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
let toastTimer = 0, acqTimer = 0, bannerTimer = 0;
function toast(text, kind = '', ms = 1700) {
  const t = $('toast'); t.textContent = text; t.className = 'show ' + kind;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = ''), ms);
}
function showAcq(p) {
  const a = $('acq');
  a.innerHTML = `<div class="t1"><b>${p.n}</b>${p.name} 획득</div><div class="t2"><em>${p.q}</em>${p.note}</div>`;
  a.classList.add('show'); clearTimeout(acqTimer); acqTimer = setTimeout(() => a.classList.remove('show'), 2400);
}
function banner(z) {
  const b = $('zoneBanner'); b.innerHTML = `${z.name}<small>${z.en}</small>`; b.style.opacity = 1;
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => (b.style.opacity = 0), 2600);
}
function addFeed(html) {
  const f = $('feed'), d = document.createElement('div'); d.innerHTML = html; f.prepend(d);
  while (f.children.length > 5) f.lastChild.remove();
  setTimeout(() => d.remove(), 9000);
}
function renderSlots() {
  const sl = $('slots'); sl.innerHTML = '';
  for (const p of PIECES) {
    const d = document.createElement('div');
    const found = state.found.includes(p.n), next = p.n === state.next;
    d.className = 'slot' + (found ? ' found' : next ? ' next' : '');
    d.innerHTML = `<i>${p.n}</i>${found ? p.name : next ? p.name[0] + '?' : ''}`;
    sl.appendChild(d);
  }
  const bar = $('bar'); bar.innerHTML = '';
  for (let i = 0; i < 8; i++) { const s = document.createElement('div'); if (i < state.found.length) s.className = 'on'; bar.appendChild(s); }
  $('cnt').textContent = state.found.length;
}
function players() {
  if (!NET.ok || (!NET.joined && !WATCH)) return [{ nick: state.nick, cleared: state.cleared, time: state.clearTime, count: state.found.length, last: 0, me: true }];
  const list = Object.entries(NET.players).filter(([, p]) => p && p.round === NET.round).map(([uid, p]) => ({ nick: p.nick, cleared: !!p.cleared, time: clearMsOf(p), count: p.count || 0, last: p.lastAt || 0, me: uid === NET.uid && !WATCH, online: p.online }));
  const me = list.find((p) => p.me); if (me) { me.count = state.found.length; me.cleared = state.cleared; if (state.cleared && !isFinite(me.time)) me.time = state.clearTime; }
  else if (!WATCH) list.push({ nick: state.nick, cleared: state.cleared, time: state.clearTime, count: state.found.length, last: 0, me: true });
  return list;
}
// 순위: ① 클리어 여부 → ② 클리어 시간 → ③ 찾은 조각 수 (같으면 먼저 찾은 사람)
function rankSort(a, b) { return (b.cleared - a.cleared) || (a.cleared ? a.time - b.time : 0) || (b.count - a.count) || ((a.last || Infinity) - (b.last || Infinity)); }
function renderRank() {
  const ps = players().sort(rankSort);
  const ol = $('rankList'); ol.innerHTML = '';
  ps.slice(0, 3).forEach((p, i) => { const li = document.createElement('li'); li.innerHTML = `<span><span class="p">${i + 1}</span>${esc(p.nick)}</span><span>${p.cleared ? fmtTime(p.time) : p.count + '/8'}</span>`; ol.appendChild(li); });
  const me = ps.findIndex((p) => p.me); $('myRank').textContent = `${me + 1} / ${ps.length}`;
  $('aliveN').textContent = NET.ok && NET.joined ? Object.values(NET.players).filter((p) => p.online && p.round === NET.round).length || 1 : ps.length;
}
function renderInv() {
  const l = $('invList'); l.innerHTML = '';
  for (const p of PIECES) {
    const found = state.found.includes(p.n), next = p.n === state.next;
    const d = document.createElement('div'); d.className = 'vrow' + (found ? '' : ' locked') + (next ? ' next' : '');
    d.innerHTML = `<div class="no">${p.n}</div><div class="nm">${found ? p.name : next ? p.name[0] + '?' : '???'}</div><div class="vs">${found ? p.verse + `<small>${p.q} · ${p.note}</small>` : next ? '다음에 찾을 조각' : '아직 찾지 못했어요'}</div>`;
    l.appendChild(d);
  }
}
const compassCv = $('compass'), cctx = compassCv.getContext('2d');
function headingDeg() { let h = -THREE.MathUtils.radToDeg(cam.yaw) % 360; if (h < 0) h += 360; return h; }
function drawCompass() {
  const W = compassCv.width, H = compassCv.height, hd = headingDeg(), ppd = W / 150;
  cctx.clearRect(0, 0, W, H);
  const g = cctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.15, 'rgba(0,0,0,.45)'); g.addColorStop(0.85, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  cctx.fillStyle = g; cctx.fillRect(0, 4, W, 26);
  cctx.textAlign = 'center'; cctx.textBaseline = 'middle';
  for (let dgr = Math.floor(hd - 80); dgr <= hd + 80; dgr++) {
    let rel = dgr - hd; const x = W / 2 + rel * ppd; const v = ((dgr % 360) + 360) % 360;
    if (v % 15 === 0) {
      const a = 1 - Math.abs(rel) / 78; cctx.globalAlpha = clamp(a * 1.4, 0, 1);
      const lbl = v === 0 ? 'N' : v === 90 ? 'E' : v === 180 ? 'S' : v === 270 ? 'W' : String(v);
      const big = v % 90 === 0;
      cctx.fillStyle = big ? '#f2a900' : '#fff'; cctx.font = `${big ? 500 : 400} ${big ? 24 : 18}px Teko`; cctx.fillText(lbl, x, 19);
    } else if (v % 5 === 0) { cctx.globalAlpha = clamp((1 - Math.abs(rel) / 78) * 1.2, 0, 1); cctx.fillStyle = '#fff'; cctx.fillRect(x - 0.5, 24, 1, 5); }
  }
  cctx.globalAlpha = 1; cctx.fillStyle = '#fff';
  cctx.beginPath(); cctx.moveTo(W / 2 - 5, 34); cctx.lineTo(W / 2 + 5, 34); cctx.lineTo(W / 2, 29); cctx.fill();
  cctx.font = '500 16px Teko'; cctx.fillText(String(Math.round(hd) % 360), W / 2, 41);
}
const mini = $('minimap'), mctx = mini.getContext('2d');
function drawArrow(ctx, x, y, rot, size) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#f2a900'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 0.7, size * 0.8); ctx.lineTo(0, size * 0.35); ctx.lineTo(-size * 0.7, size * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawMinimap() {
  const W = mini.width, view = 520, sc = MAPPX / SIZE, src = view * sc;
  const cx = (P.x + HALF) * sc, cz = (P.z + HALF) * sc;
  mctx.fillStyle = '#2b5a6e'; mctx.fillRect(0, 0, W, W);
  mctx.drawImage(mapCanvas, cx - src / 2, cz - src / 2, src, src, 0, 0, W, W);
  mctx.strokeStyle = 'rgba(255,255,255,.12)'; mctx.lineWidth = 1;
  const k = W / view;
  for (let g = Math.ceil((P.x - view / 2) / 100) * 100; g < P.x + view / 2; g += 100) { const x = (g - P.x) * k + W / 2; mctx.beginPath(); mctx.moveTo(x, 0); mctx.lineTo(x, W); mctx.stroke(); }
  for (let g = Math.ceil((P.z - view / 2) / 100) * 100; g < P.z + view / 2; g += 100) { const y = (g - P.z) * k + W / 2; mctx.beginPath(); mctx.moveTo(0, y); mctx.lineTo(W, y); mctx.stroke(); }
  // 시야 부채꼴
  mctx.save(); mctx.translate(W / 2, W / 2); mctx.rotate(-cam.yaw);
  const fg = mctx.createRadialGradient(0, 0, 0, 0, 0, 60); fg.addColorStop(0, 'rgba(255,255,255,.28)'); fg.addColorStop(1, 'rgba(255,255,255,0)');
  mctx.fillStyle = fg; mctx.beginPath(); mctx.moveTo(0, 0); mctx.arc(0, 0, 60, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); mctx.closePath(); mctx.fill(); mctx.restore();
  const mk = (x, z) => [(x - P.x) * k + W / 2, (z - P.z) * k + W / 2];
  drawPlanePath(mctx, mk, 1.5); drawDropMarks(mctx, mk, 7);
  drawArrow(mctx, W / 2, W / 2, -P.charYaw, 8);
}
const bigmap = $('bigmap'), bctx = bigmap.getContext('2d');
function drawBigMap() {
  const S = Math.floor(Math.min(innerWidth, innerHeight) * 0.86);
  if (bigmap.width !== S) { bigmap.width = bigmap.height = S; }
  bctx.drawImage(mapCanvas, 0, 0, S, S);
  const k = S / SIZE;
  bctx.strokeStyle = 'rgba(255,255,255,.12)'; bctx.lineWidth = 1;
  for (let g = 0; g <= SIZE; g += 100) { bctx.beginPath(); bctx.moveTo(g * k, 0); bctx.lineTo(g * k, S); bctx.stroke(); bctx.beginPath(); bctx.moveTo(0, g * k); bctx.lineTo(S, g * k); bctx.stroke(); }
  bctx.strokeStyle = 'rgba(242,169,0,.55)'; bctx.lineWidth = 1.5;
  for (let g = 0; g <= SIZE; g += 250) { bctx.beginPath(); bctx.moveTo(g * k, 0); bctx.lineTo(g * k, S); bctx.stroke(); bctx.beginPath(); bctx.moveTo(0, g * k); bctx.lineTo(S, g * k); bctx.stroke(); }
  bctx.fillStyle = '#f2a900'; bctx.font = `500 ${Math.round(S / 38)}px Teko`; bctx.textAlign = 'center'; bctx.textBaseline = 'top';
  for (let i = 0; i < 8; i++) { bctx.fillText('ABCDEFGH'[i], (i + 0.5) * 250 * k, 4); bctx.textAlign = 'left'; bctx.fillText(String(i + 1), 6, (i + 0.5) * 250 * k - 8); bctx.textAlign = 'center'; }
  bctx.textBaseline = 'middle';
  for (const key in ZONES) {
    const z = ZONES[key], x = (z.x + HALF) * k, y = (z.z + HALF) * k;
    bctx.font = `${Math.round(S / 40)}px "Black Han Sans"`; bctx.lineWidth = 4; bctx.strokeStyle = 'rgba(0,0,0,.65)'; bctx.strokeText(z.name, x, y); bctx.fillStyle = '#fff'; bctx.fillText(z.name, x, y);
  }
  bctx.font = `italic ${Math.round(S / 46)}px "Noto Sans KR"`; bctx.fillStyle = '#cfe6f2'; bctx.strokeStyle = 'rgba(0,0,0,.5)'; bctx.lineWidth = 3;
  bctx.strokeText('요단강', (-200 + HALF) * k, (225 + HALF) * k); bctx.fillText('요단강', (-200 + HALF) * k, (225 + HALF) * k);
  const bk = (x, z) => [(x + HALF) * k, (z + HALF) * k];
  drawPlanePath(bctx, bk, 2); drawDropMarks(bctx, bk, 10);
  drawArrow(bctx, (P.x + HALF) * k, (P.z + HALF) * k, -P.charYaw, 11);
}

// ───────────────────────── 상호작용 ─────────────────────────
let nearest = null;
function hideItem(it) { it.active = false; scene.remove(it.obj.g); }
function interact(it) {
  if (it && it.type === 'drop') return openDrop(it);
  if (!it || state.cleared || state.inLobby) return;
  if (it.type === 'box') {
    if (it.opened) return;
    it.opened = true; state.boxes++; sfx('box');
    it.openAnim = 0;
    const c = it.content;
    if (c.type === 'empty') { toast('힝 속았지? 🤪', 'warn'); }
    else {
      const spot = { x: it.x, y: it.y + 0.35, z: it.z };
      const ni = addItem(c.type, c.type === 'piece' ? { n: c.n } : { kind: c.kind }, spot);
      ni.fromBox = true; placed.pop();
    }
    return;
  }
  if (it.type === 'genie') { hideItem(it); state.genie++; sfx('genie'); toast(MSG_GENIE, 'warn', 2600); netUpdate({ genie: state.genie }); return; }
  if (it.type === 'piece') {
    if (it.n === state.next) {
      hideItem(it); state.found.push(it.n); state.next++;
      const p = PIECES[it.n - 1]; showAcq(p); sfx('get'); renderSlots(); renderRank();
      if (ui.inv) renderInv();
      netUpdate({ ...progressFields(), lastAt: NET.ok ? NET.fb.serverTimestamp() : 0 });
      if (state.found.length === 4 && !state.halfAnnounced) { state.halfAnnounced = true; netFeed(`🔥 <b>${esc(state.nick)}</b>님이 주기도문의 절반을 찾았습니다! (4/8)`); }
      if (state.next === 9) readyAmen();
    } else if (it.n < state.next) { sfx('info'); toast('이미 찾은 조각이야!'); }
    else { state.mistakes[it.n]++; sfx('bad'); toast('아직 아니야!', 'bad'); netUpdate({ ['mis/' + it.n]: state.mistakes[it.n] }); }
  }
}
function readyAmen() {
  state.amenReady = true; $('amen').classList.remove('hidden');
  ui.pauseBlocked = true; if (document.pointerLockElement) document.exitPointerLock();
  toast('주기도문을 모두 모았어요! 아멘을 외쳐요', 'warn', 2400);
}
function doAmen() {
  if (!state.amenReady || state.cleared) return;
  state.cleared = true; state.amenReady = false; state.clearTime = performance.now() - state.startTime;
  if (NET.ok && NET.joined) state.clearTime = Math.max(0, serverNow() - NET.startAt);
  $('amen').classList.add('hidden'); sfx('amen');
  netUpdate({ ...progressFields(), cleared: true, clearAt: NET.ok ? NET.fb.serverTimestamp() : 0 });
  renderRank();
  const ps = players().sort(rankSort); const rank = Math.max(1, ps.findIndex((p) => p.me) + 1);
  if (rank <= 3) netFeed(`${['🥇', '🥈', '🥉'][rank - 1]} <b>${esc(state.nick)}</b>님이 ${rank}위로 아멘!`);
  $('winWho').textContent = state.nick;
  $('winRank').innerHTML = `#${rank} <span>/ ${ps.length}</span>`;
  $('winTime').textContent = fmtTime(state.clearTime);
  $('winMis').textContent = state.mistakes.reduce((a, b) => a + b, 0);
  $('winGenie').textContent = state.genie;
  $('win').classList.remove('hidden');
}

// ───────────────────────── 대기실 섬 (배그 시작 섬) ─────────────────────────
const LOBBY = { x: -880, z: 880, half: 26, y: 3.2 };
function buildLobbyIsland() {
  const { x, z, half, y } = LOBBY, b = terrainH(x, z) - 1;
  lay(5, () => box(x, b, z, half * 2 + 4, y - b, half * 2 + 4, 0x9a7a58, false));
  addSolid(x - half, b, z - half, x + half, y, z + half);
  lay(4, () => { for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(x + dx * (half + 1), b - 2, z + dz * (half + 1), 0.6, 0.7, y - b + 3, 0x8d8a84, 10); });
  lay(1, () => { box(x - 14, y, z - 18, 6.1, 2.6, 2.44, 0x2e6f9e); addSolid(x - 17.05, y, z - 19.22, x - 10.95, y + 2.6, z - 16.78);
    box(x + 15, y, z + 16, 2.44, 2.6, 6.1, 0xb8452f); addSolid(x + 13.78, y, z + 12.95, x + 16.22, y + 2.6, z + 19.05);
    box(x + 15, y + 2.6, z + 16, 2.44, 2.6, 6.1, 0x3f7a4a); addSolid(x + 13.78, y + 2.6, z + 12.95, x + 16.22, y + 5.2, z + 19.05); });
  lay(5, () => { for (const [dx, dz] of [[6, -16], [8, -15], [-16, 10], [-15, 12.5]]) { box(x + dx, y, z + dz, 1.4, 1.2, 1.4, 0x7a5a3a); addSolid(x + dx - 0.7, y, z + dz - 0.7, x + dx + 0.7, y + 1.2, z + dz + 0.7); } });
  lay(7, () => { cyl(x, y, z - half + 1, 0.12, 0.12, 9, 0xdedede, 8); box(x + 1.3, y + 7.2, z - half + 1, 2.4, 1.5, 0.05, 0xf2a900, false); });
}
function lobbySpawn() {
  const { x, z, half, y } = LOBBY;
  for (let t = 0; t < 50; t++) { const px = x + (Math.random() - 0.5) * (half * 1.4), pz = z + (Math.random() - 0.5) * (half * 1.4); if (!insideSolid(px, y + 0.5, pz, 0.4)) return { x: px, z: pz, y: y + 0.05 }; }
  return { x, z, y: y + 0.05 };
}

// ───────────────────────── 멀티플레이 (Firebase 실시간 DB) ─────────────────────────
// 구조: rooms/main/state {phase: lobby|playing|ended, round, startAt}
//       rooms/main/players/{uid} {nick, round, count, next, cleared, clearAt, lastAt, mis, genie, online}
//       rooms/main/pos/{uid} {x,y,z,r,s,v,g}  rooms/main/feed/{id} {html, at}  rooms/main/kick/{uid}
const FB_CONFIG = {
  apiKey: 'AIzaSyAzkaXXDwG1Zx9HU6ef-f-2GCmRwa3MWG4', authDomain: 'prayer-bg.firebaseapp.com',
  databaseURL: 'https://prayer-bg-default-rtdb.asia-southeast1.firebasedatabase.app', projectId: 'prayer-bg',
  storageBucket: 'prayer-bg.firebasestorage.app', messagingSenderId: '261758048489', appId: '1:261758048489:web:eea951a268ea583f403878',
};
const FBV = '10.14.1';
const NET = { ok: false, fb: null, db: null, uid: null, offset: 0, room: null, phase: 'none', round: 0, startAt: 0, players: {}, remotes: new Map(), joined: false, joinAt: 0, sendT: 0, lastSent: '', kickSeen: 0 };
const serverNow = () => Date.now() + NET.offset;
const WATCH = new URLSearchParams(location.search).has('watch');
if (new URLSearchParams(location.search).has('debug')) setTimeout(() => (window.PBG = { P, CARS3, DROPS, state, cam, action, items }), 0);
async function initNet() {
  try {
    const [app, auth, db] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FBV}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FBV}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FBV}/firebase-database.js`),
    ]);
    // 한 기기에서 여러 명 시험할 때: 주소 끝에 ?solo 를 붙이면 매번 새 사람으로 접속
    const solo = new URLSearchParams(location.search).has('solo');
    const fapp = solo ? app.initializeApp(FB_CONFIG, 'solo' + Math.random().toString(36).slice(2)) : app.initializeApp(FB_CONFIG), a = auth.getAuth(fapp);
    if (solo) await auth.setPersistence(a, auth.inMemoryPersistence);
    const cred = await Promise.race([auth.signInAnonymously(a), new Promise((_, rej) => setTimeout(() => rej(new Error('시간 초과')), 8000))]);
    NET.fb = db; NET.db = db.getDatabase(fapp); NET.uid = cred.user.uid; NET.room = db.ref(NET.db, 'rooms/main');
    db.onValue(db.ref(NET.db, '.info/serverTimeOffset'), (snap) => (NET.offset = snap.val() || 0));
    db.onValue(db.child(NET.room, 'state'), (snap) => onRoomState(snap.val() || { phase: 'lobby', round: 0, startAt: 0 }));
    db.onValue(db.child(NET.room, 'players'), (snap) => { NET.players = snap.val() || {}; onPlayers(); });
    const posRef = db.child(NET.room, 'pos');
    db.onChildAdded(posRef, (sn) => onPos(sn.key, sn.val())); db.onChildChanged(posRef, (sn) => onPos(sn.key, sn.val())); db.onChildRemoved(posRef, (sn) => removeRemote(sn.key));
    db.onValue(db.child(NET.room, 'drops'), (snap) => syncDrops(snap.val()));
    db.onValue(db.child(NET.room, 'kick/' + NET.uid), (snap) => { const v = snap.val(); if (v && NET.joined && v > NET.joinAt) kicked(); });
    NET.ok = true;
    return true;
  } catch (e) { console.warn('온라인 연결 실패 → 혼자 하기', e); NET.ok = false; return false; }
}
function myNode() { return NET.players[NET.uid]; }
function netUpdate(fields) { if (!NET.ok || !NET.joined) return; NET.fb.update(NET.fb.child(NET.room, 'players/' + NET.uid), fields).catch((e) => console.warn(e)); }
function netFeed(html) { if (!NET.ok) { addFeed(html); return; } NET.fb.push(NET.fb.child(NET.room, 'feed'), { html, at: NET.fb.serverTimestamp() }).catch(() => addFeed(html)); }
function progressFields() {
  const mis = {}; for (let i = 1; i <= 8; i++) mis[i] = state.mistakes[i];
  return { count: state.found.length, next: state.next, mis, genie: state.genie, cleared: state.cleared };
}
async function joinNet(nick) {
  const { fb } = NET, me = fb.child(NET.room, 'players/' + NET.uid);
  const old = (await fb.get(me)).val();
  NET.joinAt = serverNow();
  if (old && old.round === NET.round) {
    // 새로고침 등으로 다시 들어온 경우: 같은 판이면 진행도 이어서
    state.next = old.next || 1; state.found = []; for (let i = 1; i < state.next; i++) state.found.push(i);
    state.genie = old.genie || 0; if (old.mis) for (let i = 1; i <= 8; i++) state.mistakes[i] = old.mis[i] || 0;
    state.cleared = !!old.cleared; state.halfAnnounced = state.found.length >= 4;
    await fb.update(me, { nick, online: true, dev: IS_TOUCH ? 'mobile' : 'pc' });
  } else {
    resetProgress();
    await fb.set(me, { nick, round: NET.round, online: true, joinedAt: fb.serverTimestamp(), dev: IS_TOUCH ? 'mobile' : 'pc', ...progressFields(), clearAt: 0, lastAt: 0 });
  }
  fb.onDisconnect(fb.child(me, 'online')).set(false);
  fb.onDisconnect(fb.child(NET.room, 'pos/' + NET.uid)).remove();
  NET.joined = true;
  // 내 노드가 관리자 초기화로 지워지면 다시 등록
  fb.onValue(me, (snap) => { if (NET.joined && !snap.exists()) { resetProgress(); writeMyNode(); } else if (snap.exists() && snap.val().nick !== state.nick) { state.nick = snap.val().nick; } });
  // 킬 로그: 들어온 뒤의 것만
  fb.onChildAdded(fb.query(fb.child(NET.room, 'feed'), fb.orderByChild('at'), fb.startAt(NET.joinAt - 2000)), (sn) => { const v = sn.val(); if (v && v.html) addFeed(v.html); });
}
function writeMyNode() {
  if (!NET.ok || !NET.joined) return;
  const { fb } = NET; fb.set(fb.child(NET.room, 'players/' + NET.uid), { nick: state.nick, round: NET.round, online: true, joinedAt: fb.serverTimestamp(), dev: IS_TOUCH ? 'mobile' : 'pc', ...progressFields(), clearAt: 0, lastAt: 0 }).catch((e) => console.warn(e));
}
// 관리자 화면용: 지도 이미지 내보내기
window.PBG_MAP = () => mapCanvas.toDataURL('image/jpeg', 0.85);
function resetProgress() {
  state.next = 1; state.found = []; state.mistakes = Array(9).fill(0); state.genie = 0; state.boxes = 0;
  state.cleared = false; state.amenReady = false; state.halfAnnounced = false; state.clearTime = 0;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.fromBox) { scene.remove(it.obj.g); items.splice(i, 1); continue; }
    if (it.type === 'drop') { it.opened = false; it.obj.lid.rotation.x = 0; continue; }
    if (it.type === 'box') { it.opened = false; it.openAnim = undefined; it.obj.hinge.rotation.x = 0; }
    if (!it.active && it.obj) { it.active = true; scene.add(it.obj.g); }
  }
  P.car = null; if (P.mode === 'drive') P.mode = 'walk'; for (const c of CARS3) resetCar(c);
  $('amen').classList.add('hidden'); $('win').classList.add('hidden'); ui.pauseBlocked = false;
  if (state.playing) { renderSlots(); renderRank(); }
}
function onRoomState(st) {
  const prevPhase = NET.phase, prevRound = NET.round;
  NET.phase = st.phase || 'lobby'; NET.round = st.round || 0; NET.startAt = st.startAt || 0; NET.plane = st.plane || null;
  if (!NET.joined) { updateLobbyBar(); if (WATCH && dropsReady && NET.phase !== prevPhase) watchPhase(); return; }
  if (NET.round !== prevRound) { resetProgress(); writeMyNode(); }
  if (NET.phase !== prevPhase || NET.round !== prevRound) enterPhase(NET.phase, prevPhase);
  updateLobbyBar();
}
function enterPhase(ph, prev) {
  $('results').classList.add('hidden');
  if (ph !== 'ended') leavePodium();
  if (ph === 'lobby') {
    state.inLobby = true; P.mode = 'walk'; P.car = null; const s = lobbySpawn(); P.x = s.x; P.z = s.z; P.y = s.y; P.vy = 0;
    $('bottom').classList.add('lobbyHide');
  } else if (ph === 'playing') {
    const wasLobby = state.inLobby; state.inLobby = false; $('bottom').classList.remove('lobbyHide');
    state.startTime = performance.now() - Math.max(0, serverNow() - NET.startAt);
    if (wasLobby || prev === 'ended' || prev === 'none') {
      if (planeBoardable()) boardPlane();
      else { P.mode = 'walk'; const s = randomSpawn(); P.x = s.x; P.z = s.z; P.y = s.y; P.vy = 0; P.charYaw = Math.random() * 6.28; cam.yaw = P.charYaw; updateGrass(true); if (prev === 'lobby') toast('게임 시작! 주기도문 조각을 순서대로 찾으세요', 'warn', 2600); }
    }
  } else if (ph === 'ended') { state.inLobby = false; enterPodium(); }
  renderSlots(); renderRank();
}
function updateLobbyBar() {
  const el = $('lobbyBar'); if (!el) return;
  const n = Object.values(NET.players).filter((p) => p.online).length;
  const ended = NET.phase === 'ended' && !state.podium;
  el.classList.toggle('hidden', !(NET.joined && (NET.phase === 'lobby' || ended)));
  el.innerHTML = ended ? `게임 종료! 수고했어요 🎉<small>관리자가 새 판을 열면 다시 비행기에 탈 수 있어요</small>` : `비행기 탑승 대기 중… <b>${n}</b>명<small>관리자가 게임을 시작하면 섬 어딘가에 떨어져요</small>`;
}
function onPlayers() {
  renderRank(); updateLobbyBar();
  if (NET.phase === 'ended' && POD.g) { buildPodium(); if (!$('results').classList.contains('hidden')) showResults(); }
  for (const [uid, r] of NET.remotes) { const p = NET.players[uid]; if (r.label) r.label.visible = !!p && NET.phase === 'lobby'; if (p && r.nick !== p.nick) setRemoteNick(r, p.nick); }
}
function kicked() {
  NET.joined = false; state.playing = false; if (document.pointerLockElement) document.exitPointerLock();
  $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); $('start').classList.remove('hidden');
  $('startBtn').disabled = false; $('nickErr').textContent = '관리자가 대기실에서 내보냈어요. 다시 들어올 수 있어요.';
}
// 클리어 시간 = 서버 시각 기준 (기기마다 시계가 달라도 공정)
function clearMsOf(p) { return p.cleared && p.clearAt && NET.startAt ? Math.max(0, p.clearAt - NET.startAt) : Infinity; }

// ── 다른 플레이어 ──
function makeNickSprite(nick) { const m = new THREE.SpriteMaterial({ map: labelTexture(nick, { size: nick.length > 6 ? 34 : 44 }), depthWrite: false, transparent: true }); const sp = new THREE.Sprite(m); sp.scale.set(1.9, 0.83, 1); sp.position.y = 2.35; return sp; }
function setRemoteNick(r, nick) { r.nick = nick; if (r.label) { r.root.remove(r.label); r.label.material.map.dispose(); r.label.material.dispose(); } r.label = makeNickSprite(nick); r.label.visible = NET.phase === 'lobby'; r.root.add(r.label); }
function onPos(uid, v) {
  if (uid === NET.uid || !v || !SOLDIER_TPL) return;
  let r = NET.remotes.get(uid);
  if (!r) {
    const S = soldierFromTpl(SOLDIER_TPL.scene);
    r = { S, root: S.root, x: v.x, y: v.y, z: v.z, yaw: v.r, tx: v.x, ty: v.y, tz: v.z, tyaw: v.r, s: v.s, v: 0, g: 1, seen: performance.now(), nick: '' };
    r.root.position.set(v.x, v.y, v.z); NET.remotes.set(uid, r);
    const p = NET.players[uid]; setRemoteNick(r, p ? p.nick : '');
  }
  r.tx = v.x; r.ty = v.y; r.tz = v.z; r.tyaw = v.r; r.s = v.s; r.v = v.v; r.g = v.g; r.seen = performance.now();
}
function removeRemote(uid) { const r = NET.remotes.get(uid); if (!r) return; scene.remove(r.root); if (r.car) scene.remove(r.car.g); r.root.traverse((o) => { if (o.isMesh && o.geometry && !o.isSkinnedMesh) o.geometry.dispose(); }); NET.remotes.delete(uid); }
const STANCES = ['stand', 'crouch', 'prone'];
function updateRemotes(dt) {
  const k = 1 - Math.exp(-9 * dt), cx = camera.position.x, cz = camera.position.z;
  for (const r of NET.remotes.values()) {
    const jump = Math.hypot(r.tx - r.x, r.tz - r.z) > 60; // 비행기에서 뛰어내릴 때 등은 바로 이동
    if (jump) { r.x = r.tx; r.y = r.ty; r.z = r.tz; } else { r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k; r.z += (r.tz - r.z) * k; }
    r.yaw = lerpAngle(r.yaw, r.tyaw, k);
    const d2 = (r.x - cx) ** 2 + (r.z - cz) ** 2, s = r.s || 0, vis = d2 < 260 * 260 && s !== 3 && !state.podium;
    r.root.visible = vis;
    if (r.car) r.car.g.visible = vis && s === 6;
    if (!vis) continue;
    r.root.position.set(r.x, r.y + (s === 4 ? 0.6 : 0), r.z); r.root.rotation.y = r.yaw;
    if (s === 6) { if (!r.car && BUGGY_TPL) r.car = makeBuggy(); if (r.car) { r.car.g.visible = true; r.car.g.position.set(r.x, r.y - SEAT_Y, r.z); r.car.g.rotation.set(0, r.yaw, 0); for (const w of r.car.wheels) w.rotation.x -= (r.v || 0) * dt / 0.42; } }
    setChute(r.S, s === 5);
    // 멀리 있으면 애니메이션을 덜 자주 갱신
    r.acc = (r.acc || 0) + dt; if (d2 > 80 * 80 && r.acc < 0.1) continue;
    if (s === 4) animateGLB(r.S, r.acc, 0, 'prone', true, false);
    else if (s === 5) animateGLB(r.S, r.acc, 0, 'stand', false, false);
    else if (s === 6) animateGLB(r.S, r.acc, 0, 'crouch', true, false);
    else animateGLB(r.S, r.acc, r.v || 0, STANCES[s] || 'stand', !!r.g, (r.v || 0) > 6);
    r.acc = 0;
  }
}
function sendPos(dt) {
  if (!NET.ok || !NET.joined) return;
  NET.sendT -= dt; if (NET.sendT > 0) return; NET.sendT = 0.2;
  const v = { x: Math.round(P.x * 100) / 100, y: Math.round(P.y * 100) / 100, z: Math.round(P.z * 100) / 100, r: Math.round(P.charYaw * 100) / 100, s: MODE_CODE[P.mode] ?? STANCES.indexOf(P.stance), v: Math.round(P.speed * 10) / 10, g: P.grounded ? 1 : 0 };
  const key = JSON.stringify(v), now = performance.now(); if (key === NET.lastSent && now - (NET.lastSentAt || 0) < 3000) return; NET.lastSent = key; NET.lastSentAt = now;
  NET.fb.set(NET.fb.child(NET.room, 'pos/' + NET.uid), v).catch(() => {});
}
function showResults() {
  const ps = players().sort(rankSort);
  const me = ps.findIndex((p) => p.me);
  $('resList').innerHTML = ps.slice(0, 10).map((p, i) => `<li class="${p.me ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="nm">${esc(p.nick)}</span><span class="rc">${p.cleared ? fmtTime(p.time) : p.count + '/8'}</span></li>`).join('');
  $('resMe').textContent = me >= 0 ? `내 순위 ${me + 1} / ${ps.length}` : '';
  $('results').classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock();
}
function esc(t) { return String(t || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ───────────────────────── 입력 ─────────────────────────
function setStance(s) {
  if (s === P.stance) return;
  if (s !== 'stand' && P.mode !== 'walk') return;
  const h = s === 'stand' ? 1.8 : s === 'crouch' ? 1.2 : 0.6;
  if (insideSolid(P.x, P.y + h - 0.1, P.z, 0)) return;
  P.stance = s; $('stance').textContent = s === 'stand' ? 'STAND' : s === 'crouch' ? 'CROUCH' : 'PRONE';
  $('tCrouch').classList.toggle('on', s === 'crouch'); $('tProne').classList.toggle('on', s === 'prone');
}
function jump() {
  if (P.mode === 'plane') return jumpOut(false);
  if (P.mode === 'fall') return openChute();
  if (P.mode !== 'walk') return;
  if (P.stance !== 'stand') { setStance('stand'); return; }
  if (P.grounded) { P.vy = 5.2; P.grounded = false; AUD.wasGrounded = false; AUD.fallVy = 0; playBuf('jump', 0.22, 1.15); footstep(0.5); }
}
function toggleView() { cam.fpp = !cam.fpp; $('viewTag').textContent = cam.fpp ? 'FPP' : 'TPP'; }
function toggleMap(force) { ui.map = force ?? !ui.map; $('mapOv').classList.toggle('hidden', !ui.map); if (ui.map) drawBigMap(); }
function toggleInv(force) { ui.inv = force ?? !ui.inv; $('inv').classList.toggle('hidden', !ui.inv); if (ui.inv) renderInv(); }
const PREVENT = new Set(['Tab', 'Space', 'AltLeft', 'AltRight', 'KeyF', 'KeyS', 'KeyD', 'KeyA', 'KeyW', 'KeyC', 'KeyZ', 'KeyV', 'KeyM', 'ControlLeft', 'ControlRight', 'ShiftLeft']);
addEventListener('keydown', (e) => {
  if (!state.playing) return;
  if (PREVENT.has(e.code) || e.ctrlKey) e.preventDefault();
  if (e.repeat && !['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) return;
  keys[e.code] = true;
  switch (e.code) {
    case 'Space': jump(); break;
    case 'KeyC': setStance(P.stance === 'crouch' ? 'stand' : 'crouch'); break;
    case 'KeyZ': setStance(P.stance === 'prone' ? 'stand' : 'prone'); break;
    case 'KeyF': action(); break;
    case 'Enter': if (state.amenReady) doAmen(); break;
    case 'KeyV': toggleView(); break;
    case 'KeyM': toggleMap(); break;
    case 'Tab': toggleInv(); break;
    case 'Escape': if (ui.map) toggleMap(false); if (ui.inv) toggleInv(false); break;
    case 'AltLeft': case 'AltRight':
      if (!cam.free) { cam.free = true; cam.freeReturn = false; cam.savedPitch = cam.pitch; } break;
  }
});
addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'AltLeft' || e.code === 'AltRight') { e.preventDefault(); if (cam.free) { cam.free = false; cam.freeReturn = true; } }
});
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (cam.free) { cam.free = false; cam.freeReturn = true; } });
const SENS = 0.0022;
function look(dx, dy, s = SENS) { lastLookAt = performance.now(); cam.yaw -= dx * s; cam.pitch = clamp(cam.pitch - dy * s, -1.25, 0.95); }
addEventListener('mousemove', (e) => {
  if (!state.playing || IS_TOUCH) return;
  if (pointerLocked) look(e.movementX, e.movementY);
  else if (dragging) look(e.movementX, e.movementY, SENS * 1.4);
});
canvas.addEventListener('mousedown', () => {
  if (!state.playing || IS_TOUCH) return;
  if (!pointerLocked) lockPointer();
  dragging = true;
});
addEventListener('mouseup', () => (dragging = false));
function lockPointer() {
  if (IS_TOUCH || state.amenReady) return;
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { dragLook = true; }); } catch { dragLook = true; }
}
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (pointerLocked) { $('pause').classList.add('hidden'); ui.pauseBlocked = false; }
  else if (state.playing && !ui.pauseBlocked && !state.cleared && !state.amenReady) $('pause').classList.remove('hidden');
});
document.addEventListener('pointerlockerror', () => { dragLook = true; $('pause').classList.add('hidden'); });
$('pause').addEventListener('click', () => { $('pause').classList.add('hidden'); lockPointer(); });
$('amen').addEventListener('click', doAmen);
document.querySelectorAll('.bgmBtn').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); setBgm(!AUD.bgmOn); }));
setBgm(AUD.bgmOn);
$('winBtn').addEventListener('click', () => { $('win').classList.add('hidden'); ui.pauseBlocked = false; if (!IS_TOUCH) lockPointer(); });
$('resBtn').addEventListener('click', () => { if (state.podium) { leavePodiumView(); return; } $('results').classList.add('hidden'); if (!IS_TOUCH) lockPointer(); });
$('mapOv').addEventListener('click', () => toggleMap(false));
$('inv').addEventListener('click', () => toggleInv(false));
addEventListener('beforeunload', (e) => { if (state.playing) { e.preventDefault(); e.returnValue = ''; } });

// 모바일 조작
const joy = { id: null, x: 0, y: 0, f: 0, r: 0 };
const lookT = { id: null, x: 0, y: 0 };
function setupTouch() {
  $('touch').classList.remove('hidden');
  if (setupTouch.done) return; setupTouch.done = true;
  const jEl = $('joy'), knob = $('knob');
  jEl.addEventListener('pointerdown', (e) => { joy.id = e.pointerId; jEl.setPointerCapture(e.pointerId); const r = jEl.getBoundingClientRect(); joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; joy.M = r.width * 0.4; moveJoy(e); });
  const moveJoy = (e) => {
    if (e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy; const L = Math.hypot(dx, dy), M = joy.M || 58;
    if (L > M) { dx = dx / L * M; dy = dy / L * M; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; joy.r = dx / M; joy.f = -dy / M;
  };
  jEl.addEventListener('pointermove', moveJoy);
  const endJoy = (e) => { if (e.pointerId !== joy.id) return; joy.id = null; joy.f = joy.r = 0; knob.style.transform = ''; };
  jEl.addEventListener('pointerup', endJoy); jEl.addEventListener('pointercancel', endJoy);
  const lz = $('lookZone');
  lz.addEventListener('pointerdown', (e) => { if (lookT.id !== null) return; lookT.id = e.pointerId; lookT.x = e.clientX; lookT.y = e.clientY; lz.setPointerCapture(e.pointerId); });
  lz.addEventListener('pointermove', (e) => { if (e.pointerId !== lookT.id) return; look(e.clientX - lookT.x, e.clientY - lookT.y, 0.0052); lookT.x = e.clientX; lookT.y = e.clientY; });
  const endLook = (e) => { if (e.pointerId === lookT.id) lookT.id = null; };
  lz.addEventListener('pointerup', endLook); lz.addEventListener('pointercancel', endLook);
  const bind = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.stopPropagation(); fn(); });
  bind('tJump', jump);
  bind('tCrouch', () => setStance(P.stance === 'crouch' ? 'stand' : 'crouch'));
  bind('tProne', () => setStance(P.stance === 'prone' ? 'stand' : 'prone'));
  bind('tView', toggleView); bind('tMap', () => toggleMap()); bind('tBag', () => toggleInv());
  bind('minimap', () => toggleMap()); // 배그 모바일처럼 미니맵을 누르면 큰 지도
  bind('tMenu', () => $('pause').classList.remove('hidden'));
  bind('tUse', action);
  $('pause').querySelector('.click').textContent = '화면을 터치하면 계속합니다';
  $('mapHint').textContent = 'MAP · 화면을 누르면 닫기';
  $('amen').querySelector('small').textContent = '터치해서 아멘!';
}

// ───────────────────────── 3단계: 비행기 · 낙하산 · 버기 · 보급상자 · 시상대 ─────────────────────────
const PLANE = { ALT: 330, SPD: 70, mesh: null, props: [] };
const MODE_CODE = { plane: 3, fall: 4, chute: 5, drive: 6 };
const SEAT_Y = 0.36;
P.mode = 'walk'; P.vx = 0; P.vz = 0; P.car = null;
let lastLookAt = 0, nearCar = null, engT = 0;
const M3 = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.2, ...o });

// ── 비행기 ──
function makePlanePath() {
  const a = Math.random() * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a), o = (Math.random() - 0.5) * 700, cx = -dz * o, cz = dx * o;
  return { ax: Math.round(cx - dx * 1350), az: Math.round(cz - dz * 1350), bx: Math.round(cx + dx * 1350), bz: Math.round(cz + dz * 1350) };
}
const planeOn = () => !!NET.plane && (NET.phase === 'playing' || !NET.ok);
const planeT = () => (serverNow() - NET.startAt) / 1000;
const overIsland = (x, z) => Math.abs(x) < 930 && Math.abs(z) < 930;
function planeAt(t) {
  const p = NET.plane; if (!p) return null;
  const L = Math.hypot(p.bx - p.ax, p.bz - p.az), dx = (p.bx - p.ax) / L, dz = (p.bz - p.az) / L, s = Math.max(0, t) * PLANE.SPD;
  return { x: p.ax + dx * s, z: p.az + dz * s, y: PLANE.ALT, yaw: Math.atan2(dx, dz), s, L, dx, dz };
}
// 아직 섬 위를 다 지나가지 않았으면 탑승 가능
function planeBoardable() { if (!planeOn()) return false; const p = planeAt(planeT()); return p.s < p.L * 0.5 + 500; }
function buildPlaneMesh() {
  const g = new THREE.Group(), body = M3(0x5f6853, { roughness: 0.5, metalness: 0.35 }), dark = M3(0x2a2d29, { roughness: 0.7 }), glass = M3(0x1c2a38, { roughness: 0.15, metalness: 0.7 }), yel = M3(0xf2a900, { roughness: 0.5 });
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; };
  add(new THREE.CylinderGeometry(2.2, 2.2, 20, 18), body, 0, 0, 0, Math.PI / 2);
  add(new THREE.SphereGeometry(2.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), body, 0, 0, 10, Math.PI / 2);
  add(new THREE.CylinderGeometry(2.2, 0.55, 9, 18), body, 0, 0.6, -14.5, Math.PI / 2);
  add(new THREE.BoxGeometry(2.4, 0.8, 1.6), glass, 0, 1.15, 10.4, -0.5);
  add(new THREE.BoxGeometry(34, 0.45, 4.4), body, 0, 1.3, 1.2);
  add(new THREE.BoxGeometry(12, 0.3, 2.6), body, 0, 1.4, -17.6);
  add(new THREE.BoxGeometry(0.35, 5.2, 3.4), body, 0, 3.6, -17.4);
  add(new THREE.BoxGeometry(0.4, 1.2, 1.2), yel, 0, 5.6, -17.9);
  for (const x of [-6.8, -12.2, 6.8, 12.2]) {
    add(new THREE.CylinderGeometry(0.8, 0.7, 4, 12), dark, x, 0.9, 2.4, Math.PI / 2);
    const pr = new THREE.Group(); pr.position.set(x, 0.9, 4.5); g.add(pr);
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.9, 0.06), dark); b.position.y = 0.95; const h = new THREE.Group(); h.rotation.z = k * Math.PI / 2; h.add(b); pr.add(h); }
    PLANE.props.push(pr);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  g.visible = false; scene.add(g); PLANE.mesh = g;
}
function updatePlaneVis(dt) {
  if (!PLANE.mesh) return;
  const p = planeOn() ? planeAt(planeT()) : null, vis = !!p && p.s <= p.L;
  PLANE.mesh.visible = vis; if (!vis) return;
  PLANE.mesh.position.set(p.x, p.y, p.z); PLANE.mesh.rotation.y = p.yaw;
  for (const pr of PLANE.props) pr.rotation.z += dt * 45;
}
function boardPlane() {
  P.mode = 'plane'; P.vy = 0; P.vx = P.vz = 0; P.grounded = false; P.car = null; setStance('stand');
  cam.pitch = -0.28; const p = planeAt(planeT()); if (p) cam.yaw = p.yaw + Math.PI;
  toast(IS_TOUCH ? '✈ 비행기 탑승! 원하는 곳에서 [뛰어내리기]를 누르세요' : '✈ 비행기 탑승! 원하는 곳에서 F 키로 뛰어내리세요', 'warn', 3400);
}
function jumpOut(auto) {
  const p = planeAt(planeT());
  if (p && !auto && !overIsland(p.x, p.z)) { toast('아직 섬 위가 아니에요!', 'bad'); return; }
  if (p) { P.x = p.x - p.dx * 16; P.z = p.z - p.dz * 16; P.y = p.y - 5; P.vx = p.dx * 20; P.vz = p.dz * 20; }
  P.mode = 'fall'; P.vy = -4; P.charYaw = cam.yaw; cam.pitch = -0.5;
  playBuf('jump', 0.3, 0.7); sfx('whoosh');
  if (auto) toast('비행기가 섬을 벗어나서 자동으로 뛰어내렸어요', 'warn', 2400);
}
function openChute() {
  if (P.mode !== 'fall') return;
  P.mode = 'chute'; playBuf('land0', 0.22, 1.7); sfx('chute');
}
function nearestLand(x, z) {
  for (let r = 10; r < 900; r += 10) for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2, px = clamp(x + Math.cos(a) * r, -900, 900), pz = clamp(z + Math.sin(a) * r, -900, 900);
    if (terrainH(px, pz) > 1.5 && !footprintBlocked(px, pz, 1)) return { x: px, z: pz, y: terrainH(px, pz) };
  }
  return randomSpawn();
}
function updateAir(dt, f, r, mag) {
  const chute = P.mode === 'chute', b = cam.yaw, fx = -Math.sin(b), fz = -Math.cos(b), rx = Math.cos(b), rz = -Math.sin(b);
  const hs = chute ? 10 : (f > 0.3 ? 30 : 18);
  let tx = 0, tz = 0;
  if (mag > 0.05) { const nf = f / mag, nr = r / mag; tx = (fx * nf + rx * nr) * hs * mag; tz = (fz * nf + rz * nr) * hs * mag; }
  const kh = 1 - Math.exp(-(chute ? 1.6 : 0.8) * dt);
  P.vx += (tx - P.vx) * kh; P.vz += (tz - P.vz) * kh;
  const vyT = chute ? -5.5 : (f > 0.5 ? -60 : -46);
  P.vy += (vyT - P.vy) * (1 - Math.exp(-(chute ? 2 : 0.7) * dt));
  let nx = clamp(P.x + P.vx * dt, -960, 960), nz = clamp(P.z + P.vz * dt, -960, 960);
  [nx, nz] = resolveXZ(nx, nz, P.y, 1.8); P.x = nx; P.z = nz; P.y += P.vy * dt;
  P.charYaw = lerpAngle(P.charYaw, cam.yaw, 1 - Math.exp(-6 * dt));
  if (P.mode === 'fall' && P.y - Math.max(terrainH(P.x, P.z), 0) < 120) openChute();
  const g = groundAt(P.x, P.z, P.y);
  if (P.y <= g) land(g);
  P.speed = Math.hypot(P.vx, P.vz);
}
function land(g) {
  P.y = g; P.mode = 'walk'; P.grounded = true; P.vy = P.vx = P.vz = 0;
  if (terrainH(P.x, P.z) < -0.6 && g <= terrainH(P.x, P.z) + 0.01) { const s = nearestLand(P.x, P.z); P.x = s.x; P.z = s.z; P.y = s.y; toast('물에 빠져서 가까운 땅으로 옮겼어요'); }
  playBuf('land1', 0.45); footstep(1); AUD.wasGrounded = true; AUD.fallVy = 0; cam.pitch = -0.12; updateGrass(true);
}

// ── 낙하산 ──
let CHUTE = null;
function chuteAssets() {
  if (CHUTE) return CHUTE;
  const geo = new THREE.SphereGeometry(3.4, 16, 5, 0, Math.PI * 2, 0, 1.0).toNonIndexed(); geo.scale(1, 0.5, 1);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), cols = [new THREE.Color(0xf2a900), new THREE.Color(0xf4f4f4), new THREE.Color(0xc2361f), new THREE.Color(0xf4f4f4)];
  for (let i = 0; i < p.count; i += 3) {
    const cx = p.getX(i) + p.getX(i + 1) + p.getX(i + 2), cz = p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2);
    const seg = Math.floor((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2) * 8) % 8, c = cols[seg % 4];
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  CHUTE = { geo, mat: new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 }), line: new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.6 }) };
  return CHUTE;
}
function makeChute(top = 5.2, target = 1.5) {
  const A = chuteAssets(), g = new THREE.Group(), m = new THREE.Mesh(A.geo, A.mat); m.position.y = top; g.add(m);
  const rimY = top + 3.4 * Math.cos(1) * 0.5, rimR = 3.4 * Math.sin(1), v = [];
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; v.push(Math.cos(a) * rimR, rimY, Math.sin(a) * rimR, Math.cos(a) * 0.2, target, Math.sin(a) * 0.15); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.add(new THREE.LineSegments(lg, A.line));
  g.visible = false; return g;
}
function setChute(S, on) { if (!on && !S.chute) return; if (!S.chute) { S.chute = makeChute(); S.root.add(S.chute); } S.chute.visible = on; }

// ── 버기 (1인승, 길가 24대, 각자 자기 것) ──
const CARS3 = []; let BUGGY_TPL = null;
function buildBuggyTpl() {
  const g = new THREE.Group(), body = M3(0xc99a2e, { roughness: 0.45, metalness: 0.3 }), frame = M3(0x1e1e1e, { roughness: 0.45, metalness: 0.6 }), tire = M3(0x141414, { roughness: 0.95, metalness: 0 }), seat = M3(0x3a3530, { roughness: 0.85 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(1.5, 0.22, 3.0), frame, 0, 0.55, 0);
  add(new THREE.BoxGeometry(1.35, 0.32, 0.95), body, 0, 0.78, -1.1);
  add(new THREE.BoxGeometry(1.25, 0.42, 0.7), body, 0, 0.84, 1.15);
  add(new THREE.BoxGeometry(0.62, 0.12, 0.62), seat, 0, 0.74, 0.15);
  add(new THREE.BoxGeometry(0.62, 0.7, 0.12), seat, 0, 1.05, 0.5).rotation.x = 0.2;
  const tube = (a, b) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, A.distanceTo(B), 6), frame); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); m.castShadow = true; g.add(m); };
  for (const sx of [-0.62, 0.62]) { tube([sx, 0.65, -0.6], [sx, 1.75, -0.2]); tube([sx, 0.65, 0.75], [sx, 1.75, 0.55]); tube([sx, 1.75, -0.2], [sx, 1.75, 0.55]); }
  tube([-0.62, 1.75, -0.2], [0.62, 1.75, -0.2]); tube([-0.62, 1.75, 0.55], [0.62, 1.75, 0.55]);
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 14), frame); sw.position.set(0, 1.02, -0.38); sw.rotation.x = -0.9; g.add(sw);
  const lamp = M3(0xfff3c0, { emissive: 0x997733 });
  for (const x of [-0.45, 0.45]) add(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10).rotateX(Math.PI / 2), lamp, x, 0.84, -1.6);
  const wg = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 14); wg.rotateZ(Math.PI / 2);
  [[-0.86, -1.05], [0.86, -1.05], [-0.86, 1.05], [0.86, 1.05]].forEach(([x, z], i) => { const w = add(wg, tire, x, 0.42, z); w.userData.wheel = i; w.rotation.order = 'YXZ'; });
  g.rotation.order = 'YXZ'; BUGGY_TPL = g;
}
function makeBuggy() { const g = BUGGY_TPL.clone(), wheels = []; g.traverse((o) => { if (o.userData.wheel !== undefined) wheels[o.userData.wheel] = o; }); scene.add(g); return { g, wheels }; }
function placeBuggies() {
  buildBuggyTpl();
  const r = mulberry32(4242), cands = ROADS.filter((rd) => rd.w >= 6);
  for (let t = 0; t < 4000 && CARS3.length < 24; t++) {
    const rd = cands[(r() * cands.length) | 0], i = 1 + ((r() * (rd.pts.length - 2)) | 0), a = rd.pts[i - 1], b = rd.pts[i + 1];
    const tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1, side = r() < 0.5 ? -1 : 1, off = rd.w / 2 + 2.6;
    const x = rd.pts[i][0] - tz / L * side * off, z = rd.pts[i][1] + tx / L * side * off;
    if (terrainH(x, z) < 1.5 || riverDist(x, z) < 35 || footprintBlocked(x, z, 2.2) || Math.abs(x) > 900 || Math.abs(z) > 900 || TREE_SPOTS.some((t) => Math.hypot(t[0] - x, t[1] - z) < 4.5)) continue;
    let ok = true; forCircles(x, z, (c) => { if (Math.hypot(c.x - x, c.z - z) < c.r + 2) ok = false; }); if (!ok) continue;
    if (CARS3.some((c) => Math.hypot(c.hx - x, c.hz - z) < 110)) continue;
    const c = { hx: x, hz: z, hyaw: Math.atan2(-tx, -tz) + (r() - 0.5) * 0.3, v: 0, vy: 0, steer: 0, ...makeBuggy() };
    resetCar(c); CARS3.push(c);
  }
}
function resetCar(c) { c.x = c.hx; c.z = c.hz; c.yaw = c.hyaw; c.v = 0; c.vy = 0; c.y = groundAt(c.x, c.z, terrainH(c.x, c.z) + 1); poseCar(c, 0); }
function poseCar(c, dt) {
  const s = Math.sin(c.yaw), co = Math.cos(c.yaw), th = terrainH(c.x, c.z);
  let pitch = 0, roll = 0;
  if (c.y - th < 0.3) {
    const hF = terrainH(c.x - s * 1.1, c.z - co * 1.1), hB = terrainH(c.x + s * 1.1, c.z + co * 1.1), hR = terrainH(c.x + co * 0.85, c.z - s * 0.85), hL = terrainH(c.x - co * 0.85, c.z + s * 0.85);
    pitch = Math.atan2(hF - hB, 2.2); roll = Math.atan2(hR - hL, 1.7);
  }
  c.g.position.set(c.x, c.y, c.z); c.g.rotation.set(pitch, c.yaw, roll);
  for (let i = 0; i < 4; i++) { const w = c.wheels[i]; w.rotation.x -= c.v * dt / 0.42; w.rotation.y = i < 2 ? c.steer * 0.45 : 0; }
}
function enterCar(c) {
  setStance('stand'); P.mode = 'drive'; P.car = c; c.v = 0; P.vy = 0;
  toast(IS_TOUCH ? '🚙 버기 탑승 · 조이스틱으로 운전, [내리기]로 하차' : '🚙 버기 탑승 · W/S 가속·후진, A/D 방향, F 내리기', '', 2600);
}
function exitCar() {
  const c = P.car; if (!c) return;
  if (Math.abs(c.v) > 9) { toast('너무 빨라요! 속도를 줄이고 내리세요', 'warn'); return; }
  let placed = false;
  for (const side of [-1, 1]) {
    const x = c.x + Math.cos(c.yaw) * 1.6 * side, z = c.z - Math.sin(c.yaw) * 1.6 * side, g = groundAt(x, z, c.y + 1);
    if (!insideSolid(x, g + 1, z, 0.3) && terrainH(x, z) > -0.6) { P.x = x; P.z = z; P.y = g; placed = true; break; }
  }
  if (!placed) { P.x = c.x; P.z = c.z; P.y = c.y + 1.2; }
  P.mode = 'walk'; P.car = null; c.v = 0; P.vy = 0; P.grounded = false;
}
function updateDrive(dt, f, r, sprint) {
  const c = P.car; let a;
  if (f > 0.1) a = (c.v < -0.3 ? 18 : 8.5) * f;
  else if (f < -0.1) a = (c.v > 0.3 ? -18 : -5) * -f;
  else a = -Math.sign(c.v) * Math.min(Math.abs(c.v) / dt, 3.5);
  c.v = clamp(c.v + a * dt, -7, sprint ? 26 : 21);
  c.steer += (-r - c.steer) * (1 - Math.exp(-8 * dt));
  c.yaw += c.steer * 1.6 * clamp(Math.abs(c.v) / 5, 0, 1) * Math.sign(c.v) * (1 - 0.35 * clamp(Math.abs(c.v) / 26, 0, 1)) * dt;
  const nx = c.x - Math.sin(c.yaw) * c.v * dt, nz = c.z - Math.cos(c.yaw) * c.v * dt, dir = Math.sign(c.v) || 1;
  let blocked = Math.abs(nx) > 960 || Math.abs(nz) > 960 || (terrainH(nx, nz) < -0.4 && !onBridge(nx, nz));
  if (!blocked) {
    const fx = nx - Math.sin(c.yaw) * 1.45 * dir, fz = nz - Math.cos(c.yaw) * 1.45 * dir;
    if (insideSolid(fx, c.y + 0.9, fz, 0.35) || insideSolid(nx, c.y + 0.9, nz, 0.55)) blocked = true;
  }
  if (!blocked) forCircles(nx, nz, (cc) => { if (Math.hypot(cc.x - nx, cc.z - nz) < cc.r + 0.9 && c.y < cc.maxY) blocked = true; });
  if (blocked) { if (Math.abs(c.v) > 7) { playBuf('land0', 0.4, 0.7); toast('쾅!', 'bad', 700); } c.v = -c.v * 0.25; }
  else { c.x = nx; c.z = nz; }
  const g = groundAt(c.x, c.z, c.y + 0.6);
  if (c.y - g > 0.45) { c.vy -= 18 * dt; c.y += c.vy * dt; if (c.y <= g) { c.y = g; c.vy = 0; } }
  else { c.y = g; c.vy = 0; }
  poseCar(c, dt);
  P.x = c.x; P.z = c.z; P.y = c.y + SEAT_Y; P.charYaw = c.yaw; P.speed = Math.abs(c.v); P.grounded = true;
  // 마우스/화면을 잠깐 안 움직이면 카메라가 차 뒤로 돌아옴
  if (performance.now() - lastLookAt > 1500 && Math.abs(c.v) > 2) cam.yaw = lerpAngle(cam.yaw, c.yaw, 1 - Math.exp(-2.2 * dt));
}
// 엔진 소리 (비행기 · 버기)
const ENG = {};
function engineSet(kind, v) {
  if (!actx || !AUD.sfxGain) return;
  if (!ENG.g) {
    const o1 = actx.createOscillator(), o2 = actx.createOscillator(), lp = actx.createBiquadFilter(), g = actx.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; lp.type = 'lowpass'; lp.frequency.value = 400; g.gain.value = 0;
    o1.connect(lp); o2.connect(lp); lp.connect(g).connect(AUD.sfxGain); o1.start(); o2.start(); Object.assign(ENG, { o1, o2, lp, g });
  }
  const t = actx.currentTime; let gain = 0, f = 40, cut = 300;
  if (kind === 'car') { gain = 0.05; f = 36 + v * 3.2; cut = 280 + v * 45; }
  else if (kind === 'plane') { gain = 0.07; f = 52; cut = 240; }
  ENG.g.gain.setTargetAtTime(gain, t, 0.2); ENG.o1.frequency.setTargetAtTime(f, t, 0.1); ENG.o2.frequency.setTargetAtTime(f * 0.505, t, 0.1); ENG.lp.frequency.setTargetAtTime(cut, t, 0.1);
}

// ── 보급상자 (관리자가 3번 투하: 꽝 · 왕관 · 꽝) ──
const DROPS = [], DROP_H = 220, DROP_V = 9; let DROP_PTS = [], dropsReady = false;
function chooseDropPts() {
  const targets = [[-430, 420], [30, -300], [560, 30]], out = [];
  for (const [tx, tz] of targets) {
    const pts = [];
    for (const rd of ROADS) for (let i = 1; i < rd.pts.length - 1; i++) pts.push([rd, i]);
    pts.sort((A, B) => Math.hypot(A[0].pts[A[1]][0] - tx, A[0].pts[A[1]][1] - tz) - Math.hypot(B[0].pts[B[1]][0] - tx, B[0].pts[B[1]][1] - tz));
    let got = null;
    for (const [rd, i] of pts) {
      const a = rd.pts[i - 1], b = rd.pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      for (const side of [1, -1]) {
        const off = rd.w / 2 + 6, x = rd.pts[i][0] - (b[1] - a[1]) / L * side * off, z = rd.pts[i][1] + (b[0] - a[0]) / L * side * off;
        if (terrainH(x, z) < 1.5 || footprintBlocked(x, z, 6) || riverDist(x, z) < 30 || TREE_SPOTS.some((t) => Math.hypot(t[0] - x, t[1] - z) < 9)) continue;
        let ok = true; forCircles(x, z, (c) => { if (Math.hypot(c.x - x, c.z - z) < c.r + 3) ok = false; }); if (!ok) continue;
        got = [Math.round(x), Math.round(z)]; break;
      }
      if (got) break;
    }
    out.push(got || [tx, tz]);
  }
  DROP_PTS = out; window.PBG_DROPS = out;
}
let SMOKE_MAT = null;
function makeDropObj() {
  const g = new THREE.Group(), red = M3(0xb3261e, { roughness: 0.6 }), white = M3(0xeeeeee), blue = M3(0x1d4f91, { roughness: 0.5 });
  const add = (geo, m, y, p = g) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = true; p.add(o); return o; };
  add(new THREE.BoxGeometry(1.4, 1.0, 1.4), red, 0.5); add(new THREE.BoxGeometry(1.43, 0.12, 1.43), white, 0.22); add(new THREE.BoxGeometry(1.43, 0.12, 1.43), white, 0.8);
  const lid = new THREE.Group(); lid.position.set(0, 1.0, -0.72); g.add(lid);
  const lm = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.14, 1.48), blue); lm.position.set(0, 0.07, 0.72); lm.castShadow = true; lid.add(lm);
  const chute = makeChute(5.6, 1.1); chute.visible = true; g.add(chute);
  if (!SMOKE_MAT) SMOKE_MAT = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,90,70,.95)', 'rgba(230,60,40,.45)'), transparent: true, depthWrite: false });
  const smoke = new THREE.Group(); smoke.visible = false; g.add(smoke);
  for (let i = 0; i < 9; i++) { const sp = new THREE.Sprite(SMOKE_MAT.clone()); sp.userData.k = i / 9; smoke.add(sp); }
  scene.add(g); return { g, lid, chute, smoke };
}
function syncDrops(v) {
  NET.drops = v || {}; if (!dropsReady) return;
  for (let i = DROPS.length - 1; i >= 0; i--) {
    const d = DROPS[i]; if (NET.drops[d.n]) continue;
    scene.remove(d.obj.g); d.active = false; const k = items.indexOf(d); if (k >= 0) items.splice(k, 1); DROPS.splice(i, 1);
  }
  for (const k in NET.drops) { const n = +k, val = NET.drops[k]; if (val && val.at && !DROPS.some((d) => d.n === n)) addDrop(n, val.at); }
}
function addDrop(n, at) {
  const [x, z] = DROP_PTS[(n - 1) % DROP_PTS.length] || [0, 0], y = terrainH(x, z);
  const it = { type: 'drop', n, x, y, z, at, active: true, landed: false, opened: false, phase: 0, obj: makeDropObj() };
  items.push(it); DROPS.push(it);
  if ((serverNow() - at) / 1000 < 5 && state.playing) { toast(`🪂 보급상자 ${n}번 투하! 지도의 빨간 표시를 찾아가세요`, 'warn', 3400); sfx('drop'); }
}
function updateDrops(dt) {
  const t = performance.now() / 1000;
  for (const d of DROPS) {
    const age = (serverNow() - d.at) / 1000, h = Math.max(0, DROP_H - age * DROP_V), o = d.obj;
    o.g.position.set(d.x, d.y + h, d.z);
    if (h > 0) { o.chute.rotation.z = Math.sin(age * 0.9) * 0.06; o.g.rotation.y = age * 0.15; }
    else if (!d.landed) { d.landed = true; o.chute.visible = false; o.smoke.visible = true; }
    if (d.landed) for (const sp of o.smoke.children) { const u = (t * 0.22 + sp.userData.k) % 1; sp.position.set(Math.sin(u * 6 + sp.userData.k * 9) * u * 1.5, 1 + u * 14, Math.cos(u * 5) * u); sp.scale.setScalar(1.2 + u * 5); sp.material.opacity = 0.75 * (1 - u); }
    if (d.opened && o.lid.rotation.x > -2) o.lid.rotation.x = Math.max(-2, o.lid.rotation.x - dt * 5);
  }
}
function openDrop(it) {
  if (it.opened) return; it.opened = true; sfx('box');
  if (it.n === 2) { state.genie++; sfx('genie'); toast('👑 왕관 발견!\n' + MSG_GENIE, 'warn', 3200); netUpdate({ genie: state.genie }); }
  else toast('텅 비었다…! 진짜 보물은 주기도문 조각이야 😉', 'warn', 2600);
}
function drawDropMarks(ctx, toXY, r) {
  for (const d of DROPS) {
    if (d.opened) continue; const [x, y] = toXY(d.x, d.z);
    ctx.fillStyle = '#e8352a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(r * 1.2)}px "Noto Sans KR"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(d.n), x, y + 1);
  }
}
function drawPlanePath(ctx, toXY, w) {
  if (!planeOn()) return; const p = planeAt(planeT()); if (!p || p.s > p.L) return;
  const A = toXY(NET.plane.ax, NET.plane.az), B = toXY(NET.plane.bx, NET.plane.bz), C = toXY(p.x, p.z);
  ctx.save(); ctx.setLineDash([w * 3, w * 2]); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.restore();
  ctx.font = `${Math.round(w * 9)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✈', C[0], C[1]);
}

// ── 시상대 ──
const POD = { g: null, key: '', S: [], conf: null, t: 0 };
const POD_C = () => ({ x: LOBBY.x, y: LOBBY.y, z: LOBBY.z + 4 });
function podTex(text, bg) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 128, 128); x.fillStyle = '#111'; x.font = '500 120px Teko, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 74);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildPodium() {
  const top = players().sort(rankSort).slice(0, 3), key = !!SOLDIER_TPL + '|' + top.map((p) => p.nick + ':' + p.count + ':' + p.time).join('|');
  if (POD.g && POD.key === key) return;
  removePodium(); POD.key = key; POD.t = 0;
  const c = POD_C(), g = new THREE.Group(); g.position.set(c.x, c.y, c.z); scene.add(g); POD.g = g;
  const H = [1.6, 1.1, 0.7], X = [0, -2.3, 2.3], col = ['#f2c230', '#c9ccd2', '#c98a4f'];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.1, H[i], 2.1), M3(0xf1eee7, { metalness: 0 })); m.position.set(X[i], H[i] / 2, 0); m.castShadow = m.receiveShadow = true; g.add(m);
    const tp = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.08, 2.14), M3(new THREE.Color(col[i]).getHex(), { metalness: 0.5, roughness: 0.35 })); tp.position.set(X[i], H[i], 0); g.add(tp);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, Math.min(0.9, H[i] - 0.15)), new THREE.MeshBasicMaterial({ map: podTex(String(i + 1), col[i]) })); pl.position.set(X[i], H[i] / 2, 1.06); g.add(pl);
    const p = top[i]; if (!p || !SOLDIER_TPL) continue;
    const S = soldierFromTpl(SOLDIER_TPL.scene); g.add(S.root); S.root.position.set(X[i], H[i] + 0.04, 0); S.root.rotation.y = Math.PI; S.baseY = H[i] + 0.04; S.rank = i;
    const nk = makeNickSprite(p.nick); nk.position.y = 2.3; S.root.add(nk);
    const rec = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(p.cleared ? fmtTime(p.time) : `${p.count}/8`, { size: 50, accent: col[i] }), depthWrite: false, transparent: true })); rec.scale.set(1.4, 0.61, 1); rec.position.y = 3.05; S.root.add(rec);
    POD.S.push(S);
  }
  // 색종이
  const N = 420, cm = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.13, 0.08), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), N), cc = new THREE.Color(), pal = [0xf2a900, 0xe8352a, 0x2e86de, 0x3ecf6a, 0xffffff, 0xc56cf0];
  POD.cd = [];
  for (let i = 0; i < N; i++) { cm.setColorAt(i, cc.setHex(pal[i % pal.length])); POD.cd.push({ x: (Math.random() - 0.5) * 12, y: Math.random() * 9, z: (Math.random() - 0.5) * 8, s: 0.6 + Math.random() * 0.9, r: Math.random() * 6, w: 2 + Math.random() * 4 }); }
  cm.frustumCulled = false; g.add(cm); POD.conf = cm;
}
function removePodium() {
  if (!POD.g) return;
  scene.remove(POD.g); POD.g.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.geometry) o.geometry.dispose(); });
  POD.g = null; POD.S = []; POD.conf = null; POD.key = '';
}
const _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion(), _pe = new THREE.Euler(), _pv = new THREE.Vector3(), _ps = new THREE.Vector3(1, 1, 1);
function updatePodium(dt) {
  if (!POD.g) return; podiumAnim(dt);
  const c = POD_C(), a = Math.sin(POD.t * 0.25) * 0.55;
  camera.position.set(c.x + Math.sin(a) * 10, c.y + 3.4, c.z + Math.cos(a) * 10); camera.lookAt(c.x, c.y + 1.8, c.z);
  sun.position.set(c.x + sunDir.x * 200, c.y + sunDir.y * 200, c.z + sunDir.z * 200); sun.target.position.set(c.x, c.y, c.z);
  soldier.root.visible = false;
}
function podiumAnim(dt) {
  if (!POD.g) return; POD.t += dt;
  for (const S of POD.S) { animateGLB(S, dt, 0, 'stand', true, false); if (S.rank === 0) S.root.position.y = S.baseY + Math.abs(Math.sin(POD.t * 3.2)) * 0.28; }
  if (POD.conf) { for (let i = 0; i < POD.cd.length; i++) { const d = POD.cd[i]; d.y -= d.s * dt; if (d.y < 0) d.y += 9; d.r += d.w * dt; _pv.set(d.x + Math.sin(d.r * 0.5) * 0.3, d.y, d.z); _pq.setFromEuler(_pe.set(d.r, d.r * 0.7, 0)); POD.conf.setMatrixAt(i, _pm.compose(_pv, _pq, _ps)); } POD.conf.instanceMatrix.needsUpdate = true; }
}
// 시상식 화면에서 나와 갑판을 걸어 다니며 다음 판을 기다림 (시상대는 그대로 둠)
function leavePodiumView() {
  if (!state.podium) return;
  state.podium = false; state.inLobby = true; $('results').classList.add('hidden');
  const c = POD_C(); P.mode = 'walk'; P.car = null; P.x = c.x; P.z = c.z + 7; P.y = LOBBY.y + 0.05; P.vy = 0; P.charYaw = 0; cam.yaw = 0; cam.pitch = -0.08;
  $('bottom').classList.add('lobbyHide'); updateLobbyBar();
  if (!IS_TOUCH) lockPointer();
}
function enterPodium() {
  state.podium = true; P.car = null; if (P.mode !== 'walk') { P.mode = 'walk'; }
  setChute(soldier, false); buildPodium(); showResults(); $('results').classList.add('podium'); $('resBtn').textContent = '대기실 둘러보기 ▶'; updateLobbyBar();
}
function leavePodium() { state.podium = false; removePodium(); $('results').classList.remove('podium'); $('resBtn').textContent = '닫기'; }

// ── 관전 모드 (?watch): 대기실 → 비행기 → 섬 전경 → 시상대 ──
function watchPhase() {
  if (NET.phase === 'ended') enterPodium();
  else { leavePodium(); $('results').classList.add('hidden'); }
}
function watchCam(dt) {
  const t = performance.now() / 1000;
  if (state.podium) { updatePodium(dt); return; }
  if (NET.phase === 'lobby') {
    const a = t * 0.12; camera.position.set(LOBBY.x + Math.cos(a) * 34, LOBBY.y + 16, LOBBY.z + Math.sin(a) * 34); camera.lookAt(LOBBY.x, LOBBY.y + 1, LOBBY.z);
  } else if (planeOn() && planeAt(planeT()).s < planeAt(planeT()).L) {
    const p = planeAt(planeT()); camera.position.set(p.x - p.dx * 60 + p.dz * 25, p.y + 18, p.z - p.dz * 60 - p.dx * 25); camera.lookAt(p.x, p.y, p.z);
  } else {
    const a = t * 0.04; camera.position.set(Math.cos(a) * 520, 230, Math.sin(a) * 520); camera.lookAt(0, 70, 0);
  }
  sun.position.set(camera.position.x + sunDir.x * 200, sunDir.y * 200, camera.position.z + sunDir.z * 200); sun.target.position.set(camera.position.x, 0, camera.position.z);
}

// ── F 키 / 사용 버튼 ──
function action() {
  if (state.podium) return;
  if (P.mode === 'plane') return jumpOut(false);
  if (P.mode === 'fall') return openChute();
  if (P.mode === 'chute') return;
  if (P.mode === 'drive') return exitCar();
  if (state.amenReady) return doAmen();
  if (nearest) return interact(nearest);
  if (nearCar && !state.inLobby) return enterCar(nearCar);
}

// ───────────────────────── 물리 · 카메라 ─────────────────────────
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), shoulder = new THREE.Vector3(), lookDir = new THREE.Vector3();
function stanceH() { return P.stance === 'stand' ? 1.8 : P.stance === 'crouch' ? 1.2 : 0.6; }
function update(dt) {
  // 입력 → 이동
  let f = 0, r = 0, walk = false, sprint = false;
  if (IS_TOUCH) { f = joy.f; r = joy.r; const m = Math.hypot(f, r); walk = m < 0.55 && m > 0; sprint = m > 0.97 && f > 0.75; }
  else { f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0); r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); walk = !!(keys.ControlLeft || keys.ControlRight); sprint = !!(keys.ShiftLeft || keys.ShiftRight) && f > 0; }
  const busy = ui.map || ui.inv || state.amenReady || !$('win').classList.contains('hidden') || !$('results').classList.contains('hidden');
  if (busy && !IS_TOUCH) { f = 0; r = 0; }
  const mag = Math.min(1, Math.hypot(f, r));
  engT -= dt; if (engT < 0) { engT = 0.1; engineSet(P.mode === 'drive' ? 'car' : P.mode === 'plane' ? 'plane' : 'off', P.speed); }
  // 비행기 탑승 중
  if (P.mode === 'plane') {
    const p = planeOn() ? planeAt(planeT()) : null;
    if (!p) { const s = randomSpawn(); P.x = s.x; P.z = s.z; P.y = s.y; P.mode = 'walk'; }
    else if (p.s > p.L || (p.s > p.L * 0.5 && !overIsland(p.x, p.z))) jumpOut(true);
    else { P.x = p.x; P.z = p.z; P.y = p.y; }
    if (P.mode === 'plane') {
      soldier.root.visible = false;
      lookDir.set(-Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), -Math.cos(cam.yaw) * Math.cos(cam.pitch));
      camera.position.set(P.x, P.y + 5, P.z).addScaledVector(lookDir, -50); camera.lookAt(P.x, P.y + 2, P.z);
      sunFollow(); nearest = null; nearCar = null; updatePrompt(); return;
    }
  }
  if (P.mode === 'fall' || P.mode === 'chute') updateAir(dt, f, r, mag);
  else if (P.mode === 'drive') updateDrive(dt, f, r, sprint);
  else {
    let spd = 0;
    if (mag > 0.05) {
      if (P.stance === 'prone') spd = 1.2; else if (P.stance === 'crouch') spd = walk ? 1.4 : 2.7;
      else spd = walk ? 1.9 : sprint ? 6.6 : 4.8;
      if (!P.grounded) spd *= 0.9;
    }
    const basis = cam.free ? P.charYaw : cam.yaw;
    const fx = -Math.sin(basis), fz = -Math.cos(basis), rx = Math.cos(basis), rz = -Math.sin(basis);
    let mx = 0, mz = 0;
    if (mag > 0.05) { const nf = f / Math.max(mag, 1e-6), nr = r / Math.max(mag, 1e-6); mx = (fx * nf + rx * nr) * spd; mz = (fz * nf + rz * nr) * spd; }
    P.speed = lerp(P.speed, spd, 1 - Math.exp(-10 * dt));
    if (mag > 0.05 && !cam.free) P.charYaw = lerpAngle(P.charYaw, cam.yaw, 1 - Math.exp(-14 * dt));
    const h = stanceH();
    let nx = P.x + mx * dt, nz = P.z + mz * dt;
    [nx, nz] = resolveXZ(nx, nz, P.y, h);
    for (const c of CARS3) { const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz); if (d < 1.5 && d > 1e-3 && P.y < c.y + 1.3) { nx = c.x + dx / d * 1.5; nz = c.z + dz / d * 1.5; } }
    nx = clamp(nx, -HALF + 20, HALF - 20); nz = clamp(nz, -HALF + 20, HALF - 20);
    const gNew = groundAt(nx, nz, P.y);
    if (gNew > -0.7) { P.x = nx; P.z = nz; }
    // 수직
    const g = groundAt(P.x, P.z, P.y);
    P.vy -= 18 * dt; P.y += P.vy * dt;
    if (P.y <= g) { P.y = g; P.vy = 0; P.grounded = true; }
    else if (P.grounded && P.y - g < 0.35 && P.vy <= 0) { P.y = g; P.vy = 0; }
    else P.grounded = false;
  }
  const md = P.mode, onFoot = md === 'walk';
  // 캐릭터
  soldier.root.position.set(P.x, P.y + (md === 'fall' ? 0.6 : 0), P.z); soldier.root.rotation.y = P.charYaw;
  if (md === 'fall') animateSoldier(soldier, dt, 0, 'prone', true, false);
  else if (md === 'chute') animateSoldier(soldier, dt, 0, 'stand', false, false);
  else if (md === 'drive') animateSoldier(soldier, dt, 0, 'crouch', true, false);
  else animateSoldier(soldier, dt, P.grounded ? P.speed : 0, P.stance, P.grounded, sprint && P.speed > 6);
  setChute(soldier, md === 'chute');
  if (onFoot) updateSteps(dt, mag > 0.05 && P.speed > 0.5);
  // 자유 시점 복귀
  if (cam.freeReturn) { cam.yaw = lerpAngle(cam.yaw, P.charYaw, 1 - Math.exp(-10 * dt)); cam.pitch = lerp(cam.pitch, cam.savedPitch, 1 - Math.exp(-10 * dt)); if (Math.abs(cam.yaw - P.charYaw) < 0.01) cam.freeReturn = false; }
  // 카메라
  const eyeT = !onFoot ? 1.62 : P.stance === 'stand' ? 1.62 : P.stance === 'crouch' ? 1.1 : 0.45;
  P.eye = lerp(P.eye, eyeT, 1 - Math.exp(-10 * dt));
  lookDir.set(-Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), -Math.cos(cam.yaw) * Math.cos(cam.pitch));
  if (cam.fpp && onFoot) {
    soldier.root.visible = false;
    camera.position.set(P.x + -Math.sin(P.charYaw) * 0.12, P.y + P.eye + (P.grounded && P.speed > 0.5 ? Math.sin(soldier.phase * 2) * 0.045 : 0), P.z + -Math.cos(P.charYaw) * 0.12);
    camera.lookAt(tmpV.copy(camera.position).add(lookDir));
  } else {
    soldier.root.visible = true;
    const rX = Math.cos(cam.yaw), rZ = -Math.sin(cam.yaw), side = onFoot ? 0.55 : 0;
    shoulder.set(P.x + rX * side, P.y + P.eye + (md === 'drive' ? 0.7 : md === 'chute' ? 2.2 : 0.22), P.z + rZ * side);
    const back = md === 'drive' ? 6.2 : md === 'chute' ? 9 : md === 'fall' ? 5.5 : P.stance === 'prone' ? 2.6 : 3.3;
    let tHit = 1;
    for (let k = 1; k <= 12; k++) {
      const s = k / 12; tmpV.copy(shoulder).addScaledVector(lookDir, -back * s);
      if (tmpV.y < terrainH(tmpV.x, tmpV.z) + 0.35 || insideSolid(tmpV.x, tmpV.y, tmpV.z, 0.25)) { tHit = (k - 1) / 12; break; }
    }
    cam.dist = tHit < cam.dist ? tHit : Math.min(tHit, cam.dist + dt * 2.5);
    camera.position.copy(shoulder).addScaledVector(lookDir, -back * Math.max(cam.dist, 0.08));
    const th = terrainH(camera.position.x, camera.position.z) + 0.3; if (camera.position.y < th) camera.position.y = th;
    camera.lookAt(tmpV2.copy(shoulder).addScaledVector(lookDir, 20));
  }
  sunFollow();
  // 아이템
  nearest = null; nearCar = null; let nd = 2.4 * 2.4; const tnow = performance.now() / 1000;
  for (const it of items) {
    if (!it.active) continue;
    const dx = it.x - P.x, dz = it.z - P.z, d2 = dx * dx + dz * dz, o = it.obj;
    if (it.type === 'drop') { if (onFoot && it.landed && !it.opened && d2 < 2.8 * 2.8 && d2 < nd && Math.abs(it.y - P.y) < 2) { nd = d2; nearest = it; } continue; }
    o.g.visible = d2 < 700 * 700;
    if (it.type === 'piece') {
      o.label.visible = d2 < 170 * 170 && d2 > 3.5 * 3.5; o.beam.visible = d2 > 25 * 25 && d2 < 450 * 450;
      if (o.label.visible) { const ls = clamp(0.8 + Math.sqrt(d2) * 0.03, 1, 4.2); o.label.scale.set(2.28 * ls, ls, 1); o.label.position.y = 1.9 + ls * 0.55; }
    }
    if (d2 < 140 * 140 && o.spin) { o.spin.rotation.y = tnow * 1.3 + it.phase; o.spin.position.y = (it.type === 'piece' ? 1.0 : o.spin.position.y) + (it.type === 'piece' ? Math.sin(tnow * 2 + it.phase) * 0.08 : 0); }
    if (it.type === 'genie' && d2 < 140 * 140) o.glow.scale.setScalar(2.4 + Math.sin(tnow * 4 + it.phase) * 0.4);
    if (it.type === 'box' && it.openAnim !== undefined && it.openAnim < 1) { it.openAnim = Math.min(1, it.openAnim + dt * 3); o.hinge.rotation.x = -1.9 * it.openAnim; }
    if (it.type === 'box' && it.opened) continue;
    if (!onFoot) continue;
    if (d2 < nd && Math.abs(it.y + 0.5 - (P.y + 0.9)) < 2.2) { nd = d2; nearest = it; }
  }
  if (onFoot && !nearest) { let cd = 3.2 * 3.2; for (const c of CARS3) { const d2 = (c.x - P.x) ** 2 + (c.z - P.z) ** 2; if (d2 < cd && Math.abs(c.y - P.y) < 1.6) { cd = d2; nearCar = c; } } }
  updatePrompt();
  // 나무 구역 컬링
  for (const m of chunkMeshes) { const dx = m.userData.cx - P.x, dz = m.userData.cz - P.z, f = m.userData.far || (LOW ? 520 : 820); m.visible = dx * dx + dz * dz < f * f; }
}
// 햇빛 그림자 따라가기 (공중에서는 발밑 땅 기준)
function sunFollow() {
  const gy = P.mode === 'walk' || P.mode === 'drive' ? P.y : Math.max(terrainH(P.x, P.z), 0);
  sun.position.set(P.x + sunDir.x * 200, gy + sunDir.y * 200, P.z + sunDir.z * 200); sun.target.position.set(P.x, gy, P.z);
}
function updatePrompt() {
  const pr = $('prompt'), tu = $('tUse');
  let verb = '', what = '', tt = '';
  if (state.podium || P.mode === 'chute') { /* 없음 */ }
  else if (P.mode === 'plane') { verb = '뛰어내리기'; tt = '뛰어내리기'; }
  else if (P.mode === 'fall') { verb = '낙하산 펴기'; tt = '낙하산'; }
  else if (P.mode === 'drive') { verb = '내리기'; what = '버기'; tt = '내리기'; }
  else if (state.amenReady) { /* 아멘 버튼이 따로 있음 */ }
  else if (nearest && nearest.type === 'drop') { verb = '열기'; what = `보급상자 ${nearest.n}`; tt = '보급상자 열기'; }
  else if (nearest && !state.cleared) {
    verb = '줍기';
    if (nearest.type === 'piece') what = `주기도문 – ${PIECES[nearest.n - 1].name}`;
    else if (nearest.type === 'genie') what = ['돈가방', '트로피', '왕관'][nearest.kind];
    else { verb = '열기'; what = '상자'; }
    tt = `${verb} ${nearest.type === 'piece' ? PIECES[nearest.n - 1].name : what}`;
  } else if (nearCar && !state.inLobby) { verb = '타기'; what = '버기'; tt = '버기 타기'; }
  if (!verb) { pr.classList.add('hidden'); tu.classList.add('hidden'); return; }
  pr.querySelector('.verb').textContent = verb; pr.querySelector('.what').textContent = what;
  pr.classList.remove('hidden'); tu.textContent = tt; tu.classList.remove('hidden');
}
let zoneCheck = 0;
function checkZone(dt) {
  zoneCheck -= dt; if (zoneCheck > 0) return; zoneCheck = 0.5;
  let cur = null; for (const k in ZONES) { const z = ZONES[k]; if (Math.hypot(P.x - z.x, P.z - z.z) < z.r * 0.85) cur = k; }
  if (cur && cur !== state.zone) banner(ZONES[cur]);
  state.zone = cur;
}

// ───────────────────────── 시작 ─────────────────────────
function randomSpawn() {
  for (let t = 0; t < 5000; t++) {
    const x = (Math.random() * 2 - 1) * 820, z = (Math.random() * 2 - 1) * 820, h = terrainH(x, z);
    if (h < 2.5 || footprintBlocked(x, z, 2)) continue;
    let ok = true; forCircles(x, z, (c) => { if (Math.hypot(c.x - x, c.z - z) < c.r + 1) ok = false; }); if (!ok) continue;
    return { x, z, y: h };
  }
  return { x: -560, z: 560, y: terrainH(-560, 560) };
}
function startGame() {
  const nick = $('nick').value.trim();
  if (!nick) { $('nickErr').textContent = '닉네임을 입력하세요'; $('nick').focus(); return; }
  state.nick = nick;
  $('startBtn').disabled = true; if (document.activeElement) document.activeElement.blur();
  initAudio();
  try { const fs = document.documentElement.requestFullscreen?.(); fs?.then?.(() => navigator.keyboard?.lock?.().catch(() => {})).catch(() => {}); } catch { /* 무시 */ }
  const go = () => {
    state.playing = true;
    $('start').classList.add('hidden'); $('hud').classList.remove('hidden');
    if (IS_TOUCH) setupTouch(); else lockPointer();
    renderSlots(); renderRank();
    updateGrass(true);
    setTimeout(() => checkZone(1), 300);
  };
  if (NET.ok) {
    $('loadMsg').textContent = '접속하는 중…';
    joinNet(nick).then(() => { go(); enterPhase(NET.phase, 'none'); updateLobbyBar(); })
      .catch((e) => { console.warn(e); $('startBtn').disabled = false; $('nickErr').textContent = '접속에 실패했어요. 다시 눌러 주세요.'; });
    return;
  }
  // 오프라인(혼자 하기): 혼자서도 비행기에서 뛰어내림
  NET.plane = makePlanePath(); NET.startAt = serverNow();
  state.startTime = performance.now();
  go(); boardPlane();
}
$('startBtn').addEventListener('click', startGame);
$('nick').addEventListener('keydown', (e) => { if (e.key === 'Enter') startGame(); });
$('nick').addEventListener('input', () => ($('nickErr').textContent = ''));

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); if (ui.map) drawBigMap(); });

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  WIND.time.value = performance.now() / 1000;
  if (NET.remotes.size) updateRemotes(dt);
  updatePlaneVis(dt); if (DROPS.length) updateDrops(dt);
  { const alt = Math.max(0, camera.position.y - Math.max(terrainH(camera.position.x, camera.position.z), 0) - 40), b = LOW ? 430 : 700; scene.fog.far = b + alt * 2.2; scene.fog.near = (LOW ? 90 : 140) + alt * 1.2; }
  if (state.playing && state.podium) { updatePodium(dt); sendPos(dt); }
  else if (state.playing) {
    update(dt); if (POD.g) podiumAnim(dt); if (P.mode !== 'plane' && P.y - terrainH(P.x, P.z) < 120) updateGrass(); if (!state.inLobby && P.mode !== 'plane') checkZone(dt); drawCompass(); drawMinimap(); if (ui.map) drawBigMap();
    sendPos(dt);
  } else if (WATCH) watchCam(dt);
  else {
    const t = performance.now() / 1000 * 0.04;
    camera.position.set(Math.cos(t) * 520, 230, Math.sin(t) * 520); camera.lookAt(0, 70, 0);
    sun.position.set(sunDir.x * 300, sunDir.y * 300, sunDir.z * 300); sun.target.position.set(0, 0, 0);
  }
  renderer.render(scene, camera);
}

async function init() {
  const msg = $('loadMsg');
  preloadAudio();
  const netP = initNet();
  try { await Promise.race([document.fonts.load('900 56px "Noto Sans KR"'), new Promise((r) => setTimeout(r, 2500))]); } catch { /* 무시 */ }
  await new Promise((r) => setTimeout(r, 30));
  msg.textContent = '사진 텍스처를 불러오는 중… 0%';
  try { await loadTextures((p) => (msg.textContent = `사진 텍스처를 불러오는 중… ${Math.round(p * 100)}%`)); } catch (e) { console.warn('텍스처 대체', e); useFallbackTextures(); }
  try { msg.textContent = '하늘을 불러오는 중…'; await loadSky(); } catch (e) { console.warn('하늘 대체', e); }
  try { msg.textContent = '3D 모델을 불러오는 중…'; await loadModels(); } catch (e) { console.warn('3D 모델 대체', e); }
  msg.textContent = '맵을 만드는 중…'; await new Promise((r) => setTimeout(r, 20));
  buildTerrain();
  defineRoads(); defineAlleys(); indexRoads(); buildBridges();
  lay(4, buildPalace); lay(4, buildTemple); lay(5, buildOlive);
  msg.textContent = '마을을 짓는 중…'; await new Promise((r) => setTimeout(r, 20));
  buildBeth(); buildHarbor(); buildMarket(); buildWild(); buildFarmsteads(); buildFieldsAround(); buildFences(); buildPoles(); buildLighthouse(); buildLobbyIsland();
  buildRoadMeshes(); buildFieldMeshes();
  finishBuildings(); buildSigns();
  msg.textContent = '주기도문 조각을 숨기는 중…';
  await new Promise((r) => setTimeout(r, 30));
  try { await loadFoliage(); } catch (e) { console.warn('잎 텍스처 대체', e); }
  initItemAssets(); placeItems();
  buildNature(placed);
  initGrass();
  buildMapImage();
  placeBuggies(); buildPlaneMesh(); chooseDropPts(); dropsReady = true; syncDrops(NET.drops);
  { const x = mapCanvas.getContext('2d'), k = MAPPX / SIZE; x.fillStyle = '#9a7a58'; x.fillRect((LOBBY.x - LOBBY.half + HALF) * k, (LOBBY.z - LOBBY.half + HALF) * k, LOBBY.half * 2 * k, LOBBY.half * 2 * k); }
  soldier = buildSoldier();
  try { msg.textContent = '병사 모델을 불러오는 중…'; const g = await buildSoldierGLB(); scene.remove(soldier.root); soldier = g; } catch (e) { console.warn('병사 모델 대체', e); }
  msg.textContent = '서버에 연결하는 중…';
  const online = await netP;
  msg.textContent = (online ? '🟢 온라인 · ' : '⚪ 혼자 하기 · ') + (IS_TOUCH ? '왼쪽 조이스틱으로 이동' : 'Esc를 누르면 조작키 안내');
  $('startBtn').disabled = false; $('startBtn').textContent = 'START';
  if (WATCH) { $('start').classList.add('hidden'); $('watchTag').classList.remove('hidden'); document.body.classList.add('watch'); syncDrops(NET.drops); watchPhase(); addEventListener('dblclick', () => document.documentElement.requestFullscreen?.()); }
}
loop();
init().catch((e) => { console.error(e); $('loadMsg').textContent = '오류: ' + e.message; });
