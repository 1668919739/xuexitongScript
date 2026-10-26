// 端到端测试：node tests/e2e/run.mjs
// 需要先安装：npm install && npx playwright install chromium
import { chromium } from 'playwright';
import {
    SRC, VERSION, withVersion, nextVersion, sleep,
    coursePage, newContext, addFakeVideo, inject, panelInfo,
} from './harness.mjs';

const cases = [];
const test = (name, fn) => cases.push({ name, fn });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// ---------- 视频播放 ----------
test('接管视频：静默音、按默认倍速播放，浮窗显示章节与进度', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    const v = await p.evaluate(() => ({ paused: __v.paused, muted: __v.muted, rate: __v.playbackRate }));
    const info = await panelInfo(p);
    assert(!v.paused && v.muted && v.rate === 1.5, `视频状态不对：${JSON.stringify(v)}`);
    assert(info.label === '播放中' && /2\.1 第一部分/.test(info.text), `浮窗不对：${JSON.stringify(info)}`);
    assert(/第 1 \/ 2 节/.test(info.chap), `章节行不对：${info.chap}`);
    assert(info.ver === `v${VERSION}`, `版本号不对：${info.ver}`);
    await ctx.close();
});

test('页面暂停后自动恢复；同一位置反复暂停时停止拉扯并提示', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    await p.evaluate(() => __v.pause()); await sleep(900);
    assert(!(await p.evaluate(() => __v.paused)), '单次暂停后没有恢复');
    for (let i = 0; i < 3; i++) { await p.evaluate(() => __v.pause()); await sleep(100); }
    await sleep(1500);
    const info = await panelInfo(p);
    assert(info.label === '需要处理', `反复暂停后应提示需要处理：${JSON.stringify(info)}`);
    await ctx.close();
});

test('倍速：点击展开选择 2x 后生效并在刷新后保持', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    await p.click('[data-k=ratebtn]'); await sleep(400);
    await p.click('[data-rate="2"]'); await sleep(800);
    assert((await p.evaluate(() => __v.playbackRate)) === 2, '选择 2x 后视频倍速没变');
    await p.reload();
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    assert((await p.evaluate(() => __v.playbackRate)) === 2, '刷新后没有记住 2x');
    await ctx.close();
});

// ---------- 课件 / 资料页 ----------
test('课件：逐步翻到底触发完成，然后进入下一小节', async (b) => {
    const body = '<div class="ans-attach-ct" id="w1"><iframe id="d1" style="width:500px;height:300px"></iframe></div>';
    const ctx = await newContext(b, { routes: { '*': coursePage({ body }) } });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await p.evaluate(() => {
        const d = document.getElementById('d1').contentDocument;
        d.body.innerHTML = '<div id="sc" style="height:250px;overflow:auto"><div style="height:3000px">PPT</div></div>';
        const sc = d.getElementById('sc');
        sc.addEventListener('scroll', () => {
            if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 40) {
                document.getElementById('w1').classList.add('ans-job-finished');
                const a = document.querySelector('.posCatalog_active');
                if (!a.querySelector('.icon_Completed')) a.insertAdjacentHTML('beforeend', '<span class="icon_Completed"></span>');
            }
        });
        document.querySelectorAll('.posCatalog_name').forEach((s) => s.addEventListener('click', () => { window.__clicked = s.title; }));
    });
    await inject(p); await sleep(5000);
    assert((await panelInfo(p)).label === '阅读中', '没有开始翻看课件');
    await sleep(12000);
    const r = await p.evaluate(() => ({ cls: document.getElementById('w1').className, clicked: window.__clicked }));
    assert(/ans-job-finished/.test(r.cls), '课件没有翻到底');
    assert(r.clicked === '2.2 第二部分', `没有进入下一小节：${r.clicked}`);
    await ctx.close();
});

test('资料页：没有视频且已完成时自动进入下一小节', async (b) => {
    const ctx = await newContext(b, { routes: { '*': coursePage({ completed: true }) } });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await p.evaluate(() => document.querySelectorAll('.posCatalog_name').forEach((s) => s.addEventListener('click', () => { window.__clicked = s.title; })));
    await inject(p); await sleep(7000);
    assert((await p.evaluate(() => window.__clicked)) === '2.2 第二部分', '没有自动进入下一小节');
    await ctx.close();
});

// ---------- 直播回放 ----------
test('回放页：读取跨域播放器的进度消息；在播放器框架内只负责保活', async (b) => {
    const player = `<html><body><video id="v"></video><script>
        var w = 56; setInterval(function(){ if(!window.__paused){ w += 0.3; }
        parent.postMessage({ event: 'playbackTimeUpdate', time: w, duration: 2591.251995 }, '*'); }, 250);
    </script></body></html>`;
    const top = '<html><body><iframe src="https://live-rk.chaoxing.com/player" style="width:320px;height:180px"></iframe></body></html>';
    const ctx = await newContext(b, { routes: { 'zhibo:/800009': top, 'live-rk': player } });
    const p = await ctx.newPage();
    await p.goto('https://zhibo.chaoxing.com/800009?rt=0.9');
    await inject(p); await sleep(3000);
    const info = await panelInfo(p);
    assert(info.label === '回放中' && /需观看满 90%/.test(info.sub), `回放页浮窗不对：${JSON.stringify(info)}`);
    const f = p.frames().find((x) => x.url().includes('live-rk'));
    await f.evaluate(() => {
        const v = document.getElementById('v'); let t = 56, paused = true;
        Object.defineProperty(v, 'paused', { get: () => paused });
        Object.defineProperty(v, 'currentTime', { get: () => t, set: (x) => { t = x; } });
        Object.defineProperty(v, 'duration', { get: () => 2591 });
        Object.defineProperty(v, 'readyState', { get: () => 4 });
        v.play = () => { paused = false; window.__paused = false; return Promise.resolve(); };
        v.pause = () => { paused = true; window.__paused = true; };
        setInterval(() => { if (!paused) t += 0.3; }, 250);
        window.__v = v; window.__paused = true;
    });
    await f.addScriptTag({ content: SRC }); await sleep(3000);
    const fr = await f.evaluate(() => ({ playerOnly: app._livePlayerOnly, paused: __v.paused, panel: !!document.getElementById('xxt-v41-panel') }));
    assert(fr.playerOnly && !fr.paused && !fr.panel, `播放器框架保活不对：${JSON.stringify(fr)}`);
    await ctx.close();
});

test('课程页：自动打开未完成的直播回放（一次一个），被拦截时可点按钮打开', async (b) => {
    const card = (n, pct) => `<html><head><meta charset="utf-8"><style>.t{cursor:pointer;width:600px;height:40px}</style></head><body>
        <div class="t" id="t">第一单元${n}</div>
        <div class="live-info2">观看时长达到总时长的90%可完成任务点。你已观看5.51分钟，当前观看进度为${pct}%</div>
        <script>document.getElementById('t').addEventListener('click',function(){ window.open('https://zhibo.chaoxing.com/80000${n}?jobId=live-${n}','_blank'); });</script></body></html>`;
    const chap = '<html><body><div class="ans-attach-ct"><iframe src="/card1" style="width:700px;height:120px"></iframe></div><div class="ans-attach-ct"><iframe src="/card2" style="width:700px;height:120px"></iframe></div></body></html>';
    const routes = { '*': coursePage({ body: '<iframe id="iframe" src="/chap" style="width:720px;height:300px"></iframe>' }), '/chap': chap, '/card1': card(1, '12.77'), '/card2': card(3, '0') };
    for (const blocked of [false, true]) {
        const ctx = await newContext(b, { routes });
        const p = await ctx.newPage();
        const opened = []; ctx.on('page', async (pg) => { await pg.waitForLoadState().catch(() => {}); opened.push(pg.url()); });
        await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
        if (blocked) await p.evaluate(() => { window.__realOpen = window.open; window.open = () => null; });
        await inject(p); await sleep(6000);
        const info = await panelInfo(p);
        assert(/2 个未完成/.test(info.live || ''), `直播提示行不对：${info.live}`);
        if (blocked) {
            assert(opened.length === 0, '被拦截时不应打开');
            await p.evaluate(() => { window.open = window.__realOpen; });
            await p.click('[data-k=livebtn]'); await sleep(800);
        }
        assert(opened.length === 1 && /800001/.test(opened[0]), `打开的回放不对：${JSON.stringify(opened)}`);
        await ctx.close();
    }
});

// ---------- 版本更新 ----------
test('静默更新：播放中不打断，视频结束后自动换成新版本，不弹任何页面', async (b) => {
    const nv = nextVersion();
    const ctx = await newContext(b, { latest: nv, versionDelay: 2500 });
    let popups = 0; ctx.on('page', () => popups++);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(5000);
    const during = await panelInfo(p);
    assert(during.ver === `v${VERSION}` && during.label === '播放中', `播放中不应更新：${JSON.stringify(during)}`);
    await p.evaluate(() => __end()); await sleep(4000);
    const after = await panelInfo(p);
    assert(after.ver === `v${nv}` && after.panels === 1, `结束后没有更新：${JSON.stringify(after)}`);
    assert(/已更新到/.test(after.notice || ''), `更新后应显示更新说明：${after.notice}`);
    assert(popups === 1, `不应弹出页面（只算测试页本身）：${popups}`);
    await ctx.close();
});

test('静默更新：下载到的代码版本不对时不执行', async (b) => {
    const nv = nextVersion();
    const ctx = await newContext(b, { latest: nv, remoteCode: SRC });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await inject(p); await sleep(5000);
    const r = await p.evaluate(() => ({ failed: app._updateFailed, ver: document.querySelector('[data-k=ver]').firstChild.nodeValue }));
    assert(r.failed && r.ver === `v${VERSION}`, `不应执行旧代码：${JSON.stringify(r)}`);
    await ctx.close();
});

test('一键停止：停止期间不自动更新，点继续后恢复', async (b) => {
    const nv = nextVersion();
    const ctx = await newContext(b, { latest: nv, versionDelay: 2500 });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(1500);
    await p.click('[data-k=power]'); await sleep(3500);
    const stopped = await panelInfo(p);
    assert(stopped.label === '已停止' && stopped.ver === `v${VERSION}`, `停止状态不对：${JSON.stringify(stopped)}`);
    await p.click('[data-k=power]'); await sleep(4000);
    const resumed = await panelInfo(p);
    assert(resumed.label === '播放中' || resumed.ver === `v${nv}`, `继续后没有恢复：${JSON.stringify(resumed)}`);
    await ctx.close();
});

// ---------- 提示 ----------
test('页面在后台被延迟后，浮窗提示保持窗口显示', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2000);
    await p.evaluate(() => { app._lastTickTs = Date.now() - 20000; app._tick(); });
    const info = await panelInfo(p);
    assert(/页面刚才在后台/.test(info.notice || ''), `没有后台提示：${info.notice}`);
    await ctx.close();
});

test('油猴更新后第一次打开：显示这一版的更新说明', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await p.evaluate(() => localStorage.setItem('xxt-v41-seen-version', '4.0.0'));
    await inject(p); await sleep(1500);
    const info = await panelInfo(p);
    assert(new RegExp(`已更新到 v${VERSION.replace(/\./g, '\\.')}`).test(info.notice || ''), `没有更新说明：${info.notice}`);
    await ctx.close();
});

// ---------- v4.3 新功能 ----------
test('计时器在后台线程（Worker）运行', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    const r = await p.evaluate(() => ({ worker: !!(app._timer && app._timer.worker), playing: !__v.paused }));
    assert(r.worker && r.playing, `计时器不对：${JSON.stringify(r)}`);
    await ctx.close();
});

test('课程总进度：统计完成/未完成小节并估算剩余时间', async (b) => {
    const page = coursePage({ nodes: ['1.1 导学', '2.1 第一部分', '2.2 第二部分', '2.3 第三部分'], active: 1, marks: ['done', 2, 3, 1] });
    const ctx = await newContext(b, { routes: { '*': page } });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=123');
    await p.evaluate(() => localStorage.setItem('xxt-v41-dur-123', JSON.stringify({ sum: 1800, count: 1 })));
    await addFakeVideo(p);
    await inject(p); await sleep(7000);
    const t = await p.evaluate(() => document.querySelector('#xxt-v41-panel [data-k=progtext]').textContent);
    // 3 节未完成 × 平均时长（1800s 与本节 1540s 的平均）÷ 1.5 倍速 ≈ 56 分钟
    assert(/课程进度 1\/4 节/.test(t) && /预计还需约 5\d 分钟/.test(t), `进度文字不对：${t}`);
    await ctx.close();
});

test('设置面板：关闭自动更新后保存，发现新版本也不自动更新', async (b) => {
    const nv = nextVersion();
    const ctx = await newContext(b, { latest: nv, versionDelay: 3000 });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await inject(p); await sleep(500);
    await p.click('[data-k=gear]'); await sleep(200);
    await p.click('.xxt-set-row:has([data-set=autoUpdate])'); await sleep(200);
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('xxt-v41-settings')).autoUpdate);
    assert(saved === false, '设置没有保存');
    await sleep(6000);
    const info = await panelInfo(p);
    assert(info.ver === `v${VERSION}`, `关闭自动更新后不应更新：${info.ver}`);
    assert(/点击立即更新/.test(info.tip2 || ''), `应提示手动更新：${info.tip2}`);
    await ctx.close();
});

test('一键复制诊断信息：包含版本、状态和最近日志', async (b) => {
    const ctx = await newContext(b);
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://mooc1.chaoxing.com' });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=1&enc=secret');
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    await p.click('[data-k=gear]'); await sleep(200);
    await p.click('[data-k=diag]'); await sleep(500);
    const text = await p.evaluate(() => navigator.clipboard.readText());
    assert(text.includes(`v${VERSION}`) && text.includes('最近日志') && text.includes('接管视频'), `诊断信息不完整：${text.slice(0, 200)}`);
    assert(!text.includes('secret'), '诊断信息不应包含网址参数');
    assert(/已复制诊断信息/.test((await panelInfo(p)).notice || ''), '没有复制成功提示');
    await ctx.close();
});

test('浮窗可拖动并记住位置，可以回到左下角', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await inject(p); await sleep(1500);
    const h = await (await p.$('#xxt-v41-panel [data-k=head]')).boundingBox();
    await p.mouse.move(h.x + 120, h.y + 20); await p.mouse.down();
    await p.mouse.move(h.x + 320, h.y - 200, { steps: 8 }); await p.mouse.up();
    const moved = await p.evaluate(() => document.getElementById('xxt-v41-panel').getBoundingClientRect().left);
    assert(moved > 150, `没有拖动：left=${moved}`);
    await p.reload(); await inject(p); await sleep(1500);
    const kept = await p.evaluate(() => document.getElementById('xxt-v41-panel').getBoundingClientRect().left);
    assert(Math.abs(kept - moved) < 2, `刷新后位置没保持：${kept} vs ${moved}`);
    await p.click('[data-k=gear]'); await p.click('[data-k=resetpos]'); await sleep(200);
    const reset = await p.evaluate(() => document.getElementById('xxt-v41-panel').getBoundingClientRect().left);
    assert(reset === 20, `没有回到左下角：${reset}`);
    await ctx.close();
});

test('需要处理时提醒一次；登录过期时提示重新登录', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    await p.evaluate(() => { window.__alerts = []; app._alert = (t, body) => window.__alerts.push(body); });
    for (let i = 0; i < 3; i++) { await p.evaluate(() => __v.pause()); await sleep(100); }
    await sleep(2500);
    const alerts = await p.evaluate(() => window.__alerts);
    assert(alerts.length === 1 && /暂停了视频/.test(alerts[0]), `提醒次数不对：${JSON.stringify(alerts)}`);
    await p.evaluate(() => { const f = document.createElement('iframe'); f.setAttribute('src', 'https://passport2.chaoxing.com/login?refer=x'); document.body.appendChild(f); });
    await sleep(6500);
    const info = await panelInfo(p);
    assert(info.label === '需要登录', `没有登录过期提示：${JSON.stringify(info)}`);
    await ctx.close();
});

// ---------- 运行 ----------
const only = process.argv[2];
const browser = await chromium.launch();
let failed = 0;
for (const c of cases) {
    if (only && !c.name.includes(only)) continue;
    const t0 = Date.now();
    try {
        await c.fn(browser);
        console.log(`✅ ${c.name}（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
    } catch (e) {
        failed++;
        console.log(`❌ ${c.name}\n   ${e.message}`);
    }
}
await browser.close();
console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
