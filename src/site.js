/* 와우고 3D 교실 안내도 */
// 학교 터 — 운동장·주차장·스탠드·길을 땅 위에 납작하게 그린다.
// 자리는 동관이 생기기 전 위성지도를 모형 좌표에 겹쳐 따라 그린 것(src/data/site.json, 확인 그림은 tools/check_site.py).
// 좌표 약속은 building.js 와 같다 — x 그대로, z = -y, 높이는 three 의 y.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const flat = (poly, y, color, opacity = 1) => {
  const g = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, z))));
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity }));
  m.position.y = y;
  return m;
};

/** 선분 묶음 [[x1,y1,x2,y2], …] → 땅 위의 선 */
const lines = (segs, y, color) => {
  const pts = [];
  for (const [x1, y1, x2, y2] of segs) pts.push(new THREE.Vector3(x1, y, -y1), new THREE.Vector3(x2, y, -y2));
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color }));
};
const ring = (poly) => poly.map((p, i) => [...p, ...poly[(i + 1) % poly.length]]);

/** 주차 칸 한 줄 — a→b 가 차 앞쪽 선, 그 왼쪽(depth 가 음수면 오른쪽)으로 depth 만큼 칸이 깊다 */
export function stallLines({ a, b, depth }, w = 2.6) {
  const [ax, ay] = a, [bx, by] = b;
  const L = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / L, uy = (by - ay) / L;
  const nx = -uy * depth, ny = ux * depth;
  const segs = [[ax + nx, ay + ny, bx + nx, by + ny]];          // 칸 뒤쪽 선
  const n = Math.max(1, Math.round(L / w));
  for (let i = 0; i <= n; i++) {                                  // 칸 사이 선
    const x = ax + (bx - ax) * (i / n), y = ay + (by - ay) * (i / n);
    segs.push([x, y, x + nx, y + ny]);
  }
  return segs;
}

/** 축구장 선 — 운동장 사각형 안쪽에 바깥 선·가운데 선·가운데 원·벌칙 구역 */
function fieldLines(poly) {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs) + 2, x1 = Math.max(...xs) - 2, y0 = Math.min(...ys) + 2, y1 = Math.max(...ys) - 2;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const segs = ring([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  segs.push([cx, y0, cx, y1]);
  const R = 5;
  for (let i = 0; i < 32; i++) {
    const t0 = (i / 32) * Math.PI * 2, t1 = ((i + 1) / 32) * Math.PI * 2;
    segs.push([cx + R * Math.cos(t0), cy + R * Math.sin(t0), cx + R * Math.cos(t1), cy + R * Math.sin(t1)]);
  }
  for (const [edge, dir] of [[x0, 1], [x1, -1]]) {
    for (const [d, half] of [[9, 11], [3.5, 5]]) {                 // 벌칙 구역 · 골 구역
      const e = edge + dir * d;
      segs.push([edge, cy - half, e, cy - half], [e, cy - half, e, cy + half], [e, cy + half, edge, cy + half]);
    }
  }
  return segs;
}

/** 꺾은선을 점선 토막으로 — 2mm 긋고 1.5mm 띄운다 */
export function dashes(path, on = 2, off = 1.5) {
  const segs = [];
  let carry = 0;                                 // 앞 토막에서 이어지는 자리(on+off 주기 안)
  for (let i = 0; i + 1 < path.length; i++) {
    const [x1, y1] = path[i], [x2, y2] = path[i + 1];
    const L = Math.hypot(x2 - x1, y2 - y1);
    for (let d = -carry; d < L; d += on + off) {
      const a = Math.max(0, d), b = Math.min(L, d + on);
      if (b > a) segs.push([x1 + ((x2 - x1) * a) / L, y1 + ((y2 - y1) * a) / L, x1 + ((x2 - x1) * b) / L, y1 + ((y2 - y1) * b) / L]);
    }
    carry = (carry + L) % (on + off);
  }
  return segs;
}

const tag = (text, [x, y]) => {
  const el = document.createElement('div');
  el.className = 'site-tag';
  el.textContent = text;
  const o = new CSS2DObject(el);
  o.position.set(x, 0.6, -y);
  return o;
};
const centerOf = (poly) => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];

export function buildSite(site) {
  const root = new THREE.Group();
  // 바닥판(층 바닥 -0.25~0)보다 아래에 겹겹이 — 학교 터 < 운동장·주차장 < 선
  root.add(flat(site.boundary, -0.29, 0xdde3d3));
  root.add(lines(ring(site.boundary), -0.28, 0x9aa58c));

  root.add(flat(site.field.poly, -0.27, 0xd9b98a));
  root.add(lines(fieldLines(site.field.poly), -0.26, 0xffffff));
  const labels = [tag(site.field.name, centerOf(site.field.poly))];

  const standMat = new THREE.MeshLambertMaterial({ color: 0xc9826f });
  for (const st of site.stands) {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(st.map(([x, y]) => new THREE.Vector2(x, y))), { depth: 0.9, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, standMat);
    m.position.y = -0.27;
    root.add(m);
  }

  for (const lot of site.lots) {
    root.add(flat(lot.poly, -0.27, 0x8e8f93));
    root.add(lines(lot.rows.flatMap((r) => stallLines(r)), -0.26, 0xf4f4f4));
    // 수능 당일 수험생은 학교에 주차할 수 없다(2026-11-16 사용자 지시) — 3D 위 주차장 이름표에도 적는다
    const t = tag(lot.name, lot.label || centerOf(lot.poly));
    const no = document.createElement('b');
    no.textContent = '수험생 주차 불가';
    t.element.append(no);
    t.element.classList.add('no-park');
    labels.push(t);
  }
  // 길 — 주차장보다 조금 밝은 아스팔트에 가운데 점선
  for (const road of site.roads || []) {
    root.add(flat(road.poly, -0.275, 0xa7a8ac));
    root.add(lines(dashes(road.center || []), -0.26, 0xf2e6b8));
    labels.push(tag(road.name, road.label || centerOf(road.poly)));
  }
  for (const l of labels) root.add(l);
  return { root, labels };
}
