// fixEssayMarkdown(AI 출력의 깨진 수식·줄바꿈 복구) 자가 점검. 실행: node scripts/check-math-repair.cjs
const ts = require("typescript");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const src = fs.readFileSync(path.join(__dirname, "../lib/ai/generateContent.ts"), "utf8");
const start = src.indexOf("const EATEN_ESCAPES");
const end = src.indexOf("function fixEscapesDeep");
assert(start > 0 && end > start, "fixEssayMarkdown 위치를 찾지 못했습니다.");
const js = ts.transpileModule(
  src.slice(start, end).replace("export function", "function") + "\nmodule.exports = fixEssayMarkdown;",
  { compilerOptions: { module: "commonjs", target: "es2020" } }
).outputText;
const mod = { exports: {} };
new Function("module", "exports", js)(mod, mod.exports);
const fix = mod.exports;

// 백슬래시·제어문자는 이스케이프 혼동을 피하려고 코드값으로 만든다.
const BS = String.fromCharCode(92);
const TAB = String.fromCharCode(9), LF = String.fromCharCode(10), CR = String.fromCharCode(13), FF = String.fromCharCode(12);
const eq = (input, expected, label) => assert.strictEqual(fix(input), expected, label);

eq(`$x$${BS}rightarrow $y$`, `$x$$${BS}rightarrow$ $y$`, "$ 밖 명령어 감싸기");
eq(`$x$${CR}ightarrow $y$`, `$x$$${BS}rightarrow$ $y$`, "CR이 먹은 rightarrow 복구 후 감싸기");
eq(`각 $${TAB}ext{∠}A=70$`, `각 $${BS}text{∠}A=70$`, "탭이 먹은 text 복구");
eq(`$${FF}rac{1}{2}$`, `$${BS}frac{1}{2}$`, "FF가 먹은 frac 복구");
eq(`$a${BS}geq0${LF}to b$`, `$a${BS}geq0 to b$`, "수식 안 줄바꿈은 공백으로");
eq(`$a ${LF}eq b$`, `$a ${BS}neq b$`, "줄바꿈이 먹은 neq 복구");
eq(`일부이다.${BS}n${BS}n학생 $x$`, `일부이다.${LF}${LF}학생 $x$`, "리터럴 백슬래시-n은 줄바꿈으로");
eq(`${BS}frac{3}{2}x^{2}`, `${BS}frac{3}{2}x^{2}`, "$ 없는 순수 수식은 그대로(ensureMath 몫)");
eq(`$a$ 이고 ${BS}neq 와 ${BS}times`, `$a$ 이고 $${BS}neq$ 와 $${BS}times$`, "$ 밖 neq/times는 줄바꿈으로 오인하지 않는다");
eq(`x-4${BS}le1인 경우`, `x-4$${BS}le$1인 경우`, "$ 없는 한글 문장 속 명령어도 감싼다");
eq(`표${TAB}값`, `표${TAB}값`, "일반 탭은 그대로");
eq(
  `$${BS}begin{cases}${LF}2x+y=7 ${BS}${BS}${LF}x-y=1${LF}${BS}end{cases}$`,
  `$${BS}begin{cases} 2x+y=7 ${BS}${BS} x-y=1 ${BS}end{cases}$`,
  "cases 여러 줄"
);

console.log("check-math-repair: OK");
