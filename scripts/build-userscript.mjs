import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'v3_optimized.js'), 'utf8').replace(/^\uFEFF/, '');
const versionMatch = /const VERSION = '([\d.]+)'/.exec(source);
if (!versionMatch) throw new Error('v3_optimized.js 中缺少 VERSION 常量');
const version = versionMatch[1];
const metadata = `// ==UserScript==
// @name         学习通自动刷课脚本 V4.1
// @namespace    local.codex.xuexitong
// @version      ${version}
// @description  自动播放、卡顿分级恢复、防暂停拉扯、运行状态浮窗、课件自动翻看、直播回放保活、自动切换下一节，并在页面结构异常时安全停止
// @author       RouteCC
// @match        *://mooc1.chaoxing.com/mycourse/studentstudy*
// @match        *://*.chaoxing.com/mycourse/studentstudy*
// @match        *://*.chaoxing.com/mooc2-ans/mycourse/studentstudy*
// @match        *://zhibo.chaoxing.com/*
// @include      /^https?:\\/\\/live[\\w-]*\\.chaoxing\\.com\\//
// @updateURL    https://github.com/1668919739/xuexitongScript/raw/master/v3_optimized.user.js
// @downloadURL  https://github.com/1668919739/xuexitongScript/raw/master/v3_optimized.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

`;

writeFileSync(resolve(root, 'v3_optimized.user.js'), `${metadata}${source}`, 'utf8');
writeFileSync(resolve(root, 'version.json'), JSON.stringify({ version }, null, 2) + '\n', 'utf8');
