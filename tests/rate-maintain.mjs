// 倍速维持逻辑的单元测试：直接抽取 _maintainRate 源码执行，用假时钟验证节流/放弃/卡顿降速
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

const body = extractMethod('_maintainRate');
const make = new Function('C', 'log', `return function ${body.slice(body.indexOf('('))};`);

let fakeNow = 1_700_000_000_000;
Date.now = () => fakeNow;

const logs = [];
const C = { playbackRate: 2, fallbackRate: 1 };
const log = (m) => logs.push(m);

function makeApp(videoRate) {
  const video = { playbackRate: videoRate, seeking: false, readyState: 4 };
  const app = {
    _video: video,
    _mode: 'course',
    _rate: C.playbackRate,
    _rateGaveUp: false,
    _rateResets: 0,
    _rateForceTs: 0,
    _rateTempUntil: 0,
    _rateWarned: false,
    _isValid: () => true,
  };
  app._maintainRate = make(C, log).bind(app);
  return app;
}

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { console.log('  [PASS]', name); pass++; }
  else { console.log('  [FAIL]', name, extra); fail++; }
};

console.log('场景 1：页面把倍速改回 1x，应纠正回 2x');
{
  const app = makeApp(1);
  app._maintainRate();
  check('纠正到 2x', app._video.playbackRate === 2, `实际 ${app._video.playbackRate}`);
  check('计数 +1', app._rateResets === 1);
}

console.log('场景 2：3 秒内重复触发不重复纠正（节流）');
{
  const app = makeApp(1);
  app._maintainRate();                    // 纠正一次
  app._video.playbackRate = 1;            // 页面又改回
  fakeNow += 500;
  app._maintainRate();                    // 应被节流挡住
  check('节流期内不纠正', app._video.playbackRate === 1, `实际 ${app._video.playbackRate}`);
  check('计数仍为 1', app._rateResets === 1, `实际 ${app._rateResets}`);
  fakeNow += 3000;
  app._maintainRate();
  check('超过 3 秒后纠正', app._video.playbackRate === 2, `实际 ${app._video.playbackRate}`);
}

console.log('场景 3：反复被改回，纠正 6 次后放弃本小节');
{
  const app = makeApp(1);
  for (let i = 0; i < 8; i++) {
    app._video.playbackRate = 1;
    fakeNow += 4000;
    app._maintainRate();
  }
  check('已放弃', app._rateGaveUp === true);
  check('放弃后不再改倍速', app._video.playbackRate === 1, `实际 ${app._video.playbackRate}`);
  check('日志说明切换到下节重试', logs.some((m) => m.includes('切换小节后会自动重试')));
}

console.log('场景 4：卡顿降速期间不干预，到点后恢复目标倍速');
{
  logs.length = 0;
  const app = makeApp(1);
  app._rateTempUntil = fakeNow + 20000;
  app._maintainRate();
  check('降速窗口内不动', app._video.playbackRate === 1, `实际 ${app._video.playbackRate}`);
  fakeNow += 21000;
  app._maintainRate();
  check('窗口结束后恢复 2x', app._video.playbackRate === 2, `实际 ${app._video.playbackRate}`);
  check('日志提示恢复', logs.some((m) => m.includes('恢复到 2x')));
}

console.log('场景 5：本来就对，不该动也不该计数');
{
  const app = makeApp(2);
  app._maintainRate();
  check('保持不变', app._video.playbackRate === 2);
  check('计数为 0', app._rateResets === 0);
}

console.log('场景 6：缓冲中（readyState<1）先不纠正');
{
  const app = makeApp(1);
  app._video.readyState = 0;
  app._maintainRate();
  check('不纠正', app._video.playbackRate === 1);
}

console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail) process.exitCode = 1;
