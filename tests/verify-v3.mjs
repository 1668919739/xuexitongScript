import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourcePath = resolve(root, 'v3_optimized.js');
const userScriptPath = resolve(root, 'v3_optimized.user.js');
const userScript = readFileSync(userScriptPath, 'utf8');
const marker = '// ==/UserScript==\n\n';
const markerIndex = userScript.indexOf(marker);

if (markerIndex < 0) throw new Error('油猴元数据块缺失或格式错误');
const payload = userScript.slice(markerIndex + marker.length);
const source = readFileSync(sourcePath, 'utf8');
if (payload !== source) throw new Error('油猴脚本未由 v3_optimized.js 同步生成');
const srcVersion = (/const VERSION = '([\d.]+)'/.exec(source) || [])[1];
const metaVersion = (/@version\s+([\d.]+)/.exec(userScript) || [])[1];
const jsonVersion = JSON.parse(readFileSync(resolve(root, 'version.json'), 'utf8')).version;
if (jsonVersion !== srcVersion) throw new Error(`version.json 未同步：${jsonVersion} ≠ ${srcVersion}`);
if (!srcVersion || srcVersion !== metaVersion) throw new Error(`版本号不一致：源码 VERSION=${srcVersion}，油猴 @version=${metaVersion}`);

const firstLog = (/const CHANGELOG = \[\s*\{ v: '([^']+)'/.exec(source) || [])[1];
if (firstLog !== srcVersion) throw new Error(`源码顶部 CHANGELOG 第一条应是当前版本 ${srcVersion}，现在是 ${firstLog}`);
if (!readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8').includes(`## v${srcVersion}`)) throw new Error(`CHANGELOG.md 缺少 v${srcVersion}`);

execFileSync(process.execPath, ['--check', sourcePath], { stdio: 'inherit' });
execFileSync(process.execPath, ['--check', userScriptPath], { stdio: 'inherit' });
console.log('V3 source and userscript payload are synchronized and syntactically valid.');
