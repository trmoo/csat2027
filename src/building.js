/* 와우고 수능 시험장 3D 안내도 (csta2027) — wawoohs-3d 를 바탕으로 변형 */
// three.js 로 건물을 짓는다 — 층마다 ① 바닥판 ② 반투명 외벽 ③ 방 상자 ④ 이름표.
// 좌표: 자료는 모형 mm(x 오른쪽, y 배치도 위쪽). 3D 에서는 x 그대로, z = -y, 높이는 three 의 y.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CAT, catOf } from './catalog.js';

export const FLOORS = [1, 2, 3, 4];
const ROOM_H = 2.5;      // 방 상자 높이 (한 층 3.7 가운데)
const SLAB = 0.25;       // 바닥판 두께
const INSET = 0.18;      // 방 상자를 조금 안쪽으로 줄여 이웃 방과 틈을 둔다

/** 배치도 좌표 → three 의 Shape 점 (z = -y 이므로 Shape 에서는 y 를 뒤집어 넣고 눕힌다) */
const v2 = ([x, y]) => new THREE.Vector2(x, y);

function shrink(poly, d) {
  // 다각형 중심 쪽으로 d 만큼 당긴다 — 볼록한 사각형 방에는 이것으로 충분하다
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map(([x, y]) => {
    const dx = cx - x, dy = cy - y, L = Math.hypot(dx, dy) || 1;
    return [x + (dx / L) * Math.min(d, L * 0.3), y + (dy / L) * Math.min(d, L * 0.3)];
  });
}

/** 바닥(XZ 평면)에 눕힌 다각형을 위로 h 만큼 세운 도형. 밑면이 y=0 */
function prism(outer, holes, h) {
  const shape = new THREE.Shape(outer.map(v2));
  for (const hole of holes || []) shape.holes.push(new THREE.Path(hole.map(v2)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); // Shape 의 y 가 -z 로 간다 → z = -y 가 된다
  return g;
}

/** 외곽선을 따라 얇은 벽(사각형 띠)을 세운다 — 안이 보이도록 채우지 않는다 */
function wallGeometry(loops, h) {
  const pos = [];
  for (const pts of loops) {
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      const a = [x0, 0, -y0], b = [x1, 0, -y1], c = [x1, h, -y1], d = [x0, h, -y0];
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function outlineLines(loops, y) {
  const pos = [];
  for (const pts of loops) {
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      pos.push(x0, y, -y0, x1, y, -y1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** 별관 아래 필로티 기둥 자리 (STL 1층 단면에서 잰 값) */
const PILLARS = [
  [49.5, 49], [58.5, 49], [49.5, 43], [58.5, 43], [49.5, 37.5], [58.5, 37.5], [49.5, 32], [58.5, 32],
  [49.5, 26], [58.5, 26], [49.5, 17], [58.5, 17], [49.5, 3], [58.5, 3], [49.5, -6], [58.5, -6],
];

/**
 * 건물 전체를 만든다.
 * @returns {{ root, floors: Map<number,{group, slab, wall, line, rooms}>, rooms: Array }}
 */
export function buildSchool(data) {
  const H = data.floorH;
  const root = new THREE.Group();
  const floors = new Map();

  for (const f of FLOORS) {
    const group = new THREE.Group();
    group.userData.floor = f;
    group.position.y = (f - 1) * H;
    root.add(group);

    const polys = data.outlines[String(f)] || [];
    const outers = polys.filter((p) => !p.hole).map((p) => p.pts);
    const holes = polys.filter((p) => p.hole).map((p) => p.pts);
    const loops = polys.map((p) => p.pts);

    // ① 바닥판 — 구멍(가운데 마당)은 그것을 품은 바깥 고리에 붙인다
    const slabMat = new THREE.MeshLambertMaterial({ color: 0xece5e3, transparent: true });
    const slabs = [];
    for (const o of outers) {
      const inner = holes.filter((h) => pointIn(h[0], o));
      const m = new THREE.Mesh(prism(o, inner, SLAB), slabMat);
      m.position.y = -SLAB;
      group.add(m); slabs.push(m);
    }

    // ② 외벽 — 반투명, 양면
    const wallMat = new THREE.MeshLambertMaterial({
      color: 0xfbf8f7, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
    });
    const wall = new THREE.Mesh(wallGeometry(loops, H - 0.4), wallMat);
    wall.renderOrder = 2;
    group.add(wall);

    const lineMat = new THREE.LineBasicMaterial({ color: 0x5a4446, transparent: true });
    const line = new THREE.Group();
    line.add(new THREE.LineSegments(outlineLines(loops, 0.01), lineMat));
    line.add(new THREE.LineSegments(outlineLines(loops, H - 0.4), lineMat));
    group.add(line);

    floors.set(f, { group, slabs, slabMat, wall, wallMat, line, lineMat, rooms: [] });
  }

  // 별관 필로티 기둥 (1·2층 높이)
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0xcfc8bb });
  const pillarGeo = new THREE.BoxGeometry(0.8, 2 * H, 0.8);
  for (const [x, y] of PILLARS) {
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(x, H, -y);
    floors.get(1).group.add(p);
    floors.get(1).pillars = (floors.get(1).pillars || []).concat(p);
  }

  // ③ 방 상자 ④ 이름표
  const rooms = [];
  for (const r of data.rooms) {
    const cat = catOf(r.name);
    const color = new THREE.Color(CAT[cat].color);
    const tall = (r.floors || 1) > 1;
    const h = tall ? (r.floors - 1) * H + ROOM_H : ROOM_H;
    const lowKey = cat === 'stair' || cat === 'wc' || cat === 'none';
    const mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: cat === 'none' ? 0.55 : lowKey ? 0.75 : 0.92 });
    const lift = cat === 'none' ? 0.35 : lowKey ? 0.6 : 1;   // 쓰지 않는 공간은 낮게 깔아 시험장 방이 돋보이게
    const geo = prism(shrink(r.poly, INSET), null, h * lift);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.roomId = r.id;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x3c3a36, transparent: true, opacity: 0.45 }));
    mesh.add(edges);

    const el = document.createElement('div');
    el.className = 'tag tag-' + cat;
    // 「감독관 대기실 2(정보융합실)」 → 큰 글자 「감독관 대기실 2」 + 작은 글자 「정보융합실」
    // 시험실·예비시험실·수험생 방은 이웃끼리 붙어 있어 이름표가 겹친다 → 작은 윗줄 + 큰 번호로 폭을 줄인다
    //   「시험실 13」 → 시험실 / 13 · 「예비시험실 1」 → 예비시험실 / 예비 1 · 「수험생 대기실」 → 수험생 / 대기실
    const m = r.name.match(/^(.*)\((.*)\)$/);
    const two = r.name.match(/^(시험실) (\d+)$/) || r.name.match(/^(예비시험실) (\d+)$/) || r.name.match(/^(수험생) (.+)$/);
    if (two) {
      const top = document.createElement('small');
      top.className = 'kind';
      top.textContent = two[1];
      el.append(top, two[1] === '예비시험실' ? '예비 ' + two[2] : two[2]);
      el.classList.add('stack');
    } else {
      el.textContent = m ? m[1] : r.name;
      if (m) { const sm = document.createElement('small'); sm.textContent = m[2]; el.append(sm); }
    }
    el.dataset.id = r.id;
    const label = new CSS2DObject(el);
    const [cx, cy] = centerOf(r.poly);
    label.position.set(cx, h * lift + 0.4, -cy);
    mesh.add(label);

    const item = { ...r, cat, mesh, mat, base: color.clone(), label, el, lowKey, blank: cat === 'none' };
    floors.get(r.floor).group.add(mesh);
    floors.get(r.floor).rooms.push(item);
    rooms.push(item);
  }

  return { root, floors, rooms };
}

function centerOf(poly) {
  let x = 0, y = 0;
  for (const [a, b] of poly) { x += a; y += b; }
  return [x / poly.length, y / poly.length];
}

function pointIn([x, y], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[j];
    if ((y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
}
