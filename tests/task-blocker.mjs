// 平台弹窗处理：新版「去学习 / 下一节」弹窗要能识别并点掉（否则视频播完卡在那）
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
const reLine = src.match(/const TASK_BLOCKER_RE = .*?;\n/)[0];

const body = [
  'const visible = (el) => Boolean(el && el.isConnected && !(el.style && el.style.display === "none"));',
  'const courseDocuments = () => [document];',
  'let taskGuardHits = 0;',
  'const log = (m) => logs.push(m);',
  'const logs = arguments[arguments.length - 1];',
  cleanLine,
  reLine,
  extractFn('findButton'),
  extractFn('taskBlockerNodes'),
  extractFn('dismissTaskBlocker'),
  'return { taskBlockerNodes, dismissTaskBlocker };',
].join('\n');

// 新版弹窗：x-component 结构，没有 cancel/确定，只有「去学习 / 下一节」
const CASE_XCOMP = `
<div class="x-component x-dialog x-dialog-default">
  <div class="x-dialog-head"><span>提示</span><i>×</i></div>
  <div class="x-dialog-body">当前章节还有任务点未完成，是否去完成？</div>
  <div class="x-dialog-foot">
    <button type="button" id="go-learn">去学习</button>
    <button type="button" id="go-next">下一节</button>
  </div>
</div>`;

// 老版弹窗：有取消
const CASE_LAYUI = `
<div class="layui-layer layui-layer-dialog">
  <div class="layui-layer-content">当前章节还有任务点未完成</div>
  <div class="layui-layer-btn"><a class="layui-layer-btn1">取消</a><a class="layui-layer-btn0">确定</a></div>
</div>`;

// 无关弹窗：不该被误判
const CASE_OTHER = `
<div class="x-dialog"><div class="x-dialog-body">确定提交本次测验吗？</div><button>确定</button></div>`;

// 页面上有无关 dialog 占位，真正的提示弹层没有任何已知类名 —— 必须靠文案兜底找到
const CASE_OBSCURED = `
<div class="el-dialog" style="display:none">登录过期提示</div>
<div class="el-dialog">课程公告</div>
<div class="sw-mask">
  <div class="sw-box">
    <div class="sw-title">提示</div>
    <div class="sw-body">当前章节还有任务点未完成，是否去完成？</div>
    <div class="sw-foot"><button type="button">去学习</button><button type="button">下一节</button></div>
  </div>
</div>`;

function run(name, html, expect) {
  const dom = new JSDOM(`<body>${html}</body>`);
  // jsdom 不实现 innerText，补一个（否则 findButton 永远匹配不到文字）
  Object.defineProperty(dom.window.HTMLElement.prototype, 'innerText', {
    get() { return this.textContent; },
    set(v) { this.textContent = v; },
    configurable: true,
  });
  const logs = [];
  global.document = dom.window.document;
  const lib = new Function('document', body)(dom.window.document, logs);
  const doc = dom.window.document;
  let clicked = '';
  doc.querySelectorAll('button,a').forEach((b) => b.addEventListener('click', () => { clicked = b.textContent.trim(); }));

  const nodes = lib.taskBlockerNodes();
  const handled = lib.dismissTaskBlocker();

  const ok = handled === expect && (!expect || clicked === (name === '老版弹窗（有取消）' ? '取消' : '下一节'));
  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] ${name}`);
  console.log(`   找到弹层 ${nodes.length} 个 · handled=${handled} · 点击了「${clicked || '无'}」`);
  console.log(`   容器: ${nodes.map((e) => `${e.tagName.toLowerCase()}.${e.className || '-'}`).join(' | ') || '无'}`);
  if (logs.length) console.log(`   日志: ${logs[0]}`);
  if (!ok) process.exitCode = 1;
  return ok;
}

let pass = 0, fail = 0;
pass += run('新版弹窗（去学习 / 下一节）', CASE_XCOMP, true) ? 1 : 0;
pass += run('老版弹窗（有取消）', CASE_LAYUI, true) ? 1 : 0;
pass += run('无关弹窗不该处理', CASE_OTHER, false) ? 1 : 0;
pass += run('页面上有无关弹层时仍能按文案兜底', CASE_OBSCURED, true) ? 1 : 0;
fail = 4 - pass;
console.log(`\n通过 ${pass} / 4`);
if (fail) process.exitCode = 1;
