// 视频弹题识别：按真实弹层（含原生 radio、选项各自容器、radio 直接挂在容器里）回归
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'v3_optimized.js'), 'utf8').replace(/\r\n/g, '\n');

function extractFn(name) {
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('找不到函数 ' + name);
  let i = src.indexOf('{', at), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(at, j + 1); }
  }
  throw new Error('花括号不配平 ' + name);
}

const cleanLine = src.match(/const clean = .*?;\n/)[0];
const kindLine = src.match(/const kindPattern = .*?;\n/)[0];

const body = [
  'const visible = (el) => Boolean(el && el.isConnected);',   // jsdom 不做布局
  'const courseDocuments = () => [document];',
  'const NodeFilter = document.defaultView.NodeFilter;',
  cleanLine,
  kindLine,
  extractFn('optionElements'),
  extractFn('stripPopupTitle'),
  extractFn('popupRoot'),
  extractFn('extractQuestions'),
  extractFn('letterPopupQuestions'),
  extractFn('videoPopupQuestions'),
  'return { videoPopupQuestions, letterPopupQuestions };',
].join('\n');

// 真实弹层：原生 radio + 选项各自容器 + 字母 A、B 在文本里
const CASE_RADIO_LI = `
<div class="x-component ans-videoquiz x-component-default">
  <div class="qtype">判断题</div>
  <div class="qtext">学心理学的人都能看出来别人心理有疾病。（）</div>
  <ul class="opts">
    <li class="opt"><input type="radio" name="q1"><i class="circle"></i><span>A、对</span></li>
    <li class="opt"><input type="radio" name="q1"><i class="circle"></i><span>B、错</span></li>
  </ul>
  <button type="button">提交</button>
</div>`;

// radio 直接是题目容器的子元素（没有 label/li 包裹）——这是最可能让原逻辑 return [] 的结构
const CASE_RADIO_FLAT = `
<div class="ans-videoquiz">
  <div>判断题</div>
  <div>学心理学的人都能看出来别人心理有疾病。（）</div>
  <input type="radio" name="a">
  <div>A、对</div>
  <input type="radio" name="b">
  <div>B、错</div>
  <button type="button">提交</button>
</div>`;

// radio 分属两个不同容器（groups.size = 2 且都等于 root）
const CASE_RADIO_SPLIT = `
<div class="ans-videoquiz">
  <div>判断题</div>
  <div>学心理学的人都能看出来别人心理有疾病。（）</div>
  <div><input type="radio" name="x"></div>
  <div>A、对</div>
  <div><input type="radio" name="y"></div>
  <div>B、错</div>
  <button type="button">提交</button>
</div>`;

// 没有原生控件，纯画出来的圆圈
const CASE_NO_INPUT = `
<div class="ans-videoquiz">
  <div>判断题</div>
  <div>学心理学的人都能看出来别人心理有疾病。（）</div>
  <div class="opt"><i></i><span>A、对</span></div>
  <div class="opt"><i></i><span>B、错</span></div>
  <button type="button">提交</button>
</div>`;

const CASES = {
  '原生 radio 包在 li 里': CASE_RADIO_LI,
  'radio 直接挂在容器里（无 label）': CASE_RADIO_FLAT,
  'radio 分属不同容器': CASE_RADIO_SPLIT,
  '纯画出来的圆圈（无控件）': CASE_NO_INPUT,
};

let pass = 0, fail = 0;
for (const [name, html] of Object.entries(CASES)) {
  const dom = new JSDOM(`<body>${html}</body>`);
  global.document = dom.window.document;
  const lib = new Function('document', body)(dom.window.document);
  const root = dom.window.document.querySelector('[class*="videoquiz"]');
  let out;
  try { out = lib.videoPopupQuestions(root); } catch (e) { out = 'ERR ' + e.message; }
  const ok = Array.isArray(out) && out.length === 1 && out[0].options.length === 2;
  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] ${name}`);
  if (ok) {
    const q = out[0];
    console.log(`   kind=${q.kind} 选项=${q.options.map((o) => o.letter + ':' + o.text).join(' ')}`);
    console.log(`   题干=${JSON.stringify(q.title)}`);
    pass++;
  } else {
    console.log('   结果:', typeof out === 'string' ? out : JSON.stringify(out));
    fail++;
  }
}
console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail) process.exitCode = 1;
