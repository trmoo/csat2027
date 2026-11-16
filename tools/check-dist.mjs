/* 와우고 수능 시험장 3D 안내도 (csta2027) */
// 빌드 결과 점검 — npm run build 끝에 저절로 돈다. 하나라도 어긋나면 실패.
//   ① dist/index.html 한 파일이 있고 크기가 그럴듯한가
//   ② 저작권 표시·화면 아래 자료 줄이 「없는가」 (2026-11-10 사용자 지시로 뺐다 — 되살아나면 실패)
//   ③ three.js(MIT) 고지가 스크립트 안에 남았는가 (라이선스 조건이라 빼면 안 된다. 화면에는 안 보인다)
//   ④ 바깥 자원(스크립트·스타일)을 부르지 않는가
import { readFileSync, statSync, existsSync } from 'node:fs';

const file = new URL('../dist/index.html', import.meta.url);
const html = readFileSync(file, 'utf8');
const size = statSync(file).size;
const errs = [];

if (size < 300_000) errs.push(`크기가 너무 작다 (${size}바이트) — 개발용 껍데기가 빌드됐나?`);
if (/티쳐무|모든 권리 보유/.test(html)) errs.push('저작권 표시가 남아 있다 — 이 앱에는 넣지 않기로 했다');
if (/<footer/i.test(html)) errs.push('화면 아래 푸터가 남아 있다 — 이 앱에는 두지 않기로 했다');
if (!html.includes('three.js authors, MIT License')) errs.push('three.js MIT 고지가 없다 (vite.config.js 의 postBanner)');
if (/<(script|link|img)[^>]+(src|href)="(?!data:)[^"#]+"/i.test(html)) errs.push('따로 떨어진 파일(그림·스크립트)을 부른다 — dist/index.html 한 파일만 나눠 주면 깨진다');
// ⑤ 시험에 쓰지 않는 방의 원래 이름(용도)이 빌드에 새어 나가지 않았는가
// 이름 목록은 source/school_base.json(깃 제외)에서 읽는다 — 없으면(깃허브 Actions) 건너뛴다. 자료 자체는 npm test 가 지킨다
const baseFile = new URL('../source/school_base.json', import.meta.url);
const keep = new Set(['식당', '교육행정실', '보건실', '승강기', '계단', '화장실', '도서관', '정보융합실', '시청각실']);   // 뒤의 셋은 감독관 방 이름의 괄호 안에 쓴다
const origNames = existsSync(baseFile) ? [...new Set(JSON.parse(readFileSync(baseFile, 'utf8')).rooms.map((r) => r.name))].filter((n) => !keep.has(n)) : [];
for (const w of origNames) {
  if (html.includes(w)) errs.push(`쓰지 않는 방의 원래 이름 「${w}」 이 빌드에 남아 있다`);
}
if (/<(script|link)[^>]+(src|href)="https?:/i.test(html)) errs.push('바깥 스크립트·스타일을 부른다 — 인터넷 없이 안 열린다');

if (errs.length) {
  console.error('✗ 빌드 점검 실패\n  - ' + errs.join('\n  - '));
  process.exit(1);
}
console.log(`✓ 빌드 점검 통과 — dist/index.html ${(size / 1024).toFixed(0)}KB · 저작권 표시·푸터 없음 · three.js 고지 있음 · 바깥 자원 0개 · 원래 교실 이름 0개`);
