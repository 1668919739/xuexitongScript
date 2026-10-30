// 用 jsdom 构造超星弹题的几种可能结构，验证 letterPopupQuestions 能否识别
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

// 抽取依赖：clean / kindPattern / stripPopupTitle / letterPopupQuestions
const cleanLine = src.match(/const clean = .*?;\n/)[0];
const kindLine = src.match(/const kindPattern = .*?;\n/)[0];
const body = [
  'const visible = (el) => Boolean(el && el.isConnected);',   // jsdom 不做布局，替掉真实可见性判断
  cleanLine,
  kindLine,
  extractFn('stripPopupTitle'),
  extractFn('letterPopupQuestions'),
  'return { letterPopupQuestions, stripPopupTitle };',
].join('\n');

const CASES = {
  '选项各自容器（span 里含 A、对）': `
    <div class="ans-videoquiz">
      <div class="ans-videoquiz-title">判断题</div>
      <div class="ans-videoquiz-question">学心理学的人都能看出来别人心理有疾病。</div>
      <div class="ans-videoquiz-opts">
        <div class="ans-videoquiz-opt"><i class="icon"></i><span>A、对</span></div>
        <div class="ans-videoquiz-opt"><i class="icon"></i><span>B、错</span></div>
      </div>
      <button type="button">提交</button>
    </div>`,
  'li 列表 + 字母和文字拆成两个 span': `
    <div class="ans-videoquiz">
      <span>判断题</span>
      <p>学心理学的人都能看出来别人心理有疾病。</p>
      <ul class="ans-videoquiz-opt">
        <li><i></i><span>A、</span><span>对</span></li>
        <li><i></i><span>B、</span><span>错</span></li>
      </ul>
      <button type="button">提交</button>
    </div>`,
  '带题量与编号的完整弹层': `
    <div id="videoquiz" class="videoquiz-wrap">
      <div class="videoquiz-head"><span>判断题</span><span>共 1 题，已答对 0 题</span></div>
      <div class="videoquiz-body">
        <p>1. 学心理学的人都能看出来别人心理有疾病。</p>
        <div class="opt-list">
          <label class="opt"><i class="circle"></i><em>A、</em>对</label>
          <label class="opt"><i class="circle"></i><em>B、</em>错</label>
        </div>
      </div>
      <div class="videoquiz-foot"><button>提交</button></div>
    </div>`,
  '多选四选项 + 中文顿号变体': `
    <div class="ans-videoquiz">
      <span>多选题</span>
      <p>下列哪些说法正确？</p>
      <div class="opts">
        <div class="opt"><span>A．甲</span></div>
        <div class="opt"><span>B．乙</span></div>
        <div class="opt"><span>C．丙</span></div>
        <div class="opt"><span>D．丁</span></div>
      </div>
      <button>提交</button>
    </div>`,
};

let pass = 0, fail = 0;
for (const [name, html] of Object.entries(CASES)) {
  const dom = new JSDOM(`<body>${html}</body>`);
  const { document } = dom.window;
  global.document = document;
  const fn = new Function('document', body);
  const lib = fn(document);
  const root = document.querySelector('[class*="videoquiz"]');
  let out;
  try { out = lib.letterPopupQuestions(root); }
  catch (e) { out = 'ERR ' + e.message; }
  const ok = Array.isArray(out) && out.length === 1 && out[0].options.length >= 2;
  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] ${name}`);
  if (ok) {
    const q = out[0];
    console.log(`   kind=${q.kind} options=${q.options.map((o) => o.letter + ':' + o.text).join(' ')}`);
    console.log(`   title=${JSON.stringify(q.title)}`);
    pass++;
  } else {
    console.log('   结果:', typeof out === 'string' ? out : JSON.stringify(out));
    fail++;
  }
}
console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail) process.exitCode = 1;
