// 发版核对：清 jsDelivr 缓存，然后逐个核对 raw / CDN 上的版本号是否都已更新。
//   node scripts/release.mjs          用 version.json 里的版本号核对
//   node scripts/release.mjs 4.6.10   指定期望版本
// 退出码 0 = 全部一致；1 = 有链接还是旧版本（需要再 purge 或稍等重试）
// 注意：本脚本不执行 git push。推送需用户明确许可后单独进行。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const REPO_SLUG = '1668919739/xuexitongScript';
const BRANCH = 'master';

const expect = process.argv[2] || JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).version;
if (!/^\d+(\.\d+)*$/.test(expect)) {
  console.error('版本号格式不对:', expect);
  process.exit(1);
}
console.log(`目标版本: ${expect}\n`);

const FILES = ['version.json', 'v3_optimized.user.js', 'v3_optimized.js'];
const MIRRORS = {
  raw: (f) => `https://raw.githubusercontent.com/${REPO_SLUG}/${BRANCH}/${f}`,
  cdn: (f) => `https://cdn.jsdelivr.net/gh/${REPO_SLUG}@${BRANCH}/${f}`,
};

async function fetchText(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(`${url}?cb=${Date.now()}_${i}`, {
        cache: 'no-store', signal: ctrl.signal,
        headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
      });
      clearTimeout(t);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

function versionIn(file, text) {
  if (file === 'version.json') {
    try { return JSON.parse(text).version || '(无 version 字段)'; } catch (e) { return '(JSON 解析失败)'; }
  }
  const m = /const VERSION = '([\d.]+)'/.exec(text);
  if (m) return m[1];
  const mv = /@version\s+([\d.]+)/.exec(text);
  return mv ? mv[1] : '(找不到版本号)';
}

function same(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return false;
  }
  return true;
}

// 1) 先清 CDN 缓存
console.log('— 清除 jsDelivr 缓存 —');
for (const f of FILES) {
  const purge = `https://purge.jsdelivr.net/gh/${REPO_SLUG}@${BRANCH}/${f}`;
  try {
    const res = await fetch(purge, { signal: AbortSignal.timeout(25000) });
    const body = await res.text();
    const ok = res.ok && /"status"\s*:\s*"(finished|ok)"/.test(body);
    console.log(`  ${ok ? '✓' : '×'} purge ${f.padEnd(20)} ${res.status}`);
  } catch (e) {
    console.log(`  × purge ${f.padEnd(20)} ${e.message}`);
  }
}

// 2) 逐个核对链接
console.log('\n— 核对链接 —');
const rows = [];
for (const [mirror, build] of Object.entries(MIRRORS)) {
  for (const f of FILES) {
    const url = build(f);
    let got = '', err = '';
    try {
      got = versionIn(f, await fetchText(url));
    } catch (e) {
      err = e.message;
    }
    const ok = !err && same(got, expect);
    rows.push({ mirror, file: f, got: err ? 'ERROR: ' + err : got, ok });
    const label = `${mirror.padEnd(4)} ${f.padEnd(20)}`;
    console.log(`  ${ok ? '✓' : '×'} ${label} ${err ? 'ERR ' + err : got}${ok ? '' : `   ← 期望 ${expect}`}`);
  }
}

// 3) 紫微排盘引擎：文件名带上游提交号，不需要 purge，只核对 CDN 上已经能下载到主脚本引用的那个文件
const engineFile = (/const ZIWEI_ENGINE_FILE = '([^']+)';/.exec(fs.readFileSync(path.join(ROOT, 'v3_optimized.js'), 'utf8')) || [])[1];
if (engineFile) {
  let ok = false, note = '';
  try {
    const t = await fetchText(MIRRORS.cdn(engineFile));
    ok = t.includes('XxtZiwei');
    note = ok ? `${(t.length / 1024).toFixed(0)} KB` : '内容不对';
  } catch (e) { note = 'ERR ' + e.message; }
  rows.push({ mirror: 'cdn', file: engineFile, got: note, ok });
  console.log(`  ${ok ? '✓' : '×'} cdn  ${engineFile}  ${note}`);
}

const bad = rows.filter((r) => !r.ok);
console.log(`\n${bad.length ? `❌ ${bad.length} 个链接还没拿到 ${expect}` : `✅ 全部 ${rows.length} 个链接已是 ${expect}`}`);
if (bad.length) {
  console.log('稍等几十秒再跑一次本脚本；若仍不一致，检查是否忘了 push 或 version.json 没更新。');
  process.exit(1);
}
