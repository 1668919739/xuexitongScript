// 浮窗状态文字测试：_blocked 残留时不应再显示“页面暂停了视频”
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'v3_optimized.js'), 'utf8').replace(/\r\n/g, '\n');

function extractMethod(name) {
  const at = src.indexOf('\n            ' + name + '(');
  if (at < 0) throw new Error('找不到方法 ' + name);
  let i = src.indexOf('{', at), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(at, j + 1); }
  }
  throw new Error('花括号不配平 ' + name);
}

const body = extractMethod('_panelStatus');
const make = new Function('document', `return function ${body.slice(body.indexOf('('))};`);
const fakeDoc = { title: 'x' };
const panelStatus = make(fakeDoc);

function makeApp(over = {}) {
  const video = Object.assign({
    paused: false, currentTime: 12, duration: 600, readyState: 4, ended: false, error: null,
  }, over.video || {});
  return Object.assign({
    _mode: 'course',
    _state: 'playing',
    _video: video,
    _title: '测试小节',
    _note: '',
    _quizNotified: false,
    _blocked: false,
    _waiting: false,
    _rateGaveUp: false,
    _userStopped: false,
    _docProgress: null,
  }, over.app || {});
}

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { console.log('  [PASS]', name); pass++; }
  else { console.log('  [FAIL]', name, extra); fail++; }
};

console.log('场景 1：视频在播，但 _blocked 残留 → 不应显示“需要处理”');
{
  const st = panelStatus.call(makeApp({ app: { _blocked: true } }));
  check('标签不是需要处理', st.label !== '需要处理', `实际 ${st.label}`);
  check('文字不含“暂停了视频”', !String(st.text).includes('暂停了视频'), `实际 ${st.text}`);
  check('显示学习中', st.label === '学习中', `实际 ${st.label}`);
}

console.log('场景 2：真的暂停 + _blocked → 显示需要处理');
{
  const st = panelStatus.call(makeApp({ app: { _blocked: true }, video: { paused: true } }));
  check('标签为需要处理', st.label === '需要处理', `实际 ${st.label}`);
  check('文字提示页面暂停', String(st.text).includes('暂停了视频'), `实际 ${st.text}`);
}

console.log('场景 3：暂停但没被标记 blocked → 显示“继续中”，不误报需要处理');
{
  const st = panelStatus.call(makeApp({ video: { paused: true } }));
  check('不是需要处理', st.label !== '需要处理', `实际 ${st.label}`);
  check('显示继续中', st.label === '继续中', `实际 ${st.label}`);
}

console.log('场景 4：弹题未关闭 → 仍显示需要处理（这条保留）');
{
  const st = panelStatus.call(makeApp({ app: { _quizNotified: true } }));
  check('标签为需要处理', st.label === '需要处理', `实际 ${st.label}`);
  check('文字提示弹题', String(st.text).includes('弹题'), `实际 ${st.text}`);
}

console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail) process.exitCode = 1;
