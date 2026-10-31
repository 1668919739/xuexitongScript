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
    assert(/已更新到/.test(after.whatsnew || ''), `更新后应显示更新说明：${after.whatsnew}`);
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

test('更新后浮窗显示新增内容（关掉前一直显示），可查看全部更新记录', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await p.evaluate(() => localStorage.setItem('xxt-v41-seen-version', '4.0.0'));
    await inject(p); await sleep(1500);
    const info = await panelInfo(p);
    assert(new RegExp(`已更新到 v${VERSION.replace(/\./g, '\\.')}`).test(info.whatsnew || ''), `没有更新说明：${info.whatsnew}`);
    // 从 4.0.0 更新来：列出期间各版本的新内容
    assert(/格式转换/.test(info.whatsnew) && /还有 \d+ 项改进/.test(info.whatsnew), `更新内容不对：${info.whatsnew}`);
    assert(/💬 作者RouteCC：/.test(info.whatsnew) && /\d+月\d+日更新/.test(info.whatsnew), `更新通知里缺少作者吐槽或日期：${info.whatsnew}`);
    // 没关掉之前，刷新页面仍然显示
    await p.reload(); await inject(p); await sleep(1500);
    assert((await panelInfo(p)).whatsnew, '刷新后更新说明不见了');
    // 查看全部更新记录：列出所有版本
    await p.click('#xxt-v41-panel [data-k=wnall]'); await sleep(700);
    const hist = await p.evaluate(() => ({
        n: document.querySelectorAll('#xxt-v41-panel .xxt-hv').length,
        first: document.querySelector('#xxt-v41-panel .xxt-hv b').textContent,
        tabs: document.querySelector('#xxt-v41-panel [data-k=tabs]').offsetParent !== null,
    }));
    assert(hist.n >= 10 && hist.first === `v${VERSION}` && !hist.tabs, `更新记录不对：${JSON.stringify(hist)}`);
    const meta = await p.evaluate(() => ({
        dates: [...document.querySelectorAll('#xxt-v41-panel .xxt-hv time')].map((e) => e.textContent),
        notes: [...document.querySelectorAll('#xxt-v41-panel .xxt-hv-note')].map((e) => e.textContent),
    }));
    assert(meta.dates.length === hist.n && meta.dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)), `更新记录缺少日期：${JSON.stringify(meta.dates)}`);
    assert(meta.notes.length >= 1 && meta.notes.every((n) => n.startsWith('💬 作者RouteCC：')), `作者吐槽不对：${JSON.stringify(meta.notes)}`);
    await p.click('#xxt-v41-panel [data-k=histback]'); await sleep(700);
    const back = await panelInfo(p);
    assert(!back.whatsnew && await p.evaluate(() => document.querySelector('#xxt-v41-panel [data-k=tabs]').offsetParent !== null), '返回后应回到主界面，且更新说明已关闭');
    await p.reload(); await inject(p); await sleep(1500);
    assert(!(await panelInfo(p)).whatsnew, '关闭后刷新又出现了更新说明');
    // 设置里也能打开更新记录
    await p.click('[data-k=gear]'); await sleep(300); await p.click('[data-k=histopen]'); await sleep(700);
    assert(await p.evaluate(() => document.querySelector('#xxt-v41-panel [data-k=history]').offsetParent !== null), '设置里打不开更新记录');
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
    assert(/今日已学/.test(goal) && !/目标/.test(goal), `今日学习概况不对：${goal}`);
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
    // 设置：倍速在设置里；已经去掉每日目标和休息提醒
    await p.click('[data-k=gear]'); await sleep(200);
    assert(await vis('ratebtn'), '倍速应该在设置里');
    assert(await p.evaluate(() => !document.querySelector('#xxt-v41-panel [data-goal], #xxt-v41-panel [data-set=breakRemind]')), '每日目标或休息提醒还在设置里');
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

test('学习助手总开关：关闭后只保留一行学习时长，设置会被记住', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=79');
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    const vis = (k) => p.evaluate((k) => { const e = document.querySelector(`#xxt-v41-panel [data-k="${k}"]`); return !!e && e.offsetParent !== null; }, k);
    assert(await vis('assist') && await vis('tabs'), '默认应开启学习助手');
    await p.click('#xxt-v41-panel [data-k=assist]'); await sleep(300);
    const st = await p.evaluate(() => ({ text: document.querySelector('#xxt-v41-panel [data-k=statsplain]').textContent, checked: document.querySelector('#xxt-v41-panel [data-k=assist]').getAttribute('aria-checked') }));
    assert(!(await vis('tabs')) && !(await vis('goal')) && await vis('statsplain') && /^今日 /.test(st.text) && st.checked === 'false', `关闭后显示不对：${JSON.stringify(st)}`);
    assert(!(await vis('progtext')), '没有课程进度时不应显示进度行');
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
        window.__beeps = 0; window.__kinds = []; app._beep = (k) => { window.__beeps++; window.__kinds.push(k || 'chime'); };
        const d = document.getElementById('f').contentDocument;
        const q = d.createElement('div'); q.className = 'ans-videoquiz'; q.id = 'quiz'; q.style.cssText = 'width:5px;height:5px'; q.textContent = 'Q';
        d.body.appendChild(q);
    });
    await sleep(3200);
    const first = await p.evaluate(() => window.__beeps);
    assert(first === 1, `第一次提醒次数不对：${first}`);
    assert(await p.evaluate(() => window.__kinds[0]) === 'attn', '需要处理时应使用警示音');
    await p.evaluate(() => { app._lastBeepTs = Date.now() - 15000; });
    await sleep(1500);
    assert(await p.evaluate(() => window.__beeps) === 2 && await p.evaluate(() => window.__kinds[1]) === 'attn', '没有用警示音重复提醒');
    await p.evaluate(() => { document.getElementById('f').contentDocument.getElementById('quiz').remove(); app._lastBeepTs = Date.now() - 15000; });
    await sleep(2500);
    assert(await p.evaluate(() => window.__beeps) === 2, '处理完后还在响');
    await ctx.close();
});

test('剩余时间：关闭学习助手时显示在状态框，打开时移到「课程」页', async (b) => {
    const page = coursePage({ nodes: ['1.1 a', '1.2 b', '1.3 c'], active: 1, marks: ['done', 2, 2] });
    const ctx = await newContext(b, { routes: { '*': page } });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=124');
    await p.evaluate(() => localStorage.setItem('xxt-v41-dur-124', JSON.stringify({ sum: 1800, count: 1 })));
    await addFakeVideo(p);
    await inject(p); await sleep(6500);
    const st = () => p.evaluate(() => {
        const e = document.querySelector('#xxt-v41-panel [data-k=progtext]');
        return { box: e.offsetParent !== null, text: e.textContent, course: document.querySelector('#xxt-v41-panel [data-k=cdetail]').textContent };
    });
    let r = await st();
    assert(!r.box && /预计还需约/.test(r.course), `打开学习助手时应显示在课程页：${JSON.stringify(r)}`);
    await p.click('#xxt-v41-panel [data-k=assist]'); await sleep(600);
    r = await st();
    assert(r.box && /课程进度 1\/3 节.*预计还需约/.test(r.text), `关闭学习助手时状态框里没有剩余时间：${JSON.stringify(r)}`);
    await ctx.close();
});

test('反馈：在浮窗里写问题或建议，可复制内容或在 GitHub 打开填好的 Issue', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://mooc1.chaoxing.com' });
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=5&enc=secret');
    await addFakeVideo(p);
    await inject(p); await sleep(2000);
    await p.click('[data-k=gear]'); await sleep(300);
    await p.click('[data-k=fbopen]'); await sleep(600);
    // 没写内容时不提交
    await p.click('[data-k=fbsend]'); await sleep(200);
    assert(/先写一下/.test((await panelInfo(p)).notice || ''), '空内容没有提示');
    assert(await p.evaluate(() => document.querySelector('#xxt-v41-panel [data-k=fbdiag]').checked), '问题反馈默认应附带诊断信息');
    await p.fill('#xxt-v41-panel [data-k=fbtext]', '弹题后没有继续播放');
    await p.click('[data-k=fbcopy]'); await sleep(400);
    const clip = await p.evaluate(() => navigator.clipboard.readText());
    assert(/^\[问题\] 弹题后没有继续播放/.test(clip) && /学习通助手 诊断信息/.test(clip) && !/secret/.test(clip), `复制内容不对：${clip.slice(0, 200)}`);
    const pages = [];
    ctx.on('page', (pg) => pages.push(pg));
    await p.click('[data-fbtype=idea]'); await sleep(200);
    assert(!(await p.evaluate(() => document.querySelector('#xxt-v41-panel [data-k=fbdiag]').checked)), '建议默认不附带诊断信息');
    await p.click('[data-k=fbsend]'); await sleep(800);
    const u = pages.length ? decodeURIComponent(pages[0].url()) : '';
    assert(/github\.com\/1668919739\/xuexitongScript\/issues\/new\?title=\[建议\] 弹题后没有继续播放/.test(u) && !/secret/.test(u), `GitHub 地址不对：${u.slice(0, 200)}`);
    await p.click('[data-k=fbback]'); await sleep(600);
    assert(await p.evaluate(() => document.querySelector('#xxt-v41-panel [data-k=settings]').offsetParent !== null), '返回后应回到设置');
    await ctx.close();
});

test('后台防卡顿：转到后台时以极小音量播放、持有保活锁，回到前台恢复静音', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    // 模拟浏览器真实的“页面隐藏”状态
    await p.evaluate(() => { window.__hid = false; Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get() { return window.__hid; } }); });
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    const locks = await p.evaluate(async () => (await navigator.locks.query()).held.map((l) => l.name));
    assert(locks.some((n) => n.startsWith('xxt-v41-keepalive')), `没有持有保活锁：${JSON.stringify(locks)}`);
    const st = () => p.evaluate(() => ({ muted: __v.muted, volume: __v.volume, paused: __v.paused }));
    assert((await st()).muted, '前台应静音');
    await p.evaluate(() => { window.__hid = true; document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(1500);
    let r = await st();
    assert(!r.muted && Math.abs(r.volume - 0.03) < 0.001 && !r.paused, `后台没有切到极小音量：${JSON.stringify(r)}`);
    await p.evaluate(() => { window.__hid = false; document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(300);
    r = await st();
    assert(r.muted && r.volume > 0.5, `回到前台没有恢复静音：${JSON.stringify(r)}`);
    assert(/后台：防卡顿/.test(await p.evaluate(() => app._diagnostics())), '诊断信息里没有后台状态');
    await ctx.close();
});

test('后台防卡顿：浏览器不允许取消静音时，恢复静音继续播放', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await p.evaluate(() => { window.__hid = false; Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get() { return window.__hid; } }); });
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    // 模拟浏览器：取消静音就暂停视频
    await p.evaluate(() => {
        const v = __v; let m = true;
        Object.defineProperty(v, 'muted', { configurable: true, get: () => m, set: (x) => { m = x; if (!x) v.pause(); } });
        window.__hid = true; document.dispatchEvent(new Event('visibilitychange'));
    });
    await sleep(2500);
    const r = await p.evaluate(() => ({ muted: __v.muted, paused: __v.paused, blocked: app._bgAudioBlocked }));
    assert(r.muted && !r.paused && r.blocked, `没有回退到静音播放：${JSON.stringify(r)}`);
    await ctx.close();
});

test('版本号气泡不被浮窗裁剪；浮窗比屏幕高时才内部滚动', async (b) => {
    const ctx = await newContext(b, { viewport: { width: 800, height: 900 } });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2000);
    await p.hover('#xxt-v41-panel [data-k=ver]'); await sleep(400);
    const r = await p.evaluate(() => {
        const el = document.getElementById('xxt-v41-panel'), tip = el.querySelector('.xxt-tip');
        const t = tip.getBoundingClientRect();
        const p = el.getBoundingClientRect();
        return { scroll: el.classList.contains('xxt-scroll'), overflow: getComputedStyle(el).overflowY, visible: getComputedStyle(tip).opacity === '1' && t.top >= 0 && t.bottom <= p.top + 40, title: el.querySelector('[data-k=head]').title };
    });
    assert(!r.scroll && r.overflow === 'visible' && r.visible && !r.title, `版本号气泡显示不对：${JSON.stringify(r)}`);
    await p.setViewportSize({ width: 800, height: 420 }); await sleep(600);
    assert(await p.evaluate(() => document.getElementById('xxt-v41-panel').classList.contains('xxt-scroll')), '屏幕变矮后应允许内部滚动');
    await ctx.close();
});

test('浮窗可拖动边缘放大缩小，大小会被记住；收起时恢复成一条；双击右下角恢复默认', async (b) => {
    const ctx = await newContext(b, { viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=5');
    await addFakeVideo(p);
    await inject(p); await sleep(2000);
    const rect = () => p.evaluate(() => { const r = document.getElementById('xxt-v41-panel').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const r0 = await rect();
    // 拖右下角：变宽变高
    const se = await (await p.$('#xxt-v41-panel [data-rz=se]')).boundingBox();
    await p.mouse.move(se.x + se.width / 2, se.y + se.height / 2); await p.mouse.down();
    await p.mouse.move(se.x + 300, se.y + 40, { steps: 8 }); await p.mouse.up(); await sleep(300);
    // 拖上边：再拉高
    const n = await (await p.$('#xxt-v41-panel [data-rz=n]')).boundingBox();
    await p.mouse.move(n.x + n.width / 2, n.y + n.height / 2); await p.mouse.down();
    await p.mouse.move(n.x + n.width / 2, n.y - 200, { steps: 8 }); await p.mouse.up(); await sleep(300);
    const r1 = await rect();
    assert(r1.w > r0.w + 250 && r1.h > r0.h + 150, `没有放大：${JSON.stringify([r0, r1])}`);
    const note = await p.evaluate(() => document.querySelector('#xxt-v41-panel [data-k=note]').offsetHeight);
    assert(note > 150, `放大后笔记框没有跟着变大：${note}`);
    // 刷新后保持
    await p.reload(); await addFakeVideo(p); await inject(p); await sleep(2000);
    const r2 = await rect();
    assert(Math.abs(r2.w - r1.w) < 2 && Math.abs(r2.h - r1.h) < 2, `刷新后大小没有保持：${JSON.stringify([r1, r2])}`);
    // 收起：恢复成一条
    await p.click('[data-k=toggle]'); await sleep(800);
    assert((await rect()).h < 100, '收起后应恢复成一条');
    await p.click('[data-k=toggle]'); await sleep(800);
    assert(Math.abs((await rect()).h - r1.h) < 2, '展开后应回到自定义大小');
    // 双击右下角恢复默认
    await p.dblclick('#xxt-v41-panel [data-rz=se]'); await sleep(800);
    const r3 = await rect();
    assert(Math.abs(r3.w - 324) < 2 && !(await p.evaluate(() => localStorage.getItem('xxt-v41-panel-size'))), `双击没有恢复默认：${JSON.stringify(r3)}`);
    await ctx.close();
});

test('一键还原：调过大小后标题栏出现还原按钮；快捷键 Alt+Shift+R 恢复默认位置和大小', async (b) => {
    const ctx = await newContext(b, { viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2000);
    const vis = () => p.evaluate(() => document.querySelector('#xxt-v41-panel [data-k=restore]').offsetParent !== null);
    const rect = () => p.evaluate(() => { const r = document.getElementById('xxt-v41-panel').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    assert(!(await vis()), '默认大小时不应显示还原按钮');
    // 拉到最大
    const se = await (await p.$('#xxt-v41-panel [data-rz=se]')).boundingBox();
    await p.mouse.move(se.x + 8, se.y + 8); await p.mouse.down(); await p.mouse.move(1199, 899, { steps: 6 }); await p.mouse.up();
    const nw = await (await p.$('#xxt-v41-panel [data-rz=nw]')).boundingBox();
    await p.mouse.move(nw.x + 8, nw.y + 8); await p.mouse.down(); await p.mouse.move(0, 0, { steps: 6 }); await p.mouse.up(); await sleep(400);
    const big = await rect();
    assert(big.w > 1150 && big.h > 850 && await vis(), `没有拉到最大或没有还原按钮：${JSON.stringify(big)}`);
    await p.click('#xxt-v41-panel [data-k=restore]'); await sleep(900);
    const r1 = await rect();
    assert(Math.abs(r1.w - 324) < 2 && r1.h < 800 && !(await vis()), `还原按钮没生效：${JSON.stringify(r1)}`);
    // 拉到最小，再用快捷键恢复默认位置和大小
    const se2 = await (await p.$('#xxt-v41-panel [data-rz=se]')).boundingBox();
    await p.mouse.move(se2.x + 8, se2.y + 8); await p.mouse.down(); await p.mouse.move(se2.x - 400, se2.y - 800, { steps: 6 }); await p.mouse.up(); await sleep(300);
    const small = await rect();
    assert(small.w <= 302 && small.h <= 142, `没有拉到最小：${JSON.stringify(small)}`);
    await p.keyboard.press('Alt+Shift+KeyR'); await sleep(900);
    const r2 = await rect();
    assert(Math.abs(r2.w - 324) < 2 && Math.abs(r2.x - 20) < 2 && Math.abs(r2.y + r2.h - 880) < 2, `快捷键没有恢复默认：${JSON.stringify(r2)}`);
    await ctx.close();
});

test('浮窗拉窄时标题栏按钮不和版本号重叠', async (b) => {
    const ctx = await newContext(b, { viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await p.evaluate(() => localStorage.setItem('xxt-v41-panel-size', JSON.stringify({ w: 300, h: 400 })));
    await addFakeVideo(p);
    await inject(p); await sleep(2000);
    const r = await p.evaluate(() => {
        const q = (k) => document.querySelector(`#xxt-v41-panel [data-k=${k}]`).getBoundingClientRect();
        const v = q('ver'), act = document.querySelector('#xxt-v41-panel .xxt-actions').getBoundingClientRect(), rs = q('restore');
        return { overlap: v.right > act.left + 1 && v.bottom > act.top && v.top < act.bottom, restore: rs.width > 0, v: [v.left, v.right], a: [act.left, act.right] };
    });
    assert(r.restore && !r.overlap, `版本号和按钮重叠：${JSON.stringify(r)}`);
    await ctx.close();
});

test('浮窗主题：可切换多种配色并记住，跟随系统时随系统深浅色变化', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2000);
    const cur = () => p.evaluate(() => { const el = document.getElementById('xxt-v41-panel'); const cs = getComputedStyle(el); return { theme: el.getAttribute('data-theme'), bg: cs.backgroundColor, accent: cs.getPropertyValue('--x-accent').trim() }; });
    assert((await cur()).theme === 'light', '默认应是清爽蓝');
    await p.click('[data-k=gear]'); await sleep(300);
    assert(await p.evaluate(() => document.querySelectorAll('#xxt-v41-panel [data-theme-opt]').length) === 8, '主题数量不对');
    await p.click('#xxt-v41-panel [data-theme-opt=sakura]'); await sleep(300);
    let c = await cur();
    assert(c.theme === 'sakura' && c.accent === '#EC4899', `切换樱花粉失败：${JSON.stringify(c)}`);
    await p.click('#xxt-v41-panel [data-theme-opt=dark]'); await sleep(600);
    c = await cur();
    assert(c.theme === 'dark' && c.bg === 'rgb(30, 35, 43)', `夜间主题不对：${JSON.stringify(c)}`);
    assert(await p.evaluate(() => JSON.parse(localStorage.getItem('xxt-v41-settings')).theme) === 'dark', '主题没有保存');
    await p.click('#xxt-v41-panel [data-theme-opt=auto]'); await sleep(300);
    await p.emulateMedia({ colorScheme: 'dark' }); await sleep(300);
    assert((await cur()).theme === 'dark', '跟随系统：系统深色时应为夜间');
    await p.emulateMedia({ colorScheme: 'light' }); await sleep(300);
    assert((await cur()).theme === 'light', '跟随系统：系统浅色时应为清爽蓝');
    await p.reload(); await addFakeVideo(p); await inject(p); await sleep(1500);
    assert(await p.evaluate(() => JSON.parse(localStorage.getItem('xxt-v41-settings')).theme) === 'auto', '刷新后主题设置丢失');
    await ctx.close();
});

test('自定义主题：调色盘自由选主色、可选浅色或深色底，按钮文字颜色自动保证看得清', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2000);
    await p.click('[data-k=gear]'); await sleep(300);
    const vis = (sel) => p.evaluate((sel) => { const e = document.querySelector(sel); return !!e && e.offsetParent !== null; }, sel);
    assert(!(await vis('#xxt-v41-panel [data-k=cpick]')), '没选自定义时不应显示调色盘');
    await p.click('#xxt-v41-panel [data-theme-opt=custom]'); await sleep(300);
    assert(await vis('#xxt-v41-panel [data-k=cpick]'), '选自定义后应显示调色盘');
    const cur = () => p.evaluate(() => {
        const el = document.getElementById('xxt-v41-panel');
        const probe = document.createElement('i'); probe.style.color = 'var(--x-accent)'; el.appendChild(probe);
        const accent = getComputedStyle(probe).color; probe.style.color = 'var(--x-on-accent)'; const on = getComputedStyle(probe).color; probe.remove();
        return { theme: el.getAttribute('data-theme'), custom: el.classList.contains('xxt-custom'), accent, on, hex: el.querySelector('[data-k=chex]').textContent };
    });
    // 拖动调色盘（input 事件）实时生效
    await p.evaluate(() => { const c = document.querySelector('#xxt-v41-panel [data-k=cpick]'); c.value = '#e11d48'; c.dispatchEvent(new Event('input', { bubbles: true })); });
    let c = await cur();
    assert(c.custom && c.theme === 'light' && c.accent === 'rgb(225, 29, 72)' && c.on === 'rgb(255, 255, 255)' && c.hex === '#E11D48', `取色没有生效：${JSON.stringify(c)}`);
    // 浅色主色：按钮文字自动换成深色
    await p.click('#xxt-v41-panel [data-cpreset="#EAB308"]'); await sleep(300);
    c = await cur();
    assert(c.accent === 'rgb(234, 179, 8)' && c.on === 'rgb(17, 24, 39)', `浅色主色的文字颜色不对：${JSON.stringify(c)}`);
    // 深色底
    await p.click('#xxt-v41-panel [data-cbase=dark]'); await sleep(400);
    c = await cur();
    assert(c.theme === 'dark' && c.custom, `深色底没有生效：${JSON.stringify(c)}`);
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('xxt-v41-settings')));
    assert(saved.theme === 'custom' && saved.customColor === '#eab308' && saved.customBase === 'dark', `自定义主题没有保存：${JSON.stringify(saved)}`);
    await p.reload(); await addFakeVideo(p); await inject(p); await sleep(1500);
    c = await cur();
    assert(c.custom && c.theme === 'dark' && c.accent === 'rgb(234, 179, 8)', `刷新后自定义主题丢失：${JSON.stringify(c)}`);
    await ctx.close();
});

test('自定义主色接近橙色时，“需手动完成”进度段换成紫色并带斜纹，和已完成分得清', async (b) => {
    const page = coursePage({ nodes: ['1.1 a', '1.2 b', '1.3 c', '1.4 d'], active: 2, marks: ['done', 1, 2, 2] });
    const ctx = await newContext(b, { routes: { '*': page } });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy?courseId=321');
    await p.evaluate(() => {
        localStorage.setItem('xxt-v41-manual-321', JSON.stringify(['1.2 b']));
        localStorage.setItem('xxt-v41-settings', JSON.stringify({ theme: 'custom', customColor: '#f97316', customBase: 'light' }));
    });
    await addFakeVideo(p);
    await inject(p); await sleep(6500);
    const r = await p.evaluate(() => {
        const m = document.querySelector('#xxt-v41-panel [data-k=progman]'), bar = document.querySelector('#xxt-v41-panel [data-k=progbar]');
        const el = document.getElementById('xxt-v41-panel');
        return { manual: el.style.getPropertyValue('--x-manual'), gap: m.style.marginLeft, w: m.offsetWidth, bw: bar.offsetWidth, bg: getComputedStyle(m).backgroundImage };
    });
    assert(r.manual === '#8B5CF6' && r.gap === '2px' && r.w > 0 && r.bw > 0 && /repeating-linear-gradient/.test(r.bg), `进度条分不清：${JSON.stringify(r)}`);
    await p.evaluate(() => app._setCustom('#3b82f6', null, true)); await sleep(300);
    assert(await p.evaluate(() => document.getElementById('xxt-v41-panel').style.getPropertyValue('--x-manual')) === '#F5A524', '蓝色主色时应保持橙色');
    await ctx.close();
});

test('唱片机：从浮窗右侧功能栏打开，添加本地音乐，点列表即播放，刷新后列表还在', async (b) => {
    // 生成两段 3 秒的无声 WAV 当作“本地音乐”
    const wav = (sec) => {
        const rate = 8000, n = rate * sec, buf = Buffer.alloc(44 + n);
        buf.write('RIFF', 0); buf.writeUInt32LE(36 + n, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
        buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34); buf.write('data', 36); buf.writeUInt32LE(n, 40); buf.fill(128, 44);
        return buf;
    };
    const ctx = await newContext(b, { viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2000);
    const st = () => p.evaluate(() => {
        const d = document.getElementById('xxt-v41-music'), panel = document.getElementById('xxt-v41-panel');
        if (!d) return null;
        const r = d.getBoundingClientRect(), pr = panel.getBoundingClientRect();
        const sr = document.querySelector('#xxt-v41-side .xs-tray').getBoundingClientRect();
        return { open: d.classList.contains('open'), playing: d.classList.contains('playing'), items: [...d.querySelectorAll('.xm-item:not(.builtin) .xm-name')].map((e) => e.textContent),
            cur: (d.querySelector('.xm-item.cur .xm-name') || {}).textContent || '', title: d.querySelector('[data-m=title]').textContent,
            rightOfPanel: r.left >= pr.right && r.left >= sr.right, paused: app._audio ? app._audio.paused : true };
    });
    await p.click('#xxt-v41-side [data-s=handle]'); await sleep(500);
    await p.click('#xxt-v41-side [data-s=music]'); await sleep(600);
    let s = await st();
    assert(s && s.open && s.items.length === 0 && s.rightOfPanel, `唱片机没有在浮窗旁打开：${JSON.stringify(s)}`);
    // 紧挨着侧边功能栏，顶部对齐
    const near = await p.evaluate(() => { const a = document.getElementById('xxt-v41-music').getBoundingClientRect(), b = document.querySelector('#xxt-v41-side .xs-tray').getBoundingClientRect(); return { dx: a.left - b.right, dy: Math.abs(a.top - Math.max(8, Math.min(b.top - 12, innerHeight - a.height - 8))) }; });
    assert(near.dx >= 0 && near.dx <= 12 && near.dy <= 2, `唱片机离侧边栏太远：${JSON.stringify(near)}`);
    await p.setInputFiles('#xxt-v41-music [data-m=file]', [
        { name: '晨读.wav', mimeType: 'audio/wav', buffer: wav(3) },
        { name: '午后钢琴.wav', mimeType: 'audio/wav', buffer: wav(3) },
    ]);
    await sleep(1200);
    s = await st();
    assert(s.items.join('|') === '晨读|午后钢琴' && s.playing && !s.paused && s.cur === '晨读', `添加后没有开始播放：${JSON.stringify(s)}`);
    // 点列表里的第二首即播放
    await p.click('#xxt-v41-music .xm-item:not(.builtin) >> nth=1'); await sleep(800);
    s = await st();
    assert(s.cur === '午后钢琴' && s.title === '午后钢琴' && !s.paused, `点击列表没有切歌：${JSON.stringify(s)}`);
    // 暂停
    await p.click('#xxt-v41-music [data-m=play]'); await sleep(300);
    s = await st();
    assert(s.paused && !s.playing, `暂停没生效：${JSON.stringify(s)}`);
    // 关闭侧边栏后刷新：列表还在
    await p.click('#xxt-v41-music [data-m=close]'); await sleep(500);
    assert(!(await st()).open, '关闭没生效');
    await p.reload(); await addFakeVideo(p); await inject(p); await sleep(1500);
    await p.click('#xxt-v41-side [data-s=handle]'); await sleep(500);
    await p.click('#xxt-v41-side [data-s=music]'); await sleep(1000);
    s = await st();
    assert(s.items.join('|') === '晨读|午后钢琴', `刷新后列表丢失：${JSON.stringify(s)}`);
    // 移除一首
    await p.hover('#xxt-v41-music .xm-item:not(.builtin) >> nth=0');
    await p.click('#xxt-v41-music .xm-item:not(.builtin) .xm-del >> nth=0'); await sleep(600);
    assert((await st()).items.join('|') === '午后钢琴', '移除没生效');
    await ctx.close();
});

test('侧边功能栏：浮窗右侧边缘的小把手点击拉出，含唱片机 / 紫微排盘 / 更新记录 / 反馈；浮窗靠右时改到左侧', async (b) => {
    const ctx = await newContext(b, { viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2000);
    const st = () => p.evaluate(() => {
        const d = document.getElementById('xxt-v41-side'), pr = document.getElementById('xxt-v41-panel').getBoundingClientRect();
        const h = d.querySelector('.xs-handle').getBoundingClientRect(), tray = d.querySelector('.xs-tray');
        return { show: d.classList.contains('show'), open: d.classList.contains('open'), left: d.classList.contains('left'),
            handleAtRight: Math.abs(h.left - pr.right) < 2, handleAtLeft: Math.abs(h.right - pr.left) < 2, trayOpacity: getComputedStyle(tray).opacity,
            items: [...d.querySelectorAll('.xs-item')].map((e) => e.getAttribute('data-label')), headerMusic: !!document.querySelector('#xxt-v41-panel [data-k=musicbtn]') };
    });
    let s = await st();
    assert(s.show && !s.open && s.handleAtRight && s.trayOpacity === '0' && !s.headerMusic, `把手位置或默认状态不对：${JSON.stringify(s)}`);
    await p.click('#xxt-v41-side [data-s=handle]'); await sleep(500);
    s = await st();
    assert(s.open && s.trayOpacity === '1' && s.items.join('|') === '唱片机|音频转换|紫微排盘|更新记录|留言板|反馈问题', `拉出后不对：${JSON.stringify(s)}`);
    await p.click('#xxt-v41-side [data-s=history]'); await sleep(700);
    assert(await p.evaluate(() => document.querySelector('#xxt-v41-panel [data-k=history]').offsetParent !== null), '更新记录没打开');
    await p.click('#xxt-v41-side [data-s=feedback]'); await sleep(700);
    assert(await p.evaluate(() => document.querySelector('#xxt-v41-panel [data-k=feedback]').offsetParent !== null), '反馈没打开');
    // 收起浮窗时把手隐藏
    await p.click('[data-k=toggle]'); await sleep(700);
    assert(!(await st()).show, '收起后应隐藏侧边栏');
    await p.click('[data-k=toggle]'); await sleep(700);
    // 浮窗拖到屏幕最右边：侧边栏改到左侧
    const head = await (await p.$('#xxt-v41-panel [data-k=head]')).boundingBox();
    await p.mouse.move(head.x + 60, head.y + 10); await p.mouse.down(); await p.mouse.move(1190, head.y + 10, { steps: 8 }); await p.mouse.up(); await sleep(400);
    s = await st();
    assert(s.left && s.handleAtLeft, `靠右时没有改到左侧：${JSON.stringify(s)}`);
    await ctx.close();
});

test('唱片机内置环境音：轻钢琴、雨声等实时合成，点击即播放，可暂停，不能删除', async (b) => {
    const ctx = await newContext(b, { viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2000);
    await p.click('#xxt-v41-side [data-s=handle]'); await sleep(400);
    await p.click('#xxt-v41-side [data-s=music]'); await sleep(600);
    const names = await p.evaluate(() => [...document.querySelectorAll('#xxt-v41-music .xm-item.builtin .xm-name')].map((e) => e.textContent));
    assert(names.length === 5 && names[0].startsWith('轻钢琴'), `内置环境音不对：${JSON.stringify(names)}`);
    assert(await p.evaluate(() => document.querySelectorAll('#xxt-v41-music .xm-item.builtin .xm-del').length) === 0, '内置环境音不应能删除');
    const st = () => p.evaluate(() => ({ playing: document.getElementById('xxt-v41-music').classList.contains('playing'), kind: app._gen && app._gen.kind, state: app._genCtx && app._genCtx.state,
        title: document.querySelector('#xxt-v41-music [data-m=title]').textContent, time: document.querySelector('#xxt-v41-music [data-m=time]').textContent, seek: document.querySelector('#xxt-v41-music [data-m=seek]').disabled }));
    for (const [i, kind] of [[0, 'piano'], [1, 'rain'], [2, 'waves'], [3, 'fire'], [4, 'noise']]) {
        await p.click(`#xxt-v41-music .xm-item.builtin >> nth=${i}`); await sleep(700);
        const s = await st();
        assert(s.playing && s.kind === kind && s.state === 'running' && s.title === names[i] && /环境音/.test(s.time) && s.seek, `${kind} 播放不对：${JSON.stringify(s)}`);
    }
    await p.click('#xxt-v41-music [data-m=play]'); await sleep(500);
    let s = await st();
    assert(!s.playing && s.state === 'suspended', `暂停不对：${JSON.stringify(s)}`);
    await p.click('#xxt-v41-music [data-m=play]'); await sleep(500);
    s = await st();
    assert(s.playing && s.state === 'running', `继续播放不对：${JSON.stringify(s)}`);
    await p.click('#xxt-v41-music [data-m=next]'); await sleep(600);
    assert((await st()).kind === 'piano', '下一首应循环回第一首');
    await ctx.close();
});

test('唱片机格式转换：把音频/视频转成 MP3 或 WAV 加入唱片机，加密格式和坏文件给出原因', async (b) => {
    const tone = (sec, rate = 44100) => {   // 立体声 440Hz 正弦波 WAV
        const n = rate * sec, buf = Buffer.alloc(44 + n * 4);
        buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
        buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
        for (let i = 0; i < n; i++) { const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000); buf.writeInt16LE(v, 44 + i * 4); buf.writeInt16LE(v, 46 + i * 4); }
        return buf;
    };
    const ctx = await newContext(b, { viewport: { width: 1200, height: 900 } });
    const lame = (await import('node:fs')).readFileSync(new URL('../../node_modules/lamejs/lame.min.js', import.meta.url), 'utf8');
    let lameHits = 0;
    await ctx.route('**/lamejs@1.2.1/lame.min.js', (r) => { lameHits++; return r.fulfill({ contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: lame }); });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2000);
    await p.click('#xxt-v41-side [data-s=handle]'); await sleep(400);
    await p.click('#xxt-v41-side [data-s=music]'); await sleep(600);
    await p.click('#xxt-v41-music [data-m=convopen]'); await sleep(400);
    assert(await p.evaluate(() => document.getElementById('xxt-v41-music').classList.contains('conv')), '没有打开格式转换');
    await p.setInputFiles('#xxt-v41-music [data-m=convfile]', [
        { name: '讲座录音.wav', mimeType: 'audio/wav', buffer: tone(2) },
        { name: '会员歌曲.ncm', mimeType: 'application/octet-stream', buffer: Buffer.from('CTENFDAM....') },
        { name: '坏文件.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('not audio at all') },
    ]);
    await sleep(300);
    await p.click('#xxt-v41-music [data-m=cstart]');
    await p.waitForFunction(() => !app._convRunning, null, { timeout: 30000 }); await sleep(800);
    const r = await p.evaluate(async () => {
        const q = app._convQ.map((x) => ({ name: x.name, status: x.status, msg: x.msg }));
        const t = (app._tracks || []).find((x) => x.name === '讲座录音');
        let dur = 0, type = '';
        if (t) { type = t.blob.type; const buf = await t.blob.arrayBuffer(); dur = (await new OfflineAudioContext(2, 1, 44100).decodeAudioData(buf)).duration; }
        return { q, type, dur, names: [...document.querySelectorAll('#xxt-v41-music .xm-cq-st')].map((e) => e.textContent) };
    });
    assert(lameHits === 1, `MP3 编码组件加载次数不对：${lameHits}`);
    assert(r.q[0].status === 'done' && /MP3/.test(r.q[0].msg) && r.type === 'audio/mpeg' && r.dur > 1.8 && r.dur < 2.3, `MP3 转换不对：${JSON.stringify(r)}`);
    assert(r.q[1].status === 'drm' && /加密格式/.test(r.q[1].msg), `加密格式提示不对：${JSON.stringify(r.q[1])}`);
    assert(r.q[2].status === 'fail' && /无法解码/.test(r.q[2].msg), `坏文件提示不对：${JSON.stringify(r.q[2])}`);
    // WAV + 单声道 + 下载到电脑
    await p.selectOption('#xxt-v41-music [data-m=cfmt]', 'wav');
    await p.selectOption('#xxt-v41-music [data-m=cch]', '1');
    await p.check('#xxt-v41-music [data-m=cdl]');
    await p.click('#xxt-v41-music [data-m=cclear]');
    await p.setInputFiles('#xxt-v41-music [data-m=convfile]', [{ name: 'clip.wav', mimeType: 'audio/wav', buffer: tone(1, 48000) }]);
    const dl = p.waitForEvent('download');
    await p.click('#xxt-v41-music [data-m=cstart]');
    const file = await dl;
    assert(file.suggestedFilename() === 'clip.wav', `下载文件名不对：${file.suggestedFilename()}`);
    await p.waitForFunction(() => !app._convRunning, null, { timeout: 20000 }); await sleep(500);
    const w = await p.evaluate(async () => { const t = app._tracks.find((x) => x.name === 'clip'); const a = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(await t.blob.arrayBuffer()); return { ch: a.numberOfChannels, type: t.blob.type }; });
    assert(w.type === 'audio/wav' && w.ch === 1, `WAV 单声道不对：${JSON.stringify(w)}`);
    // 直接“添加本地音乐”时，视频文件自动放进转换列表
    await p.click('#xxt-v41-music [data-m=convback]'); await sleep(300);
    await p.setInputFiles('#xxt-v41-music [data-m=file]', [{ name: '课堂视频.mp4', mimeType: 'video/mp4', buffer: Buffer.from('fake') }]);
    await sleep(500);
    const v = await p.evaluate(() => ({ conv: document.getElementById('xxt-v41-music').classList.contains('conv'), hint: document.querySelector('#xxt-v41-music [data-m=convhint]').textContent, q: app._convQ.map((x) => x.name) }));
    assert(v.conv && /不能直接播放/.test(v.hint) && v.q.includes('课堂视频.mp4'), `视频文件没有转到格式转换：${JSON.stringify(v)}`);
    await ctx.close();
});

// ---------- 答题辅助（DeepSeek 接口在本地拦截，不会真的调用） ----------
const QUIZ_BODY = '<div id="work">' +
    '<div class="TiMu"><div>1 【单选题】 1+1 等于几？</div><ul><li><label><input type="radio" name="q1"><span>A</span> 2</label></li><li><label><input type="radio" name="q1"><span>B</span> 3</label></li></ul></div>' +
    '<div class="TiMu"><div>2 【多选题】 下面哪些是偶数？</div><ul><li><label><input type="checkbox" name="q2"><span>A</span> 2</label></li><li><label><input type="checkbox" name="q2"><span>B</span> 4</label></li><li><label><input type="checkbox" name="q2"><span>C</span> 5</label></li></ul></div>' +
    '<button type="button" id="sub">提交</button><div id="score"></div></div>' +
    '<div id="prevNextFocusNext" style="display:inline-block;padding:4px">下一节</div>';
const quizPage = () => coursePage({ body: QUIZ_BODY }).replace('<div class="prev_title" title="视频"></div>', '<div class="prev_title" title="章节测验"></div>');
const wireQuiz = (p) => p.evaluate(() => {
    document.getElementById('sub').addEventListener('click', () => {
        window.__submitted = [...document.querySelectorAll('#work input')].map((i) => i.checked);
        document.getElementById('score').innerHTML = '<div>本次成绩：100分</div><div>章节测验 已完成</div>';
    });
    document.getElementById('prevNextFocusNext').addEventListener('click', () => { window.__next = (window.__next || 0) + 1; });
});
const mockDeepseek = async (ctx, reply) => {
    const calls = [];
    await ctx.route('https://api.deepseek.com/**', (r) => {
        const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'POST' };
        if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: H });
        calls.push({ auth: r.request().headers().authorization, body: JSON.parse(r.request().postData() || '{}') });
        if (reply.status) return r.fulfill({ status: reply.status, headers: H, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Authentication Fails' } }) });
        return r.fulfill({ headers: H, contentType: 'application/json', body: JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ answers: reply.answers }) } }] }) });
    });
    return calls;
};
const quizUi = (p) => p.evaluate(() => {
    const q = (k) => document.querySelector(`#xxt-v41-panel [data-k="${k}"]`);
    return { label: q('label').textContent, text: q('text').textContent, st: q('quizst') && q('quizst').textContent, note: q('quiznote') && q('quiznote').textContent };
});
const KEY = 'sk-0123456789abcdef';

test('答题辅助：默认开启且为 DeepSeek；没填 Key 时显示上手教程，三步引导，看完不再出现，设置里可重看', async (b) => {
    const ctx = await newContext(b, { viewport: { width: 1100, height: 950 } });
    await ctx.route('https://platform.deepseek.com/**', (r) => r.fulfill({ contentType: 'text/html', body: 'ds' }));
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(1500);
    const defaults = await p.evaluate(() => [app.configs.quizAssist, app.configs.quizMode]);
    assert(JSON.stringify(defaults) === '[true,"api"]', `默认应开启且为 DeepSeek：${JSON.stringify(defaults)}`);
    const card = () => p.evaluate(() => { const c = document.querySelector('#xxt-v41-panel [data-k=quizguidecard]'); return { shown: !!c && c.style.display !== 'none', mini: !!c && c.querySelector('[data-k=gmini]').style.display !== 'none', title: c && c.querySelector('[data-k=gtitle]').textContent, text: c && c.querySelector('[data-k=gtext]').textContent }; });
    let c = await card();
    assert(c.shown && c.mini, `没填 Key 时应显示教程提示：${JSON.stringify(c)}`);
    await p.click('#xxt-v41-panel [data-k=gstart]'); await sleep(300);
    c = await card();
    assert(c.title === '打开答题辅助' && !c.mini, `第一步不对：${JSON.stringify(c)}`);
    await p.click('#xxt-v41-panel [data-k=gact]'); await sleep(900);
    const flash = await p.evaluate(() => ({ settings: document.querySelector('#xxt-v41-panel [data-k=settings]').offsetParent !== null, flashing: document.querySelectorAll('#xxt-v41-panel .xxt-flash').length }));
    assert(flash.settings && flash.flashing >= 2, `“带我去看”应打开设置并提示答题辅助：${JSON.stringify(flash)}`);
    assert(/消耗你自己 DeepSeek 账号的余额/.test(await p.textContent('#xxt-v41-panel [data-k=quizapi]')), '设置里应注明消耗自己 DeepSeek 账号的余额');
    await p.click('[data-k=gear]'); await sleep(600);
    c = await card();
    assert(c.title === '填入 DeepSeek Key' && /余额/.test(c.text), `第二步不对：${JSON.stringify(c)}`);
    const pop = ctx.waitForEvent('page');
    await p.click('#xxt-v41-panel [data-k=gact]');
    assert((await pop).url().startsWith('https://platform.deepseek.com/'), '应打开 DeepSeek 开放平台');
    await sleep(300);
    assert((await card()).title === '开始学习', '第三步不对');
    await p.click('#xxt-v41-panel [data-k=gact]'); await sleep(300);
    assert(!(await card()).shown, '看完后应收起');
    await p.reload(); await addFakeVideo(p); await inject(p); await sleep(1500);
    assert(!(await card()).shown, '看完后刷新不应再出现');
    await p.click('[data-k=gear]'); await sleep(400);
    await p.click('#xxt-v41-panel [data-k=quizguide]'); await sleep(700);
    c = await card();
    assert(c.shown && c.title === '打开答题辅助', `设置里应能重看教程：${JSON.stringify(c)}`);
    await ctx.close();
});

test('答题辅助：默认没填 Key 时不生效，章节测验仍按原来的方式跳过', async (b) => {
    const ctx = await newContext(b, { routes: { '*': quizPage() } });
    const calls = await mockDeepseek(ctx, { answers: [] });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await wireQuiz(p);
    await inject(p); await sleep(6500);
    const r = await p.evaluate(() => ({ next: window.__next || 0, sub: !!window.__submitted }));
    assert(r.next >= 1 && !r.sub && calls.length === 0, `未填 Key 时应按原逻辑跳过：${JSON.stringify(r)}`);
    await p.click('[data-k=gear]'); await sleep(500);
    assert(/还没有填写 DeepSeek Key/.test((await quizUi(p)).st), '设置里应提示填写 Key');
    await ctx.close();
});

test('答题辅助：设置里保存 Key（只显示掩码、刷新后保留、可清除），可切换随机作答', async (b) => {
    const ctx = await newContext(b);
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(1500);
    await p.click('[data-k=gear]'); await sleep(500);
    await p.fill('#xxt-v41-panel [data-k=quizkey]', 'abc');
    await p.click('#xxt-v41-panel [data-k=quizkeysave]'); await sleep(200);
    assert(/sk-/.test((await quizUi(p)).note), 'Key 格式不对时应提示');
    await p.fill('#xxt-v41-panel [data-k=quizkey]', KEY);
    await p.press('#xxt-v41-panel [data-k=quizkey]', 'Enter'); await sleep(300);
    assert(/sk-…cdef/.test((await quizUi(p)).st), '保存后应显示 Key 掩码');
    await p.reload(); await addFakeVideo(p); await inject(p); await sleep(1500);
    await p.click('[data-k=gear]'); await sleep(500);
    assert(/sk-…cdef/.test((await quizUi(p)).st) && (await p.inputValue('#xxt-v41-panel [data-k=quizkey]')) === '', '刷新后 Key 应保留且不回显');
    await p.click('#xxt-v41-panel [data-qmode=random]'); await sleep(300);
    const mode = await p.evaluate(() => JSON.parse(localStorage.getItem('xxt-v41-settings')).quizMode);
    assert(mode === 'random' && /随机作答/.test((await quizUi(p)).st), `切换随机作答不对：${mode}`);
    await p.click('#xxt-v41-panel [data-qmode=api]'); await sleep(200);
    await p.click('#xxt-v41-panel [data-k=quizkeyclear]'); await sleep(200);
    assert((await p.evaluate(() => localStorage.getItem('xxt-v41-deepseek-key'))) === null, '清除后 Key 应删除');
    await ctx.close();
});

test('答题辅助：DeepSeek 作答，逐题核对后提交，确认成绩再点“下一节”', async (b) => {
    const ctx = await newContext(b, { routes: { '*': quizPage() } });
    const calls = await mockDeepseek(ctx, { answers: [{ id: 1, letters: ['A'] }, { id: 2, letters: ['A', 'B'] }] });
    const p = await ctx.newPage();
    await p.addInitScript((k) => localStorage.setItem('xxt-v41-deepseek-key', k), KEY);
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await wireQuiz(p);
    await inject(p); await sleep(3000);
    assert((await quizUi(p)).label === '答题中', '作答过程中状态框应显示“答题中”');
    await p.waitForFunction(() => window.__next >= 1, null, { timeout: 25000 });
    const sub = await p.evaluate(() => window.__submitted);
    assert(JSON.stringify(sub) === '[true,false,true,true,false]', `提交时选中状态不对：${JSON.stringify(sub)}`);
    const c = calls[0];
    const qs = JSON.parse(c.body.messages[1].content);
    assert(c.auth === `Bearer ${KEY}` && c.body.model === 'deepseek-flash' && qs.length === 2 && qs[1].type === '多选题' && qs[0].question === '1+1 等于几？', `请求不对：${JSON.stringify(c)}`);
    await ctx.close();
});

test('答题辅助：Key 无效时停止，不提交，状态框说明原因', async (b) => {
    const ctx = await newContext(b, { routes: { '*': quizPage() } });
    await mockDeepseek(ctx, { status: 401 });
    const p = await ctx.newPage();
    await p.addInitScript((k) => localStorage.setItem('xxt-v41-deepseek-key', k), KEY);
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await wireQuiz(p);
    await inject(p); await sleep(9000);
    const r = await p.evaluate(() => ({ sub: !!window.__submitted, next: window.__next || 0, state: app._state }));
    const ui = await quizUi(p);
    assert(!r.sub && r.next === 0 && r.state === 'stopped' && ui.label === '需要处理' && /401.*Key 无效/.test(ui.text), `Key 无效时应停止：${JSON.stringify({ r, ui })}`);
    await ctx.close();
});

test('答题辅助：随机作答处理视频弹题，弹层关闭后继续播放，不联网', async (b) => {
    const ctx = await newContext(b);
    const calls = await mockDeepseek(ctx, { answers: [] });
    const p = await ctx.newPage();
    await p.addInitScript(() => localStorage.setItem('xxt-v41-settings', JSON.stringify({ quizMode: 'random' })));
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    await p.evaluate(() => {
        const d = document.getElementById('f').contentDocument;
        d.body.insertAdjacentHTML('beforeend', '<div class="ans-videoquiz" style="width:300px;height:160px"><div class="tkTopic">【单选题】 视频里提到的是哪一个？</div>' +
            '<ul><li><label><input type="radio" name="v"><span>A</span> 甲</label></li><li><label><input type="radio" name="v"><span>B</span> 乙</label></li></ul><button type="button">提交</button></div>');
        d.querySelector('.ans-videoquiz button').addEventListener('click', () => { window.__picked = [...d.querySelectorAll('.ans-videoquiz input')].map((i) => i.checked); d.querySelector('.ans-videoquiz').remove(); });
        __v.pause();
    });
    await p.waitForFunction(() => !!window.__picked, null, { timeout: 15000 });
    await sleep(2500);
    const r = await p.evaluate(() => ({ picked: window.__picked, paused: __v.paused }));
    assert(r.picked.filter(Boolean).length === 1 && !r.paused && calls.length === 0, `视频弹题处理不对：${JSON.stringify(r)}`);
    await ctx.close();
});

test('答题辅助：答题进行中也能切换设置，界面立即显示，本轮结束后才生效', async (b) => {
    const ctx = await newContext(b, { routes: { '*': quizPage() } });
    await ctx.route('https://api.deepseek.com/**', async (r) => {
        const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'POST' };
        if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: H });
        await sleep(4000);
        return r.fulfill({ headers: H, contentType: 'application/json', body: JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ answers: [{ id: 1, letters: ['A'] }, { id: 2, letters: ['A', 'B'] }] }) } }] }) });
    });
    const p = await ctx.newPage();
    await p.addInitScript((k) => localStorage.setItem('xxt-v41-deepseek-key', k), KEY);
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await wireQuiz(p);
    await p.evaluate(() => document.getElementById('prevNextFocusNext').addEventListener('click', () => setTimeout(() => { document.querySelector('.prev_title').title = '学习目标'; }, 800)));
    await inject(p);
    await p.click('[data-k=gear]');
    await p.waitForFunction(() => document.querySelector('#xxt-v41-panel [data-k=label]').textContent === '答题中', null, { timeout: 15000 });
    await sleep(1000);
    await p.click('#xxt-v41-panel [data-qmode=random]', { timeout: 2000 });
    await p.click('#xxt-v41-panel [data-k=quizon]', { timeout: 2000 });
    await sleep(200);
    const mid = await p.evaluate(() => ({ on: document.querySelector('#xxt-v41-panel [data-k=quizon]').checked, random: document.querySelector('#xxt-v41-panel [data-qmode=random]').classList.contains('on'), real: [app.configs.quizAssist, app.configs.quizMode], note: document.querySelector('#xxt-v41-panel [data-k=quiznote]').textContent }));
    assert(!mid.on && mid.random && mid.real[0] === true && mid.real[1] === 'api' && /本轮答题结束后生效/.test(mid.note), `答题中切换不对：${JSON.stringify(mid)}`);
    await p.waitForFunction(() => window.__next >= 1, null, { timeout: 25000 });
    assert(JSON.stringify(await p.evaluate(() => window.__submitted)) === '[true,false,true,true,false]', '本轮应按原设置（DeepSeek）完成');
    await sleep(3000);
    const after = await p.evaluate(() => [app.configs.quizAssist, app.configs.quizMode, JSON.parse(localStorage.getItem('xxt-v41-settings') || '{}').quizMode]);
    assert(JSON.stringify(after) === '[false,"random","random"]', `本轮结束后应生效：${JSON.stringify(after)}`);
    await ctx.close();
});

test('唱片机 / 音频转换：同一个面板按页面切换，功能栏高亮跟着走', async (b) => {
    const ctx = await newContext(b, { viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(1500);
    await p.click('#xxt-v41-side [data-s=handle]'); await sleep(500);
    const st = () => p.evaluate(() => { const m = document.getElementById('xxt-v41-music'); const on = (k) => document.querySelector(`#xxt-v41-side [data-s=${k}]`).classList.contains('on'); return [m && m.classList.contains('open'), m && m.classList.contains('conv'), on('music'), on('conv')].map(Number).join(''); });
    const got = [];
    for (const sel of ['#xxt-v41-side [data-s=music]', '#xxt-v41-side [data-s=conv]', '#xxt-v41-side [data-s=music]', '#xxt-v41-side [data-s=music]', '#xxt-v41-side [data-s=conv]', '#xxt-v41-music [data-m=close]', '#xxt-v41-side [data-s=music]', '#xxt-v41-music [data-m=convopen]', '#xxt-v41-music [data-m=convback]']) {
        await p.click(sel); await sleep(400); got.push(await st());
    }
    assert(got.join(',') === '1010,1101,1010,0000,1101,0000,1010,1101,1010', `切换不对：${got.join(',')}`);
    await ctx.close();
});

test('答题辅助：视频弹题答错时换没试过的答案重交，答对后继续播放', async (b) => {
    const ctx = await newContext(b);
    await mockDeepseek(ctx, { answers: [{ id: 1, letters: ['A'] }] });
    const p = await ctx.newPage();
    await p.addInitScript((k) => localStorage.setItem('xxt-v41-deepseek-key', k), KEY);
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    await p.evaluate(() => {
        const d = document.getElementById('f').contentDocument;
        d.body.insertAdjacentHTML('beforeend', '<div class="ans-videoquiz" style="width:320px;height:200px"><div class="tkTopic">【单选题】 正确的是哪一个？</div><ul>' +
            ['甲', '乙', '丙', '丁'].map((x, i) => `<li><label><input type="radio" name="v"><span>${'ABCD'[i]}</span> ${x}</label></li>`).join('') + '</ul><button type="button">提交</button><div class="fb"></div></div>');
        window.__tries = [];
        d.querySelector('.ans-videoquiz button').addEventListener('click', () => {
            const i = [...d.querySelectorAll('.ans-videoquiz input')].findIndex((x) => x.checked);
            window.__tries.push('ABCD'[i]);
            if (i === 3) d.querySelector('.ans-videoquiz').remove(); else d.querySelector('.ans-videoquiz .fb').textContent = '回答错误';
        });
        __v.pause();
    });
    await p.waitForFunction(() => !document.getElementById('f').contentDocument.querySelector('.ans-videoquiz'), null, { timeout: 30000 });
    await sleep(2500);
    const r = await p.evaluate(() => ({ tries: window.__tries, paused: __v.paused }));
    assert(r.tries[0] === 'A' && r.tries[r.tries.length - 1] === 'D' && new Set(r.tries).size === r.tries.length && !r.paused, `答错重试不对：${JSON.stringify(r)}`);
    await ctx.close();
});

test('格式转换：网易云 .ncm 等加密格式可以选中，加入列表时就说明不能转换，不影响其他文件', async (b) => {
    const ctx = await newContext(b, { viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(1500);
    await p.click('#xxt-v41-side [data-s=handle]'); await sleep(500);
    await p.click('#xxt-v41-side [data-s=conv]'); await sleep(600);
    const accept = await p.evaluate(() => [document.querySelector('#xxt-v41-music [data-m=convfile]').accept, document.querySelector('#xxt-v41-music [data-m=file]').accept]);
    assert(accept.every((a) => /\.ncm/.test(a) && /\.kgm/.test(a) && /\.qmc0/.test(a)), `选择框应允许选中加密格式：${JSON.stringify(accept)}`);
    const n = 44100, wav = Buffer.alloc(44 + n * 2);
    wav.write('RIFF', 0); wav.writeUInt32LE(36 + n * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) wav.writeInt16LE(Math.round(Math.sin(i / 10) * 5000), 44 + i * 2);
    await p.selectOption('#xxt-v41-music [data-m=cfmt]', 'wav');
    await p.setInputFiles('#xxt-v41-music [data-m=convfile]', [
        { name: '马也_Crabbit - 海屿你.ncm', mimeType: 'application/octet-stream', buffer: Buffer.from('CTENFDAM fake') },
        { name: '正常.wav', mimeType: 'audio/wav', buffer: wav },
    ]);
    await sleep(300);
    const before = await p.evaluate(() => ({ q: app._convQ.map((x) => [x.name, x.status, x.msg]), hint: document.querySelector('#xxt-v41-music [data-m=convhint]').textContent }));
    assert(before.q[0][1] === 'drm' && /加密格式/.test(before.q[0][2]) && before.q[1][1] === 'wait' && /\.ncm/.test(before.hint) && /正规渠道/.test(before.hint), `加入列表时应说明原因：${JSON.stringify(before)}`);
    await p.click('#xxt-v41-music [data-m=cstart]');
    await p.waitForFunction(() => !app._convRunning && app._convQ[1].status === 'done', null, { timeout: 20000 });
    assert((await p.evaluate(() => app._convQ[0].status)) === 'drm', '加密文件不应被处理');
    await ctx.close();
});

test('唱片机「RouteCC 的歌单」：侧拉栏默认收起，点歌名在网易云音乐打开，重新打开唱片机后又收起', async (b) => {
    const ctx = await newContext(b, { viewport: { width: 1200, height: 950 } });
    await ctx.route('https://music.163.com/**', (r) => r.fulfill({ contentType: 'text/html', body: 'music' }));
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(1500);
    await p.click('#xxt-v41-side [data-s=handle]'); await sleep(500);
    await p.click('#xxt-v41-side [data-s=music]'); await sleep(800);
    const st = () => p.evaluate(() => { const rb = document.querySelector('#xxt-v41-music [data-m=recbody]'), r = rb.getBoundingClientRect(); return { open: document.querySelector('#xxt-v41-music [data-m=drawer]').classList.contains('open'), op: getComputedStyle(rb).opacity, inView: r.left >= 0 && r.right <= innerWidth && r.width > 200,
        inHeader: !!document.querySelector('#xxt-v41-music .xm-head [data-m=rechandle]'),
        rows: [...document.querySelectorAll('#xxt-v41-music [data-rec]')].map((e) => e.textContent), inList: document.querySelectorAll('#xxt-v41-music [data-m=list] [data-rec]').length }; });
    let s = await st();
    assert(!s.open && s.op === '0' && s.inHeader && s.inList === 0, `歌单应默认收起、入口在标题栏，且不在播放列表里：${JSON.stringify(s)}`);
    await p.click('#xxt-v41-music [data-m=rechandle]'); await sleep(600);
    s = await st();
    assert(s.open && s.op === '1' && s.inView && s.rows.length === 5 && s.rows[0].includes('River Flows In You') && s.rows[4].includes('海屿你'), `点把手后应展开歌单：${JSON.stringify(s)}`);
    const pop = ctx.waitForEvent('page');
    await p.click('#xxt-v41-music [data-rec="0"]');
    const url = (await pop).url();
    assert(url.startsWith('https://music.163.com/') && decodeURIComponent(url).includes('River Flows In You Martin Ermen'), `应在网易云音乐打开：${url}`);
    await sleep(300);
    assert(!(await panelInfo(p)).notice, '正常打开时不应提示“拦截了新窗口”');
    await p.click('#xxt-v41-music [data-m=close]'); await sleep(500);
    await p.click('#xxt-v41-side [data-s=music]'); await sleep(800);
    assert(!(await st()).open, '重新打开唱片机后歌单应收起');
    await p.setViewportSize({ width: 520, height: 900 }); await sleep(500);
    await p.click('#xxt-v41-music [data-m=rechandle]'); await sleep(600);
    s = await st();
    assert(s.open && s.inView, `窄窗口里歌单也应完整可见：${JSON.stringify(s)}`);
    await ctx.close();
});

test('留言板：从功能栏和设置打开，读取所有人的留言（纯文字显示），一键复制并打开 GitHub 发表', async (b) => {
    const ctx = await newContext(b, { viewport: { width: 1200, height: 950 } });
    let reads = 0, limited = false;
    const H = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'X-RateLimit-Remaining' };
    await ctx.route('https://api.github.com/repos/1668919739/xuexitongScript/issues/2**', (r) => {
        reads++;
        if (limited) return r.fulfill({ status: 403, headers: { ...H, 'x-ratelimit-remaining': '0' }, contentType: 'application/json', body: '{"message":"API rate limit exceeded"}' });
        const u = r.request().url();
        if (u.includes('/comments')) return r.fulfill({ headers: H, contentType: 'application/json', body: JSON.stringify([
            { user: { login: 'student1' }, created_at: '2026-10-28T08:00:00Z', body: '很好用！<b>谢谢</b> ![图](https://x/y.png) [链接](https://x)' },
            { user: { login: '1668919739' }, created_at: '2026-10-28T09:00:00Z', body: '欢迎留言～' },
        ]) });
        return r.fulfill({ headers: H, contentType: 'application/json', body: JSON.stringify({ comments: 2 }) });
    });
    await ctx.route('https://github.com/**', (r) => r.fulfill({ contentType: 'text/html', body: 'github' }));
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://mooc1.chaoxing.com' });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(1500);
    await p.click('#xxt-v41-side [data-s=handle]'); await sleep(500);
    await p.click('#xxt-v41-side [data-s=board]'); await sleep(1500);
    const info = await p.evaluate(() => ({
        title: document.querySelector('#xxt-v41-panel [data-k=histtitle]').textContent,
        on: document.querySelector('#xxt-v41-side [data-s=board]').classList.contains('on'),
        st: document.querySelector('#xxt-v41-panel [data-k=boardstate]').textContent,
        msgs: [...document.querySelectorAll('#xxt-v41-panel .xxt-bm')].map((e) => ({ user: e.querySelector('b').textContent, owner: !!e.querySelector('.xxt-bm-head span'), text: e.querySelector('.xxt-bm-text').textContent, html: e.querySelector('.xxt-bm-text').innerHTML })),
        log: document.querySelector('#xxt-v41-panel [data-k=histlist]').offsetParent !== null,
    }));
    assert(info.title === '留言板' && info.on && !info.log && /共 2 条留言/.test(info.st), `留言板没有打开：${JSON.stringify(info)}`);
    assert(info.msgs[0].user === '1668919739' && info.msgs[0].owner && info.msgs[1].user === 'student1' && !info.msgs[1].owner, `留言顺序或作者标记不对：${JSON.stringify(info.msgs)}`);
    assert(info.msgs[1].text === '很好用！谢谢 [图片] 链接' && !/<b>|<img/.test(info.msgs[1].html), `留言应以纯文字显示：${JSON.stringify(info.msgs[1])}`);
    // 发表：内容复制到剪贴板，并打开留言 Issue
    await p.fill('#xxt-v41-panel [data-k=boardtext]', '来自测试的留言');
    const pop = ctx.waitForEvent('page');
    await p.click('#xxt-v41-panel [data-k=boardsend]');
    const url = (await pop).url();
    assert(url === 'https://github.com/1668919739/xuexitongScript/issues/2#new_comment_field', `打开的页面不对：${url}`);
    assert((await p.evaluate(() => navigator.clipboard.readText())) === '来自测试的留言', '留言没有复制到剪贴板');
    assert(/已复制/.test(await p.textContent('#xxt-v41-panel [data-k=boardnote]')), '应提示已复制');
    // 2 分钟内重新打开不重复读取；点刷新才读；被限流时说明原因
    const before = reads;
    await p.click('#xxt-v41-side [data-s=board]'); await sleep(500);
    await p.click('[data-k=gear]'); await sleep(400);
    await p.click('[data-k=boardopen]'); await sleep(800);
    assert(reads === before, `不应重复读取：${reads - before} 次`);
    limited = true;
    await p.click('#xxt-v41-panel [data-k=boardrefresh]'); await sleep(1200);
    assert(/太频繁/.test(await p.textContent('#xxt-v41-panel [data-k=boardstate]')), '限流时应说明原因');
    assert((await p.evaluate(() => document.querySelectorAll('#xxt-v41-panel .xxt-bm').length)) === 2, '限流时应保留已读到的留言');
    await p.click('#xxt-v41-panel [data-k=histback]'); await sleep(600);
    assert(await p.evaluate(() => document.querySelector('#xxt-v41-panel [data-k=settings]').offsetParent !== null), '从设置打开的留言板，返回后应回到设置');
    await ctx.close();
});

for (const style of ['native', 'drawn']) test(`答题辅助：新版章节页（没有视频 / 测验页签）的视频弹题也会自动作答（${style === 'native' ? '原生单选框' : '画出来的选项'}）`, async (b) => {
    const ctx = await newContext(b, { routes: { '*': coursePage().replace('<div class="prev_title" title="视频"></div>', '') } });
    const calls = await mockDeepseek(ctx, { answers: [{ id: 1, letters: ['C'] }] });
    const p = await ctx.newPage();
    await p.addInitScript((k) => localStorage.setItem('xxt-v41-deepseek-key', k), KEY);
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2500);
    await p.evaluate((style) => {
        const d = document.getElementById('f').contentDocument;
        const opts = ['2013年', '2014年', '2015年', '2016年'].map((x, i) => style === 'native'
            ? `<li class="ans-videoquiz-opt"><label><input type="radio" name="vq"> ${'ABCD'[i]}、${x}</label></li>`
            : `<li class="ans-videoquiz-opt" data-i="${i}"><i class="radio-icon"></i>${'ABCD'[i]}、${x}</li>`).join('');
        d.body.insertAdjacentHTML('beforeend', '<div class="ans-videoquiz" style="width:600px;height:380px">' +
            '<div class="ans-videoquiz-title"><span>单选题</span><span class="count">共 3 题，已答对 0 题</span></div>' +
            '<div class="ans-videoquiz-stem">“大众创业，万众创新”是哪一年提出的？</div>' +
            `<ul class="ans-videoquiz-opts">${opts}</ul><button type="button" class="ans-videoquiz-submit">提交</button></div>`);
        if (style === 'drawn') d.querySelectorAll('.ans-videoquiz-opt').forEach((li) => li.addEventListener('click', () => {
            d.querySelectorAll('.ans-videoquiz-opt').forEach((x) => x.classList.remove('checked')); li.classList.add('checked');
        }));
        d.querySelector('.ans-videoquiz-submit').addEventListener('click', () => {
            window.__picked = style === 'native' ? [...d.querySelectorAll('.ans-videoquiz input')].findIndex((x) => x.checked) : [...d.querySelectorAll('.ans-videoquiz-opt')].findIndex((x) => x.classList.contains('checked'));
            d.querySelector('.ans-videoquiz').remove();
        });
        __v.pause();
    }, style);
    await p.waitForFunction(() => window.__picked !== undefined, null, { timeout: 20000 });
    await sleep(2500);
    const r = await p.evaluate(() => ({ picked: window.__picked, paused: __v.paused }));
    const q = JSON.parse(calls[0].body.messages[1].content)[0];
    assert(r.picked === 2 && !r.paused, `应选 C 并继续播放：${JSON.stringify(r)}`);
    assert(q.question === '“大众创业，万众创新”是哪一年提出的？' && q.type === '单选题' && q.options.map((o) => o.letter + o.text).join('|') === 'A2013年|B2014年|C2015年|D2016年', `识别的题目不对：${JSON.stringify(q)}`);
    await ctx.close();
});

test('答题辅助：DeepSeek 思考用光输出长度时自动改为直接作答；参数不被接受时换参数；超过 10 题分批请求', async (b) => {
    // 12 道单选题
    const qs = Array.from({ length: 12 }, (_, i) => `<div class="TiMu"><div>${i + 1} 【单选题】 第 ${i + 1} 题？</div><ul><li><label><input type="radio" name="q${i}"><span>A</span> 对</label></li><li><label><input type="radio" name="q${i}"><span>B</span> 错</label></li></ul></div>`).join('');
    const body = `<div id="work">${qs}<button type="button" id="sub">提交</button><div id="score"></div></div><div id="prevNextFocusNext" style="display:inline-block;padding:4px">下一节</div>`;
    const ctx = await newContext(b, { routes: { '*': coursePage({ body }).replace('<div class="prev_title" title="视频"></div>', '<div class="prev_title" title="章节测验"></div>') } });
    const calls = [];
    await ctx.route('https://api.deepseek.com/**', (r) => {
        const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'POST' };
        if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: H });
        const req = JSON.parse(r.request().postData());
        calls.push(req);
        const n = JSON.parse(req.messages[1].content).length;
        // 第一批：先 400（参数不认），再“长度用光”，然后直答成功；第二批：直接成功
        if (calls.length === 1) return r.fulfill({ status: 400, headers: H, contentType: 'application/json', body: '{"error":{"message":"max_tokens invalid"}}' });
        if (calls.length === 2) return r.fulfill({ headers: H, contentType: 'application/json', body: JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '' } }] }) });
        return r.fulfill({ headers: H, contentType: 'application/json', body: JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ answers: Array.from({ length: n }, (_, i) => ({ id: i + 1, letters: ['A'] })) }) } }] }) });
    });
    const p = await ctx.newPage();
    await p.addInitScript((k) => localStorage.setItem('xxt-v41-deepseek-key', k), KEY);
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await wireQuiz(p);
    await inject(p);
    await p.waitForFunction(() => window.__next >= 1, null, { timeout: 40000 });
    const sub = await p.evaluate(() => window.__submitted);
    const sizes = calls.map((c) => JSON.parse(c.messages[1].content).length);
    assert(sub.filter((x, i) => i % 2 === 0).every(Boolean) && sub.filter((x, i) => i % 2 === 1).every((x) => !x), `12 题都应选 A 并提交：${JSON.stringify(sub)}`);
    assert(JSON.stringify(sizes) === '[10,10,10,2]', `应分成 10 + 2 两批：${JSON.stringify(sizes)}`);
    assert(calls[0].max_tokens === 16000 && calls[1].max_tokens === 8000 && calls[2].thinking && calls[2].thinking.type === 'disabled', `重试参数不对：${JSON.stringify(calls.map((c) => [c.thinking, c.max_tokens]))}`);
    assert(calls[3].thinking && calls[3].thinking.type === 'enabled', '下一批应重新先用思考模式');
    await ctx.close();
});

test('唱片机：加宽且列表不会出现左右滚动条；拖入文件时高亮不会来回闪', async (b) => {
    const ctx = await newContext(b, { viewport: { width: 1200, height: 950 } });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(1500);
    await p.evaluate(() => app._showMusic('player')); await sleep(600);
    const r = await p.evaluate(() => {
        const d = document.getElementById('xxt-v41-music'), l = d.querySelector('[data-m=list]');
        const cs = getComputedStyle(l);
        d.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true }));
        const child = d.querySelector('[data-m=add]');
        d.dispatchEvent(new DragEvent('dragleave', { bubbles: true, relatedTarget: child }));
        const stays = d.classList.contains('drag');
        d.dispatchEvent(new DragEvent('dragleave', { bubbles: true, relatedTarget: document.body }));
        return { w: d.offsetWidth, ox: cs.overflowX, gutter: cs.scrollbarGutter, stays, cleared: !d.classList.contains('drag') };
    });
    assert(r.w === 320 && r.ox === 'hidden' && r.gutter === 'stable', `唱片机宽度或滚动设置不对：${JSON.stringify(r)}`);
    assert(r.stays && r.cleared, `拖入高亮不应在内部移动时取消，离开时才取消：${JSON.stringify(r)}`);
    await ctx.close();
});

test('格式转换：功能栏直达；FLAC + 音量统一 + 序号 + 同名歌词；车载 MP3；添加整个文件夹', async (b) => {
    const tone = (sec, rate, amp) => {
        const n = rate * sec, buf = Buffer.alloc(44 + n * 4);
        buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
        buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
        for (let i = 0; i < n; i++) { const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * amp); buf.writeInt16LE(v, 44 + i * 4); buf.writeInt16LE(v, 46 + i * 4); }
        return buf;
    };
    const ctx = await newContext(b, { viewport: { width: 1200, height: 950 } });
    const lame = (await import('node:fs')).readFileSync(new URL('../../node_modules/lamejs/lame.min.js', import.meta.url), 'utf8');
    await ctx.route('**/lamejs@1.2.1/lame.min.js', (r) => r.fulfill({ contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: lame }));
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(1500);
    await p.click('#xxt-v41-side [data-s=handle]'); await sleep(500);
    await p.click('#xxt-v41-side [data-s=conv]'); await sleep(800);
    assert(await p.evaluate(() => document.getElementById('xxt-v41-music').classList.contains('conv')), '功能栏「音频转换」应直接打开转换页');
    // 记录下载文件名，并在页面里解码检查结果
    await p.evaluate(() => { window.__dl = []; const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dl.push(this.download); return c.call(this); }; });
    await p.selectOption('#xxt-v41-music [data-m=cfmt]', 'flac');
    for (const k of ['cnorm', 'cnum', 'cdl']) await p.check(`#xxt-v41-music [data-m=${k}]`);
    await p.setInputFiles('#xxt-v41-music [data-m=convfile]', [
        { name: '轻声.wav', mimeType: 'audio/wav', buffer: tone(2, 44100, 1500) },
        { name: '轻声.lrc', mimeType: 'text/plain', buffer: Buffer.from('[00:00.00]歌词') },
        { name: '第二首.wav', mimeType: 'audio/wav', buffer: tone(1, 48000, 9000) },
    ]);
    await p.click('#xxt-v41-music [data-m=cstart]');
    await p.waitForFunction(() => !app._convRunning && app._convQ.every((x) => x.status === 'done' || x.status === 'fail'), null, { timeout: 30000 });
    const r = await p.evaluate(async () => {
        const t = app._tracks.find((x) => x.name === '01 轻声');
        const a = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(await t.blob.arrayBuffer());
        const d = a.getChannelData(0); let peak = 0, sum = 0;
        for (let i = 0; i < d.length; i++) { peak = Math.max(peak, Math.abs(d[i])); sum += d[i] * d[i]; }
        return { dl: window.__dl, type: t.blob.type, rms: 20 * Math.log10(Math.sqrt(sum / d.length)), peak: 20 * Math.log10(peak), len: a.duration };
    });
    assert(['01 轻声.flac', '01 轻声.lrc', '02 第二首.flac'].every((n) => r.dl.includes(n)), `下载文件不对：${JSON.stringify(r.dl)}`);
    assert(r.type === 'audio/flac' && Math.abs(r.len - 2) < 0.05 && r.rms > -17.5 && r.rms < -14.5 && r.peak <= -0.9, `FLAC / 音量统一不对：${JSON.stringify(r)}`);
    // 车载 MP3：采样率、声道固定；整个文件夹（含子文件夹）入列，非音频忽略
    await p.click('#xxt-v41-music [data-m=cclear]');
    await p.selectOption('#xxt-v41-music [data-m=cfmt]', 'car');
    for (const k of ['cnorm', 'cnum']) await p.uncheck(`#xxt-v41-music [data-m=${k}]`);
    const dis = await p.evaluate(() => ['csr', 'cch', 'cbr'].map((k) => document.querySelector(`#xxt-v41-music [data-m=${k}]`).disabled));
    assert(JSON.stringify(dis) === '[true,true,false]', `车载 MP3 选项状态不对：${JSON.stringify(dis)}`);
    await p.evaluate((wav) => {
        const inp = document.querySelector('#xxt-v41-music [data-m=convdir]');
        const bin = Uint8Array.from(atob(wav), (c) => c.charCodeAt(0));
        const files = [['专辑/单声道.wav', 'audio/wav'], ['专辑/子目录/另一首.wav', 'audio/wav'], ['专辑/说明.txt', 'text/plain']].map(([rel, type]) => {
            const f = new File([bin], rel.split('/').pop(), { type }); Object.defineProperty(f, 'webkitRelativePath', { value: rel }); return f;
        });
        Object.defineProperty(inp, 'files', { configurable: true, get: () => files });
        inp.dispatchEvent(new Event('change'));
    }, tone(1, 22050, 8000).toString('base64'));
    assert(JSON.stringify(await p.evaluate(() => app._convQ.map((x) => x.name))) === '["单声道.wav","另一首.wav"]', '文件夹导入不对');
    await p.click('#xxt-v41-music [data-m=cstart]');
    await p.waitForFunction(() => !app._convRunning && app._convQ.every((x) => x.status === 'done' || x.status === 'fail'), null, { timeout: 30000 });
    const car = await p.evaluate(async () => {
        const t = app._tracks.find((x) => x.name === '另一首');
        const a = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(await t.blob.arrayBuffer());
        return { type: t.blob.type, ch: a.numberOfChannels };
    });
    assert(car.type === 'audio/mpeg' && car.ch === 2, `车载 MP3 不对：${JSON.stringify(car)}`);
    await ctx.close();
});

// ---------- 紫微排盘 ----------
test('紫微排盘：功能栏打开后才下载引擎，农历/晚子时换算后出 12 宫盘，点宫位看详情，和唱片机互斥', async (b) => {
    const ctx = await newContext(b, { viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    const engineReqs = [];
    p.on('request', (r) => { if (r.url().includes('/ziwei/ziwei-')) engineReqs.push(r.url()); });
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await inject(p); await sleep(1500);
    assert(engineReqs.length === 0 && !(await p.evaluate(() => !!window.XxtZiwei)), '没打开紫微排盘就下载了引擎');
    await p.click('#xxt-v41-side [data-s=handle]'); await sleep(400);
    await p.click('#xxt-v41-side [data-s=ziwei]');
    await p.waitForFunction(() => window.XxtZiwei && document.querySelector('#xxt-v41-ziwei.open'), null, { timeout: 8000 });
    assert(engineReqs.length === 1, `引擎应只下载一次：${engineReqs.length}`);
    assert(await p.evaluate(() => document.querySelector('#xxt-v41-side [data-s=ziwei]').classList.contains('on')), '功能栏按钮没有高亮');
    // 公历 1990-05-15 午时 男
    await p.fill('#xxt-v41-ziwei [data-z=year]', '1990');
    await p.selectOption('#xxt-v41-ziwei [data-z=month]', '5');
    await p.selectOption('#xxt-v41-ziwei [data-z=day]', '15');
    await p.selectOption('#xxt-v41-ziwei [data-z=hour]', '6');
    await p.click('#xxt-v41-ziwei [data-z=go]'); await sleep(400);
    const r1 = await p.evaluate(() => {
        const d = document.getElementById('xxt-v41-ziwei');
        return {
            cells: d.querySelectorAll('.zw-cell[data-br]').length,
            center: d.querySelector('.zw-center').textContent,
            ming: d.querySelector('.zw-cell.sel .zw-foot b').textContent,
            form: d.querySelector('[data-z=formwrap]').style.display,
            pats: d.querySelectorAll('.zw-pat').length,
            stars: [...d.querySelectorAll('.zw-cell[data-br="11"] .zw-major')].map((x) => x.textContent).join(''),
        };
    });
    assert(r1.cells === 12 && /土五局/.test(r1.center) && /庚午 辛巳 庚辰 壬午/.test(r1.center), `盘面不对：${JSON.stringify(r1)}`);
    assert(r1.ming === '命宫' && /天梁/.test(r1.stars) && r1.form === 'none' && r1.pats > 0, `命宫/格局不对：${JSON.stringify(r1)}`);
    // 点财帛宫（未）：详情切换，三方四正高亮
    await p.click('#xxt-v41-ziwei .zw-cell[data-br="7"]'); await sleep(200);
    const r2 = await p.evaluate(() => {
        const d = document.getElementById('xxt-v41-ziwei');
        return { title: d.querySelector('.zw-detail b').textContent, tri: d.querySelectorAll('.zw-cell.tri').length, txt: d.querySelector('.zw-detail').textContent };
    });
    assert(r2.title === '财帛' && r2.tri === 3 && /太阳/.test(r2.txt) && /禄/.test(r2.txt), `宫位详情不对：${JSON.stringify(r2)}`);
    // 农历闰月 + 晚子时：2023 年闰二月初一 23:30 → 公历 2023-03-23 子时
    await p.click('#xxt-v41-ziwei [data-zact=edit]'); await sleep(200);
    await p.click('#xxt-v41-ziwei [data-z=cal] [data-v=lunar]');
    await p.fill('#xxt-v41-ziwei [data-z=year]', '2023');
    await p.selectOption('#xxt-v41-ziwei [data-z=month]', '2');
    await p.selectOption('#xxt-v41-ziwei [data-z=day]', '1');
    await p.check('#xxt-v41-ziwei [data-z=leap]');
    await p.selectOption('#xxt-v41-ziwei [data-z=hour]', '12');
    await p.click('#xxt-v41-ziwei [data-z=gender] [data-v=female]');
    await p.click('#xxt-v41-ziwei [data-z=go]'); await sleep(400);
    const r3 = await p.evaluate(() => ({ bi: app._zw.chart.birthInfo, bar: document.querySelector('#xxt-v41-ziwei .zw-who').textContent }));
    assert(r3.bi.year === 2023 && r3.bi.month === 3 && r3.bi.day === 23 && r3.bi.hour === 0 && r3.bi.gender === 'female', `农历/晚子时换算不对：${JSON.stringify(r3)}`);
    assert(/晚子时/.test(r3.bar), `没有提示晚子时换日：${r3.bar}`);
    // 不存在的闰月：报错、不出新盘
    await p.click('#xxt-v41-ziwei [data-zact=edit]'); await sleep(200);
    await p.selectOption('#xxt-v41-ziwei [data-z=month]', '3');
    await p.click('#xxt-v41-ziwei [data-z=go]'); await sleep(300);
    const err = await p.evaluate(() => document.querySelector('#xxt-v41-ziwei .zw-msg.err')?.textContent || '');
    assert(/没有闰三月.*闰二月/.test(err), `闰月错误提示不对：${err}`);
    // 输入记在本机，刷新后还在
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('xxt_v41_ziwei_form')));
    assert(saved.cal === 'lunar' && saved.year === 2023 && saved.month === 3 && saved.leap === true, `表单没有保存：${JSON.stringify(saved)}`);
    // 打开唱片机会收起紫微排盘，反之亦然
    await p.click('#xxt-v41-side [data-s=music]'); await sleep(300);
    const m1 = await p.evaluate(() => ({ zw: document.querySelector('#xxt-v41-ziwei').classList.contains('open'), mu: document.querySelector('#xxt-v41-music').classList.contains('open') }));
    assert(!m1.zw && m1.mu, `打开唱片机后紫微应收起：${JSON.stringify(m1)}`);
    await p.click('#xxt-v41-side [data-s=ziwei]'); await sleep(300);
    const m2 = await p.evaluate(() => ({ zw: document.querySelector('#xxt-v41-ziwei').classList.contains('open'), mu: document.querySelector('#xxt-v41-music').classList.contains('open') }));
    assert(m2.zw && !m2.mu, `打开紫微后唱片机应收起：${JSON.stringify(m2)}`);
    assert(engineReqs.length === 1, '再次打开不应重复下载引擎');
    // 浮窗收起时一起隐藏
    await p.click('#xxt-v41-panel [data-k=toggle]'); await sleep(500);
    assert(!(await p.evaluate(() => document.querySelector('#xxt-v41-ziwei').classList.contains('open'))), '浮窗收起后紫微面板还开着');
    await ctx.close();
});

test('紫微排盘：引擎下载失败时提示并可重试，不影响刷课', async (b) => {
    const ctx = await newContext(b, { viewport: { width: 1280, height: 900 }, ziwei: 'fail' });
    const p = await ctx.newPage();
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await addFakeVideo(p);
    await inject(p); await sleep(2000);
    await p.click('#xxt-v41-side [data-s=handle]'); await sleep(400);
    await p.click('#xxt-v41-side [data-s=ziwei]');
    await p.waitForFunction(() => app._zwLoad === 'failed', null, { timeout: 8000 });
    const t = await p.evaluate(() => document.querySelector('#xxt-v41-ziwei [data-z=msg]').textContent);
    assert(/下载失败/.test(t) && await p.$('#xxt-v41-ziwei [data-zact=retry]'), `失败提示不对：${t}`);
    assert(!(await p.evaluate(() => __v.paused)), '引擎下载失败影响了视频播放');
    await p.click('#xxt-v41-ziwei [data-zact=retry]');
    await p.waitForFunction(() => app._zwLoad === 'failed', null, { timeout: 8000 });
    await ctx.close();
});

test('紫微排盘 · 星曜含义与 AI 解读：没填 Key 时就地填写，按主题点了才调用 DeepSeek，结果缓存，可重新生成，出错可重试', async (b) => {
    const ctx = await newContext(b, { viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    const calls = [];
    let mode = 'ok';
    await ctx.route('https://api.deepseek.com/**', async (r) => {
        const body = JSON.parse(r.request().postData() || '{}');
        calls.push({ auth: r.request().headers().authorization, user: body.messages[1].content, system: body.messages[0].content, fmt: body.response_format });
        const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
        if (mode === '401') return r.fulfill({ status: 401, contentType: 'application/json', headers: H, body: JSON.stringify({ error: { message: 'Authentication Fails' } }) });
        const n = calls.length;
        return r.fulfill({ contentType: 'application/json', headers: H, body: JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: `【事业定性】\n官禄宫空宫借对宫，第${n}次生成。\n**【建议】** 稳中求进。` } }] }) });
    });
    await p.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
    await inject(p); await sleep(1500);
    await p.evaluate(() => { localStorage.setItem('xxt_v41_ziwei_form', JSON.stringify({ cal: 'solar', year: 1990, month: 5, day: 15, leap: false, hour: 6, gender: 'male' })); });
    await p.click('#xxt-v41-side [data-s=handle]'); await sleep(300);
    await p.click('#xxt-v41-side [data-s=ziwei]');
    await p.waitForFunction(() => window.XxtZiwei);
    await p.click('#xxt-v41-ziwei [data-z=go]'); await sleep(400);
    // 宫位详情里显示主星含义
    const det = await p.evaluate(() => document.querySelector('#xxt-v41-ziwei .zw-detail').textContent);
    assert(/天梁陷[\s\S]*荫[\s\S]*五行土/.test(det), `命宫详情没有天梁含义：${det}`);
    await p.click('#xxt-v41-ziwei .zw-cell[data-br="3"]'); await sleep(200);   // 官禄（卯）空宫
    const det2 = await p.evaluate(() => document.querySelector('#xxt-v41-ziwei .zw-detail').textContent);
    assert(/天机借[\s\S]*智慧/.test(det2) && /巨门借/.test(det2), `空宫没有显示借星含义：${det2}`);
    // 没填 Key：显示就地填写，点主题不调用
    const ai0 = await p.evaluate(() => ({ note: document.querySelector('#xxt-v41-ziwei .zw-ai-note')?.textContent, key: !!document.querySelector('#xxt-v41-ziwei [data-z=aikey]'), chips: [...document.querySelectorAll('#xxt-v41-ziwei .zw-chip')].map((x) => x.textContent) }));
    assert(/不是原网站校对过的断语/.test(ai0.note) && ai0.key && ai0.chips.join('') === '命格性格感情事业财运健康', `AI 区块初始状态不对：${JSON.stringify(ai0)}`);
    await p.click('#xxt-v41-ziwei .zw-chip[data-topic=career]'); await sleep(300);
    assert(calls.length === 0, '没填 Key 就调用了 DeepSeek');
    // 填 Key 保存：和答题辅助共用同一个存储，保存后直接生成已选的主题
    await p.fill('#xxt-v41-ziwei [data-z=aikey]', 'sk-test-ziwei-1234');
    await p.click('#xxt-v41-ziwei [data-zact=aikeysave]');
    await p.waitForFunction(() => document.querySelector('#xxt-v41-ziwei .zw-ai-out'), null, { timeout: 8000 });
    assert(await p.evaluate(() => localStorage.getItem('xxt-v41-deepseek-key')) === 'sk-test-ziwei-1234', 'Key 没有存到答题辅助共用的位置');
    assert(calls.length === 1 && calls[0].auth === 'Bearer sk-test-ziwei-1234' && !calls[0].fmt, `调用不对：${JSON.stringify(calls.map((c) => c.auth))}`);
    assert(/「事业」/.test(calls[0].user) && /官禄/.test(calls[0].user) && /不要编造古籍原文/.test(calls[0].system), '提示词不对');
    const out1 = await p.evaluate(() => ({ h: [...document.querySelectorAll('#xxt-v41-ziwei .zw-ai-out h4')].map((x) => x.textContent), t: document.querySelector('#xxt-v41-ziwei .zw-ai-out').textContent }));
    assert(out1.h.join('|') === '事业定性|建议' && /第1次生成/.test(out1.t) && !/\*\*/.test(out1.t), `解读渲染不对：${JSON.stringify(out1)}`);
    // 切到别的宫位再回来、再点同一主题：用缓存，不重复调用
    await p.click('#xxt-v41-ziwei .zw-cell[data-br="11"]'); await sleep(200);
    await p.click('#xxt-v41-ziwei .zw-chip[data-topic=career]'); await sleep(300);
    assert(calls.length === 1 && /第1次生成/.test(await p.evaluate(() => document.querySelector('#xxt-v41-ziwei .zw-ai-out').textContent)), '同一主题重复调用了 DeepSeek');
    assert(await p.evaluate(() => /✓/.test(document.querySelector('#xxt-v41-ziwei .zw-chip[data-topic=career]').textContent)), '已生成的主题没有打勾');
    // 重新生成
    await p.click('#xxt-v41-ziwei [data-zact=airegen]');
    await p.waitForFunction(() => /第2次生成/.test(document.querySelector('#xxt-v41-ziwei .zw-ai-out')?.textContent || ''), null, { timeout: 8000 });
    // 刷新页面后缓存还在（存在本机）
    await p.reload(); await inject(p); await sleep(1500);
    await p.click('#xxt-v41-side [data-s=handle]'); await sleep(300);
    await p.click('#xxt-v41-side [data-s=ziwei]');
    await p.waitForFunction(() => window.XxtZiwei);
    await p.click('#xxt-v41-ziwei [data-z=go]'); await sleep(400);
    await p.click('#xxt-v41-ziwei .zw-chip[data-topic=career]'); await sleep(300);
    assert(calls.length === 2 && /第2次生成/.test(await p.evaluate(() => document.querySelector('#xxt-v41-ziwei .zw-ai-out')?.textContent || '')), '刷新后没有用缓存');
    // 出错：显示原因和重试
    mode = '401';
    await p.click('#xxt-v41-ziwei .zw-chip[data-topic=love]');
    await p.waitForFunction(() => document.querySelector('#xxt-v41-ziwei [data-z=ai] .zw-msg.err'), null, { timeout: 8000 });
    const err = await p.evaluate(() => document.querySelector('#xxt-v41-ziwei [data-z=ai] .zw-msg.err').textContent);
    assert(/401/.test(err) && /Key 无效/.test(err), `错误提示不对：${err}`);
    mode = 'ok';
    await p.click('#xxt-v41-ziwei [data-z=ai] [data-zact=airegen]');
    await p.waitForFunction(() => document.querySelector('#xxt-v41-ziwei .zw-ai-out'), null, { timeout: 8000 });
    assert(/「感情」/.test(calls[calls.length - 1].user), '重试的主题不对');
    // 换一张盘：主题选择清空，不会把上一张盘的解读当成这张的
    await p.click('#xxt-v41-ziwei [data-zact=edit]'); await sleep(200);
    await p.fill('#xxt-v41-ziwei [data-z=year]', '1991');
    await p.click('#xxt-v41-ziwei [data-z=go]'); await sleep(400);
    const ai2 = await p.evaluate(() => ({ out: !!document.querySelector('#xxt-v41-ziwei .zw-ai-out'), on: document.querySelectorAll('#xxt-v41-ziwei .zw-chip.on').length, done: document.querySelectorAll('#xxt-v41-ziwei .zw-chip.done').length }));
    assert(!ai2.out && ai2.on === 0 && ai2.done === 0, `换盘后还显示旧解读：${JSON.stringify(ai2)}`);
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
