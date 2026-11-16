/* 와우고 수능 시험장 3D 안내도 (csta2027) — wawoohs-3d 를 바탕으로 변형 */
// 방 이름으로 종류·구역을 정하고, 검색·길 안내에 쓰는 계산을 모아 둔 곳.
// 화면(DOM)·three.js 를 쓰지 않아 node 에서 그대로 시험할 수 있다(test/data.test.mjs).

/** 방 종류 — 색상 안내의 차례이기도 하다. color 는 3D 상자 색.
 *  시험장 용도가 없는 방(이름이 빈 칸)은 'none' — 회색 상자로만 그리고 이름·용도를 보이지 않는다 */
export const CATS = [
  // 교표의 버건디(#81002b)와 어울리게 채도를 낮춘 색. 고른 방은 진홍(#c41e3a)으로 따로 칠한다
  { key: 'exam', label: '시험실', color: '#e2b257' },
  { key: 'spare', label: '예비시험실', color: '#d99aab' },
  { key: 'student', label: '수험생 대기·휴게', color: '#8fb282' },
  { key: 'hq', label: '시험관리본부', color: '#b06a5c' },
  { key: 'staff', label: '감독관 대기·연수', color: '#7fa3c4' },
  { key: 'facility', label: '식당·행정실·보건실', color: '#a48fc4' },
  { key: 'stair', label: '승강기', color: '#776b6c' },
  { key: 'none', label: '사용하지 않는 공간', color: '#dcd6d4' },
];
export const CAT = Object.fromEntries(CATS.map((c) => [c.key, c]));

/** 이름으로 종류를 정한다 (앞의 규칙이 먼저 걸린다) */
export function catOf(name) {
  if (!name) return 'none';
  if (/^시험실 \d+$/.test(name)) return 'exam';
  if (/^예비시험실/.test(name)) return 'spare';
  if (/^수험생/.test(name)) return 'student';
  if (/^시험관리본부$/.test(name)) return 'hq';
  if (/^감독관/.test(name)) return 'staff';
  if (/^승강기$/.test(name)) return 'stair';   // 계단은 표시하지 않는다(자료에서 뺐다)
  return 'facility'; // 식당·교육행정실·보건실
}

/**
 * 건물(관) — 3D 위에 띄우는 큰 이름표와 방의 「어느 관」 판단에 함께 쓴다.
 * at: 이름표를 띄울 자리(모형 mm, 배치도 좌표), top: 그 관의 꼭대기 층.
 * ★ 이름 붙이기(2026-11-10, 학교에서 부르는 이름과 맞는지 사용자 확인함): 배치도 아래쪽 동(행정실·보건실이 있는 동) = 전관,
 *   위쪽 동 = 후관, 오른쪽 별관 = 동관, 왼쪽 동 = 서관.
 */
export const BUILDINGS = [
  { key: 'front', name: '전관', at: [20, -3], top: 4 },
  { key: 'rear', name: '후관', at: [20, 35], top: 4 },
  { key: 'east', name: '동관', at: [54, 21], top: 4, from: 3 },   // 동관은 필로티 위 3층부터
  { key: 'west', name: '서관', at: [-36, 22], top: 3 },
  { key: 'hall', name: '식당동', at: [-37, -27], top: 3 },
];

/** 모형 좌표(mm)로 방이 속한 관을 정한다. 기준은 STL 의 동(棟) 경계 */
export function zoneOf(room) {
  const [cx, cy] = centroid(room.poly);
  if (room.annex || cx > 48.5) return '동관';
  if (cx < -18) return cy < -12 ? '식당동' : '서관';
  if (cx < -4) return '가운데 연결 통로';
  if (cy > 16) return '후관';
  return '전관';
}

export function centroid(poly) {
  let x = 0, y = 0;
  for (const [a, b] of poly) { x += a; y += b; }
  return [x / poly.length, y / poly.length];
}

/** 검색용으로 글자를 다듬는다 — 띄어쓰기·가운뎃점·「반」 을 지우고 소문자로 */
export const norm = (s) => s.toLowerCase().replace(/[\s·・()（）]/g, '').replace(/반$/, '');

/** 검색 — 이름이 똑같은 것 → 앞이 같은 것 → 들어 있는 것 차례. 계단·화장실은 이름으로 찾을 때만 */
export function search(rooms, q) {
  const s = norm(q);
  if (!s) return [];
  const score = (r) => {
    const n = norm(r.name);
    if (n === s) return 0;
    if (n.startsWith(s)) return 1;
    if (n.includes(s)) return 2;
    return 9;
  };
  return rooms
    .filter((r) => r.name)
    .map((r) => ({ r, k: score(r) }))
    .filter((o) => o.k < 9)
    .sort((a, b) => a.k - b.k || a.r.name.length - b.r.name.length || a.r.floor - b.r.floor || a.r.name.localeCompare(b.r.name, 'ko', { numeric: true }))
    .map((o) => o.r);
}

/** 같은 층에서 가장 가까운 계단·화장실 (중심점 사이 거리) */
export function nearest(rooms, room, cat) {
  const [x, y] = centroid(room.poly);
  let best = null, bd = Infinity;
  for (const r of rooms) {
    if (r === room || r.floor !== room.floor || catOf(r.name) !== cat) continue;
    const [a, b] = centroid(r.poly);
    const d = Math.hypot(a - x, b - y);
    if (d < bd) { bd = d; best = r; }
  }
  return best && { room: best, dir: direction(room, best) };
}

/** 두 방 사이의 방향을 배치도 기준(위·아래·왼쪽·오른쪽)으로 말한다 */
export function direction(from, to) {
  const [x0, y0] = centroid(from.poly);
  const [x1, y1] = centroid(to.poly);
  const dx = x1 - x0, dy = y1 - y0;
  if (Math.hypot(dx, dy) < 4) return '바로 옆';
  const h = dx > 0 ? '오른쪽' : '왼쪽';
  const v = dy > 0 ? '위쪽' : '아래쪽';
  if (Math.abs(dx) > 2.2 * Math.abs(dy)) return h;
  if (Math.abs(dy) > 2.2 * Math.abs(dx)) return v;
  return `${v} ${h}`;
}

/** 링크에 쓰는 열쇠 — 이름이 하나뿐이면 이름, 여럿이면 번호 */
export function keyOf(rooms, room) {
  const same = rooms.filter((r) => r.name === room.name).length;
  return same === 1 ? room.name : 'r' + room.id;
}

export function findByKey(rooms, key) {
  const m = key.match(/^r(\d+)$/);
  if (m) return rooms.find((r) => r.id === +m[1]) || null;
  return rooms.find((r) => r.name === key) || null;
}
