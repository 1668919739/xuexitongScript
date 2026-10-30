// 更新记录结构测试：4.6.7（ncm 那版）带作者吐槽；无版本条目仍被正确跳过
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'v3_optimized.js'), 'utf8').replace(/\r\n/g, '\n');
const md = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8').replace(/\r\n/g, '\n');

function sliceArray(name) {
  const at = src.indexOf('const ' + name + ' = [');
  if (at < 0) throw new Error('找不到数组 ' + name);
  let i = src.indexOf('[', at), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '[') depth++;
    else if (src[j] === ']') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('方括号不配平 ' + name);
}

const CHANGELOG = new Function(`return ${sliceArray('CHANGELOG')};`)();
const NOTE_LINES = ['遇到了些有意思的事情，写在留言板里', '你可以尝试把一首网易云音乐导入到格式转换器'];
const expectVer = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).version;

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { console.log('  [PASS]', name); pass++; }
  else { console.log('  [FAIL]', name, extra); fail++; }
};

console.log('版本条目');
check(`第一条是最新版本 ${expectVer}`, CHANGELOG[0].v === expectVer, CHANGELOG[0].v);
check('没有无版本的长吐槽条目', CHANGELOG.every((e) => typeof e.v === 'string'));

console.log('\n4.6.7（ncm 那版）的作者吐槽');
const e467 = CHANGELOG.find((e) => e.v === '4.6.7');
check('条目存在', !!e467);
check('第一句在', e467 && e467.note.includes(NOTE_LINES[0]), JSON.stringify(e467 && e467.note));
check('第二句在', e467 && e467.note.includes(NOTE_LINES[1]), JSON.stringify(e467 && e467.note));
check('CHANGELOG.md 同步了两句', NOTE_LINES.every((l) => md.includes(l)));

console.log('\n渲染能力');
const renderSrc = src.slice(src.indexOf('histlist"]\')'), src.indexOf('histlist"]\')') + 1800);
check('保留无版本条目渲染分支', /xxt-hv-talk/.test(renderSrc));
check('版本条目会渲染 note', /xxt-hv-note/.test(renderSrc));
check('changelogSince 跳过无版本条目', /changelogSince = \(from\) => CHANGELOG\.filter\(\(e\) => e\.v &&/.test(src));

console.log(`\n通过 ${pass} / ${pass + fail}`);
if (fail) process.exitCode = 1;
