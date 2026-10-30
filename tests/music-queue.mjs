// 唱片机播放队列：内置环境音不进顺序/随机队列，只能手动点
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

const methods = ['_queueTracks', '_musicNext'].map((n) => extractMethod(n)).join(',\n');
const build = (ctx) => new Function('ctx', `return ({${methods}});`)(ctx);

const BUILTIN = [
  { id: 'gen:piano', name: '轻钢琴', builtin: true },
  { id: 'gen:rain', name: '窗外雨声', builtin: true },
];

function makeApp({ tracks, cur, mode = 'all', audio = {} }) {
  const played = [];
  const app = {
    _tracks: tracks,
    _curTrack: cur,
    _audio: audio,
    _played: played,
    _builtinTracks: () => BUILTIN,
    _allTracks: () => BUILTIN.concat(tracks),
    _musicMode: () => mode,
    _musicPlay: (id) => played.push(id),
    _musicStop: () => played.push('__STOP__'),
  };
  Object.assign(app, build(app));
  return app;
}

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { console.log('  [PASS]', name); pass++; }
  else { console.log('  [FAIL]', name, extra); fail++; }
};

console.log('队列内容');
{
  const app = makeApp({ tracks: [{ id: 'a' }, { id: 'b' }], cur: 'a' });
  const q = app._queueTracks();
  check('只含我的音乐', q.length === 2 && q.every((t) => !String(t.id).startsWith('gen:')));
  check('不含环境音', !q.some((t) => t.id === 'gen:rain'));
}

console.log('\n顺序播放不串到环境音');
{
  const app = makeApp({ tracks: [{ id: 'a' }, { id: 'b' }], cur: 'a' });
  app._musicNext(false, 1);
  check('a → b', app._played[0] === 'b', app._played.join());
  app._played.length = 0;
  app._curTrack = 'b';
  app._musicNext(false, 1);
  check('b → a（回到队列头，不跳到 gen:）', app._played[0] === 'a', app._played.join());
}

console.log('\n上一首也不串');
{
  const app = makeApp({ tracks: [{ id: 'a' }, { id: 'b' }], cur: 'a' });
  app._musicNext(false, -1);
  check('a → b（队列尾）', app._played[0] === 'b', app._played.join());
}

console.log('\n从环境音点「下一首」');
{
  const app = makeApp({ tracks: [{ id: 'a' }, { id: 'b' }], cur: 'gen:rain' });
  app._musicNext(false, 1);
  check('切到我的音乐第一首', app._played[0] === 'a', app._played.join());
}

console.log('\n随机播放只在我的音乐里选');
{
  const app = makeApp({ tracks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], cur: 'a', mode: 'shuffle' });
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    app._played.length = 0;
    app._musicNext(false, 1);
    const id = app._played[0];
    seen.add(id);
    check(`第 ${i + 1} 次选中 ${id} 不越界`, ['a', 'b', 'c'].includes(id), id);
    app._curTrack = id;
  }
  check('覆盖到全部三首', seen.size === 3, [...seen].join());
}

console.log('\n空队列的边界');
{
  const app = makeApp({ tracks: [], cur: 'gen:piano' });
  app._musicNext(false, 1);
  check('没音乐时环境音继续，不被停掉', !app._played.includes('__STOP__'), app._played.join());

  const app2 = makeApp({ tracks: [], cur: null });
  app2._musicNext(true, 1);
  check('空且无当前曲时安静停止', app2._played[0] === '__STOP__', app2._played.join());
}

console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail) process.exitCode = 1;
