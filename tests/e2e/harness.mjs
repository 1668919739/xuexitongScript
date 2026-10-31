// 端到端测试的公共工具：用 Playwright 打开一个“模拟的学习通页面”，注入脚本后检查行为。
// 所有网络请求都在本地拦截，不会访问真实的学习通、GitHub 或 jsDelivr。
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
export const root = resolve(import.meta.dirname, '..', '..');
export const SRC = readFileSync(resolve(root, 'v3_optimized.js'), 'utf8');
export const VERSION = /const VERSION = '([\d.]+)'/.exec(SRC)[1];
const JQUERY = readFileSync(require.resolve('jquery/dist/jquery.min.js'), 'utf8');

/** 把版本号改成另一个值，用来模拟“新版本”的代码 */
export const withVersion = (v) => SRC.replace(`const VERSION = '${VERSION}'`, `const VERSION = '${v}'`);
/** 比当前版本高一个补丁号的版本 */
export const nextVersion = () => VERSION.replace(/(\d+)$/, (n) => String(Number(n) + 1));

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 课程目录 + 当前小节，nodes 为小节标题数组，active 为当前小节下标 */
export function coursePage({ nodes = ['2.1 第一部分', '2.2 第二部分'], active = 0, body = '', completed = false, marks = [] } = {}) {
    // marks[i]：'done' 显示已完成对勾；数字显示未完成任务点角标
    const items = nodes.map((t, i) => {
        const mark = marks[i] === 'done' || (i === active && completed) ? '<span class="icon_Completed"></span>'
            : typeof marks[i] === 'number' ? `<span class="catalog_points"><em>${marks[i]}</em></span>` : '';
        return `<li><div class="posCatalog_select${i === active ? ' posCatalog_active' : ''}"><span class="posCatalog_name" title="${t}">${t}</span>${mark}</div></li>`;
    }).join('');
    return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#EEF1F5;min-height:700px">
<div id="coursetree"><ul><li><div class="posCatalog_select firstLayer"><span class="posCatalog_name" title="2 第一单元">2 第一单元</span></div><ul>${items}</ul></li></ul></div>
<div class="prev_title" title="视频"></div>${body}</body></html>`;
}

/**
 * 新建一个浏览器上下文，并拦截常用地址。
 * routes: { [pathname]: html }，挂在 https://mooc1.chaoxing.com 下
 * latest: version.json 返回的版本号（默认等于当前版本，即“已是最新”）
 * remoteCode: 静默更新下载到的代码（默认就是 latest 版本的代码）
 */
export async function newContext(browser, { routes = {}, latest = VERSION, remoteCode, versionDelay = 0, viewport = { width: 800, height: 700 }, ziwei = 'ok' } = {}) {
    const ctx = await browser.newContext({ viewport });
    const H = { 'access-control-allow-origin': '*' };
    const code = remoteCode ?? withVersion(latest);
    await ctx.route('https://code.jquery.com/**', (r) => r.fulfill({ body: JQUERY, contentType: 'text/javascript' }));
    // 紫微斗数引擎：ziwei='ok' 返回本地打包好的引擎文件；'fail' 模拟所有 CDN 都下载失败
    const serveZiwei = (r) => {
        if (ziwei === 'fail') return r.abort();
        const u = new URL(r.request().url());
        const f = u.pathname.split('@master/')[1];
        return r.fulfill({ contentType: 'application/javascript', headers: H, body: readFileSync(resolve(root, f), 'utf8') });
    };
    for (const h of ['fastly', 'testingcf']) await ctx.route(`https://${h}.jsdelivr.net/**`, serveZiwei);
    const serveRemote = async (r) => {
        const u = r.request().url();
        if (u.includes('/ziwei/ziwei-')) return serveZiwei(r);
        if (u.includes('version.json')) {
            if (versionDelay) await sleep(versionDelay);
            return r.fulfill({ contentType: 'application/json', headers: H, body: JSON.stringify({ version: latest }) });
        }
        return r.fulfill({ contentType: 'application/javascript', headers: H, body: code });
    };
    await ctx.route('https://raw.githubusercontent.com/**', serveRemote);
    await ctx.route('https://cdn.jsdelivr.net/**', serveRemote);
    await ctx.route('https://github.com/**', (r) => r.fulfill({ contentType: 'text/html', body: 'github' }));
    await ctx.route('https://zhibo.chaoxing.com/**', (r) => {
        const html = routes['zhibo:' + new URL(r.request().url()).pathname] ?? '<html><body>replay</body></html>';
        return r.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
    });
    await ctx.route('https://mooc2-ans.chaoxing.com/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: routes['mooc2-ans'] ?? '<html><body></body></html>' }));
    await ctx.route('https://live-rk.chaoxing.com/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: routes['live-rk'] ?? '<html><body></body></html>' }));
    await ctx.route('https://mooc1.chaoxing.com/**', (r) => {
        const path = new URL(r.request().url()).pathname;
        return r.fulfill({ contentType: 'text/html; charset=utf-8', body: routes[path] ?? routes['*'] ?? coursePage() });
    });
    return ctx;
}

/** 在 frame 的文档里放一个可控的假视频（同源 iframe 内），返回后可用 window.__v 控制 */
export async function addFakeVideo(frameOrPage, { iframeId = 'f', time = 723, duration = 1540 } = {}) {
    await frameOrPage.evaluate(({ iframeId, time, duration }) => {
        let host = document.getElementById(iframeId);
        if (!host) {
            host = document.createElement('iframe');
            host.id = iframeId;
            host.style.cssText = 'width:10px;height:10px;border:0';
            document.body.appendChild(host);
        }
        const d = host.contentDocument;
        d.body.innerHTML = '<div class="video-js"><video id="video_html5_api"></video></div>';
        const v = d.querySelector('video');
        let t = time, paused = true, ended = false, rate = 1;
        Object.defineProperty(v, 'paused', { get: () => paused });
        Object.defineProperty(v, 'ended', { get: () => ended });
        Object.defineProperty(v, 'currentTime', { get: () => t, set: (x) => { t = x; } });
        Object.defineProperty(v, 'duration', { get: () => duration });
        Object.defineProperty(v, 'readyState', { get: () => 4 });
        Object.defineProperty(v, 'playbackRate', { get: () => rate, set: (x) => { rate = x; v.dispatchEvent(new Event('ratechange')); } });
        v.play = () => { paused = false; v.dispatchEvent(new Event('playing')); return Promise.resolve(); };
        v.pause = () => { paused = true; v.dispatchEvent(new Event('pause')); };
        setInterval(() => { if (!paused && !ended) t += 0.25 * rate; }, 250);
        window.__v = v;
        window.__end = () => { ended = true; paused = true; v.dispatchEvent(new Event('ended')); };
    }, { iframeId, time, duration });
}

/** 注入脚本并等浮窗出现 */
export async function inject(frameOrPage, code = SRC) {
    await frameOrPage.addScriptTag({ content: code });
    await frameOrPage.waitForSelector('#xxt-v41-panel', { state: 'attached', timeout: 8000 }).catch(() => {});
}

export const panelInfo = (page) => page.evaluate(() => {
    const q = (k) => document.querySelector(`#xxt-v41-panel [data-k="${k}"]`);
    const txt = (k) => (q(k) ? q(k).textContent : null);
    return {
        exists: !!document.getElementById('xxt-v41-panel'),
        panels: document.querySelectorAll('#xxt-v41-panel').length,
        label: txt('label'), text: txt('text'), sub: txt('sub'), chap: txt('chap'),
        ver: q('ver') ? q('ver').firstChild.nodeValue : null,
        tip1: txt('tip1'), tip2: txt('tip2'),
        notice: q('notice') && q('notice').style.display !== 'none' ? txt('noticetext') : null,
        whatsnew: q('whatsnew') && q('whatsnew').style.display !== 'none' ? txt('whatsnew') : null,
        live: q('liverow') && q('liverow').style.display !== 'none' ? txt('livetext') : null,
        state: window.app ? window.app._state : null,
    };
});
