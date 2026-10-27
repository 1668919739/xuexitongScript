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
    assert(/唱片机/.test(info.whatsnew) && /还有 \d+ 项改进/.test(info.whatsnew), `更新内容不对：${info.whatsnew}`);
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

test('唱片机：从浮窗打开侧边栏，添加本地音乐，点列表即播放，刷新后列表还在', async (b) => {
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
        return { open: d.classList.contains('open'), playing: d.classList.contains('playing'), items: [...d.querySelectorAll('.xm-name')].map((e) => e.textContent),
            cur: (d.querySelector('.xm-item.cur .xm-name') || {}).textContent || '', title: d.querySelector('[data-m=title]').textContent,
            rightOfPanel: r.left >= pr.right, paused: app._audio ? app._audio.paused : true };
    });
    await p.click('#xxt-v41-panel [data-k=musicbtn]'); await sleep(600);
    let s = await st();
    assert(s && s.open && s.items.length === 0 && s.rightOfPanel, `唱片机没有在浮窗旁打开：${JSON.stringify(s)}`);
    await p.setInputFiles('#xxt-v41-music [data-m=file]', [
        { name: '晨读.wav', mimeType: 'audio/wav', buffer: wav(3) },
        { name: '午后钢琴.wav', mimeType: 'audio/wav', buffer: wav(3) },
    ]);
    await sleep(1200);
    s = await st();
    assert(s.items.join('|') === '晨读|午后钢琴' && s.playing && !s.paused && s.cur === '晨读', `添加后没有开始播放：${JSON.stringify(s)}`);
    // 点列表里的第二首即播放
    await p.click('#xxt-v41-music .xm-item:nth-child(2)'); await sleep(800);
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
    await p.click('#xxt-v41-panel [data-k=musicbtn]'); await sleep(1000);
    s = await st();
    assert(s.items.join('|') === '晨读|午后钢琴', `刷新后列表丢失：${JSON.stringify(s)}`);
    // 移除一首
    await p.hover('#xxt-v41-music .xm-item:nth-child(1)');
    await p.click('#xxt-v41-music .xm-item:nth-child(1) .xm-del'); await sleep(600);
    assert((await st()).items.join('|') === '午后钢琴', '移除没生效');
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
