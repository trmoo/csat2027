/* 와우고 수능 시험장 3D 안내도 (csta2027) — wawoohs-3d 를 바탕으로 변형 */
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// ★ 이 앱에는 우리 저작권 표시를 넣지 않는다(2026-11-10 사용자 지시).
// 다만 묶어 넣은 three.js 는 MIT 라이선스라 고지를 남겨야 한다.
// ⚠ Vite 8 은 압축하며 라이브러리의 @license 주석까지 지운다 — 압축 뒤에 붙는 postBanner 로 넣는다.
const 배너 = `/*! 이 파일에는 three.js (© 2010-2026 three.js authors, MIT License) 가 들어 있습니다. */`;

export default defineConfig({
  // GitHub Pages 하위 경로나 파일 더블클릭에서도 열리도록 상대 경로를 쓴다.
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: { output: { postBanner: 배너 } },
  },
});
