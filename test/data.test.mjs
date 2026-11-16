/* 와우고 수능 시험장 3D 안내도 (csta2027) */
// 자료 점검 — 배치도의 방이 빠짐없이, 건물 안에, 겹치지 않게 놓였는지 본다.
//   npm test
import { readFileSync } from 'node:fs';
import { catOf, search, nearest, keyOf, findByKey, zoneOf, centroid, BUILDINGS } from '../src/catalog.js';

const data = JSON.parse(readFileSync(new URL('../src/data/school.json', import.meta.url), 'utf8'));
const rooms = data.rooms;
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('  ✗', msg); } };

const inside = ([x, y], poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[j];
    if ((y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
};

// ① 시험장 방 — 시험실 1~22 가 하나씩, 맞는 층에(1~12 는 4층, 13~22 는 3층)
for (let n = 1; n <= 22; n++) {
  const list = rooms.filter((r) => r.name === `시험실 ${n}`);
  ok(list.length === 1, `시험실 ${n} 이 하나여야 함 (${list.length}개)`);
  if (list[0]) ok(list[0].floor === (n <= 12 ? 4 : 3), `시험실 ${n} 층 ${list[0].floor}`);
}
const ONE = {
  '예비시험실 1': 3, '예비시험실 2': 3, '수험생 휴게실': 2, '수험생 대기실': 2, '시험관리본부': 2,
  '감독관 대기실 1(도서관)': 2, '감독관 대기실 2(정보융합실)': 3, '감독관 연수장소(시청각실)': 1,
  '식당': 1, '교육행정실': 1, '보건실': 1,
};
for (const [name, f] of Object.entries(ONE)) {
  const list = rooms.filter((r) => r.name === name);
  ok(list.length === 1 && list[0].floor === f, `${name} 이 ${f}층에 하나 (${list.map((r) => r.floor)})`);
}
// 그 밖의 방은 이름이 비어 있어야 한다(용도를 보이지 않는다). 승강기만 예외
const ALLOWED = new Set([...Object.keys(ONE), '승강기']);
ok(!rooms.some((r) => r.name === '계단' || r.name === '화장실'), '계단·화장실은 자료에 없다(사용자 지시로 지움)');
ok(rooms.every((r, i) => r.id === i), '방 번호가 0부터 이어진다');
for (const r of rooms) {
  if (!r.name) { ok(catOf(r.name) === 'none', `이름 없는 방 ${r.id} 종류`); continue; }
  ok(ALLOWED.has(r.name) || /^시험실 \d+$/.test(r.name), `용도를 보이면 안 되는 방 이름 「${r.name}」`);
}
ok(rooms.filter((r) => r.name && !/^승강기$/.test(r.name)).length === 33, '용도 있는 방 33개');
// 시험실 차례 — 배치도의 자리(4층 위쪽 줄은 오른쪽에서 왼쪽으로 1→6, 아래쪽 줄은 왼쪽에서 오른쪽으로 7→12)
const cx = (name) => centroid(rooms.find((r) => r.name === name).poly)[0];
for (let n = 1; n < 6; n++) ok(cx(`시험실 ${n}`) > cx(`시험실 ${n + 1}`), `시험실 ${n} 이 ${n + 1} 의 오른쪽`);
for (let n = 7; n < 12; n++) ok(cx(`시험실 ${n}`) < cx(`시험실 ${n + 1}`), `시험실 ${n} 이 ${n + 1} 의 왼쪽`);
for (let n = 13; n < 18; n++) ok(cx(`시험실 ${n}`) > cx(`시험실 ${n + 1}`), `시험실 ${n} 이 ${n + 1} 의 오른쪽`);
for (let n = 19; n < 22; n++) ok(cx(`시험실 ${n}`) > cx(`시험실 ${n + 1}`), `시험실 ${n} 이 ${n + 1} 의 오른쪽`);
ok(cx('시험실 22') > cx('예비시험실 1') && cx('예비시험실 1') > cx('예비시험실 2'), '예비시험실 1·2 는 시험실 22 왼쪽');
ok(cx('수험생 휴게실') < cx('수험생 대기실'), '수험생 휴게실이 대기실 왼쪽');

// ② 모든 방에 종류가 있고, 중심이 그 층 건물 안(마당 구멍이 아닌 곳)에 있다
for (const r of rooms) {
  ok(catOf(r.name), `${r.name || r.id} 종류`);
  const c = centroid(r.poly);
  const polys = data.outlines[String(r.floor)] || [];
  const inOuter = polys.filter((p) => !p.hole).some((p) => inside(c, p.pts));
  const inHole = polys.filter((p) => p.hole).some((p) => inside(c, p.pts));
  // 별관은 3층부터라 3·4층 외곽선 안에 있다
  // 북동쪽 계단은 2~4층 외곽선이 움푹 들어간 곳(바깥 계단실)이라 밖으로 나와도 괜찮다
  if (catOf(r.name) === 'stair' && c[0] > 40) continue;
  ok(inOuter && !inHole, `${r.floor}층 ${r.name} 의 중심 ${c.map((v) => v.toFixed(1))} 이 건물 밖`);
}

// ③ 같은 층 교실끼리 크게 겹치지 않는다 (상자 넓이의 30% 이상 겹치면 실패)
const bbox = (p) => { const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
const main = rooms.filter((r) => !['stair', 'wc'].includes(catOf(r.name)));  // 이름 없는 방도 겹침은 본다
for (let i = 0; i < main.length; i++) for (let j = i + 1; j < main.length; j++) {
  const a = main[i], b = main[j];
  if (a.floor !== b.floor) continue;
  const A = bbox(a.poly), B = bbox(b.poly);
  const w = Math.min(A[2], B[2]) - Math.max(A[0], B[0]), h = Math.min(A[3], B[3]) - Math.max(A[1], B[1]);
  if (w <= 0 || h <= 0) continue;
  const small = Math.min((A[2] - A[0]) * (A[3] - A[1]), (B[2] - B[0]) * (B[3] - B[1]));
  ok((w * h) / small < 0.3, `${a.floor}층 ${a.name} ↔ ${b.name} 겹침 ${Math.round((w * h) / small * 100)}%`);
}

// ④ 검색 — 번호·이름 일부·띄어쓰기. 이름 없는 방은 절대 걸리지 않는다
ok(search(rooms, '시험실 7')[0]?.name === '시험실 7', '「시험실 7」 → 시험실 7');
ok(search(rooms, '시험실7')[0]?.name === '시험실 7', '띄어쓰기 없이도');
ok(search(rooms, '시험실1')[0]?.name === '시험실 1', '「시험실1」 → 시험실 1 먼저(10·11 보다)');
ok(search(rooms, '예비')[0]?.name === '예비시험실 1', '「예비」 → 예비시험실 1');
ok(search(rooms, '대기실').length === 3, '「대기실」 → 수험생 1 + 감독관 2');
ok(search(rooms, '도서관')[0]?.name === '감독관 대기실 1(도서관)', '괄호 안 이름으로도');
ok(search(rooms, '교무실').length === 0 && search(rooms, '반').length === 0, '원래 교실 이름은 찾지 못한다');
ok(search(rooms, '').length === 0, '빈 검색');


// ⑥ 링크 열쇠 — 이름 있는 방은 되돌려 찾으면 같은 방
for (const r of rooms.filter((r) => r.name)) ok(findByKey(rooms, keyOf(rooms, r)) === r, `${r.name} 링크 왕복`);

// ⑦ 구역
ok(zoneOf(rooms.find((r) => r.name === '시험실 1')) === '후관', '시험실 1 은 후관');
ok(zoneOf(rooms.find((r) => r.name === '시험실 12')) === '전관', '시험실 12 는 전관');
ok(zoneOf(rooms.find((r) => r.name === '식당')) === '식당동', '식당은 식당동');
ok(zoneOf(rooms.find((r) => r.name === '감독관 대기실 2(정보융합실)')) === '서관', '감독관 대기실 2 는 서관');
for (const b of BUILDINGS) {
  const polys = (data.outlines[String(b.top)] || []).filter((p) => !p.hole);
  ok(polys.some((p) => inside(b.at, p.pts)), `${b.name} 이름표 자리 ${b.at} 가 ${b.top}층 건물 밖`);
}

// ⑧ 학교 터 — 운동장·주차장은 건물(1층) 밖, 학교 울타리 안. 주차 칸 줄은 제 주차장 안
const site = JSON.parse(readFileSync(new URL('../src/data/site.json', import.meta.url), 'utf8'));
const inBuilding = (pt) => {
  const polys = data.outlines['1'];
  return polys.filter((p) => !p.hole).some((p) => inside(pt, p.pts)) && !polys.filter((p) => p.hole).some((p) => inside(pt, p.pts));
};
const samples = (poly) => {           // 다각형 안의 점을 1mm 간격으로 고른다
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]), out = [];
  for (let x = Math.min(...xs) + 0.5; x < Math.max(...xs); x += 1)
    for (let y = Math.min(...ys) + 0.5; y < Math.max(...ys); y += 1) if (inside([x, y], poly)) out.push([x, y]);
  return out;
};
const areas = [site.field, ...site.lots].map((a) => ({ name: a.name, poly: a.poly }));
site.stands.forEach((st, i) => areas.push({ name: `스탠드 ${i + 1}`, poly: st }));
for (const r of site.roads) areas.push({ name: r.name, poly: r.poly });
// 길 가운데 점선은 길 안에 있어야 한다
for (const r of site.roads) for (const p of r.center) ok(inside(p, r.poly), `${r.name} 가운데 선 ${p} 이 길 밖`);
for (const a of areas) {
  const pts = samples(a.poly);
  ok(pts.length > 20, `${a.name} 넓이가 너무 작다`);
  const inB = pts.filter(inBuilding).length;
  ok(inB / pts.length < 0.02, `${a.name} 이 건물과 겹친다 (${inB}/${pts.length})`);
  ok(pts.every((p) => inside(p, site.boundary)), `${a.name} 이 학교 울타리 밖으로 나간다`);
}
for (const lot of site.lots) for (const r of lot.rows) {
  const [ax, ay] = r.a, [bx, by] = r.b, L = Math.hypot(bx - ax, by - ay);
  const nx = (-(by - ay) / L) * r.depth, ny = ((bx - ax) / L) * r.depth;
  const mid = [(ax + bx) / 2 + nx / 2, (ay + by) / 2 + ny / 2];
  ok(inside(mid, lot.poly), `주차 칸 줄 ${r.a}→${r.b} 이 주차장 밖`);
  ok(!inBuilding(mid), `주차 칸 줄 ${r.a}→${r.b} 이 건물 안`);
}
// 운동장은 전관 남쪽(배치도 아래쪽) — 전관 남쪽 벽 y −12 보다 아래
ok(Math.max(...site.field.poly.map((p) => p[1])) < -12, '운동장은 전관 남쪽');

console.log(`\n자료 점검: 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
