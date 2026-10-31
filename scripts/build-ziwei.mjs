// 把 Renhuai123/ziwei-doushu 的排盘引擎打包成浏览器可用的单文件 ziwei/ziwei-<上游提交号>-<内容哈希>.min.js。
// 浮窗里第一次打开「紫微斗数」时才从 jsDelivr 加载它，主脚本不变大。
// 文件名带上游提交号和内容哈希：内容变了文件名就变，jsDelivr @master 的缓存不会让用户拿到旧引擎，也不用 purge。
// 打包完会自动把 v3_optimized.js 里的 ZIWEI_ENGINE_FILE 改成新文件名，并删掉旧的引擎文件。
//
// 用法：
//   git clone https://github.com/Renhuai123/ziwei-doushu.git ../ziwei-doushu
//   (cd ../ziwei-doushu && npm ci --ignore-scripts)
//   ZIWEI_SRC=../ziwei-doushu node scripts/build-ziwei.mjs
//
// 只打包排盘相关的纯函数（排盘、格局识别、农历换算），不含 Next.js 页面、AI 接口、数据库。
// iztro 内部的 lunar-typescript 与项目自带的 lunar-javascript 同源（6tail），合并成一份：
// 体积从 912KB 降到约 585KB；1900–2049 年 4800 张盘与未合并版本逐字段一致（见 tests/ziwei-engine.mjs）。
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const src = resolve(root, process.env.ZIWEI_SRC || '../ziwei-doushu');
if (!existsSync(resolve(src, 'lib/ziwei/algorithm.ts'))) throw new Error(`找不到 ziwei-doushu 源码：${src}（用 ZIWEI_SRC 指定）`);
if (!existsSync(resolve(src, 'node_modules/iztro'))) throw new Error(`${src} 还没装依赖：先在里面跑 npm ci --ignore-scripts`);

let commit = 'unknown';
try { commit = execFileSync('git', ['-C', src, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch (e) { /* 不是 git 仓库也能打包 */ }
const iztroVer = JSON.parse(readFileSync(resolve(src, 'node_modules/iztro/package.json'), 'utf8')).version;
const lunarVer = JSON.parse(readFileSync(resolve(src, 'node_modules/lunar-javascript/package.json'), 'utf8')).version;

const entry = `
import { generateChart } from './lib/ziwei/algorithm';
import { detectPatterns, getMingGongSummary } from './lib/ziwei/patterns';
import { lunarToSolar, leapMonthOfLunarYear, lunarMonthDayCount } from './lib/ziwei/lunar-solar';
import { shiftGregorianDate, isValidGregorianDate, calculateTrueSolarTime, resolveZiweiDayOffset } from './lib/ziwei/true-solar-time';
import { PROVINCES } from './lib/ziwei/cities';
import { isChinaDST } from './lib/ziwei/dst-cn';
import { shiftClock } from './lib/ziwei/clock-adjust';
import { STAR_IN_FUQI_GU, SIHUA_IN_FUQI_GU, HEMING_METHODOLOGY, MARRIAGE_STARS_BRIEF } from './lib/ziwei/heming-knowledge';
import { Solar } from 'lunar-javascript';
import { STEMS, BRANCHES, STAR_DESCRIPTIONS, SI_HUA_TABLE } from './lib/ziwei/constants';
// 公历 → 农历（小六壬用）：month 为本月序数，闰月另给 leap
const solarToLunar = (y, m, d) => { const l = Solar.fromYmd(y, m, d).getLunar(); const mm = l.getMonth(); return { year: l.getYear(), month: Math.abs(mm), day: l.getDay(), leap: mm < 0 }; };
globalThis.XxtZiwei = {
  version: ${JSON.stringify(commit.slice(0, 7))},
  generateChart, detectPatterns, getMingGongSummary,
  lunarToSolar, leapMonthOfLunarYear, lunarMonthDayCount,
  shiftGregorianDate, isValidGregorianDate, calculateTrueSolarTime, resolveZiweiDayOffset,
  PROVINCES, isChinaDST, shiftClock, STEMS, BRANCHES, STAR_DESCRIPTIONS, SI_HUA_TABLE,
  STAR_IN_FUQI_GU, SIHUA_IN_FUQI_GU, HEMING_METHODOLOGY, MARRIAGE_STARS_BRIEF, solarToLunar,
};
`;

const banner = `/*! 学习通助手 · 紫微斗数引擎（构建自 ziwei-doushu@${commit.slice(0, 7)}）
 * ziwei-doushu  https://github.com/Renhuai123/ziwei-doushu  MIT License  Copyright (c) 2026 紫微研究
 * iztro ${iztroVer}  https://github.com/SylarLong/iztro  MIT License  Copyright (c) 2023 All Contributors
 * lunar-javascript ${lunarVer}  https://github.com/6tail/lunar-javascript  MIT License  Copyright (c) 2018 6tail
 * 完整许可文本见 ziwei/LICENSE-THIRD-PARTY.txt */`;

const outDir = resolve(root, 'ziwei');
mkdirSync(outDir, { recursive: true });
const empty = resolve(outDir, '.empty.js');
writeFileSync(empty, '');
const result = await build({
    stdin: { contents: entry, resolveDir: src, loader: 'ts', sourcefile: 'ziwei-entry.ts' },
    absWorkingDir: src,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2019',
    minify: true,
    legalComments: 'none',
    banner: { js: banner },
    tsconfig: resolve(src, 'tsconfig.json'),
    alias: {
        'server-only': empty,
        'lunar-typescript': resolve(src, 'node_modules/lunar-javascript'),
    },
    write: false,
    outfile: resolve(outDir, 'ziwei.min.js'),
    logLevel: 'warning',
});
const bytes = result.outputFiles[0].contents;
const fileName = `ziwei-${commit.slice(0, 7)}-${createHash('sha256').update(bytes).digest('hex').slice(0, 8)}.min.js`;
writeFileSync(resolve(outDir, fileName), bytes);
execFileSync('rm', ['-f', empty]);

const lic = (p) => { try { return readFileSync(p, 'utf8').trim(); } catch (e) { return '(未找到许可文件)'; } };
writeFileSync(resolve(outDir, 'LICENSE-THIRD-PARTY.txt'), [
    `${fileName} 由以下 MIT 开源项目打包而成（ziwei-doushu@${commit}）。`,
    '',
    '=== ziwei-doushu (https://github.com/Renhuai123/ziwei-doushu) ===', lic(resolve(src, 'LICENSE')), '',
    `=== iztro ${iztroVer} (https://github.com/SylarLong/iztro) ===`, lic(resolve(src, 'node_modules/iztro/LICENSE')), '',
    `=== lunar-javascript ${lunarVer} (https://github.com/6tail/lunar-javascript) ===`, lic(resolve(src, 'node_modules/lunar-javascript/LICENSE')), '',
].join('\n'), 'utf8');

for (const f of readdirSync(outDir)) if (/^ziwei(-[\w-]+)?\.min\.js$/.test(f) && f !== fileName) unlinkSync(resolve(outDir, f));
const mainPath = resolve(root, 'v3_optimized.js');
const main = readFileSync(mainPath, 'utf8');
const re = /const ZIWEI_ENGINE_FILE = '[^']*';/;
if (!re.test(main)) throw new Error('v3_optimized.js 中缺少 ZIWEI_ENGINE_FILE 常量');
writeFileSync(mainPath, main.replace(re, `const ZIWEI_ENGINE_FILE = 'ziwei/${fileName}';`), 'utf8');

const size = readFileSync(resolve(outDir, fileName)).length;
console.log(`ziwei/${fileName}  ${(size / 1024).toFixed(0)} KB  (ziwei-doushu@${commit.slice(0, 7)}, iztro ${iztroVer}, lunar-javascript ${lunarVer})`);
console.log('已更新 v3_optimized.js 的 ZIWEI_ENGINE_FILE；记得再跑 npm run build 生成 .user.js');
