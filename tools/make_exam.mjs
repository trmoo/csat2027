/* 와우고 수능 시험장 3D 안내도 (csta2027) */
// 교실 안내도(wawoohs-3d)의 방 자료를 시험장 용도로 바꾼다.
//   node tools/make_exam.mjs   (npm run data)
// 입력: source/exam_map.json(원래 방 → 용도, 깃 제외)
//      source/school_base.json — wawoohs-3d/src/data/school.json 을 그대로 복사한 것(깃 제외, 원래 방 이름이 들어 있다)
// 출력: src/data/school.json   — 시험장 용도가 정해진 방만 이름이 있고, 나머지 방은 이름이 빈 칸이다.
//   ★ 원래 교실 이름은 출력 파일에 한 글자도 남기지 않는다(앱 안에서 검색·표시되지 않도록).
import { readFileSync, writeFileSync } from 'node:fs';

const base = JSON.parse(readFileSync(new URL('../source/school_base.json', import.meta.url), 'utf8'));

// 원래 방 이름 → 시험장 용도. 2027학년도 시험장 배치도(손으로 칠한 그림)에서 읽었다.
// ★ 원래 교실 이름이 들어 있어 source/exam_map.json(깃 제외)에 둔다 — 공개 저장소에 교실 배치가 드러나지 않게.
const MAP = JSON.parse(readFileSync(new URL('../source/exam_map.json', import.meta.url), 'utf8'));
// 길 찾기에 필요한 것은 그대로 둔다(용도가 아니라 시설이다)
// ★ 계단·화장실은 지운다(2026-11-16 사용자 지시) — 상자째 자료에서 뺀다
const KEEP = new Set(['승강기']);
const DROP = new Set(['계단', '화장실']);

const used = new Set();
const rooms = base.rooms.filter((r) => !DROP.has(r.name)).map((r, i) => {
  let name = '';
  if (MAP[r.name]) { name = MAP[r.name]; used.add(r.name); }
  else if (KEEP.has(r.name)) name = r.name;
  return { ...r, name, id: i };   // 번호를 0부터 다시 매긴다
});

const missing = Object.keys(MAP).filter((k) => !used.has(k));
if (missing.length) { console.error('✗ 원본에서 못 찾은 방:', missing.join(', ')); process.exit(1); }

const out = { ...base, source: '2026학년도 와우고등학교 배치도 · 3D 모형(STL) · 2027학년도 수능 시험장 배치', rooms };
writeFileSync(new URL('../src/data/school.json', import.meta.url), JSON.stringify(out));
const named = rooms.filter((r) => r.name && !KEEP.has(r.name)).length;
console.log(`✓ 시험장 자료 — 용도 있는 방 ${named}개 · 이름 없는 방 ${rooms.filter((r) => !r.name).length}개 · 승강기 ${rooms.filter((r) => KEEP.has(r.name)).length}개`);
