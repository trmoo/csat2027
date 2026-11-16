/* 와우고 수능 시험장 3D 안내도 (csta2027) — wawoohs-3d 를 바탕으로 변형 */
// 화면 조작 — 층 고르기·검색·교실 카드·주소(#) 링크·보기 설정을 3D 장면과 잇는다.
import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import data from './data/school.json';
import siteData from './data/site.json';
import { buildSite } from './site.js';
import { buildSchool, FLOORS } from './building.js';
import { CATS, CAT, BUILDINGS, search, zoneOf, keyOf, findByKey } from './catalog.js';
import emblem from './assets/emblem.svg';

// 탭 아이콘 = 교표. HTML 의 <link rel=icon> 은 빌드 때 따로 떨어진 파일이 되어 한 파일 배포에서 깨지므로
// 스크립트에서 붙인다(그림은 빌드 때 data: 주소로 스크립트 안에 들어간다).
document.head.append(Object.assign(document.createElement('link'), { rel: 'icon', type: 'image/svg+xml', href: emblem }));

const $ = (id) => document.getElementById(id);
const H = data.floorH;
const GAP = 7;                    // 「층 띄워 쌓기」 때 층 사이에 더 벌리는 높이

/* ---------- 장면 ---------- */
const view = $('view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0xf6f2f1);
view.append(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
view.append(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc6b5, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(-40, 90, 60);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;   // 땅 밑으로는 못 내려가게
controls.minDistance = 15;
controls.maxDistance = 320;

// 땅과 남쪽 앞마당
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0xebe3e1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.3;
scene.add(ground);

// 학교 터 — 운동장·주차장(동관 증축 전 위성지도를 따라 그림)
const site = buildSite(siteData);
scene.add(site.root);

const school = buildSchool(data);
scene.add(school.root);
const rooms = school.rooms;           // 3D 물체가 붙은 방 목록
const byId = new Map(rooms.map((r) => [r.id, r]));

// 처음 시점의 방향 — 배치도 아래쪽(앞마당 쪽)에서 비스듬히 내려다본다. 거리는 화면 크기에 맞춰 homeView() 가 잰다
// 관 이름표(전관·후관·동관·서관…) — 건물 지붕 위에 크게 띄운다. 높이는 tick() 에서 보이는 꼭대기 층에 맞춘다
const bldTags = BUILDINGS.map((b) => {
  const el = document.createElement('div');
  el.className = 'bld bld-' + b.key;
  el.textContent = b.name;
  const obj = new CSS2DObject(el);
  obj.position.set(b.at[0], 0, -b.at[1]);
  scene.add(obj);
  return { b, obj };
});

// 학교 터 전체(가로 약 134, 세로 약 118 — 운동장·주차장까지)의 가운데를 바라본다
const HOME = { pos: new THREE.Vector3(-3, 115, 76), target: new THREE.Vector3(-4, 4, 2) };

/* ---------- 상태 ---------- */
const state = {
  floor: 0,          // 0 = 전체
  sel: null,         // 고른 방 id
  hover: null,       // 마우스를 올린 방 id
  cat: null,         // 색상 안내에서 고른 종류
  explode: false,
  labels: true,
  wall: 0.35,
  bld: true,         // 관 이름표 보이기
  site: true,        // 운동장·주차장 보이기
};

/* ---------- 모양 바꾸기 ---------- */
// 층을 고르면 그 층만 보이고 나머지 층은 모두 감춘다(2026-11-10 사용자 지시 — 예전에는 아래층을 흐리게 남겼다)
function floorMode(f) {
  if (state.floor === 0) return 'full';
  return f === state.floor ? 'full' : 'hidden';
}

function applyStyles() {
  for (const f of FLOORS) {
    const fl = school.floors.get(f);
    const mode = floorMode(f);
    fl.group.visible = mode !== 'hidden';
    const ghost = mode === 'ghost';
    fl.slabMat.opacity = ghost ? 0.35 : 1;
    fl.wallMat.opacity = ghost ? state.wall * 0.25 : state.wall;
    fl.wall.visible = fl.wallMat.opacity > 0.01;
    fl.lineMat.opacity = ghost ? 0.25 : 0.9;
    for (const p of fl.pillars || []) p.visible = true;

    for (const r of fl.rooms) {
      const selected = state.sel === r.id;
      const dimByCat = state.cat && r.cat !== state.cat;
      let op = r.blank ? 0.55 : r.lowKey ? 0.75 : 0.92;
      if (ghost) op = 0.1;
      else if (dimByCat) op = 0.12;
      r.mat.opacity = selected ? 1 : op;
      r.mat.depthWrite = r.mat.opacity > 0.5;
      r.mat.color.copy(selected ? new THREE.Color(0xc41e3a) : r.base);
      r.mat.emissive?.setHex(selected ? 0x400000 : 0x000000);

      // 이름표 — 전체 보기에서는 고른 방·강조한 종류만, 층을 고르면 그 층 방 모두
      let show = false;
      if (!ghost && state.labels) {
        if (state.floor === 0) show = selected || (state.cat && r.cat === state.cat);
        else show = !dimByCat || selected;
      }
      if (selected || (state.hover === r.id && !ghost)) show = true;   // 마우스를 올린 방은 늘 이름을 보여 준다
      if (r.blank) show = false;          // 시험에 쓰지 않는 공간은 이름도 용도도 보이지 않는다
      r.label.visible = Boolean(show);   // ⚠ null 이 들어가면 CSS2DRenderer 는 「보임」으로 친다(=== false 만 숨긴다)
      r.el.classList.toggle('on', selected);
    }
  }
  $('floorTag').textContent = state.floor ? state.floor + '층' : '전체';
  document.querySelectorAll('#floors button').forEach((b) => b.classList.toggle('on', +b.dataset.f === state.floor));
  document.querySelectorAll('#legend > li[data-cat]').forEach((li) => li.classList.toggle('on', li.dataset.cat === state.cat));
  renderCatList();
}

/* ---------- 카메라 부드럽게 옮기기 ---------- */
let fly = null;
function flyTo(target, pos, ms = 700) {
  fly = { t0: performance.now(), ms, fromT: controls.target.clone(), fromP: camera.position.clone(), toT: target, toP: pos };
}
function floorY(f) { return (f - 1) * (H + (state.explode ? GAP : 0)); }

function focusRoom(r) {
  const [cx, cy] = r.poly.reduce((s, p) => [s[0] + p[0] / r.poly.length, s[1] + p[1] / r.poly.length], [0, 0]);
  const t = new THREE.Vector3(cx, floorY(r.floor) + 1, -cy);
  const off = camera.position.clone().sub(controls.target).setLength(95);
  if (off.y < 35) off.y = 35;
  flyTo(t, t.clone().add(off));
}

/** 처음 시점 — 학교 터(운동장·주차장까지)와 건물 꼭대기가 화면에 다 들어오게 맞춘다.
 *  원근 때문에 가까운 쪽(운동장)이 크게 보이므로, 모서리를 화면에 비춰 보며 거리와 바라보는 점을 몇 번 고쳐 잡는다 */
const FIT_PTS = [];
for (const [x, y] of siteData.boundary) FIT_PTS.push(new THREE.Vector3(x, 0, -y));
for (const [x, y] of [[-51, 49], [59, 49], [59, -42], [-51, -42]]) FIT_PTS.push(new THREE.Vector3(x, 4 * H, -y));
function homeView() {
  const t = HOME.target.clone();
  // 층을 골랐으면 그 층 높이를, 띄워 쌓은 전체 보기면 건물 가운데 높이를 바라본다
  t.y += state.floor ? floorY(state.floor) : state.explode ? floorY(2.5) : 0;
  const dir = HOME.pos.clone().sub(HOME.target).normalize();
  const cam = camera.clone();
  let d = 150;
  for (let i = 0; i < 12; i++) {
    cam.position.copy(t).addScaledVector(dir, d);
    cam.lookAt(t);
    cam.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of FIT_PTS) {
      const v = p.clone().project(cam);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    t.z -= ((y0 + y1) / 2) * d * 0.25;               // 위아래 가운데 맞추기(화면 아래로 치우치면 바라보는 점을 앞으로)
    t.x += ((x0 + x1) / 2) * d * 0.25;
    d *= Math.max(x1 - x0, y1 - y0) / 1.86;           // 화면의 93% 를 채우게
  }
  return { t, p: t.clone().addScaledVector(dir, d) };
}
function home() {
  const { t, p } = homeView();
  flyTo(t, p);
}

/* ---------- 층·방 고르기 ---------- */
function setFloor(f, { keepSel = false } = {}) {
  state.floor = f;
  if (!keepSel) { state.sel = null; hideCard(); }
  applyStyles();
  if (!keepSel) home();
}

function select(id, { push = true, keepCat = false } = {}) {
  const r = byId.get(id);
  if (!r || r.blank) return;
  state.sel = id;
  if (!keepCat || r.cat !== state.cat) state.cat = null;   // 종류 목록에서 고르면 목록을 열어 둔다
  state.floor = r.floor;
  applyStyles();
  showCard(r);
  focusRoom(r);
  if (push) setHash(keyOf(rooms, r));
}

/* ---------- 교실 카드 ---------- */
function showCard(r) {
  const c = CAT[r.cat];
  $('cardChip').textContent = c.label;
  $('cardChip').style.background = c.color;
  $('cardName').textContent = r.name;
  $('cardWhere').textContent = `${r.floor}층${r.floors > 1 ? '~' + (r.floor + r.floors - 1) + '층' : ''} · ${zoneOf(r)}`;
  // 가까운 계단·화장실 안내는 뺐다 — 계단·화장실을 지도에서 지웠다(2026-11-16 사용자 지시)
  $('card').hidden = false;
}
function hideCard() { $('card').hidden = true; }

/* ---------- 주소(#) — 링크로 바로 열기 ---------- */
function setHash(h) { history.replaceState(null, '', '#' + encodeURIComponent(h)); }
function readHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h || h === 'all') return setFloor(0);
  const m = h.match(/^f([1-4])$/);
  if (m) return setFloor(+m[1]);
  const r = findByKey(rooms, h);
  if (r) select(r.id, { push: false });
}

/* ---------- 화면 조각 만들기 ---------- */
// 층 단추
const floorsEl = $('floors');
for (const f of [0, ...FLOORS.slice().reverse()]) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.f = f;
  b.innerHTML = f ? `${f}<span>층</span>` : '전체';
  b.onclick = () => { setFloor(f); setHash(f ? 'f' + f : 'all'); };
  floorsEl.append(b);
}

// 색상 안내
const legendEl = $('legend');
for (const c of CATS) {
  const n = rooms.filter((r) => r.cat === c.key).length;
  if (!n) continue;
  const li = document.createElement('li');
  if (c.key === 'none') {                 // 쓰지 않는 공간 — 누를 수 없고 방 목록도 없다
    li.className = 'static';
    li.innerHTML = `<i style="background:${c.color}"></i>${c.label}`;
    legendEl.append(li);
    continue;
  }
  li.dataset.cat = c.key;
  li.tabIndex = 0;
  li.innerHTML = `<i style="background:${c.color}"></i>${c.label}<em>${n}</em>`;
  const toggle = () => { state.cat = state.cat === c.key ? null : c.key; state.sel = null; hideCard(); applyStyles(); };
  li.onclick = toggle;
  li.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
  legendEl.append(li);
}

// 색상 안내에서 고른 종류의 방 목록 — 고른 칸 바로 아래에 층별로 펼친다. 누르면 그 방으로 간다(목록은 열어 둔 채)
let catListFor = null;
function renderCatList() {
  const key = state.cat ? state.cat + ':' + state.sel : null;
  if (key === catListFor) return;                    // 같은 상태면 다시 그리지 않는다(스크롤 자리 지키기)
  catListFor = key;
  legendEl.querySelector('.cat-rooms')?.remove();
  if (!state.cat) return;
  const box = document.createElement('li');
  box.className = 'cat-rooms';
  const list = rooms.filter((r) => r.cat === state.cat)
    .sort((a, b) => b.floor - a.floor || a.name.localeCompare(b.name, 'ko', { numeric: true }));
  for (const f of [...new Set(list.map((r) => r.floor))]) {
    const h = document.createElement('p');
    h.className = 'cat-floor';
    h.textContent = f + '층';
    box.append(h);
    const ul = document.createElement('ul');
    for (const r of list.filter((r) => r.floor === f)) {
      const li = document.createElement('li');
      li.tabIndex = 0;
      li.className = r.id === state.sel ? 'on' : '';
      li.innerHTML = '<b></b><span></span>';
      li.querySelector('b').textContent = r.name;
      li.querySelector('span').textContent = zoneOf(r);
      const go = (e) => { e.stopPropagation(); select(r.id, { keepCat: true }); };
      li.onclick = go;
      li.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } };
      ul.append(li);
    }
    box.append(ul);
  }
  legendEl.querySelector(`li[data-cat="${state.cat}"]`)?.after(box);
}

// 검색
const q = $('q'), hits = $('hits');
function renderHits() {
  hits.replaceChildren();
  const list = search(rooms, q.value).slice(0, 12);
  if (q.value.trim() && !list.length) {
    const li = document.createElement('li');
    li.className = 'none';
    li.textContent = '찾는 방이 없어요. 「시험실 7」·「7」 처럼 번호나 「대기실」 처럼 이름 일부를 넣어 보세요.';
    hits.append(li);
    return;
  }
  for (const r of list) {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.tabIndex = 0;
    li.innerHTML = `<i style="background:${CAT[r.cat].color}"></i><b></b><span>${r.floor}층 · ${zoneOf(r)}</span>`;
    li.querySelector('b').textContent = r.name;
    li.onclick = () => select(r.id);
    li.onkeydown = (e) => { if (e.key === 'Enter') select(r.id); };
    hits.append(li);
  }
}
q.addEventListener('input', renderHits);
q.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { const first = search(rooms, q.value)[0]; if (first) select(first.id); }
});

// 보기 설정
$('explode').onchange = (e) => {
  state.explode = e.target.checked;
  if (state.sel != null) focusRoom(byId.get(state.sel)); else home();
};
$('labels').onchange = (e) => { state.labels = e.target.checked; applyStyles(); };
$('bld').onchange = (e) => { state.bld = e.target.checked; };
$('site').onchange = (e) => { state.site = e.target.checked; site.root.visible = state.site; };
$('wall').oninput = (e) => { state.wall = e.target.value / 100; $('wallOut').textContent = e.target.value + '%'; applyStyles(); };
$('home').onclick = () => home();

// 카드 단추
$('cardClose').onclick = () => { state.sel = null; hideCard(); applyStyles(); setHash(state.floor ? 'f' + state.floor : 'all'); };
$('cardAll').onclick = () => { setFloor(0); setHash('all'); };
$('cardLink').onclick = async () => {
  const url = location.href;
  try { await navigator.clipboard.writeText(url); toast('링크를 복사했어요. 붙여 넣으면 이 방이 바로 열립니다.'); }
  catch { toast('복사하지 못했어요. 주소창의 주소를 직접 복사해 주세요.'); }
};

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- 눌러서 방 고르기 ---------- */
const ray = new THREE.Raycaster();
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  const r = pick(e);
  if (r) select(r.id);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.buttons) return;                       // 끄는 중에는 고르지 않는다
  const r = pick(e);
  renderer.domElement.style.cursor = r ? 'pointer' : 'grab';
  const id = r ? r.id : null;
  if (id !== state.hover) { state.hover = id; applyStyles(); }
});
labelRenderer.domElement.addEventListener('click', (e) => {
  const id = e.target.closest?.('.tag')?.dataset.id;
  if (id != null) select(+id);
});

function pick(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  const p = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(p, camera);
  const cand = rooms.filter((r) => !r.blank && r.mesh.parent.visible && r.mat.opacity > 0.3).map((r) => r.mesh);
  const hit = ray.intersectObjects(cand, false)[0];
  return hit ? byId.get(hit.object.userData.roomId) : null;
}

/* ---------- 그리기 ---------- */
function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);

/* ---------- 이름표 겹침 줄이기 ----------
   화면에서 겹치는 이름표는 덜 중요한 쪽을 잠깐 숨긴다.
   차례: 고른 방 > 마우스 올린 방 > 교실·특별실 등 > 준비실·창고 > 화장실·계단 */
const RANK = { stair: 3, wc: 3 };
let frame = 0;
function declutter() {
  const tags = [];
  for (const r of rooms) {
    if (!r.label.visible || r.el.style.display === 'none') { r.el.classList.remove('clash'); continue; }
    const rank = r.id === state.sel ? -2 : r.id === state.hover ? -1 : (RANK[r.cat] ?? 1);
    tags.push({ r, rank, box: r.el.getBoundingClientRect() });
  }
  // 관 이름표도 함께 견준다 — 전체 보기에서는 맨 먼저, 층을 고르면 교실 이름표 다음
  for (const { obj } of bldTags) {
    if (!obj.visible || obj.element.style.display === 'none') { obj.element.classList.remove('clash'); continue; }
    tags.push({ r: { el: obj.element }, rank: state.floor ? 1.5 : -3, box: obj.element.getBoundingClientRect() });
  }
  // 운동장·주차장 이름표는 가장 덜 중요하다
  for (const o of site.labels) {
    if (!state.site) { o.element.classList.remove('clash'); continue; }
    // 「수험생 주차 불가」 주차장 이름표는 시험실 다음으로 중요하다
    tags.push({ r: { el: o.element }, rank: o.element.classList.contains('no-park') ? 1.2 : 4, box: o.element.getBoundingClientRect() });
  }
  tags.sort((a, b) => a.rank - b.rank);
  const kept = [];
  for (const t of tags) {
    const hit = kept.some((k) => t.box.left < k.right - 2 && t.box.right > k.left + 2 && t.box.top < k.bottom - 1 && t.box.bottom > k.top + 1);
    t.r.el.classList.toggle('clash', hit);
    if (!hit) kept.push(t.box);
  }
}

/* ---------- 확대하면 시험실 번호를 키우기 (2026-11-16 사용자 지시) ----------
   처음 시점 거리 ÷ 지금 거리 = 확대 배율. 이름표 묶음에 --zoom 으로 넘기고 CSS 가 시험실 이름표 글자에 곱한다.
   처음 시점에서는 1배(그대로), 가까이 갈수록 커지되 3배까지. 축소할 때는 작아지지 않는다 */
let homeDist = 0;
function updateZoom() {
  if (!homeDist) { const { t, p } = homeView(); homeDist = t.distanceTo(p); }
  const z = Math.min(3, Math.max(1, homeDist / camera.position.distanceTo(controls.target)));
  labelRenderer.domElement.style.setProperty('--zoom', z.toFixed(2));
}

function tick(now) {
  if (++frame % 8 === 0) declutter();
  if (frame % 60 === 0) homeDist = 0;           // 층·띄워 쌓기·창 크기가 바뀌면 기준 거리도 다시 잰다
  updateZoom();
  // 층 높이를 목표값 쪽으로 조금씩 (띄워 쌓기 애니메이션)
  for (const f of FLOORS) {
    const g = school.floors.get(f).group;
    g.position.y += (floorY(f) - g.position.y) * 0.15;
  }
  // 관 이름표 — 지금 보이는 맨 위층(층을 골랐으면 그 층, 그 관이 더 낮으면 그 관 꼭대기)의 천장 위
  for (const { b, obj } of bldTags) {
    const top = Math.min(b.top, state.floor || 4);
    obj.position.y = floorY(top) + H + 1.2;
    obj.visible = state.bld && !(state.floor && state.floor < (b.from || 1));   // 그 관이 없는 층에서는 숨긴다
    obj.element.classList.toggle('quiet', state.floor !== 0);                // 층을 고르면 작게 — 교실 이름이 주인공
  }
  if (fly) {
    const t = Math.min(1, (now - fly.t0) / fly.ms);
    const k = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    controls.target.lerpVectors(fly.fromT, fly.toT, k);
    camera.position.lerpVectors(fly.fromP, fly.toP, k);
    if (t >= 1) fly = null;
  }
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  requestAnimationFrame(tick);
}

if (import.meta.env.DEV) window.__app = { school, state, applyStyles, select, setFloor, camera, controls };

resize();
{ const { t, p } = homeView(); controls.target.copy(t); camera.position.copy(p); }
applyStyles();
readHash();
window.addEventListener('hashchange', readHash);
requestAnimationFrame(tick);
