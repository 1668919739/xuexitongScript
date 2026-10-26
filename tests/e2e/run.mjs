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
    assert(!v.paused && v.muted && v.rate === 2, `视频状态不对：${JSON.stringify(v)}`);
    assert(info.label === '学习中' && /2\.1 第一部分/.test(info.text), `浮窗不对：${JSON.stringify(info)}`);
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

test('倍速：点击展开选择 1.25x 后生效并在刷新后保持', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    await p.click('[data-k=gear]'); await sleep(200);
    await p.click('[data-k=ratebtn]'); await sleep(400);
    await p.click('[data-rate="1.25"]'); await sleep(800);
    assert((await p.evaluate(() => __v.playbackRate)) === 1.25, '选择 1.25x 后视频倍速没变');
    await p.reload();
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    assert((await p.evaluate(() => __v.playbackRate)) === 1.25, '刷新后没有记住 1.25x');
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
    assert((await panelInfo(p)).label === '阅读课件', '没有开始翻看课件');
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
    assert(during.ver === `v${VERSION}` && during.label === '学习中', `播放中不应更新：${JSON.stringify(during)}`);
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
    assert(stopped.label === '已暂停' && stopped.ver === `v${VERSION}`, `停止状态不对：${JSON.stringify(stopped)}`);
    await p.click('[data-k=power]'); await sleep(4000);
    const resumed = await panelInfo(p);
    assert(resumed.label === '学习中' || resumed.ver === `v${nv}`, `继续后没有恢复：${JSON.stringify(resumed)}`);
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
    // 3 节未完成 × 平均时长（1800s 与本节 1540s 的平均）÷ 2 倍速 ≈ 42 分钟
    assert(/课程进度 1\/4 节/.test(t) && /预计还需约 4\d 分钟/.test(t), `进度文字不对：${t}`);
    await ctx.close();
});

test('课程总进度：看完视频但还剩测验的小节，单独记为“需手动完成”', async (b) => {
    const page = coursePage({ nodes: ['1.1 导学', '2.1 第一部分', '2.2 第二部分'], active: 1, marks: ['done', 1, 2] });
    const ctx = await newContext(b, { routes: { '*': page } });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=77');
    await p.evaluate(() => document.querySelectorAll('.posCatalog_name').forEach((sp) => sp.addEventListener('click', () => {
        document.querySelectorAll('.posCatalog_select').forEach((n) => n.classList.remove('posCatalog_active'));
        sp.parentElement.classList.add('posCatalog_active');
    })));
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    await p.evaluate(() => __end()); await sleep(9000);
    const r = await p.evaluate(() => ({
        text: document.querySelector('#xxt-v41-panel [data-k=progtext]').textContent,
        title: document.querySelector('#xxt-v41-panel [data-k=prog]').title,
        saved: localStorage.getItem('xxt-v41-manual-77'),
    }));
    assert(/课程进度 1\/3 节 · 1 节需手动完成/.test(r.text), `进度文字不对：${r.text}`);
    assert(/2\.1 第一部分/.test(r.title) && /2\.1 第一部分/.test(r.saved || ''), `需手动列表不对：${JSON.stringify(r)}`);
    // 用户手动做完测验后，对勾出现，自动移出列表
    await p.evaluate(() => {
        const n = [...document.querySelectorAll('.posCatalog_select')].find((x) => x.textContent.includes('2.1'));
        n.querySelector('.catalog_points').remove();
        n.insertAdjacentHTML('beforeend', '<span class="icon_Completed"></span>');
    });
    await sleep(6000);
    const t2 = await p.evaluate(() => document.querySelector('#xxt-v41-panel [data-k=progtext]').textContent);
    assert(/课程进度 2\/3 节/.test(t2) && !/需手动/.test(t2), `补完后进度不对：${t2}`);
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

test('学习记录：播放时累计今日时长，显示连续天数和 7 天图表', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=5');
    await p.evaluate(() => {
        const k = (o) => { const d = new Date(); d.setDate(d.getDate() - o); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
        localStorage.setItem('xxt-v41-stats', JSON.stringify({ days: { [k(1)]: { sec: 3600, nodes: 3 }, [k(2)]: { sec: 1800, nodes: 2 } }, courses: {} }));
    });
    await addFakeVideo(p);
    await inject(p); await sleep(6000);
    const r = await p.evaluate(() => ({ today: app._statSummary().todaySec, text: document.querySelector('#xxt-v41-panel [data-k=statstext]').textContent }));
    assert(r.today >= 3, `今日时长没有累计：${r.today}`);
    assert(/本周 1小时30分/.test(r.text), `本周时长不对：${r.text}`);
    // 今天还不到 1 分钟，不计入连续天数：昨天、前天共 2 天
    assert(/连续 2 天/.test(r.text), `连续天数不对：${r.text}`);
    await p.click('[data-k=stats]'); await sleep(300);
    const bars = await p.evaluate(() => document.querySelectorAll('#xxt-v41-panel .xxt-bar').length);
    assert(bars === 7, `图表柱子数量不对：${bars}`);
    await ctx.close();
});

test('课程完成时显示本课程总学习时长', async (b) => {
    const ctx = await newContext(b, { routes: { '*': coursePage({ nodes: ['9.1 最后一节'], active: 0, completed: true }) } });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=8');
    await p.evaluate(() => localStorage.setItem('xxt-v41-stats', JSON.stringify({ days: {}, courses: { 8: { sec: 67200, first: '2026-10-18', last: '2026-10-26' } } })));
    await inject(p); await sleep(7000);
    const info = await panelInfo(p);
    assert(/本课程已全部学习完成 · 共学习 18 小时 40 分钟，历时 9 天/.test(info.text || ''), `完成总结不对：${info.text}`);
    await ctx.close();
});

test('控制台版：30 秒后提示安装油猴版，关闭后不再出现', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(32000);
    const info = await panelInfo(p);
    assert(/装上油猴版/.test(info.notice || ''), `没有油猴提示：${info.notice}`);
    await p.click('[data-k=noticex]');
    assert(await p.evaluate(() => localStorage.getItem('xxt-v41-tm-hint-dismissed') === '1'), '关闭后没有记住');
    await ctx.close();
});

test('课程列表页：显示课程总览，可一键继续上次的课程', async (b) => {
    const card = (id, name, done, total) => `<div class="course clearfix learnCourse" id="c_${id}"><div class="course-cover">
        <input type="hidden" class="courseId" value="${id}"><a href="https://mooc1.chaoxing.com/visit/stucoursemiddle?courseid=${id}"><img src=""></a>
        <div class="btm-cover"><div class="fl l-txt">任务点进度: ${done}/${total}</div></div></div>
        <div class="course-info"><h3><a class="color1" href="https://mooc1.chaoxing.com/visit/stucoursemiddle?courseid=${id}"><span class="course-name" title="${name}">${name}</span></a></h3></div></div>`;
    const html = `<html><head><meta charset="utf-8"></head><body style="height:800px">${card(1, '大学生创业基础', 12, 61)}${card(2, '市场营销学', 30, 30)}${card(3, '电影艺术鉴赏', 5, 44)}${card(4, '无任务点的课', 0, 0)}</body></html>`;
    const ctx = await newContext(b, { routes: { 'mooc2-ans': html }, viewport: { width: 800, height: 800 } });
    const p = await ctx.newPage();
    await p.goto('https://mooc2-ans.chaoxing.com/visit/interaction');
    await p.evaluate(() => localStorage.setItem('xxt-v41-last-course', JSON.stringify({ cid: '3', url: 'https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=3&chapterId=9', ts: Date.now() })));
    await inject(p); await sleep(2000);
    const r = await p.evaluate(() => ({
        text: document.querySelector('#xxt-v41-panel [data-k=text]').textContent,
        rows: [...document.querySelectorAll('#xxt-v41-panel .xxt-crow .xxt-cname')].map((e) => e.textContent),
        cont: (document.querySelector('#xxt-v41-panel .xxt-continue') || {}).textContent,
    }));
    assert(/共 4 门课 · 已完成 1 门 · 进行中 2 门/.test(r.text), `总览文字不对：${r.text}`);
    assert(r.rows.length === 2 && !r.rows.includes('市场营销学'), `进行中列表不对：${JSON.stringify(r.rows)}`);
    assert(/继续上次的课程/.test(r.cont || '') && /电影艺术鉴赏/.test(r.cont || ''), `继续按钮不对：${r.cont}`);
    const opened = []; ctx.on('page', async (pg) => { await pg.waitForLoadState().catch(() => {}); opened.push(pg.url()); });
    await p.click('#xxt-v41-panel .xxt-continue'); await sleep(800);
    assert(opened.length === 1 && /courseId=3/.test(opened[0]), `没有打开上次的课程：${JSON.stringify(opened)}`);
    await ctx.close();
});

test('播放页记录“上次学习的课程”', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=42&chapterId=7');
    await inject(p); await sleep(1500);
    const last = await p.evaluate(() => JSON.parse(localStorage.getItem('xxt-v41-last-course')));
    assert(last && last.cid === '42' && /chapterId=7/.test(last.url), `没有记录上次课程：${JSON.stringify(last)}`);
    await ctx.close();
});

test('学习助手：三个标签页、本节笔记自动保存并可复制、每日目标、学习日历', async (b) => {
    const ctx = await newContext(b, { routes: { '*': coursePage({ nodes: ['2.1 第一部分', '2.2 第二部分'], active: 0, marks: [2, 3] }) } });
    const p = await ctx.newPage();
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://mooc1.chaoxing.com' });
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=77');
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    const vis = (k) => p.evaluate((k) => { const e = document.querySelector(`#xxt-v41-panel [data-k="${k}"]`); return !!e && e.offsetParent !== null; }, k);
    assert(await vis('pane-today') && await vis('note') && await vis('goal'), '默认应显示“今天”页和笔记框');
    const goal = await p.evaluate(() => document.querySelector('#xxt-v41-panel [data-k=goal]').textContent);
    assert(/今日目标 60 分钟/.test(goal), `今日目标不对：${goal}`);
    // 按键不应传给页面
    await p.evaluate(() => { window.__keys = 0; document.addEventListener('keydown', () => window.__keys++); });
    await p.click('#xxt-v41-panel [data-k=note]');
    await p.keyboard.type('需求曲线向右下倾斜');
    await sleep(1000);
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('xxt-v41-notes-77') || '{}'));
    assert(saved['2.1 第一部分'] && saved['2.1 第一部分'].t === '需求曲线向右下倾斜' && saved['2.1 第一部分'].chap === '2 第一单元', `笔记没有保存：${JSON.stringify(saved)}`);
    assert(await p.evaluate(() => window.__keys) === 0, '笔记里的按键传到了页面');
    // 课程页：显示进度和笔记，复制全部笔记
    await p.click('#xxt-v41-panel [data-tab=course]'); await sleep(300);
    const cd = await p.evaluate(() => document.querySelector('#xxt-v41-panel [data-k=cdetail]').textContent);
    assert(/已完成 0 \/ 2 节/.test(cd) && /本课程笔记1 条/.test(cd) && /需求曲线/.test(cd), `课程页内容不对：${cd}`);
    await p.click('#xxt-v41-panel [data-act=copynotes]'); await sleep(400);
    const clip = await p.evaluate(() => navigator.clipboard.readText());
    assert(/## 2 第一单元/.test(clip) && /### 2\.1 第一部分\n需求曲线向右下倾斜/.test(clip), `复制的笔记不对：${clip}`);
    // 记录页：4 个数字、7 天柱状图、12 周日历
    await p.click('#xxt-v41-panel [data-tab=record]'); await sleep(300);
    const rec = await p.evaluate(() => ({
        tiles: document.querySelectorAll('#xxt-v41-panel .xxt-recsum > div').length,
        bars: document.querySelectorAll('#xxt-v41-panel .xxt-bar').length,
        cells: document.querySelectorAll('#xxt-v41-panel .xxt-hgrid i:not(.lx)').length,
    }));
    const dow = new Date().getDay();
    assert(rec.tiles === 4 && rec.bars === 7 && rec.cells === 78 + dow, `记录页不对：${JSON.stringify(rec)}`);
    // 设置：每日目标改为 30 分钟并保存；倍速在设置里
    await p.click('[data-k=gear]'); await sleep(200);
    assert(await vis('ratebtn'), '倍速应该在设置里');
    await p.click('#xxt-v41-panel [data-goal="30"]'); await sleep(200);
    assert(await p.evaluate(() => JSON.parse(localStorage.getItem('xxt-v41-settings')).dailyGoal) === 30, '每日目标没有保存');
    // 收起：只剩标题栏，状态带上课程进度
    await p.click('[data-k=gear]'); await p.click('[data-k=toggle]'); await sleep(200);
    const col = await panelInfo(p);
    assert(/学习中 · 0%/.test(col.label) && !(await vis('tabs')), `收起状态不对：${JSON.stringify(col)}`);
    // 切到下一节后，笔记框换成新小节，刷新后旧笔记还在
    await p.click('[data-k=toggle]'); await p.click('#xxt-v41-panel [data-tab=today]');
    await p.reload(); await addFakeVideo(p); await inject(p); await sleep(2000);
    assert(await p.evaluate(() => document.querySelector('#xxt-v41-panel [data-k=note]').value) === '需求曲线向右下倾斜', '刷新后笔记没有恢复');
    await ctx.close();
});

test('学习助手：连续学习 45 分钟提醒休息，完成今日目标提醒一次', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=78');
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    // 休息提醒默认关闭
    await p.evaluate(() => { app._restSec = 45 * 60 - 1; });
    await sleep(2500);
    assert(!/连续学习/.test((await panelInfo(p)).notice || ''), '休息提醒应默认关闭');
    await p.click('[data-k=gear]'); await p.click('[data-set=breakRemind]'); await p.click('[data-k=gear]'); await sleep(200);
    await p.evaluate(() => { app._restSec = 45 * 60 - 1; });
    await sleep(2500);
    let info = await panelInfo(p);
    assert(/连续学习 45 分钟/.test(info.notice || ''), `没有休息提醒：${info.notice}`);
    await p.click('[data-k=noticex]');
    await p.evaluate(() => { const st = app._loadStats(); const d = st.days[Object.keys(st.days).pop()]; d.sec = 3600; });
    await sleep(2000);
    info = await panelInfo(p);
    assert(/今日目标 60 分钟已完成/.test(info.notice || ''), `没有目标完成提醒：${info.notice}`);
    await ctx.close();
});

test('学习助手总开关：关闭后只保留一行学习时长，不再提醒休息，设置会被记住', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=79');
    await p.evaluate(() => localStorage.setItem('xxt-v41-settings', JSON.stringify({ breakRemind: true })));
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    const vis = (k) => p.evaluate((k) => { const e = document.querySelector(`#xxt-v41-panel [data-k="${k}"]`); return !!e && e.offsetParent !== null; }, k);
    assert(await vis('assist') && await vis('tabs'), '默认应开启学习助手');
    await p.click('#xxt-v41-panel [data-k=assist]'); await sleep(300);
    const st = await p.evaluate(() => ({ text: document.querySelector('#xxt-v41-panel [data-k=statsplain]').textContent, checked: document.querySelector('#xxt-v41-panel [data-k=assist]').getAttribute('aria-checked') }));
    assert(!(await vis('tabs')) && !(await vis('goal')) && await vis('statsplain') && /^今日 /.test(st.text) && st.checked === 'false', `关闭后显示不对：${JSON.stringify(st)}`);
    await p.evaluate(() => { app._restSec = 45 * 60 - 1; });
    await sleep(2500);
    assert(!/连续学习/.test((await panelInfo(p)).notice || ''), '关闭后仍然提醒休息');
    await p.reload(); await addFakeVideo(p); await inject(p); await sleep(2000);
    assert(!(await vis('tabs')) && await vis('assist'), '刷新后没有记住关闭状态');
    await p.click('#xxt-v41-panel [data-k=assist]'); await sleep(300);
    assert(await vis('tabs'), '重新打开后没有显示标签页');
    await ctx.close();
});

test('延时任务交给后台线程计时（页面在后台也能按时恢复播放、进入下一节）', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2000);
    const r = await p.evaluate(() => new Promise((res) => {
        const t0 = Date.now();
        const id = app._later(() => res({ id: typeof id, ms: Date.now() - t0 }), 300);
    }));
    assert(r.id === 'string' && r.ms >= 250 && r.ms < 1500, `延时任务没有走后台线程：${JSON.stringify(r)}`);
    // 页面暂停视频后，靠后台线程的延时任务恢复
    await p.evaluate(() => __v.pause()); await sleep(900);
    assert(!(await p.evaluate(() => __v.paused)), '暂停后没有恢复');
    await ctx.close();
});

test('浮窗收起 / 展开 / 切换标签页带过渡动画，系统要求减少动态效果时不播放', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2000);
    const anims = () => p.evaluate(() => document.getElementById('xxt-v41-panel').getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length);
    const h0 = await p.evaluate(() => document.getElementById('xxt-v41-panel').offsetHeight);
    await p.click('[data-k=toggle]');
    assert(await anims() > 0, '收起时没有动画');
    await sleep(800);
    const h1 = await p.evaluate(() => ({ h: document.getElementById('xxt-v41-panel').offsetHeight, ov: document.getElementById('xxt-v41-panel').style.overflow }));
    assert(h1.h < h0 - 100 && h1.ov === '', `收起后尺寸不对：${h0} -> ${JSON.stringify(h1)}`);
    await p.click('[data-k=toggle]');
    assert(await anims() > 0, '展开时没有动画');
    await sleep(800);
    assert(Math.abs((await p.evaluate(() => document.getElementById('xxt-v41-panel').offsetHeight)) - h0) < 4, '展开后没有恢复原来的高度');
    const hs = [];
    for (const tb of ['record', 'course', 'today']) {
        await p.click(`#xxt-v41-panel [data-tab=${tb}]`);
        if (tb === 'record') assert(await anims() > 0, '切换标签页时没有动画');
        await sleep(700);
        hs.push(await p.evaluate(() => document.getElementById('xxt-v41-panel').getBoundingClientRect().top));
    }
    assert(Math.max(...hs) - Math.min(...hs) < 1, `切换标签页时浮窗上下跳动：${JSON.stringify(hs)}`);
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.click('#xxt-v41-panel [data-tab=today]');
    assert(await anims() === 0, '减少动态效果时仍有动画');
    await ctx.close();
});

test('弹题等需要处理时，提示音每隔一会儿重复，处理完就停', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2000);
    await p.evaluate(() => {
        window.__beeps = 0; app._beep = () => window.__beeps++;
        const d = document.getElementById('f').contentDocument;
        const q = d.createElement('div'); q.className = 'ans-videoquiz'; q.id = 'quiz'; q.style.cssText = 'width:5px;height:5px'; q.textContent = 'Q';
        d.body.appendChild(q);
    });
    await sleep(3200);
    const first = await p.evaluate(() => window.__beeps);
    assert(first === 1, `第一次提醒次数不对：${first}`);
    await p.evaluate(() => { app._lastBeepTs = Date.now() - 15000; });
    await sleep(1500);
    assert(await p.evaluate(() => window.__beeps) === 2, '没有重复提醒');
    await p.evaluate(() => { document.getElementById('f').contentDocument.getElementById('quiz').remove(); app._lastBeepTs = Date.now() - 15000; });
    await sleep(2500);
    assert(await p.evaluate(() => window.__beeps) === 2, '处理完后还在响');
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
