// ==UserScript==
// @name         学习通自动刷课脚本 V4.1
// @namespace    local.codex.xuexitong
// @version      4.5.0
// @description  自动播放、卡顿分级恢复、防暂停拉扯、运行状态浮窗、课件自动翻看、直播回放保活、自动切换下一节，并在页面结构异常时安全停止
// @author       RouteCC
// @match        *://mooc1.chaoxing.com/mycourse/studentstudy*
// @match        *://*.chaoxing.com/mycourse/studentstudy*
// @match        *://*.chaoxing.com/mooc2-ans/mycourse/studentstudy*
// @match        *://zhibo.chaoxing.com/*
// @match        *://i.chaoxing.com/base*
// @match        *://mooc2-ans.chaoxing.com/*visit/interaction*
// @include      /^https?:\/\/live[\w-]*\.chaoxing\.com\//
// @updateURL    https://cdn.jsdelivr.net/gh/1668919739/xuexitongScript@master/v3_optimized.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/1668919739/xuexitongScript@master/v3_optimized.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 只在顶层页面运行；唯一例外是直播回放页里跨域嵌入的播放器（live*.chaoxing.com）
    const IS_LIVE_PLAYER = /^live[\w-]*\.chaoxing\.com$/i.test(location.hostname);
    if (window.top !== window && !IS_LIVE_PLAYER) return;

    // 版本号唯一来源：浮窗徽章和油猴 @version 都从这里读取，发版时只改这一处
    const VERSION = '4.5.0';
    // 更新记录：更新后浮窗显示新增内容，设置里可以查看全部历史（同步记录在 CHANGELOG.md，新版本加在最上面）
    // date：发布日期；note：作者 RouteCC 的吐槽（可选）
    const CHANGELOG = [
        { v: '4.5.0', date: '2026-10-27', note: '谁会在这里塞一个音乐播放器啊？？？怎么还有音频格式转换器？？？浮窗主题颜色自定义？这个东西有人用得上吗。。。我认为浮窗可随意拉动的确是个实用的功能，直接盖住整个学习通页面哈哈', items: [
            '唱片机新增「格式转换」：把音频或视频（MP3、M4A、AAC、FLAC、WAV、OGG、OPUS、MP4 等）转成 MP3（128~320 kbps）或 WAV，可选采样率和声道，转完自动加入唱片机，也可下载到电脑；添加音乐时遇到放不了的文件会自动放进转换列表。全部在本机浏览器里完成，不上传文件；音乐软件的加密格式不提供转换',
            '唱片机内置 5 种环境音：轻钢琴（专注）、窗外雨声、海浪、壁炉篝火、粉红噪音，由浏览器实时合成，不用下载、没有版权问题，打开就能听；唱片机改为紧挨着侧边功能栏展开',
            '浮窗右侧边缘新增可拉出的功能栏（点小把手展开），放着不常用的功能：唱片机、更新记录、反馈问题；浮窗靠屏幕右边时自动改到左侧。唱片机：从电脑里添加音乐（可多选、可拖进来），点列表即播放；黑胶唱片随播放转动、唱臂落下，支持上一首/下一首、进度、音量和列表循环/单曲循环/随机播放。音乐只保存在本机浏览器里，不上传',
            '浮窗主题：设置里可选清爽蓝、薄荷绿、樱花粉、星空紫、奶茶棕、夜间、跟随系统，以及「自定义」——用调色盘自由选主色（也有 12 种常用色一键选），可选浅色或深色底，按钮文字颜色会自动调整保证看得清；选择会被记住',
            '进度条里“需手动完成”的一段改为斜纹，并和“已完成”之间留一道缝；自定义主色接近橙色或黄色时，这一段自动换成紫色，不会混在一起',
            '修复：浮窗拉窄时，标题栏的按钮和版本号重叠（版本号会自动换到标题下一行）；学习通页面自带的按钮样式不再影响浮窗里的按钮',
            '浮窗可以拖动四边和四角自由放大缩小（最大可铺满整个页面），适合开启学习助手当作学习页面，或用来遮住页面上不想被看到的位置；大小会被记住。调过大小后标题栏会出现「还原大小」按钮，也可以双击右下角，或按 Alt+Shift+R 让浮窗回到默认位置和大小',
            '更新后浮窗显示这次更新了什么（跨多个版本时一并列出），关掉之前刷新页面也会一直显示',
            '设置里新增「更新记录」，可查看每个版本更新的内容和发布日期；更新说明和更新记录里还有作者 RouteCC 的吐槽',
            '后台防卡顿（默认开启，可在设置里关闭）：页面真正转到后台时，视频改为极小音量（3%）播放，回到前台恢复静音。浏览器不会给“正在播放声音”的页面限速、冻结或暂停视频；若浏览器不允许取消静音，自动恢复静音播放',
            '运行时持有一个保活锁（Web Lock），减少页面被浏览器冻结 / 丢弃',
            '诊断信息增加后台状态：防卡顿是否生效、后台被暂停次数、保活锁、当前前后台',
            '设置面板内容较多时可以滚动，小屏幕上也能完整显示；浮窗只在比屏幕还高时才内部滚动，版本号气泡不再被遮住',
        ] },
        { v: '4.4.3', date: '2026-10-26', items: [
            '提示音分两种：弹题、页面要求操作、登录过期等需要处理时，响急促的高低双音警示音（每 15 秒重复直到处理完）；课程完成、目标达成等普通提醒仍是柔和的两声',
        ] },
        { v: '4.4.2', date: '2026-10-26', items: [
            '浮窗设置（齿轮）里新增「反馈问题 / 提建议」：写下问题或建议，可一键复制发给作者，或在 GitHub 打开填好的 Issue；问题反馈默认附带诊断信息（不含账号和网址参数），只在点击时生成，不会自动发送',
        ] },
        { v: '4.4.1', date: '2026-10-26', items: [
            '关闭学习助手时，状态框里重新显示课程进度和预计剩余时间；打开学习助手时显示在「课程」页',
        ] },
        { v: '4.4.0', date: '2026-10-26', note: '浮窗现在长得更像正经学习工具，虽然这部分功能一般都用不上。。。但它的确是个实用的改动（比如我不希望陌生人看到我在刷课）', items: [
            '浮窗新增「学习助手」总开关（状态框下方），打开后分「今天 / 课程 / 记录」三个标签页，关闭则只保留一行学习时长',
            '  今天：今日目标进度环（30 / 60 / 90 / 120 分钟可选）、本节笔记（自动保存在本机）',
            '  课程：课程进度环与剩余时间、待手动完成的测验 / 讨论清单、按章节整理的笔记，可一键复制全部笔记',
            '  记录：今日 / 本周 / 连续天数 / 累计时长、近 7 天柱状图、最近 12 周学习日历',
            '休息提醒（连续学习 45 分钟提醒一次，默认关闭，可在设置里开启）；完成今日目标、学完一章时给出小结',
            '状态文字改为学习口吻（学习中、阅读课件、本节完成进入下一节…）；倍速移入设置',
            '收起后只保留一条，显示状态和课程进度',
            '过渡动画：浮窗打开时淡入上浮并轻微放大；收起、展开、切换标签页、打开设置时尺寸平滑过渡，新内容淡入（系统开启“减少动态效果”时不播放）',
            '后台卡顿：恢复播放、进入下一节、翻课件等延时动作改由后台线程（Worker）计时，不再被浏览器对后台页面的限速拖慢；回到前台时立即补一次检查',
            '后台被限速时，提示把 chaoxing.com 加入浏览器“始终保持活动”的网站',
            '修复：收起 / 展开按钮在部分浏览器点击无效',
            '页面开着时每 3 小时检查一次新版本（原为 6 小时），控制台版和油猴版都会在小节之间静默更新',
            '切换标签页时浮窗高度保持不变，不再上下跳动；标签切换改为滑块 + 淡入，整体动画放慢、更柔和',
            '默认倍速改为 2x（已经手动选过倍速的保持原选择；课程限制倍速时自动按页面允许的速度播放）',
            '弹题、页面要求操作、登录过期等需要处理时，提示音每 15 秒重复一次，直到处理完',
        ] },
        { v: '4.3.1', date: '2026-10-26', note: 'GitHub 在国内实在太慢，现在全换成 jsDelivr，避免更新卡顿。', items: [
            '油猴版的安装和自动更新改为走 jsDelivr（国内 CDN），不再依赖 GitHub，避免访问超时导致更新失败',
        ] },
        { v: '4.3.0', date: '2026-10-26', items: [
            '课程总进度：浮窗显示已完成 / 总小节数和进度条，并根据看过的视频时长估算剩余时间',
            '看完视频但还剩章节测验、讨论等手动任务的小节，单独统计为“需手动完成”（进度条橙色段，鼠标悬停可看清单），不计入剩余时间；手动补完后自动移出',
            '设置面板（浮窗右上角齿轮）：自动更新、自动打开直播回放、静音播放、提示音、系统通知，设置会被记住',
            '一键复制诊断信息（版本、状态、视频、设置、最近日志，不含网址参数），方便在 Issues 里反馈',
            '需要人工处理（弹题、验证、登录过期）或课程完成时，播放提示音 / 弹出系统通知',
            '检测到登录过期时提醒重新登录',
            '浮窗可以按住标题栏拖动，位置会被记住，可在设置里一键回到左下角',
            '主循环计时改为在后台线程（Web Worker）运行，页面在后台时更不容易变慢',
            '学习记录：浮窗显示今日 / 本周学习时长和连续学习天数，点开可看近 7 天柱状图；课程完成时显示总学习时长和天数（数据只存在本机浏览器）',
            '课程列表页总览：在学习通“课程”页显示共几门课、已完成 / 进行中，列出最多 15 门进行中的课程（超出部分可滚动查看），一键“继续上次的课程”',
            '控制台版使用一段时间后，提示可改用油猴版（打开课程自动运行、自动更新），可关闭且不再出现',
        ] },
        { v: '4.2.8', date: '2026-10-26', items: [
            '页面在后台导致脚本变慢时，回到前台后浮窗给出提示',
            '静默更新或油猴更新后，浮窗短暂显示这一版的更新说明',
            '版本号气泡增加“反馈问题”提示',
        ] },
        { v: '4.2.7', date: '2026-10-25', items: [
            '课程页自动打开未完成的直播回放（一次一个），被浏览器拦截时显示“打开直播回放”按钮',
            '课程页浮窗显示直播回放完成情况',
            '回放页正确识别播放器的进度消息，浮窗显示观看进度',
            '回放页手动停止时显示“已停止”',
        ] },
        { v: '4.2.6', date: '2026-10-25', items: [
            '浮窗右上角一键停止 / 继续',
            '浮窗淡入上浮出场动画',
        ] },
        { v: '4.2.5', date: '2026-10-25', items: [
            '静默更新改为直接获取新版代码，不依赖版本标签',
        ] },
        { v: '4.2.4', date: '2026-10-25', items: [
            '版本号显示与悬停气泡，点击打开仓库',
            '发现新版本时版本号变黄，在两个小节之间自动静默更新',
            '倍速选择（1x / 1.25x / 1.5x / 2x），点击“倍速”展开，记住选择',
            '油猴版指定从 GitHub 检查更新',
        ] },
        { v: '4.2.0–v4.2.3', date: '2026-10-24', items: [
            'PPT 课件自动翻看、点进即完成的资料页自动跳过',
            '直播回放保活，适配跨域播放器',
            '浮窗显示当前章节进度',
        ] },
        { v: '4.1.x', date: '2026-10-24', note: '一切的起点：本来只想找个现成的版本自己用。但是那个版本有BUG，视频老是卡住、暂停又播放，被逼得自己动手改。', items: [
            '状态浮窗（白色卡片样式），显示播放状态、进度、倍速',
            '修复视频卡住、“暂停-播放”反复拉扯、重复跳节等问题（已提交原仓库 PR #76）',
        ] },
    ];
    // 版本号区间（如 4.2.0–4.2.3、4.1.x）取上限，用于比较
    const changelogTop = (label) => String(label).split('–').pop().replace(/x/gi, '99');
    const changelogSince = (from) => CHANGELOG.filter((e) => newerThan(changelogTop(e.v), from) && !newerThan(changelogTop(e.v), VERSION));
    const REPO_URL = 'https://github.com/1668919739/xuexitongScript';
    // 检查新版本：GitHub 最及时，jsDelivr 作为国内备用
    const VERSION_URLS = [
        'https://raw.githubusercontent.com/1668919739/xuexitongScript/master/version.json',
        'https://cdn.jsdelivr.net/gh/1668919739/xuexitongScript@master/version.json',
    ];
    // 静默更新时获取新版代码：GitHub 原始文件最及时（需核对版本号），jsDelivr 作为备用
    const SCRIPT_RAW_URL = 'https://raw.githubusercontent.com/1668919739/xuexitongScript/master/v3_optimized.js';
    const SCRIPT_CDN_URL = 'https://cdn.jsdelivr.net/gh/1668919739/xuexitongScript@master/v3_optimized.js';
    const newerThan = (a, b) => {
        const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const x = pa[i] || 0, y = pb[i] || 0;
            if (x !== y) return x > y;
        }
        return false;
    };

    const APP_KEY = '__xuexitongPlayerV4';
    // 浏览器原生的“页面是否隐藏”，不受脚本对 document.hidden 的伪装影响
    const NATIVE_HIDDEN = (() => { try { return Object.getOwnPropertyDescriptor(Document.prototype, 'hidden').get; } catch (e) { return null; } })();
    const reallyHidden = () => { try { return NATIVE_HIDDEN ? !!NATIVE_HIDDEN.call(document) : false; } catch (e) { return false; } };
    const BOOT_TIMER_KEY = '__xuexitongPlayerV4BootTimer';
    const NS = '.xuexitongPlayerV4';

    // 清理旧版本实例，避免多个脚本同时抢控制权
    for (const key of ['__xuexitongPlayerV3', APP_KEY]) {
        const prev = window[key];
        if (prev && typeof prev.destroy === 'function') {
            try { prev.destroy(); } catch (e) { /* ignore */ }
        }
    }
    for (const key of ['__xuexitongPlayerV3BootTimer', BOOT_TIMER_KEY]) {
        if (window[key]) { clearInterval(window[key]); window[key] = null; }
    }

    if (typeof window.jQuery === 'undefined') {
        const s = document.createElement('script');
        s.src = 'https://code.jquery.com/jquery-3.6.0.min.js';
        s.onload = waitForCoursePage;
        s.onerror = () => console.error('jQuery 加载失败，请检查网络');
        document.head.appendChild(s);
    } else {
        waitForCoursePage();
    }

    function waitForCoursePage() {
        const $ = window.jQuery;
        let attempts = 0;
        const isLive = /(^|\.)zhibo\.chaoxing\.com$/i.test(location.hostname) || IS_LIVE_PLAYER;
        // 课程列表页：个人空间（i.chaoxing.com，课程在内嵌页面里）或直接打开的课程列表
        const isList = /^i\.chaoxing\.com$/i.test(location.hostname) || /\/visit\/interaction/i.test(location.pathname);
        window[BOOT_TIMER_KEY] = setInterval(() => {
            if (isLive && document.body) {
                clearInterval(window[BOOT_TIMER_KEY]);
                window[BOOT_TIMER_KEY] = null;
                const app = createApp($);
                window.app = app;
                window[APP_KEY] = app;
                app.startLive(IS_LIVE_PLAYER);
                return;
            }
            if (isList && document.body) {
                clearInterval(window[BOOT_TIMER_KEY]);
                window[BOOT_TIMER_KEY] = null;
                const app = createApp($);
                window.app = app;
                window[APP_KEY] = app;
                app.startList();
                return;
            }
            if ($('#coursetree').length > 0) {
                clearInterval(window[BOOT_TIMER_KEY]);
                window[BOOT_TIMER_KEY] = null;
                const app = createApp($);
                window.app = app;
                window[APP_KEY] = app;
                app.start();
                return;
            }
            if (++attempts >= 20) {
                clearInterval(window[BOOT_TIMER_KEY]);
                window[BOOT_TIMER_KEY] = null;
                console.error('%c脚本启动超时：未检测到课程目录（#coursetree）。请确认当前处于课程播放页、课程列表页或直播回放页。', 'color:#F44336;font-weight:bold');
            }
        }, 1000);
    }

    function createApp($) {
        const C = {
            playbackRate: 2,            // 期望倍速（默认 2x，课程限制倍速时自动按页面允许的速度播放）
            fallbackRate: 1.0,          // 卡顿时的降级倍速
            muted: true,                // 接管时静音（浏览器自动播放策略要求）
            tickMs: 1000,               // 状态检查间隔
            stallMs: 8000,              // 非缓冲状态下多久无进度判定为卡住
            bufferingStallMs: 20000,    // 缓冲（加载中）状态下多久无进度才处理，缓冲是正常现象，不要太早干预
            pauseResumeDelayMs: 300,    // 页面暂停后多快恢复（事件驱动，不再等 1 秒轮询）
            pausedFallbackMs: 2500,     // 轮询兜底：暂停超过这么久仍未恢复则再试一次
            resumeCooldownMs: 1500,     // 两次恢复播放的最小间隔
            blockedPauseCount: 3,       // 同一位置被页面暂停几次判定为“页面要求处理”
            blockedWindowMs: 10000,     // 上述统计的时间窗口
            finishSettleMs: 1500,       // 视频结束后等待任务点状态刷新的时间
            unitLoadTimeoutMs: 20000,   // 小节加载后多久仍无视频视为“无视频小节”
            maxReloadPerUnit: 3,        // 每个小节最多重载视频次数
            autoAdvanceNoVideo: false,  // 无视频小节是否自动跳过
            skipFinishedVideos: true,   // 跳过已完成任务点的视频
            guardFocus: true,           // 让各层页面认为窗口始终可见/有焦点
            debugPause: false,          // 开启后打印每次 pause() 的调用栈，用于定位是谁暂停了视频
            showPanel: true,            // 页面左下角显示运行状态浮窗
            alertSound: true,           // 需要人工处理 / 课程完成时播放提示音
            alertNotify: false,         // 同时弹出系统通知（需要浏览器授权）
            bgAudio: true,              // 后台防卡顿：页面在后台时以极小音量播放（浏览器不会给“正在播放声音”的页面限速、冻结或暂停视频）
            bgVolume: 0.03,             // 后台防卡顿时的音量（0~1）
            alertRepeatMs: 15000,       // 需要人工处理时，每隔多久再响一次提示音，直到处理完
            completedPageDwellMs: 2000, // 无视频且已完成的小节，停留多久后进入下一小节
            readDocs: true,             // 自动翻看课件（PPT/PDF/文档）任务点：逐步滚动到底部
            docStepMs: 700,             // 课件每次滚动的间隔
            docMaxSteps: 400,           // 每份课件最多滚动次数
            liveStallMs: 20000,         // 直播回放多久无进度判定为卡住
            autoOpenLive: true,         // 课程页发现未完成的直播回放时，自动打开回放标签页（被浏览器拦截时显示按钮）
            autoUpdate: true,           // 发现新版本后，在两个小节之间自动静默更新（不打断正在播放的视频）
            assistMode: true,           // 学习助手总开关：今日目标、笔记、学习记录、休息提醒
            theme: 'light',             // 浮窗主题：light / mint / sakura / violet / latte / dark / auto / custom
            customColor: '#3B82F6',     // 自定义主题的主色
            customBase: 'light',        // 自定义主题的底色：light 浅色 / dark 深色
            dailyGoal: 60,              // 每日学习目标（分钟）
            breakRemind: false,         // 连续学习一段时间后提醒休息（默认关闭）
            breakAfterMin: 45,          // 连续学习多少分钟提醒休息
            videoSelector: 'video#video_html5_api, video[id*="video_html5"], .video-js video',
            quizSelector: '[class*="videoquiz"]', // 视频内弹题浮层
        };

        // 浮窗里选择的倍速保存在本地，刷新页面、换课程后保持
        const RATE_KEY = 'xxt-v41-rate';
        const SEEN_KEY = 'xxt-v41-seen-version';
        const WHATSNEW_KEY = 'xxt-v41-whatsnew';
        const SETTINGS_KEY = 'xxt-v41-settings';
        const POS_KEY = 'xxt-v41-panel-pos';
        const SIZE_KEY = 'xxt-v41-panel-size';
        const PANEL_MIN_W = 300, PANEL_MIN_H = 140;
        const STATS_KEY = 'xxt-v41-stats';
        const TMHINT_KEY = 'xxt-v41-tm-hint-dismissed';
        const LAST_KEY = 'xxt-v41-last-course';
        const NAMES_KEY = 'xxt-v41-course-names';
        const NOTES_PREFIX = 'xxt-v41-notes-';
        const GOAL_OPTIONS = [30, 60, 90, 120];
        // 浮窗主题：每个主题只换一组颜色变量；“跟随系统”在浅色 / 深色之间自动切换
        const THEMES = [
            ['light', '清爽蓝', '#3B82F6'],
            ['mint', '薄荷绿', '#10B981'],
            ['sakura', '樱花粉', '#EC4899'],
            ['violet', '星空紫', '#8B5CF6'],
            ['latte', '奶茶棕', '#B4835A'],
            ['dark', '夜间', '#1E232B'],
            ['auto', '跟随系统', ''],
            ['custom', '自定义', ''],
        ];
        const THEME_SWATCH = { auto: 'linear-gradient(135deg,#fff 0 50%,#1E232B 50%)', custom: 'conic-gradient(#EF4444,#F59E0B,#10B981,#3B82F6,#8B5CF6,#EC4899,#EF4444)' };
        // 自定义主色上用白字还是深色字：按亮度自动选择，保证看得清
        // 自定义主色接近橙 / 黄时，“需手动完成”改用紫色，避免和主色混在一起
        const manualFor = (hex) => {
            const n = parseInt(String(hex).slice(1), 16);
            const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
            if (d < 0.12) return '#F5A524';                       // 灰色系：保持橙色
            let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
            h = (h * 60 + 360) % 360;
            return h >= 10 && h <= 65 ? '#8B5CF6' : '#F5A524';
        };
        const onAccent = (hex) => {
            const n = parseInt(String(hex).slice(1), 16);
            const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
            const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
            return L > 0.45 ? '#111827' : '#fff';
        };
        const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const fmtShort = (sec) => {
            sec = Math.round(sec);
            const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
            return h ? `${h}小时${m ? m + '分' : ''}` : `${m}分钟`;
        };
        const fmtDur = (sec) => {
            sec = Math.round(sec);
            if (sec < 60) return `${sec} 秒`;
            const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
            return h ? `${h} 小时${m ? ' ' + m + ' 分钟' : ''}` : `${m} 分钟`;
        };
        // 设置面板里可以开关的项，保存在本地
        const SETTING_ITEMS = [
            ['autoUpdate', '自动更新', '发现新版本后，在两个小节之间自动静默更新'],
            ['autoOpenLive', '自动打开直播回放', '有未完成的直播回放时自动打开回放页'],
            ['muted', '静音播放', '接管视频时静音（关闭后浏览器可能阻止自动播放）'],
            ['bgAudio', '后台防卡顿', '切到别的窗口时以极小音量播放，浏览器就不会给页面限速、暂停视频'],
            ['alertSound', '提示音', '需要处理时（弹题等）响急促的警示音，每 15 秒一次直到处理完；完成等普通提醒响柔和的提示音'],
            ['alertNotify', '系统通知', '切到别的窗口也能收到提醒（需要允许通知）'],
            ['breakRemind', '休息提醒', '连续学习 45 分钟后，提醒起来活动一下'],
        ];
        try {
            const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
            for (const [k] of SETTING_ITEMS) if (typeof saved[k] === 'boolean') C[k] = saved[k];
            if (GOAL_OPTIONS.includes(saved.dailyGoal)) C.dailyGoal = saved.dailyGoal;
            if (typeof saved.assistMode === 'boolean') C.assistMode = saved.assistMode;
            if (typeof saved.theme === 'string' && THEMES.some((t) => t[0] === saved.theme)) C.theme = saved.theme;
            if (/^#[0-9a-f]{6}$/i.test(saved.customColor || '')) C.customColor = saved.customColor;
            if (saved.customBase === 'light' || saved.customBase === 'dark') C.customBase = saved.customBase;
        } catch (e) { /* 读取失败时使用默认设置 */ }
        const saveSettings = () => {
            try {
                const o = {};
                for (const [k] of SETTING_ITEMS) o[k] = C[k];
                o.dailyGoal = C.dailyGoal;
                o.assistMode = C.assistMode;
                o.theme = C.theme;
                o.customColor = C.customColor;
                o.customBase = C.customBase;
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(o));
            } catch (e) { /* ignore */ }
        };
        const RATE_OPTIONS = [1, 1.25, 1.5, 2];
        try {
            const saved = parseFloat(localStorage.getItem(RATE_KEY));
            if (RATE_OPTIONS.includes(saved)) C.playbackRate = saved;
        } catch (e) { /* 无法读取本地存储时使用默认倍速 */ }

        // 最近的日志保存在内存里，“复制诊断信息”时一起带上
        const LOGS = [];
        const log = (msg, color = '#607D8B', level = 'log') => {
            const d = new Date();
            LOGS.push(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} ${level === 'log' ? '' : '[' + level + '] '}${msg}`);
            if (LOGS.length > 80) LOGS.shift();
            console[level](`%c[学习通V4.1] ${msg}`, `color:${color}`);
        };

        const app = {
            configs: C,
            _timer: null,
            _timeouts: new Set(),
            _token: 0,
            _state: 'idle', // idle | loading | waiting | playing | advancing | stopped
            _video: null,
            _videoFrameEl: null,
            _boundVideo: null,
            _videoHandlers: null,
            _doneVideos: new WeakSet(),
            _staleVideos: new WeakSet(),
            _guarded: [],
            _pauseTracers: [],
            _clicking: false,
            _origTitle: document.title,
            _title: '',
            _unitStartTs: 0,
            _ignoreUntil: 0,
            _selfActionUntil: 0,
            _lastTime: 0,
            _lastProgressTs: 0,
            _lastResumeTs: 0,
            _lastStallTs: 0,
            _lastStepClickTs: 0,
            _pausedSince: 0,
            _waiting: false,
            _pauseLog: [],
            _blocked: false,
            _blockedAt: 0,
            _stallLevel: 0,
            _reloadCount: 0,
            _stepTried: 0,
            _testAdvanceTimes: 0,
            _quizNotified: false,
            _rate: C.playbackRate,
            _rateResets: 0,
            _rateGaveUp: false,
            _note: '',
            _noVideoWait: false,
            _latest: null,
            _updating: false,
            _updateFailed: false,
            _ratesOpen: false,
            _userStopped: false,
            _lastTickTs: 0,
            _notice: null,
            _settingsOpen: false,
            _progress: null,
            _progressTs: 0,
            _loginExpired: false,
            _processedTitle: '',
            _lastActiveTitle: '',
            _lastAlertKey: '',
            _audioCtx: null,
            _stats: null,
            _statsDirty: 0,
            _statsOpen: false,
            _prevDone: null,
            _courses: null,
            _coursesTs: 0,
            _lives: [],
            _liveOpened: new WeakSet(),
            _liveScanTs: 0,
            _liveBlocked: false,
            _updateTimer: null,
            _mode: 'course',
            _docsDone: false,
            _docProgress: null,
            _panel: null,
            _panelCollapsed: false,
            _panelKey: '',

            // ================= 公共方法 =================
            start() {
                log(`=== 学习通自动播放脚本 V4.1 启动 === v${VERSION} · 源码 ${REPO_URL}`, '#4CAF50');
                this._bindPageEvents();
                this._startTimer();
                this._enterLoading('start');
                this._showUpdatedNotice();
                this._renderPanel();
                this._startUpdateCheck();
                this._maybeTmHint();
                this._rememberLastCourse();
            },
            run() {
                this._userStopped = false;
                if (!this._timer) this._startTimer();
                if (this._mode === 'live') {
                    this._video = null;
                    this._state = 'loading';
                } else {
                    this._enterLoading('start');
                }
                log('已恢复运行', '#4CAF50');
                this._panelKey = '';
                this._renderPanel();
            },
            stop() {
                this._userStopped = true;
                this._stop();
                this._note = '学习已暂停，点击右上角 ▶ 继续';
                log('脚本已停止，点击浮窗右上角的 ▶ 或执行 app.run() 继续', '#FF9800');
                this._panelKey = '';
                this._renderPanel();
            },
            nextUnit() {
                const idx = this._currentIndex();
                if (idx < 0) {
                    log('未找到当前激活的小节，请手动点击一个小节，脚本会自动接管', '#FF9800', 'warn');
                    this._state = 'waiting';
                    this._note = '未找到当前小节，请手动点击一个小节';
                    return;
                }
                this._goToNode(idx + 1);
            },
            // 选择倍速（浮窗按钮调用，也可在控制台执行 app.setRate(2)）
            setRate(r) {
                r = Number(r);
                if (!(r > 0 && r <= 4)) return;
                C.playbackRate = r;
                try { localStorage.setItem(RATE_KEY, String(r)); } catch (e) { /* ignore */ }
                this._rateGaveUp = false;
                this._rateResets = 0;
                this._rate = r;
                if (this._mode !== 'live' && this._isValid(this._video)) this._setRate(this._video, r);
                log(`倍速已设为 ${r}x`, '#2196F3');
                this._panelKey = '';
                this._renderPanel();
            },
            status() {
                const v = this._video;
                console.table({
                    状态: this._blocked ? 'playing(等待手动处理)' : this._state,
                    当前小节: this._title,
                    当前倍速: v ? v.playbackRate : '-',
                    倍速受限: this._rateGaveUp,
                    播放进度: v ? `${(v.currentTime || 0).toFixed(1)} / ${(v.duration || 0).toFixed(1)}` : '-',
                    缓冲中: v ? (v.readyState < 3 || this._waiting) : '-',
                    近10秒被页面暂停次数: this._pauseLog.length,
                    卡顿等级: this._stallLevel,
                    本节重载次数: this._reloadCount,
                });
            },
            destroy() {
                this._removeMusic();
                this._removeSide();
                this._state = 'stopped';
                this._stopTimer();
                this._saveStats(true);
                if (this._onPageHide) window.removeEventListener('pagehide', this._onPageHide);
                if (this._updateTimer) clearInterval(this._updateTimer);
                this._updateTimer = null;
                this._clearTimeouts();
                this._unbindVideoEvents();
                $(document).off(NS);
                for (const g of this._guarded) this._unguard(g);
                this._guarded = [];
                for (const t of this._pauseTracers) {
                    try { t.proto.pause = t.orig; } catch (e) { /* ignore */ }
                }
                this._pauseTracers = [];
                this._removePanel();
                if (this._onLiveMessage) window.removeEventListener('message', this._onLiveMessage);
                document.title = this._origTitle;
            },

            // ================= 定时器（带令牌，切换小节后旧回调自动失效） =================
            _later(fn, ms) {
                const token = this._token;
                const id = this._wait(() => {
                    this._timeouts.delete(id);
                    if (token === this._token && this._state !== 'stopped') fn();
                }, ms);
                this._timeouts.add(id);
                return id;
            },
            _clearTimeouts() {
                for (const id of this._timeouts) this._unwait(id);
                this._timeouts.clear();
            },
            // 不受后台限速影响的 setTimeout：交给 Worker 计时，页面在后台时也能按时恢复播放、进入下一节
            _wait(fn, ms) {
                const t = this._timer;
                if (t && t.worker) {
                    this._waitSeq = (this._waitSeq || 0) + 1;
                    const id = 'w' + this._waitSeq;
                    t.fns.set(id, fn);
                    try { t.worker.postMessage({ id, ms: Math.max(0, ms | 0) }); return id; } catch (e) { t.fns.delete(id); }
                }
                return setTimeout(fn, ms);
            },
            _unwait(id) {
                if (typeof id === 'string') { if (this._timer && this._timer.fns) this._timer.fns.delete(id); }
                else clearTimeout(id);
            },

            // ================= 计时器 =================
            // 主循环放在后台线程（Web Worker）里计时：浏览器对后台标签页的普通定时器限制很严，
            // 对 Worker 宽松得多，页面在后台时也能更及时地恢复播放、切换下一节。创建失败时回退到普通定时器。
            _startTimer() {
                this._stopTimer();
                this._holdLock();
                const fallback = () => {
                    const pending = this._timer && this._timer.fns ? [...this._timer.fns.values()] : [];
                    if (this._timer && this._timer.worker) { try { this._timer.worker.terminate(); URL.revokeObjectURL(this._timer.url); } catch (e) { /* ignore */ } }
                    this._timer = { id: setInterval(() => this._tick(), C.tickMs) };
                    for (const fn of pending) setTimeout(fn, 0);
                };
                try {
                    const url = URL.createObjectURL(new Blob([`setInterval(function(){postMessage(0)},${C.tickMs});onmessage=function(e){var d=e.data;setTimeout(function(){postMessage(d.id)},d.ms)};`], { type: 'text/javascript' }));
                    const worker = new Worker(url);
                    const fns = new Map();
                    worker.onmessage = (e) => {
                        if (e.data === 0) { this._tick(); return; }
                        const fn = fns.get(e.data);
                        if (!fn) return;
                        fns.delete(e.data);
                        try { fn(); } catch (err) { log('定时任务异常: ' + err.message, '#F44336', 'error'); }
                    };
                    worker.onerror = () => { if (this._timer && this._timer.worker === worker) fallback(); };
                    this._timer = { worker, url, fns };
                } catch (e) {
                    fallback();
                }
            },

            // 持有一个 Web Lock：浏览器不会冻结 / 丢弃持有锁的标签页
            _holdLock() {
                if (this._lockRelease || this._mode === 'list') return;
                try {
                    if (!navigator.locks || !navigator.locks.request) return;
                    navigator.locks.request('xxt-v41-keepalive-' + Math.random().toString(36).slice(2), () => new Promise((res) => { this._lockRelease = res; })).catch(() => {});
                } catch (e) { /* ignore */ }
            },
            _releaseLock() {
                if (this._lockRelease) { try { this._lockRelease(); } catch (e) { /* ignore */ } }
                this._lockRelease = null;
            },

            // 后台防卡顿：页面真正转到后台、视频静音播放时，改为极小音量播放；回到前台恢复静音。
            // 浏览器不允许取消静音（会把视频暂停）时，恢复静音并在本页不再尝试。
            _syncBgAudio() {
                const v = this._video;
                const want = C.bgAudio && C.muted && this._mode === 'course' && !this._userStopped && !this._bgAudioBlocked &&
                    this._state === 'playing' && this._isValid(v) && reallyHidden();
                if (want && !this._bgAudio) {
                    if (!v.muted) return;
                    this._bgAudio = { v, volume: v.volume };
                    try {
                        this._selfActionUntil = Date.now() + 1500;
                        v.volume = C.bgVolume;
                        v.muted = false;
                    } catch (e) { /* ignore */ }
                    log('页面转到后台：以极小音量播放，防止浏览器限速、暂停视频', '#607D8B');
                    this._wait(() => {
                        const b = this._bgAudio;
                        if (b && b.v === v && v.paused && !v.ended) {
                            this._bgAudioBlocked = true;
                            this._restoreBgAudio();
                            log('浏览器不允许在后台取消静音，已恢复静音播放（本页不再尝试）', '#FF9800', 'warn');
                            this._lastResumeTs = 0;
                            this._resume('bg-audio-blocked');
                        }
                    }, 900);
                } else if (!want && this._bgAudio) {
                    this._restoreBgAudio();
                }
            },
            _restoreBgAudio() {
                const b = this._bgAudio;
                this._bgAudio = null;
                if (!b) return;
                try { b.v.muted = true; b.v.volume = b.volume; } catch (e) { /* ignore */ }
            },

            _stopTimer() {
                this._releaseLock();
                const t = this._timer;
                if (!t) return;
                if (t.worker) { try { t.worker.terminate(); URL.revokeObjectURL(t.url); } catch (e) { /* ignore */ } }
                if (t.id) clearInterval(t.id);
                this._timer = null;
            },

            // ================= 主循环 =================
            _tick() {
                const now = Date.now();
                // 定时器间隔被浏览器拉长（页面在后台/最小化）时记录下来，回到前台后提示
                if (this._lastTickTs && now - this._lastTickTs > 8000 && !this._userStopped && this._mode !== 'list') {
                    const sec = Math.round((now - this._lastTickTs) / 1000);
                    if (!this._notice || this._notice.kind !== 'upd') {
                        this._notice = { kind: 'bg', until: now + 45000, text: `页面刚才在后台被浏览器限速，约 ${sec} 秒没能及时运行。把 chaoxing.com 加入浏览器“始终保持活动”的网站（Edge：设置 › 系统和性能 › 睡眠标签页；Chrome：设置 › 性能 › 内存节省程序），并且不要最小化窗口，就不会再变慢` };
                    }
                    log(`页面在后台，定时器被浏览器延迟了 ${sec} 秒`, '#FF9800', 'warn');
                }
                if (this._lastTickTs) {
                    const dt = Math.min(now - this._lastTickTs, 5000) / 1000;
                    this._statTick(dt);
                    this._assistTick(dt);
                }
                this._lastTickTs = now;
                try {
                    this._tickInner();
                    this._syncBgAudio();
                } finally {
                    this._renderPanel();
                }
            },

            _tickInner() {
                if (this._mode === 'live') { this._liveTick(); return; }
                if (this._mode === 'list') { this._scanCourseList(); return; }
                this._maybeAutoUpdate();
                this._scanLiveCards();
                this._scanCourse();
                if (this._updating) return;
                if (this._state === 'stopped' || this._state === 'advancing' || this._state === 'idle' || this._state === 'reading') return;
                try {
                    if (!this._isValid(this._video)) {
                        if (this._video) {
                            log('视频元素已失效（页面已刷新/切换），重新查找', '#FF9800');
                            this._unbindVideoEvents();
                            this._video = null;
                            this._videoFrameEl = null;
                            this._state = 'loading';
                            this._unitStartTs = Date.now();
                        }
                        this._handleLoading();
                        return;
                    }
                    this._handlePlaying();
                } catch (e) {
                    log('状态检查异常: ' + e.message, '#F44336', 'error');
                }
            },

            _handleLoading() {
                const { item, total } = this._pickVideo();
                if (item) { this._attachVideo(item); return; }
                if (total > 0) {
                    if (this._startReadingDocs()) return;
                    log('本页视频均已完成，进入下一小节', '#4CAF50');
                    this._scheduleAdvance(800);
                    return;
                }
                const elapsed = Date.now() - this._unitStartTs;
                const noVideoWait = this._state === 'waiting' && this._noVideoWait;
                if (this._state === 'waiting' && !noVideoWait) return;
                if (elapsed < 3000) return;
                if (!noVideoWait && this._startReadingDocs()) return;

                // 纯文字/资料页：没有视频，进入后平台自动把任务点标记为完成 → 直接进入下一小节
                if (this._activeNodeCompleted()) {
                    log('本节没有视频，任务点已完成，进入下一小节', '#4CAF50');
                    this._scheduleAdvance(C.completedPageDwellMs);
                    return;
                }
                if (noVideoWait) return;

                const step = this._stepTitle();
                if (step === '章节测验') { this._advanceChapterTest(); return; }
                if (step !== '视频' && this._stepTried < 2 && Date.now() - this._lastStepClickTs > 4000) {
                    if (this._clickVideoTab()) return;
                }

                if (elapsed >= C.unitLoadTimeoutMs) {
                    if (C.autoAdvanceNoVideo) {
                        log('当前小节未发现视频，按配置跳到下一小节', '#FF9800', 'warn');
                        this._scheduleAdvance(500);
                    } else {
                        this._state = 'waiting';
                        this._noVideoWait = true;
                        this._note = '当前小节没有视频且任务点未完成，请手动查看，完成后自动继续';
                        log('当前小节未发现视频，已暂停。确认无需完成后执行 app.nextUnit()，或手动切换小节，脚本会自动接管。', '#FF9800', 'warn');
                    }
                }
            },

            _handlePlaying() {
                const v = this._video;
                const now = Date.now();
                const ct = v.currentTime || 0;

                // 1. 视频内弹题：不和弹题抢播放
                if (this._quizVisible(v)) {
                    if (!this._quizNotified) {
                        this._quizNotified = true;
                        document.title = '【待答题】' + this._origTitle;
                        log('检测到视频内弹题，已暂停保活，请手动作答，关闭后自动继续', '#E91E63', 'warn');
                    }
                    this._lastProgressTs = now;
                    return;
                }
                if (this._quizNotified) {
                    this._quizNotified = false;
                    document.title = this._origTitle;
                    this._pauseLog = [];
                    log('弹题已关闭，继续播放', '#4CAF50');
                    this._lastResumeTs = 0;
                    this._resume('after-quiz');
                }

                // 2. 页面在同一位置反复暂停 → 等待手动处理，不再拉扯
                if (this._blocked) {
                    if (!v.paused && Math.abs(ct - this._blockedAt) > 0.5) {
                        this._blocked = false;
                        this._pauseLog = [];
                        document.title = this._origTitle;
                        log('视频已恢复播放，脚本继续接管', '#4CAF50');
                    } else {
                        this._lastProgressTs = now;
                        return;
                    }
                }

                // 3. 播放器报错 → 重载
                if (v.error) { this._reloadVideo(`播放器错误(code=${v.error.code})`); return; }

                // 4. 播放结束（有些情况不触发 ended，用进度兜底）
                if (v.ended || this._nearEnd(v)) {
                    this._onVideoFinished(v);
                    return;
                }

                // 5. 进度检测
                if (Math.abs(ct - this._lastTime) > 0.05) {
                    this._lastTime = ct;
                    this._lastProgressTs = now;
                    this._pausedSince = 0;
                    if (this._stallLevel && now - this._lastStallTs > 20000) this._stallLevel = 0;
                    return;
                }

                // 6. 暂停兜底（正常情况下 pause 事件已在 300ms 内处理）
                if (v.paused) {
                    if (!this._pausedSince) this._pausedSince = now;
                    else if (now - this._pausedSince >= C.pausedFallbackMs) {
                        this._pausedSince = now;
                        this._resume('paused-fallback');
                    }
                } else {
                    this._pausedSince = 0;
                }

                // 7. 卡顿检测：区分“缓冲中”和“真卡死”
                const buffering = !v.paused && (v.readyState < 3 || this._waiting);
                const limit = buffering ? C.bufferingStallMs : C.stallMs;
                if (now - this._lastProgressTs >= limit) this._recover(buffering);
            },

            _nearEnd(v) {
                const dur = v.duration;
                return isFinite(dur) && dur > 0 && (v.currentTime || 0) >= dur - 0.5 && v.paused;
            },

            // ================= 页面暂停处理（事件驱动） =================
            _onPause(v) {
                if (v !== this._video || this._state !== 'playing') return;
                const now = Date.now();
                if (now < this._selfActionUntil) return;      // 脚本自己 seek/重载引起的暂停
                if (v.ended || this._nearEnd(v)) return;
                if (this._quizVisible(v)) return;             // 弹题由主循环处理
                if (reallyHidden()) this._bgPauseCount = (this._bgPauseCount || 0) + 1;

                const ct = v.currentTime || 0;
                this._pauseLog = this._pauseLog.filter((p) => now - p.t < C.blockedWindowMs);
                this._pauseLog.push({ t: now, ct });
                if (C.debugPause) log(`页面暂停了视频 @ ${ct.toFixed(1)}s`, '#9E9E9E');

                const samePos = this._pauseLog.filter((p) => Math.abs(p.ct - ct) < 1.5);
                if (samePos.length >= C.blockedPauseCount) {
                    if (!this._blocked) {
                        this._blocked = true;
                        this._blockedAt = ct;
                        document.title = '【需处理】' + this._origTitle;
                        log('页面在同一位置反复暂停视频，可能出现了弹题、验证或确认框，已停止自动恢复。请手动处理并点击播放，脚本会自动继续。', '#E91E63', 'warn');
                    }
                    return;
                }

                this._later(() => {
                    if (v === this._video && v.paused && !this._blocked && this._state === 'playing') {
                        this._lastResumeTs = 0;
                        this._resume('page-pause');
                    }
                }, C.pauseResumeDelayMs);
            },

            // 倍速：只在接管时设置一次；页面改回去最多再设一次，之后接受页面的倍速，不再来回拉扯
            _onRateChange(v) {
                if (v !== this._video) return;
                if (Math.abs(v.playbackRate - this._rate) < 0.01) return; // 是脚本自己设置的
                this._rateResets++;
                if (this._rateGaveUp || this._rateResets >= 2) {
                    if (!this._rateGaveUp) {
                        log(`课程限制倍速（被页面改回 ${v.playbackRate}x），之后按页面倍速播放，避免反复暂停`, '#FF9800', 'warn');
                    }
                    this._rateGaveUp = true;
                    this._rate = v.playbackRate;
                    return;
                }
                this._later(() => this._setRate(v, this._rate), 500);
            },

            _setRate(v, r) {
                if (!this._isValid(v) || this._rateGaveUp) return;
                this._rate = r;
                try { v.playbackRate = r; } catch (e) { /* ignore */ }
            },

            // 卡顿分级恢复
            _recover(buffering) {
                const v = this._video;
                const now = Date.now();
                this._stallLevel++;
                this._lastStallTs = now;
                this._lastProgressTs = now;
                this._lastTime = v.currentTime || 0;
                this._lastResumeTs = 0;
                const canSlowDown = !this._rateGaveUp && this._rate > C.fallbackRate;
                const lvl = this._stallLevel;

                if (buffering) {
                    // 缓冲慢：不回退进度（回退会丢掉已缓冲内容，反而更卡）
                    if (lvl === 1 && canSlowDown) {
                        log(`网络缓冲较慢，本节倍速降为 ${C.fallbackRate}x`, '#FF5722');
                        this._setRate(v, C.fallbackRate);
                    } else if (lvl <= 1) {
                        log('缓冲时间较长，继续等待', '#FF9800');
                    } else {
                        this._reloadVideo('长时间缓冲无进度');
                    }
                    return;
                }

                if (lvl === 1) {
                    log('播放卡住，尝试恢复播放', '#FF5722');
                    this._resume('stall');
                } else if (lvl === 2) {
                    log('仍然卡住，回退 1 秒重新加载画面', '#FF5722');
                    this._selfActionUntil = now + 1500;
                    try { v.currentTime = Math.max(0, (v.currentTime || 0) - 1); } catch (e) { /* ignore */ }
                    this._resume('rewind');
                } else if (lvl === 3 && canSlowDown) {
                    log(`连续卡顿，本节倍速降为 ${C.fallbackRate}x`, '#FF5722');
                    this._setRate(v, C.fallbackRate);
                    this._resume('slowdown');
                } else {
                    this._reloadVideo('连续卡顿');
                }
            },

            _resume(reason) {
                const v = this._video;
                if (!this._isValid(v) || this._blocked) return;
                const now = Date.now();
                if (now - this._lastResumeTs < C.resumeCooldownMs) return;
                this._lastResumeTs = now;
                if (!v.paused) return;
                let p;
                try { p = v.play(); } catch (e) { return; }
                if (p && typeof p.catch === 'function') {
                    p.catch((err) => {
                        if (!err) return;
                        if (err.name === 'NotAllowedError' && !v.muted) {
                            v.muted = true;
                            v.play().catch(() => {});
                        } else if (err.name !== 'AbortError') {
                            log(`播放失败(${reason}): ${err.message}`, '#FF5722', 'warn');
                        }
                    });
                }
            },

            _reloadVideo(why) {
                this._reloadCount++;
                if (this._reloadCount > C.maxReloadPerUnit) {
                    log(`${why}，本节已重载 ${C.maxReloadPerUnit} 次仍失败，已停止。请检查网络或刷新页面后重新运行脚本。`, '#F44336', 'error');
                    this._stop();
                    this._note = '视频多次加载失败，已停止，请刷新页面';
                    return;
                }
                log(`${why}，重新加载视频 (${this._reloadCount}/${C.maxReloadPerUnit})`, '#FF5722', 'warn');
                const frame = this._videoFrameEl;
                this._enterLoading('reload');
                let ok = false;
                try {
                    if (frame && frame.isConnected && frame.contentWindow) {
                        frame.contentWindow.location.reload();
                        ok = true;
                    }
                } catch (e) { /* ignore */ }
                if (!ok) {
                    const idx = this._currentIndex();
                    if (idx >= 0) this._clickNode(idx);
                }
            },

            _onVideoFinished(v) {
                if (this._doneVideos.has(v)) return;
                this._doneVideos.add(v);
                if (v !== this._video) return;
                this._markProcessed();
                log(`'${this._title}' 播放完成`, '#4CAF50');
                this._unbindVideoEvents();
                this._video = null;
                this._videoFrameEl = null;
                this._state = 'loading';
                this._stallLevel = 0;
                this._unitStartTs = Date.now();
                this._ignoreUntil = Date.now() + C.finishSettleMs;
            },

            _scheduleAdvance(ms) {
                if (this._state === 'advancing') return;
                this._state = 'advancing';
                this._later(() => this.nextUnit(), ms);
            },

            // ================= 状态切换 =================
            _enterLoading(reason) {
                this._token++;
                this._clearTimeouts();
                if (reason === 'reload' && this._video) this._staleVideos.add(this._video);
                this._unbindVideoEvents();
                this._video = null;
                this._videoFrameEl = null;
                this._state = 'loading';
                const now = Date.now();
                this._unitStartTs = now;
                this._ignoreUntil = reason === 'start' ? 0 : now + 1500;
                this._selfActionUntil = reason === 'reload' ? now + 3000 : 0;
                this._stallLevel = 0;
                this._stepTried = 0;
                this._lastStepClickTs = 0;
                this._pausedSince = 0;
                this._pauseLog = [];
                this._blocked = false;
                this._waiting = false;
                if (!this._rateGaveUp) this._rate = C.playbackRate;
                if (reason !== 'reload') this._reloadCount = 0;
                if (reason === 'next' || reason === 'manual' || reason === 'start') this._testAdvanceTimes = 0;
                this._quizNotified = false;
                this._note = '';
                this._noVideoWait = false;
                this._docsDone = false;
                this._lives = [];
                this._liveBlocked = false;
                this._docProgress = null;
                document.title = this._origTitle;
            },

            _stop() {
                this._state = 'stopped';
                this._token++;
                this._clearTimeouts();
                this._unbindVideoEvents();
            },

            // ================= 视频查找与接管 =================
            _isValid(v) {
                try {
                    return !!(v && v.isConnected && v.ownerDocument && v.ownerDocument.defaultView);
                } catch (e) {
                    return false;
                }
            },

            _collectVideos() {
                const out = [];
                const walk = (doc, depth) => {
                    if (!doc || depth > 3) return;
                    let frames = [];
                    try { frames = doc.querySelectorAll('iframe'); } catch (e) { return; }
                    for (const f of frames) {
                        let fdoc = null;
                        try { fdoc = f.contentDocument; } catch (e) { fdoc = null; }
                        if (!fdoc) continue;
                        let videos = [];
                        try { videos = fdoc.querySelectorAll(C.videoSelector); } catch (e) { /* ignore */ }
                        for (const v of videos) {
                            const wrap = f.closest ? f.closest('.ans-attach-ct') : null;
                            out.push({
                                video: v,
                                frameEl: f,
                                finished: !!(wrap && wrap.classList.contains('ans-job-finished')),
                            });
                        }
                        walk(fdoc, depth + 1);
                    }
                };
                walk(document, 0);
                return out;
            },

            _pickVideo() {
                if (Date.now() < this._ignoreUntil) return { item: null, total: 0 };
                const list = this._collectVideos().filter(
                    (x) => this._isValid(x.video) && !this._staleVideos.has(x.video)
                );
                const pending = list.filter(
                    (x) => !this._doneVideos.has(x.video) && !(C.skipFinishedVideos && x.finished)
                );
                return { item: pending[0] || null, total: list.length };
            },

            _attachVideo(item) {
                const v = item.video;
                this._recordDuration(v);
                this._video = v;
                this._videoFrameEl = item.frameEl;
                this._state = 'playing';
                this._lastTime = v.currentTime || 0;
                this._lastProgressTs = Date.now();
                this._lastResumeTs = 0;
                this._pausedSince = 0;
                this._stallLevel = 0;
                this._testAdvanceTimes = 0;
                this._waiting = false;

                const win = v.ownerDocument.defaultView;
                this._guardChain(win);
                if (C.debugPause) this._installPauseTracer(win);
                this._bindVideoEvents(v);

                if (this._bgAudio && this._bgAudio.v !== v) this._restoreBgAudio();
                if (C.muted) v.muted = true;
                if (!this._rateGaveUp) this._setRate(v, this._rate);

                const nodes = this._nodes();
                const idx = this._currentIndex();
                this._title = idx >= 0
                    ? ($(nodes.get(idx)).find('.posCatalog_name').attr('title') || '未知标题')
                    : '未知标题';
                log(`接管视频：${this._title}（${idx + 1}/${nodes.length}），倍速 ${v.playbackRate}x`, '#4CAF50');
                this._resume('start');
            },

            _bindVideoEvents(v) {
                this._unbindVideoEvents();
                const h = {
                    ended: () => this._onVideoFinished(v),
                    pause: () => this._onPause(v),
                    ratechange: () => this._onRateChange(v),
                    waiting: () => { this._waiting = true; },
                    playing: () => { this._waiting = false; this._lastProgressTs = Date.now(); this._pausedSince = 0; },
                    canplay: () => { this._waiting = false; },
                    error: () => log('播放器报错，稍后自动重载', '#FF5722', 'warn'),
                };
                for (const k of Object.keys(h)) v.addEventListener(k, h[k]);
                this._boundVideo = v;
                this._videoHandlers = h;
            },

            _unbindVideoEvents() {
                const v = this._boundVideo;
                const h = this._videoHandlers;
                if (v && h) {
                    for (const k of Object.keys(h)) {
                        try { v.removeEventListener(k, h[k]); } catch (e) { /* ignore */ }
                    }
                }
                this._boundVideo = null;
                this._videoHandlers = null;
            },

            _quizVisible(v) {
                try {
                    const doc = v.ownerDocument;
                    const win = doc.defaultView;
                    for (const q of doc.querySelectorAll(C.quizSelector)) {
                        const st = win.getComputedStyle(q);
                        if (st.display !== 'none' && st.visibility !== 'hidden' && q.getClientRects().length > 0) {
                            return true;
                        }
                    }
                } catch (e) { /* ignore */ }
                return false;
            },

            // ================= 页面“离开即暂停”防护 =================
            // 暂停监听可能挂在 视频iframe / 章节iframe / 顶层页面 任意一层，所以整条链都要处理
            _guardChain(win) {
                this._guarded = this._guarded.filter((g) => {
                    try { return g.doc.defaultView != null; } catch (e) { return false; }
                });
                let w = win;
                for (let i = 0; i < 5 && w; i++) {
                    this._guardWindow(w);
                    let parent = null;
                    try {
                        if (w.frameElement) parent = w.frameElement.ownerDocument.defaultView;
                    } catch (e) { parent = null; }
                    if (!parent || parent === w) break;
                    w = parent;
                }
            },

            _guardWindow(win) {
                let doc;
                try { doc = win.document; } catch (e) { return; }
                if (this._guarded.some((g) => g.doc === doc)) return;

                // 只拦截“鼠标离开整个页面”（relatedTarget 为空），不影响页面内正常的悬停交互
                const stopLeave = (e) => { if (!e.relatedTarget) e.stopImmediatePropagation(); };
                // 只拦截窗口级 blur，不影响输入框等元素的失焦（弹题作答需要）
                const stopWinBlur = (e) => { if (e.target === win || e.target === doc) e.stopImmediatePropagation(); };
                const stopVis = (e) => {
                    e.stopImmediatePropagation();
                    if (win === window) this._onRealVisibility();
                };

                const listeners = [
                    [win, 'mouseout', stopLeave],
                    [win, 'mouseleave', stopLeave],
                    [doc, 'mouseleave', stopLeave],
                    [win, 'blur', stopWinBlur],
                    [win, 'visibilitychange', stopVis],
                    [doc, 'visibilitychange', stopVis],
                ];
                for (const [t, type, fn] of listeners) t.addEventListener(type, fn, true);

                let spoofed = false;
                if (C.guardFocus) {
                    try {
                        Object.defineProperty(doc, 'hidden', { configurable: true, get: () => false });
                        Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'visible' });
                        doc.hasFocus = () => true;
                        spoofed = true;
                    } catch (e) { /* ignore */ }
                }
                this._guarded.push({ doc, listeners, spoofed });
            },

            // 页面真正的可见状态（不受上面伪装的影响）：回到前台时立刻补一次检查，不等下一个计时
            _onRealVisibility() {
                const hidden = reallyHidden();
                try { this._syncBgAudio(); } catch (e) { /* ignore */ }
                if (hidden) { this._hiddenSince = Date.now(); return; }
                if (this._visTimer) return;
                this._visTimer = true;
                Promise.resolve().then(() => {
                    this._visTimer = false;
                    if (!this._timer || this._userStopped) return;
                    if (this._hiddenSince) log(`回到前台（在后台 ${Math.round((Date.now() - this._hiddenSince) / 1000)} 秒），立即检查播放状态`, '#607D8B');
                    this._hiddenSince = 0;
                    this._tick();
                });
            },

            _unguard(g) {
                try {
                    for (const [t, type, fn] of g.listeners) t.removeEventListener(type, fn, true);
                    if (g.spoofed) {
                        delete g.doc.hidden;
                        delete g.doc.visibilityState;
                        delete g.doc.hasFocus;
                    }
                } catch (e) { /* 页面可能已卸载 */ }
            },

            // 调试：打印谁调用了 video.pause()
            _installPauseTracer(win) {
                try {
                    const proto = win.HTMLMediaElement.prototype;
                    if (this._pauseTracers.some((t) => t.proto === proto)) return;
                    const orig = proto.pause;
                    proto.pause = function () {
                        console.groupCollapsed('%c[学习通V4.1] video.pause() 被调用，展开查看调用栈', 'color:#9E9E9E');
                        console.log(new Error().stack);
                        console.groupEnd();
                        return orig.apply(this, arguments);
                    };
                    this._pauseTracers.push({ proto, orig });
                } catch (e) { /* ignore */ }
            },

            // ================= 课件（PPT/PDF/文档）任务点 =================
            // 学习通课件在页面中以 iframe 嵌入，滚动到课件底部后平台自动标记任务点完成
            _sameOriginDocs() {
                const docs = [];
                const walk = (doc, depth) => {
                    if (!doc || depth > 4) return;
                    docs.push(doc);
                    let frames = [];
                    try { frames = doc.querySelectorAll('iframe'); } catch (e) { return; }
                    for (const f of frames) {
                        let fd = null;
                        try { fd = f.contentDocument; } catch (e) { fd = null; }
                        if (fd) walk(fd, depth + 1);
                    }
                };
                walk(document, 0);
                return docs;
            },

            _scrollablesIn(doc) {
                const out = [];
                const walk = (d, depth) => {
                    if (!d || depth > 3) return;
                    const se = d.scrollingElement;
                    if (se && se.scrollHeight > se.clientHeight + 40) out.push(se);
                    let els = [];
                    try { els = d.querySelectorAll('div,section,main,article'); } catch (e) { return; }
                    for (const el of els) {
                        if (el.clientHeight < 100 || el.scrollHeight <= el.clientHeight + 40) continue;
                        const oy = d.defaultView.getComputedStyle(el).overflowY;
                        if (oy === 'auto' || oy === 'scroll') out.push(el);
                        if (out.length >= 6) break;
                    }
                    for (const f of d.querySelectorAll('iframe')) {
                        let fd = null;
                        try { fd = f.contentDocument; } catch (e) { fd = null; }
                        if (fd) walk(fd, depth + 1);
                    }
                };
                walk(doc, 0);
                return out;
            },

            _collectPendingDocs() {
                const list = [];
                for (const doc of this._sameOriginDocs()) {
                    let wraps = [];
                    try { wraps = doc.querySelectorAll('.ans-attach-ct'); } catch (e) { continue; }
                    for (const wrap of wraps) {
                        if (wrap.classList.contains('ans-job-finished')) continue;
                        const frame = wrap.querySelector('iframe');
                        let fd = null;
                        try { fd = frame && frame.contentDocument; } catch (e) { fd = null; }
                        if (!fd) continue;
                        if (fd.querySelector('video')) continue;              // 视频任务点由播放逻辑处理
                        if (!this._scrollablesIn(fd).length) continue;        // 不可滚动的（直播卡片、讨论等）跳过
                        list.push({ wrap, frame, doc: fd });
                    }
                }
                return list;
            },

            _startReadingDocs() {
                if (!C.readDocs || this._docsDone || this._state === 'reading') return false;
                const docs = this._collectPendingDocs();
                if (!docs.length) { this._docsDone = true; return false; }
                this._state = 'reading';
                log(`发现 ${docs.length} 份未完成的课件，开始自动翻看`, '#2196F3');
                const token = this._token;
                this._readDocs(docs, token).catch((e) => log('翻看课件出错：' + e.message, '#F44336', 'warn')).finally(() => {
                    if (token !== this._token || this._state !== 'reading') return;
                    this._docsDone = true;
                    this._markProcessed();
                    this._docProgress = null;
                    this._state = 'loading';
                    this._unitStartTs = Date.now() - 3000;
                });
                return true;
            },

            async _readDocs(docs, token) {
                const sleep = (ms) => new Promise((r) => this._wait(r, ms));
                for (let i = 0; i < docs.length; i++) {
                    const d = docs[i];
                    this._docProgress = { i: i + 1, n: docs.length, pct: 0 };
                    // 先把课件滚动到可视区域：课件图片按可见性懒加载，不在视野里可能不加载
                    try { d.wrap.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ }
                    await sleep(1000);
                    let bottomRounds = 0;
                    for (let step = 0; step < C.docMaxSteps; step++) {
                        if (token !== this._token || this._state !== 'reading') return;
                        if (d.wrap.classList.contains('ans-job-finished')) break;
                        const els = this._scrollablesIn(d.doc);
                        if (!els.length) break;
                        let atBottom = true, pctSum = 0;
                        for (const el of els) {
                            const max = el.scrollHeight - el.clientHeight;
                            if (el.scrollTop < max - 5) {
                                atBottom = false;
                                el.scrollTop = Math.min(max, el.scrollTop + Math.max(200, el.clientHeight * 0.6));
                                const target = el === el.ownerDocument.scrollingElement ? el.ownerDocument : el;
                                target.dispatchEvent(new Event('scroll', { bubbles: true }));
                            }
                            pctSum += max > 0 ? Math.min(1, el.scrollTop / max) : 1;
                        }
                        this._docProgress.pct = Math.round((pctSum / els.length) * 100);
                        if (atBottom) {
                            if (++bottomRounds >= 4) break;   // 到底后再等几秒，让平台记录完成
                        } else {
                            bottomRounds = 0;
                        }
                        await sleep(C.docStepMs);
                    }
                    log(`课件 ${i + 1}/${docs.length} ${d.wrap.classList.contains('ans-job-finished') ? '已完成' : '已翻到底部'}`, '#4CAF50');
                }
            },

            // ================= 课程页上的直播回放任务点 =================
            // 每张直播卡片是一个独立 iframe，里面的 .live-info2 写着“观看时长达到总时长的90%…当前观看进度为12.77%”
            _scanLiveCards() {
                if (this._mode === 'live' || this._userStopped) return;
                const now = Date.now();
                if (now - this._liveScanTs < 3000) return;
                this._liveScanTs = now;
                const lives = [];
                for (const doc of this._sameOriginDocs()) {
                    let infos = [];
                    try { infos = doc.querySelectorAll('.live-info2'); } catch (e) { continue; }
                    for (const info of infos) {
                        const text = info.innerText || info.textContent || '';
                        const frame = doc.defaultView && doc.defaultView.frameElement;
                        const wrap = frame && frame.closest ? frame.closest('.ans-attach-ct') : null;
                        const need = parseFloat((/总时长的\s*([\d.]+)\s*%/.exec(text) || [])[1]) || 90;
                        const pct = parseFloat((/观看进度为\s*([\d.]+)\s*%/.exec(text) || [])[1]) || 0;
                        const done = (wrap && wrap.classList.contains('ans-job-finished')) || pct >= need;
                        lives.push({ doc, info, frame, need, pct, done });
                    }
                }
                this._lives = lives;
                const pending = lives.filter((l) => !l.done);
                // 一次只自动打开一个回放：平台要求观看时回放页保持在前台，同时开多个只会有一个在计时
                const watching = pending.some((l) => this._liveOpened.has(l.frame || l.info));
                if (C.autoOpenLive && pending.length && !this._liveBlocked && !watching) {
                    const next = pending.find((l) => !this._liveOpened.has(l.frame || l.info));
                    if (next) {
                        const ok = this._openLive(next, false);
                        if (!ok) {
                            this._liveBlocked = true;
                            log('浏览器拦截了自动打开直播回放，请点击浮窗上的“打开直播回放”按钮', '#FF9800', 'warn');
                        }
                    }
                }
                this._panelKey = '';
            },

            // 找到卡片里可点击的元素（鼠标指针为手形、面积最大的那个）
            _liveClickTarget(l) {
                const doc = l.doc;
                const win = doc.defaultView;
                let best = null, bestArea = 0;
                for (const el of doc.querySelectorAll('body *')) {
                    if (el === l.info || l.info.contains(el)) continue;
                    let cur = '';
                    try { cur = win.getComputedStyle(el).cursor; } catch (e) { continue; }
                    if (cur !== 'pointer') continue;
                    const r = el.getBoundingClientRect();
                    const area = r.width * r.height;
                    if (area > bestArea) { best = el; bestArea = area; }
                }
                return best || doc.body.firstElementChild;
            },

            // 打开回放：先截获卡片自己要打开的地址，再由当前页面打开（manual=用户点击时，浏览器一般不会拦截）
            _openLive(l, manual) {
                const win = l.doc.defaultView;
                const target = this._liveClickTarget(l);
                if (!win || !target) return false;
                let url = null;
                // 卡片可能调用自己、父页面或顶层页面的 window.open，整条链都临时截获
                const chain = [];
                for (let w = win; w; w = w === w.parent ? null : w.parent) {
                    try { chain.push([w, w.open]); w.open = (u) => { url = u; return null; }; } catch (e) { break; }
                    if (w === window.top) break;
                }
                try {
                    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: win }));
                } catch (e) { /* ignore */ } finally {
                    for (const [w, o] of chain) { try { w.open = o; } catch (e) { /* ignore */ } }
                }
                if (!url) {
                    // 卡片可能是普通链接
                    const a = target.closest ? target.closest('a[href]') : null;
                    if (a && !/^javascript:/i.test(a.getAttribute('href'))) url = a.href;
                }
                if (!url) {
                    log('没能找到直播回放的打开地址，请手动点击直播卡片', '#FF9800', 'warn');
                    this._liveOpened.add(l.frame || l.info);
                    return true;   // 不再自动重试
                }
                try { url = new URL(url, l.doc.baseURI).href; } catch (e) { /* ignore */ }
                const w = window.open(url, '_blank');
                if (!w) return false;
                this._liveOpened.add(l.frame || l.info);
                log(`已${manual ? '' : '自动'}打开直播回放（当前进度 ${l.pct}%），请让回放窗口保持显示`, '#4CAF50');
                return true;
            },

            _openNextLive() {
                const pending = this._lives.filter((l) => !l.done);
                if (!pending.length) return;
                const next = pending.find((l) => !this._liveOpened.has(l.frame || l.info)) || pending[0];
                if (this._openLive(next, true)) this._liveBlocked = false;
                this._panelKey = '';
                this._renderPanel();
            },

            // ================= 直播回放（zhibo.chaoxing.com）=================
            // 回放在新标签页打开，任务点按“观看时长达到总时长的一定比例”计算，所以保持 1 倍速持续播放
            startLive(playerOnly) {
                this._mode = 'live';
                this._livePlayerOnly = !!playerOnly;
                if (playerOnly) C.showPanel = false;   // 嵌在回放页里的播放器框架：只负责保持播放，浮窗由外层页面显示
                log(`${playerOnly ? '=== 学习通 V4.1 回放播放器保活已启动 ===' : '=== 学习通 V4.1 直播回放模式启动 ==='} v${VERSION}`, '#4CAF50');
                this._liveMsg = null;
                this._onLiveMessage = (e) => this._handleLiveMessage(e);
                window.addEventListener('message', this._onLiveMessage);
                const m = /[?&]rt=([\d.]+)/.exec(location.search);
                this._liveRequired = m ? Math.round(parseFloat(m[1]) * 100) : 90;
                this._startTimer();
                this._state = 'loading';
                this._renderPanel();
                if (!playerOnly) {
                    this._showUpdatedNotice();
                    this._startUpdateCheck();
                }
            },

            // 回放播放器在跨域 iframe（如 live-rk.chaoxing.com）里，会用 postMessage 向回放页汇报观看时长
            _handleLiveMessage(e) {
                try {
                    if (!/(^|\.)chaoxing\.com$/i.test(new URL(e.origin).hostname)) return;
                } catch (err) {
                    return;
                }
                let data = e.data;
                if (typeof data === 'string') {
                    if (!/time|duration/i.test(data)) return;
                    try { data = JSON.parse(data); } catch (err) { return; }
                }
                if (!data || typeof data !== 'object') return;
                let watch = null, duration = null;
                const scan = (o, depth) => {
                    if (!o || typeof o !== 'object' || depth > 3) return;
                    for (const k of Object.keys(o)) {
                        const val = o[k];
                        if (typeof val === 'number' || (typeof val === 'string' && /^\d+(\.\d+)?$/.test(val))) {
                            const n = Number(val);
                            if (watch === null && /^(watchTime|playTime|currentTime|curTime|playbackTime|time)$/i.test(k)) watch = n;
                            else if (duration === null && /^(duration|totalTime|videoDuration)$/i.test(k)) duration = n;
                        } else if (val && typeof val === 'object') {
                            scan(val, depth + 1);
                        }
                    }
                };
                scan(data, 0);
                if (watch === null || !duration) return;
                const prev = this._liveMsg;
                const now = Date.now();
                this._liveMsg = {
                    watch, duration,
                    ts: now,
                    lastGrowTs: !prev || watch > prev.watch + 0.05 ? now : prev.lastGrowTs,
                };
            },

            _findLiveVideo() {
                let best = null;
                for (const doc of this._sameOriginDocs()) {
                    for (const v of doc.querySelectorAll('video')) {
                        const d = isFinite(v.duration) ? v.duration : 0;
                        if (!best || d > (isFinite(best.duration) ? best.duration : 0)) best = v;
                    }
                }
                return best;
            },

            _liveTick() {
                if (this._state === 'stopped') return;
                const now = Date.now();
                if (!this._isValid(this._video)) {
                    const v = this._findLiveVideo();
                    if (!v) {
                        const m = this._liveMsg;
                        this._state = m ? 'playing' : 'loading';
                        if (m && m.watch / m.duration * 100 >= this._liveRequired && !this._liveReachedLogged) {
                            this._liveReachedLogged = true;
                            log(`观看时长已达到 ${this._liveRequired}%，任务点约 5 分钟内更新`, '#4CAF50');
                        }
                        return;
                    }
                    this._video = v;
                    this._state = 'playing';
                    this._lastTime = v.currentTime || 0;
                    this._lastProgressTs = now;
                    this._lastResumeTs = 0;
                    this._guardChain(v.ownerDocument.defaultView);
                    if (C.muted) v.muted = true;
                    log(`接管直播回放，需观看满总时长的 ${this._liveRequired}%`, '#4CAF50');
                    this._resume('live-start');
                    return;
                }
                const v = this._video;
                if (v.ended || this._nearEnd(v)) {
                    this._state = 'stopped';
                    this._note = '🎉 回放已播放完，任务点约 5 分钟内更新，之后可关闭此页';
                    log(this._note, '#4CAF50');
                    return;
                }
                const ct = v.currentTime || 0;
                if (Math.abs(ct - this._lastTime) > 0.05) {
                    this._lastTime = ct;
                    this._lastProgressTs = now;
                    return;
                }
                if (v.paused) { this._resume('live-paused'); return; }
                if (now - this._lastProgressTs >= C.liveStallMs) {
                    log('回放卡住，回退 1 秒重新缓冲', '#FF5722');
                    this._lastProgressTs = now;
                    try { v.currentTime = Math.max(0, ct - 1); } catch (e) { /* ignore */ }
                    this._lastResumeTs = 0;
                    this._resume('live-stall');
                }
            },

            _livePanelStatus(fmt, c) {
                const v = this._video;
                if (this._state === 'stopped') {
                    if (this._userStopped) return { color: c.GREY, label: '已暂停', text: this._note };
                    return { color: c.GREEN, label: '已完成', text: this._note };
                }
                if (!v) {
                    const m = this._liveMsg;
                    if (!m) return { color: c.BLUE, label: '加载中', text: '正在等待回放播放器开始播放…' };
                    const pct = Math.min(100, Math.floor((m.watch / m.duration) * 100));
                    const sub = `已观看 ${fmt(m.watch)} / ${fmt(m.duration)} · ${pct}%（需观看满 ${this._liveRequired}%）`;
                    if (pct >= this._liveRequired) return { color: c.GREEN, label: '已达标', text: `观看时长已达 ${this._liveRequired}%，任务点约 5 分钟内更新，之后可关闭此页`, sub };
                    if (Date.now() - m.lastGrowTs > 30000) return { color: c.ORANGE, label: '可能暂停', text: '观看时长 30 秒没有增加，请点一下播放器的播放键', sub };
                    return { color: c.GREEN, label: '回放中', text: '正在观看直播回放，请勿最小化此窗口', sub };
                }
                const pct = isFinite(v.duration) && v.duration > 0 ? Math.round((v.currentTime / v.duration) * 100) : 0;
                const sub = `${fmt(v.currentTime)} / ${fmt(v.duration)} · 进度 ${pct}%（需观看满 ${this._liveRequired}%）`;
                if (v.paused) return { color: c.ORANGE, label: '恢复中', text: '正在恢复回放播放…', sub };
                if (v.readyState < 3) return { color: c.ORANGE, label: '缓冲中', text: '回放缓冲中…', sub };
                return { color: c.GREEN, label: '回放中', text: '正在观看直播回放，请勿最小化此窗口', sub };
            },

            // ================= 版本更新 =================
            // 刚更新过（静默更新或油猴更新后第一次打开）时，浮窗短暂显示更新说明
            _showUpdatedNotice() {
                let from = window.__xxtUpdatedFrom || null;
                try {
                    const seen = localStorage.getItem(SEEN_KEY);
                    if (!from && seen && seen !== VERSION) from = seen;
                    localStorage.setItem(SEEN_KEY, VERSION);
                } catch (e) { /* ignore */ }
                window.__xxtUpdatedFrom = null;
                if (!from || from === VERSION || !newerThan(VERSION, from)) return;
                // 记下“从哪个版本更新来的”，浮窗一直显示新增内容，直到用户关掉（刷新页面也不会错过）
                try {
                    const pending = localStorage.getItem(WHATSNEW_KEY);
                    if (!pending || newerThan(pending, from)) localStorage.setItem(WHATSNEW_KEY, from);
                } catch (e) { /* ignore */ }
                this._whatsNewFrom = from;
                log(`已从 v${from} 更新到 v${VERSION}`, '#4CAF50');
            },
            _whatsNew() {
                let from = this._whatsNewFrom || null;
                try { from = localStorage.getItem(WHATSNEW_KEY) || from; } catch (e) { /* ignore */ }
                if (!from || !newerThan(VERSION, from)) return null;
                return { from, entries: changelogSince(from) };
            },
            _dismissWhatsNew() {
                this._whatsNewFrom = null;
                try { localStorage.removeItem(WHATSNEW_KEY); } catch (e) { /* ignore */ }
            },
            _renderWhatsNew(el, open) {
                const box = el.querySelector('[data-k="whatsnew"]');
                const wn = open && !this._histOpen ? this._whatsNew() : null;
                box.style.display = wn ? 'block' : 'none';
                if (!wn) return;
                const esc = (t) => this._esc(t);
                const items = [];
                for (const e of wn.entries) for (const it of e.items) if (!it.startsWith('  ')) items.push(it);
                const shown = items.slice(0, 3);
                el.querySelector('[data-k="wntitle"]').textContent = `🎉 已更新到 v${VERSION}`;
                el.querySelector('[data-k="wnlist"]').innerHTML =
                    (shown.length ? shown.map((t) => `<li>${esc(t)}</li>`).join('') : '<li>修复了一些问题，体验更稳定</li>') +
                    (items.length > shown.length ? `<li class="xxt-wn-more">还有 ${items.length - shown.length} 项改进</li>` : '');
                const latest = wn.entries[0];
                const note = el.querySelector('[data-k="wnnote"]');
                note.style.display = latest && latest.note ? 'block' : 'none';
                if (latest && latest.note) note.innerHTML = `<b>💬 作者RouteCC：</b>${esc(latest.note)}`;
                el.querySelector('[data-k="wndate"]').textContent = latest && latest.date ? latest.date.replace(/^\d{4}-0?(\d+)-0?(\d+)$/, '$1月$2日') + '更新' : '';
            },
            _renderHistory(el) {
                const esc = (t) => this._esc(t);
                el.querySelector('[data-k="histlist"]').innerHTML = CHANGELOG.map((e, i) =>
                    `<div class="xxt-hv"><div class="xxt-hv-head"><b>v${esc(e.v)}</b>${i === 0 && e.v === VERSION ? '<span>当前版本</span>' : ''}${e.date ? `<time datetime="${esc(e.date)}">${esc(e.date)}</time>` : ''}</div><ul>` +
                    e.items.map((t) => t.startsWith('  ') ? `<li class="sub">${esc(t.trim())}</li>` : `<li>${esc(t)}</li>`).join('') + '</ul>' +
                    (e.note ? `<div class="xxt-hv-note"><b>💬 作者RouteCC：</b>${esc(e.note)}</div>` : '') + '</div>').join('');
            },
            _startUpdateCheck() {
                this._checkUpdate();
                if (!this._updateTimer) this._updateTimer = setInterval(() => this._checkUpdate(), 3 * 3600 * 1000);   // 每 3 小时检查一次新版本
            },

            async _checkUpdate() {
                for (const url of VERSION_URLS) {
                    try {
                        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
                        const t = ctrl && setTimeout(() => ctrl.abort(), 6000);
                        const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined });
                        if (t) clearTimeout(t);
                        if (!res.ok) continue;
                        const data = await res.json();
                        if (data && /^\d+(\.\d+)*$/.test(data.version || '')) {
                            const latest = newerThan(data.version, VERSION) ? data.version : null;
                            if (latest && latest !== this._latest) log(`发现新版本 v${latest}，点击浮窗上的版本号即可更新`, '#2196F3');
                            this._latest = latest;
                            this._panelKey = '';
                            this._renderPanel();
                            return;
                        }
                    } catch (e) { /* 网络不通或被拦截，换下一个地址 */ }
                }
            },

            // 静默更新：直接在当前页面加载新版本，新版本启动时会自动替换掉当前实例，不打开任何页面。
            // 油猴版同样适用（本页立即生效），油猴之后也会在后台把已安装的脚本更新到新版。
            _doUpdate(manual) {
                const v = this._latest;
                if (!v || this._updating) return;
                this._updating = true;
                this._panelKey = '';
                this._renderPanel();
                log(`正在${manual ? '' : '自动'}更新到 v${v}…`, '#2196F3');
                const fail = (why) => {
                    this._updating = false;
                    this._updateFailed = true;     // 本次页面不再自动重试，避免反复失败
                    this._panelKey = '';
                    this._renderPanel();
                    log(`更新到 v${v} 失败（${why}），刷新页面后会重试`, '#F44336', 'warn');
                };
                const run = (code) => {
                    window.__xxtUpdatedFrom = VERSION;
                    const s = document.createElement('script');
                    s.textContent = code;
                    document.head.appendChild(s);
                };
                (async () => {
                    // 只接受版本号正好是新版本的代码，防止拿到缓存的旧文件
                    for (const url of [SCRIPT_RAW_URL, SCRIPT_CDN_URL]) {
                        try {
                            const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
                            if (!res.ok) continue;
                            const code = await res.text();
                            const m = /const VERSION = '([\d.]+)'/.exec(code);
                            if (m && m[1] === v) { run(code); return; }
                        } catch (e) { /* 换下一个地址 */ }
                    }
                    fail('暂时下载不到新版本代码');
                })();
            },

            // 自动更新只在“小节之间”进行：当前没有在播放视频、翻看课件，也不在直播回放页
            _maybeAutoUpdate() {
                if (!C.autoUpdate || !this._latest || this._updating || this._updateFailed || this._mode === 'live' || this._userStopped) return;
                if (this._state === 'loading' || this._state === 'waiting' || this._state === 'stopped') this._doUpdate(false);
            },

            // ================= 课程列表页总览 =================
            startList() {
                this._mode = 'list';
                this._state = 'list';
                log(`=== 学习通助手 课程总览 === v${VERSION}`, '#4CAF50');
                this._startTimer();
                this._scanCourseList(true);
                this._showUpdatedNotice();
                this._renderPanel();
                this._startUpdateCheck();
            },

            // 在播放页记下“上次学习的课程”，课程列表页上可以一键继续
            _rememberLastCourse() {
                try {
                    const cid = this._courseKey();
                    if (cid === 'default') return;
                    localStorage.setItem(LAST_KEY, JSON.stringify({ cid, url: location.href, ts: Date.now() }));
                } catch (e) { /* ignore */ }
            },

            _scanCourseList(force) {
                const now = Date.now();
                if (!force && now - this._coursesTs < 4000) return;
                this._coursesTs = now;
                const list = [];
                for (const doc of this._sameOriginDocs()) {
                    let cards = [];
                    try { cards = doc.querySelectorAll('.course.learnCourse, .course[info]'); } catch (e) { continue; }
                    for (const c of cards) {
                        const idEl = c.querySelector('input.courseId');
                        const cid = idEl ? idEl.value : (c.id || '').replace(/^c_/, '');
                        const nameEl = c.querySelector('.course-name');
                        const name = nameEl ? (nameEl.getAttribute('title') || nameEl.textContent || '').trim() : '';
                        const link = c.querySelector('.course-info a[href], a[href*="stucoursemiddle"], a[href*="course"]');
                        const m = /(\d+)\s*\/\s*(\d+)/.exec((c.querySelector('.l-txt') || {}).textContent || '');
                        const done = m ? Number(m[1]) : 0, total = m ? Number(m[2]) : 0;
                        if (!cid || !name) continue;
                        list.push({ cid, name, href: link ? link.href : '', done, total, finished: total > 0 && done >= total });
                    }
                    if (list.length) break;
                }
                if (!list.length) { this._courses = []; return; }
                // 记住课程名称，播放页上可以用到
                try {
                    const names = JSON.parse(localStorage.getItem(NAMES_KEY) || '{}');
                    for (const c of list) names[c.cid] = c.name;
                    localStorage.setItem(NAMES_KEY, JSON.stringify(names));
                } catch (e) { /* ignore */ }
                const st = this._loadStats();
                for (const c of list) {
                    const s2 = st.courses[c.cid];
                    c.studied = s2 ? s2.sec : 0;
                    c.last = s2 ? s2.last : '';
                }
                this._courses = list;
            },

            _lastCourse() {
                try {
                    const o = JSON.parse(localStorage.getItem(LAST_KEY) || 'null');
                    if (!o || !o.url) return null;
                    const names = JSON.parse(localStorage.getItem(NAMES_KEY) || '{}');
                    const c = (this._courses || []).find((x) => x.cid === o.cid);
                    return { ...o, name: (c && c.name) || names[o.cid] || '上次的课程', course: c };
                } catch (e) { return null; }
            },

            _listPanelStatus(c) {
                const list = this._courses;
                if (!list || !list.length) return { color: c.BLUE, label: '课程总览', text: '在左侧点击「课程」后，这里会显示所有课程的进度' };
                const withTasks = list.filter((x) => x.total > 0);
                const fin = withTasks.filter((x) => x.finished).length;
                return { color: c.GREEN, label: '课程总览', text: `共 ${list.length} 门课 · 已完成 ${fin} 门 · 进行中 ${withTasks.length - fin} 门` };
            },

            _renderCourseList(el) {
                const box = el.querySelector('[data-k="courses"]');
                const list = this._courses || [];
                const todo = list.filter((x) => x.total > 0 && !x.finished)
                    .sort((a, b) => (b.last || '').localeCompare(a.last || '') || (b.done / b.total) - (a.done / a.total));
                const last = this._lastCourse();
                const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
                let html = '';
                if (last) {
                    const p = last.course && last.course.total ? ` · ${Math.round((last.course.done / last.course.total) * 100)}%` : '';
                    html += `<button type="button" class="xxt-continue" data-open="last"><b>▶ 继续上次的课程</b><span>${esc(last.name)}${p}</span></button>`;
                }
                if (todo.length) {
                    html += '<div class="xxt-clist">' + todo.slice(0, 15).map((x) => {
                        const pct = Math.round((x.done / x.total) * 100);
                        return `<button type="button" class="xxt-crow" data-open="${esc(x.cid)}" title="${esc(x.name)}">` +
                            `<span class="xxt-cname">${esc(x.name)}</span>` +
                            `<span class="xxt-cmeta">${x.done}/${x.total} 任务点${x.studied >= 60 ? ` · 已学 ${fmtShort(x.studied)}` : ''}<em>${pct}%</em></span>` +
                            `<span class="xxt-ctrack"><i style="width:${pct}%"></i></span></button>`;
                    }).join('') + '</div>';
                    if (todo.length > 15) html += `<div class="xxt-cmore">还有 ${todo.length - 15} 门进行中的课程</div>`;
                } else if (list.length) {
                    html += '<div class="xxt-cmore">🎉 所有课程的任务点都完成了</div>';
                }
                box.innerHTML = html;
                box.style.display = html ? 'block' : 'none';
            },

            _openFromList(key) {
                if (key === 'last') {
                    const last = this._lastCourse();
                    if (last) window.open(last.url, '_blank');
                    return;
                }
                const c = (this._courses || []).find((x) => x.cid === key);
                if (c && c.href) window.open(c.href, '_blank');
            },

            // ================= 学习记录 =================
            // 只记在本地浏览器里，不上传：每天的学习时长、完成小节数，以及每门课的累计时长
            _loadStats() {
                if (this._stats) return this._stats;
                let o = null;
                try { o = JSON.parse(localStorage.getItem(STATS_KEY) || 'null'); } catch (e) { o = null; }
                if (!o || typeof o !== 'object') o = {};
                o.days = o.days || {};
                o.courses = o.courses || {};
                this._stats = o;
                if (!this._onPageHide) {
                    this._onPageHide = () => this._saveStats(true);
                    window.addEventListener('pagehide', this._onPageHide);
                }
                return o;
            },
            _saveStats(force) {
                if (!this._stats) return;
                if (!force && Date.now() - this._statsDirty < 10000) return;
                this._statsDirty = Date.now();
                try {
                    const keys = Object.keys(this._stats.days).sort();
                    for (const k of keys.slice(0, Math.max(0, keys.length - 120))) delete this._stats.days[k];
                    localStorage.setItem(STATS_KEY, JSON.stringify(this._stats));
                } catch (e) { /* ignore */ }
            },
            // 正在学习（视频在走、在翻课件、回放在计时）时累计时长
            _isStudying() {
                if (this._userStopped) return false;
                const now = Date.now();
                if (this._mode === 'live') {
                    if (this._livePlayerOnly) return false;
                    const m = this._liveMsg;
                    return !!(m && now - m.lastGrowTs < 5000);
                }
                if (this._state === 'reading') return true;
                const v = this._video;
                return this._state === 'playing' && this._isValid(v) && !v.paused && now - this._lastProgressTs < 5000;
            },
            _statTick(dt) {
                if (!(dt > 0) || !this._isStudying()) return;
                const st = this._loadStats();
                const d = dayKey();
                const day = st.days[d] || (st.days[d] = { sec: 0, nodes: 0 });
                day.sec += dt;
                const ck = this._courseKey();
                const c = st.courses[ck] || (st.courses[ck] = { sec: 0, first: d, last: d });
                c.sec += dt; c.last = d;
                this._saveStats(false);
            },
            _statAddNodes(n) {
                const st = this._loadStats();
                const d = dayKey();
                const day = st.days[d] || (st.days[d] = { sec: 0, nodes: 0 });
                day.nodes += n;
                this._saveStats(true);
            },
            _statSummary() {
                const st = this._loadStats();
                const today = new Date();
                const get = (offset) => {
                    const d = new Date(today); d.setDate(d.getDate() - offset);
                    return { key: dayKey(d), date: d, ...(st.days[dayKey(d)] || { sec: 0, nodes: 0 }) };
                };
                const week = [6, 5, 4, 3, 2, 1, 0].map(get);
                const todaySec = week[6].sec;
                const weekSec = week.reduce((a, x) => a + x.sec, 0);
                let streak = 0;
                for (let i = (todaySec >= 60 ? 0 : 1); i < 120; i++) {
                    if (get(i).sec >= 60) streak++; else break;
                }
                return { todaySec, todayNodes: week[6].nodes, weekSec, streak, week };
            },
            _courseSummary() {
                const c = this._loadStats().courses[this._courseKey()];
                if (!c || c.sec < 60) return '';
                const days = Math.max(1, Math.round((new Date(c.last) - new Date(c.first)) / 86400000) + 1);
                return ` · 共学习 ${fmtDur(c.sec)}，历时 ${days} 天`;
            },

            // ================= 引导安装油猴版 =================
            _maybeTmHint() {
                let isUs = false;
                try { isUs = typeof GM_info !== 'undefined'; } catch (e) { isUs = false; }
                if (isUs || this._mode === 'live') return;
                try { if (localStorage.getItem(TMHINT_KEY)) return; } catch (e) { return; }
                this._later(() => {
                    if (this._notice) return;   // 有其他提示时不打扰
                    this._notice = {
                        kind: 'tip', until: Date.now() + 60000,
                        text: '装上油猴版，以后打开学习通自动运行，不用每次粘贴代码。',
                        link: { href: REPO_URL + '#-快速安装', label: '查看安装方法' },
                    };
                    this._panelKey = '';
                    this._renderPanel();
                }, 30000);
            },

            // ================= 课程总进度 / 登录状态 =================
            _courseKey() {
                const m = /[?&]courseId=(\d+)/i.exec(location.search) || /[?&]courseid=(\d+)/i.exec(location.search);
                return m ? m[1] : 'default';
            },

            // 记录看过的视频时长，用来估算剩余时间
            _recordDuration(v) {
                const save = () => {
                    const d = v.duration;
                    if (!isFinite(d) || d < 30 || d > 6 * 3600 || v.__xxtDurRecorded) return;
                    v.__xxtDurRecorded = true;
                    try {
                        const key = 'xxt-v41-dur-' + this._courseKey();
                        const o = JSON.parse(localStorage.getItem(key) || '{"sum":0,"count":0}');
                        o.sum += d; o.count += 1;
                        if (o.count > 50) { o.sum = o.sum / o.count * 50; o.count = 50; }
                        localStorage.setItem(key, JSON.stringify(o));
                    } catch (e) { /* ignore */ }
                };
                if (isFinite(v.duration) && v.duration > 0) save();
                else v.addEventListener('loadedmetadata', save, { once: true });
            },

            _nodeTitle(n) {
                const s = n && n.querySelector('.posCatalog_name');
                return s ? (s.getAttribute('title') || s.textContent || '').trim() : '';
            },
            _nodeDone(n) {
                return !!n.querySelector('.icon_Completed, [class*="icon_Completed"], [class*="icon_complete"]');
            },
            _nodePending(n) {
                return [...n.querySelectorAll('span, em, i, div')].some((e) => e.children.length === 0 && /^\d+$/.test((e.textContent || '').trim()));
            },
            _manualSet() {
                try { return new Set(JSON.parse(localStorage.getItem('xxt-v41-manual-' + this._courseKey()) || '[]')); } catch (e) { return new Set(); }
            },
            _saveManualSet(set) {
                try { localStorage.setItem('xxt-v41-manual-' + this._courseKey(), JSON.stringify([...set].slice(-300))); } catch (e) { /* ignore */ }
            },
            // 记下脚本已经处理过（看完视频 / 翻完课件）的小节
            _markProcessed() {
                const idx = this._currentIndex();
                if (idx >= 0) this._processedTitle = this._nodeTitle(this._nodes().get(idx));
            },

            _markManual(n) {
                if (!n || this._nodeDone(n) || !this._nodePending(n)) return;
                const t = this._nodeTitle(n);
                if (!t) return;
                const set = this._manualSet();
                if (!set.has(t)) {
                    set.add(t);
                    this._saveManualSet(set);
                    log(`「${t}」还有需要手动完成的任务（如章节测验、讨论），已记入课程进度`, '#FF9800');
                }
            },

            _scanCourse() {
                const now = Date.now();
                if (now - this._progressTs < 5000) return;
                this._progressTs = now;
                // 课程进度：带“已完成”对勾的算完成；带数字角标的算未完成，其中脚本处理过、
                // 但还剩测验/讨论等手动任务的小节单独统计为“需手动完成”，不计入剩余观看时间
                try {
                    const curIdx = this._currentIndex();
                    const curTitle = curIdx >= 0 ? this._nodeTitle(this._nodes().get(curIdx)) : '';
                    if (this._lastActiveTitle && curTitle !== this._lastActiveTitle && this._lastActiveTitle === this._processedTitle) {
                        const prev = this._nodes().filter((_, n) => this._nodeTitle(n) === this._lastActiveTitle).get(0);
                        this._markManual(prev);
                    }
                    this._lastActiveTitle = curTitle;
                    let done = 0, pending = 0;
                    const manualSet = this._manualSet();
                    const manual = [];
                    let changed = false;
                    this._nodes().each((_, n) => {
                        const t = this._nodeTitle(n);
                        if (this._nodeDone(n)) {
                            done++;
                            if (manualSet.delete(t)) changed = true;   // 已经手动补完，移出列表
                            return;
                        }
                        if (!this._nodePending(n)) return;
                        if (manualSet.has(t)) manual.push(t);
                        else pending++;
                    });
                    if (changed) this._saveManualSet(manualSet);
                    if (this._prevDone !== null && done > this._prevDone && done - this._prevDone <= 3) this._statAddNodes(done - this._prevDone);
                    this._prevDone = done;
                    let avg = 0;
                    try {
                        const o = JSON.parse(localStorage.getItem('xxt-v41-dur-' + this._courseKey()) || 'null');
                        if (o && o.count) avg = o.sum / o.count;
                    } catch (e) { /* ignore */ }
                    const total = done + pending + manual.length;
                    this._progress = total ? { done, total, pending, manual, avg } : null;
                } catch (e) {
                    this._progress = null;
                }
                // 登录状态：页面里出现跳转到登录页的框架，或明确的“登录超时”提示
                let expired = false;
                for (const doc of this._sameOriginDocs()) {
                    let frames = [];
                    try { frames = doc.querySelectorAll('iframe'); } catch (e) { continue; }
                    for (const f of frames) {
                        const src = f.getAttribute('src') || '';
                        if (/passport\d*\.chaoxing\.com|\/login(\?|$|\/)/i.test(src)) { expired = true; break; }
                    }
                    if (expired) break;
                    try {
                        for (const el of doc.querySelectorAll('.layui-layer-content, [class*="dialog"], [class*="popup"], [class*="tip"]')) {
                            if (el.offsetParent !== null && /登录超时|登录已过期|请重新登录|登录失效/.test(el.textContent || '')) { expired = true; break; }
                        }
                    } catch (e) { /* ignore */ }
                    if (expired) break;
                }
                if (expired && !this._loginExpired) log('检测到登录可能已过期，请重新登录后刷新页面', '#F44336', 'warn');
                this._loginExpired = expired;
            },

            _progressLine() {
                const p = this._progress;
                if (!p) return null;
                let eta = '', etaStr = '';
                if (p.pending && p.avg) {
                    const sec = (p.pending * p.avg) / (C.playbackRate || 1);
                    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
                    etaStr = `预计还需约 ${h ? h + ' 小时 ' : ''}${h && !m ? '' : m + ' 分钟'}`;
                    eta = ` · ${etaStr}`;
                }
                const manual = p.manual.length ? ` · ${p.manual.length} 节需手动完成` : '';
                const tail = p.pending ? eta : p.manual.length ? ' · 视频等已全部完成' : ' · 已全部完成';
                return {
                    pct: Math.round((p.done / p.total) * 100),
                    manualPct: Math.round((p.manual.length / p.total) * 100),
                    text: `课程进度 ${p.done}/${p.total} 节${manual}${tail}`,
                    etaText: p.pending ? (etaStr || `还剩 ${p.pending} 节`) : p.manual.length ? '视频等已全部完成，剩下的需手动完成' : '已全部完成',
                    title: p.manual.length ? '需手动完成（章节测验、讨论等）：\n' + p.manual.join('\n') : '',
                };
            },

            // ================= 提醒 =================
            // 提示音分两种：
            //   'attn'（需要处理：弹题、页面要求操作、登录过期）——急促的高低双音交替，响两轮，一听就知道要过去看
            //   'chime'（完成、目标达成、休息等普通提醒）——柔和的上行两声
            _beep(kind = 'chime') {
                try {
                    const Ctx = window.AudioContext || window.webkitAudioContext;
                    if (!Ctx) return;
                    if (!this._audioCtx) this._audioCtx = new Ctx();
                    const ctx = this._audioCtx;
                    if (ctx.state === 'suspended') ctx.resume();
                    const notes = kind === 'attn'
                        ? { type: 'square', vol: 0.09, len: 0.13, seq: [[988, 0], [740, 0.16], [988, 0.32], [740, 0.48], [988, 0.8], [740, 0.96], [988, 1.12], [740, 1.28]] }
                        : { type: 'sine', vol: 0.18, len: 0.16, seq: [[880, 0], [1175, 0.18]] };
                    for (const [freq, at] of notes.seq) {
                        const o = ctx.createOscillator(), g = ctx.createGain();
                        const t0 = ctx.currentTime + at;
                        o.type = notes.type; o.frequency.value = freq;
                        g.gain.setValueAtTime(0.0001, t0);
                        g.gain.exponentialRampToValueAtTime(notes.vol, t0 + 0.015);
                        g.gain.exponentialRampToValueAtTime(0.0001, t0 + notes.len);
                        o.connect(g).connect(ctx.destination);
                        o.start(t0); o.stop(t0 + notes.len + 0.02);
                    }
                } catch (e) { /* ignore */ }
            },

            _alert(title, body, kind) {
                if (C.alertSound) this._beep(kind);
                if (C.alertNotify) {
                    try {
                        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                            const n = new Notification(title, { body, tag: 'xxt-v41', renotify: true });
                            n.onclick = () => { try { window.focus(); n.close(); } catch (e) { /* ignore */ } };
                        }
                    } catch (e) { /* ignore */ }
                }
            },

            // 状态进入“需要处理 / 已完成”时提醒一次
            _checkAlert(st) {
                let key = '', title = '', body = '';
                if (st.color === '#E5484D') { key = 'attn|' + st.text; title = '学习通助手：需要你处理'; body = st.text; }
                else if (/已完成|已达标/.test(st.label)) { key = 'done|' + st.text; title = '学习通助手'; body = st.text; }
                const now = Date.now();
                const kind = key.startsWith('attn|') ? 'attn' : 'chime';
                if (key && key !== this._lastAlertKey) { this._alert(title, body, kind); this._lastBeepTs = now; }
                // 需要人工处理（弹题、页面要求操作、登录过期）时，每隔一会儿再响一次，直到处理完
                else if (key.startsWith('attn|') && C.alertSound && now - (this._lastBeepTs || 0) >= C.alertRepeatMs) {
                    this._beep('attn');
                    this._lastBeepTs = now;
                }
                this._lastAlertKey = key;
            },

            // ================= 设置 / 诊断 / 位置 =================
            _toggleSetting(k, on) {
                if (k === 'alertNotify' && on) {
                    if (typeof Notification === 'undefined') {
                        this._notice = { kind: 'bg', until: Date.now() + 8000, text: '当前浏览器不支持系统通知' };
                        on = false;
                    } else if (Notification.permission === 'denied') {
                        this._notice = { kind: 'bg', until: Date.now() + 10000, text: '浏览器已禁止本站通知，请在地址栏左侧的网站设置里允许通知' };
                        on = false;
                    } else if (Notification.permission !== 'granted') {
                        Notification.requestPermission().then((perm) => {
                            C.alertNotify = perm === 'granted';
                            saveSettings();
                            if (!C.alertNotify) this._notice = { kind: 'bg', until: Date.now() + 8000, text: '没有获得通知权限，系统通知未开启' };
                            this._panelKey = '';
                            this._renderPanel();
                        });
                    }
                }
                C[k] = on;
                saveSettings();
                if (k === 'muted' && this._isValid(this._video)) { this._restoreBgAudio(); try { this._video.muted = on; } catch (e) { /* ignore */ } }
                if (k === 'bgAudio' && !on) this._restoreBgAudio();
                log(`设置：${(SETTING_ITEMS.find((x) => x[0] === k) || [k, k])[1]} ${on ? '开启' : '关闭'}`, '#2196F3');
                this._panelKey = '';
                this._renderPanel();
            },

            _diagnostics() {
                const v = this._isValid(this._video) ? this._video : null;
                const st = this._panelStatus();
                const lines = [
                    '【学习通助手 诊断信息】',
                    `版本：v${VERSION}（${(() => { try { return typeof GM_info !== 'undefined' ? '油猴版' : '控制台版'; } catch (e) { return '控制台版'; } })()}）`,
                    `页面：${location.origin}${location.pathname}`,
                    `模式/状态：${this._mode} / ${this._state}${this._userStopped ? '（已手动停止）' : ''}`,
                    `浮窗：${st.label} · ${st.text}${st.sub ? ' · ' + st.sub : ''}`,
                    `章节：${this._chapterLine() || '-'}`,
                    `课程进度：${this._progress ? `${this._progress.done}/${this._progress.total}，需手动 ${this._progress.manual.length} 节` : '-'}`,
                    `视频：${v ? `${(v.currentTime || 0).toFixed(1)}/${(v.duration || 0).toFixed(1)}s 倍速 ${v.playbackRate} ${v.paused ? '暂停' : '播放'} readyState=${v.readyState} muted=${v.muted}` : '无'}`,
                    `直播回放：${this._lives.length ? this._lives.map((l) => `${l.pct}%${l.done ? '(完成)' : ''}`).join('、') : '无'}${this._liveMsg ? ` · 回放进度 ${Math.round(this._liveMsg.watch)}/${Math.round(this._liveMsg.duration)}s` : ''}`,
                    `学习记录：今日 ${fmtDur(this._statSummary().todaySec)} · 本周 ${fmtDur(this._statSummary().weekSec)}`,
                    `设置：倍速 ${C.playbackRate}x · 每日目标 ${C.dailyGoal} 分钟 · 主题 ${C.theme}${C.theme === 'custom' ? `（${C.customColor} ${C.customBase}）` : ''} · ${SETTING_ITEMS.map(([k, name]) => `${name}${C[k] ? '开' : '关'}`).join(' · ')}`,
                    `更新：${this._latest ? '发现 v' + this._latest : '已是最新'}${this._updateFailed ? '（更新失败）' : ''}`,
                    `后台：防卡顿${C.bgAudio ? (this._bgAudioBlocked ? '（浏览器不允许）' : this._bgAudio ? '（生效中）' : '开') : '关'} · 后台被暂停 ${this._bgPauseCount || 0} 次 · 保活锁${this._lockRelease ? '有' : '无'} · 当前${reallyHidden() ? '在后台' : '在前台'}`,
                    `计时器：${this._timer && this._timer.worker ? 'Worker' : '普通定时器'} · 登录：${this._loginExpired ? '可能已过期' : '正常'}`,
                    `浏览器：${navigator.userAgent}`,
                    '',
                    '—— 最近日志 ——',
                    ...LOGS.slice(-40),
                ];
                return lines.join('\n');
            },

            // ================= 反馈 =================
            // 只在用户主动点击时生成反馈内容：复制到剪贴板，或在 GitHub 打开一个填好的 Issue，不会自动发送任何东西
            _feedbackText() {
                const el = this._panel;
                const type = this._fbType || 'bug';
                const text = ((el && el.querySelector('[data-k="fbtext"]').value) || '').trim();
                const withDiag = el ? el.querySelector('[data-k="fbdiag"]').checked : false;
                const title = `[${type === 'bug' ? '问题' : '建议'}] ${(text.split('\n')[0] || (type === 'bug' ? '遇到问题' : '改进建议')).slice(0, 40)}`;
                const body = [`**${type === 'bug' ? '问题描述' : '建议内容'}**`, '', text || '（未填写）', ''];
                const short = [`版本：v${VERSION}（${(() => { try { return typeof GM_info !== 'undefined' ? '油猴版' : '控制台版'; } catch (e) { return '控制台版'; } })()}）`,
                    `状态：${this._mode} / ${this._state}`, `浏览器：${navigator.userAgent}`];
                return { title, text, withDiag, body: body.join('\n'), short: short.join('\n'), full: withDiag ? this._diagnostics() : '' };
            },
            _sendFeedback(github) {
                const f = this._feedbackText();
                if (!f.text) {
                    this._notice = { kind: 'bg', until: Date.now() + 6000, text: '先写一下遇到的问题或建议吧' };
                    this._panelKey = ''; this._renderPanel();
                    const ta = this._panel && this._panel.querySelector('[data-k="fbtext"]');
                    if (ta) ta.focus();
                    return;
                }
                const copyAll = `${f.title}\n\n${f.body}\n${f.full ? '\n' + f.full : '\n' + f.short}`;
                if (!github) {
                    this._copyText(copyAll, '已复制反馈内容，可以直接发给作者', '复制失败，请手动选中文字复制');
                    return;
                }
                // 网址长度有限：Issue 里放描述和简要信息，完整诊断信息复制到剪贴板，方便粘贴进去
                let body = `${f.body}\n<details><summary>环境</summary>\n\n\`\`\`\n${f.short}\n\`\`\`\n</details>\n`;
                if (f.full) body += '\n<!-- 完整诊断信息已复制到剪贴板，可以粘贴在这一行下面 -->\n';
                const url = `${REPO_URL}/issues/new?title=${encodeURIComponent(f.title)}&body=${encodeURIComponent(body)}`;
                window.open(url, '_blank', 'noopener');
                if (f.full) this._copyText(f.full, '已在新标签页打开 GitHub；完整诊断信息已复制，可粘贴到 Issue 里', '已在新标签页打开 GitHub');
                else { this._notice = { kind: 'upd', until: Date.now() + 8000, text: '已在新标签页打开 GitHub，登录后点「Submit new issue」即可' }; this._panelKey = ''; this._renderPanel(); }
                log(`打开反馈页面（${this._fbType === 'idea' ? '建议' : '问题'}）`, '#2196F3');
            },

            _copyDiagnostics() {
                this._copyText(this._diagnostics(), '已复制诊断信息，可以直接粘贴到仓库的 Issues 里反馈', '复制失败，请按 F12 在控制台执行 copy(app._diagnostics())');
            },

            _applyPanelPos(el) {
                let pos = null;
                try { pos = JSON.parse(localStorage.getItem(POS_KEY) || 'null'); } catch (e) { pos = null; }
                if (pos && isFinite(pos.left) && isFinite(pos.top)) {
                    const w = el.offsetWidth || 324, h = el.offsetHeight || 220;
                    const left = Math.min(Math.max(0, pos.left), Math.max(0, window.innerWidth - w));
                    const top = Math.min(Math.max(0, pos.top), Math.max(0, window.innerHeight - h));
                    el.style.left = left + 'px'; el.style.top = top + 'px'; el.style.bottom = 'auto';
                } else {
                    el.style.left = '20px'; el.style.top = 'auto'; el.style.bottom = '20px';
                }
            },

            _bindDrag(el, handle) {
                let start = null;
                handle.addEventListener('pointerdown', (e) => {
                    if (e.button !== 0 || e.target.closest('button, a, input, label')) return;
                    const r = el.getBoundingClientRect();
                    start = { x: e.clientX, y: e.clientY, left: r.left, top: r.top, moved: false };
                    handle.setPointerCapture(e.pointerId);
                });
                handle.addEventListener('pointermove', (e) => {
                    if (!start) return;
                    const dx = e.clientX - start.x, dy = e.clientY - start.y;
                    if (!start.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
                    start.moved = true;
                    const left = Math.min(Math.max(0, start.left + dx), window.innerWidth - el.offsetWidth);
                    const top = Math.min(Math.max(0, start.top + dy), window.innerHeight - el.offsetHeight);
                    el.style.left = left + 'px'; el.style.top = top + 'px'; el.style.bottom = 'auto';
                    this._positionFloats();
                });
                const end = () => {
                    if (start && start.moved) {
                        try { localStorage.setItem(POS_KEY, JSON.stringify({ left: parseFloat(el.style.left), top: parseFloat(el.style.top) })); } catch (e) { /* ignore */ }
                    }
                    start = null;
                };
                handle.addEventListener('pointerup', end);
                handle.addEventListener('pointercancel', end);
            },

            _resetPanelPos() {
                try { localStorage.removeItem(POS_KEY); localStorage.removeItem(SIZE_KEY); } catch (e) { /* ignore */ }
                if (this._panel) { this._applySize(this._panel); this._applyPanelPos(this._panel); this._fitPanel(this._panel); }
            },

            // ================= 浮窗大小 =================
            // 拖动浮窗边缘或右下角可以放大缩小（可以铺满整个页面），大小会被记住；收起时不生效
            _loadSize() {
                try {
                    const o = JSON.parse(localStorage.getItem(SIZE_KEY) || 'null');
                    if (o && isFinite(o.w) && isFinite(o.h)) return o;
                } catch (e) { /* ignore */ }
                return null;
            },
            _applySize(el) {
                if (!el) return;
                const sz = this._panelCollapsed ? null : this._loadSize();
                el.classList.toggle('xxt-sized', !!sz);
                if (!sz) { el.style.width = '324px'; el.style.height = ''; return; }
                el.style.width = Math.round(Math.min(Math.max(PANEL_MIN_W, sz.w), window.innerWidth)) + 'px';
                el.style.height = Math.round(Math.min(Math.max(PANEL_MIN_H, sz.h), window.innerHeight)) + 'px';
            },
            _applyTheme(el) {
                const theme = this._resolvedTheme();
                if (el.getAttribute('data-theme') !== theme) el.setAttribute('data-theme', theme);
                const custom = C.theme === 'custom';
                el.classList.toggle('xxt-custom', custom);
                if (custom) {
                    el.style.setProperty('--x-c', C.customColor);
                    el.style.setProperty('--x-on-accent', onAccent(C.customColor));
                    el.style.setProperty('--x-manual', manualFor(C.customColor));
                } else {
                    el.style.removeProperty('--x-c');
                    el.style.removeProperty('--x-on-accent');
                    el.style.removeProperty('--x-manual');
                }
            },
            _setCustom(color, base, save) {
                if (color && /^#[0-9a-f]{6}$/i.test(color)) C.customColor = color.toLowerCase();
                if (base === 'light' || base === 'dark') C.customBase = base;
                C.theme = 'custom';
                if (this._panel) {
                    this._applyTheme(this._panel);
                    const hex = this._panel.querySelector('[data-k="chex"]');
                    if (hex) hex.textContent = C.customColor.toUpperCase();
                }
                if (save) { saveSettings(); this._panelKey = ''; this._renderPanel(); }
            },
            _resolvedTheme() {
                if (C.theme === 'custom') return C.customBase === 'dark' ? 'dark' : 'light';
                if (C.theme !== 'auto') return C.theme;
                try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'light'; }
            },
            _setTheme(k) {
                if (!THEMES.some((t) => t[0] === k)) return;
                C.theme = k;
                saveSettings();
                log(`浮窗主题：${THEMES.find((t) => t[0] === k)[1]}`, '#2196F3');
                this._panelKey = '';
                this._renderPanel();
            },
            // 一键还原默认大小（位置保留，超出屏幕时自动挪回来）
            _restoreSize(withPos) {
                const el = this._panel;
                try { localStorage.removeItem(SIZE_KEY); if (withPos) localStorage.removeItem(POS_KEY); } catch (e) { /* ignore */ }
                if (!el) return;
                this._animatePanel(() => this._applySize(el));
                log(withPos ? '浮窗已恢复默认位置和大小' : '浮窗已还原默认大小', '#2196F3');
            },
            _bindResize(el) {
                let st = null;
                for (const h of el.querySelectorAll('[data-rz]')) {
                    h.addEventListener('pointerdown', (e) => {
                        if (e.button !== 0 || this._panelCollapsed) return;
                        e.preventDefault(); e.stopPropagation();
                        if (this._resizeAnim) this._resizeAnim.cancel();
                        const r = el.getBoundingClientRect();
                        st = { dir: h.getAttribute('data-rz'), x: e.clientX, y: e.clientY, r, id: e.pointerId, moved: false };
                        el.style.left = r.left + 'px'; el.style.top = r.top + 'px'; el.style.bottom = 'auto';
                        el.classList.add('xxt-resizing');
                        h.setPointerCapture(e.pointerId);
                    });
                    h.addEventListener('pointermove', (e) => {
                        if (!st || e.pointerId !== st.id) return;
                        const dx = e.clientX - st.x, dy = e.clientY - st.y, r = st.r, d = st.dir;
                        let left = r.left, top = r.top, w = r.width, hh = r.height;
                        if (d.includes('e')) w = Math.min(Math.max(PANEL_MIN_W, r.width + dx), window.innerWidth - r.left);
                        if (d.includes('s')) hh = Math.min(Math.max(PANEL_MIN_H, r.height + dy), window.innerHeight - r.top);
                        if (d.includes('w')) { w = Math.min(Math.max(PANEL_MIN_W, r.width - dx), r.right); left = r.right - w; }
                        if (d.includes('n')) { hh = Math.min(Math.max(PANEL_MIN_H, r.height - dy), r.bottom); top = r.bottom - hh; }
                        st.moved = true;
                        el.classList.add('xxt-sized');
                        el.style.width = w + 'px'; el.style.height = hh + 'px';
                        el.style.left = left + 'px'; el.style.top = top + 'px';
                        this._fitPanel(el);
                        this._positionFloats();
                    });
                    const end = (e) => {
                        if (!st || (e && e.pointerId !== st.id)) return;
                        if (st.moved) {
                            const r = el.getBoundingClientRect();
                            try {
                                localStorage.setItem(SIZE_KEY, JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height) }));
                                localStorage.setItem(POS_KEY, JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) }));
                            } catch (err) { /* ignore */ }
                        }
                        st = null;
                        el.classList.remove('xxt-resizing');
                        this._panelKey = '';
                        this._renderPanel();
                    };
                    h.addEventListener('pointerup', end);
                    h.addEventListener('pointercancel', end);
                    h.addEventListener('dblclick', () => this._restoreSize(false));
                }
            },

            // ================= 学习助手：今日目标 / 休息提醒 / 章节小结 / 笔记 =================
            // 提示不覆盖“更新”这类更重要的提示
            _softNotice(n) {
                const cur = this._notice;
                if (cur && Date.now() < cur.until && (cur.kind === 'upd' || cur.kind === 'tip')) return false;
                this._notice = n;
                return true;
            },
            _goalInfo() {
                const goal = (C.dailyGoal || 60) * 60;
                const sec = this._statSummary().todaySec;
                return { goal, sec, pct: Math.min(100, Math.round((sec / goal) * 100)), done: sec >= goal };
            },
            _assistTick(dt) {
                if (this._mode === 'list' || !C.assistMode) return;
                const now = Date.now();
                if (this._isStudying()) {
                    // 连续学习：中断超过 5 分钟就重新计时
                    if (this._restLastTs && now - this._restLastTs > 5 * 60000) this._restSec = 0;
                    this._restSec = (this._restSec || 0) + dt;
                    this._restLastTs = now;
                    if (C.breakRemind && this._restSec >= C.breakAfterMin * 60) {
                        this._restSec = 0;
                        if (this._softNotice({ kind: 'rest', until: now + 5 * 60000, text: `☕ 已经连续学习 ${C.breakAfterMin} 分钟了，起来活动一下、看看远处吧` })) {
                            if (C.alertSound) this._beep();
                            log(`休息提醒：已连续学习 ${C.breakAfterMin} 分钟`, '#22B573');
                        }
                    }
                    if (this._mode === 'course') {
                        const ch = this._chapterName();
                        if (ch && this._chapAcc && this._chapAcc.name === ch) this._chapAcc.sec += dt;
                    }
                }
                // 章节小结：进入新的一章时，总结上一章
                if (this._mode === 'course') {
                    const ch = this._chapterName();
                    if (ch && (!this._chapAcc || this._chapAcc.name !== ch)) {
                        const prev = this._chapAcc;
                        if (prev && prev.sec >= 120) {
                            const notes = Object.values(this._loadNotes()).filter((x) => x.chap === prev.name).length;
                            this._softNotice({ kind: 'rest', until: now + 20000, text: `✅ 学完「${prev.name}」· 本章用时 ${fmtShort(prev.sec)}${notes ? ` · 记了 ${notes} 条笔记` : ''}` });
                        }
                        this._chapAcc = { name: ch, sec: 0 };
                    }
                }
                // 今日目标完成时提醒一次
                const g = this._goalInfo();
                if (g.done) {
                    const day = this._loadStats().days[dayKey()];
                    if (day && !day.goalHit) {
                        day.goalHit = 1;
                        this._saveStats(true);
                        if (this._softNotice({ kind: 'rest', until: now + 20000, text: `🎯 今日目标 ${C.dailyGoal} 分钟已完成，继续保持！` }) && C.alertSound) this._beep();
                    }
                }
            },
            _toggleAssist() {
                C.assistMode = !C.assistMode;
                saveSettings();
                if (!C.assistMode && this._notice && this._notice.kind === 'rest') this._notice = null;
                this._chapAcc = null;
                log(`学习助手：${C.assistMode ? '开启' : '关闭'}`, '#2196F3');
                this._panelKey = '';
                this._renderPanel();
            },
            _setGoal(m) {
                if (!GOAL_OPTIONS.includes(m)) return;
                C.dailyGoal = m;
                saveSettings();
                const day = this._loadStats().days[dayKey()];
                if (day && !this._goalInfo().done) delete day.goalHit;
                this._panelKey = '';
                this._renderPanel();
            },

            _notesKey() { return NOTES_PREFIX + this._courseKey(); },
            _loadNotes() {
                try {
                    const o = JSON.parse(localStorage.getItem(this._notesKey()) || '{}');
                    return o && typeof o === 'object' ? o : {};
                } catch (e) { return {}; }
            },
            _saveNote(title, text) {
                if (!title) return;
                const notes = this._loadNotes();
                text = String(text || '').replace(/\s+$/, '');
                if (text) notes[title] = { t: text, chap: this._chapterName(), ts: Date.now() };
                else delete notes[title];
                try {
                    if (Object.keys(notes).length) localStorage.setItem(this._notesKey(), JSON.stringify(notes));
                    else localStorage.removeItem(this._notesKey());
                } catch (e) { /* ignore */ }
                this._notesVer = (this._notesVer || 0) + 1;
            },
            _notesText() {
                const notes = this._loadNotes();
                const order = (() => { try { return this._nodes().toArray().map((n) => this._nodeTitle(n)); } catch (e) { return []; } })();
                const titles = Object.keys(notes).sort((a, b) => {
                    const ia = order.indexOf(a), ib = order.indexOf(b);
                    return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib) || notes[a].ts - notes[b].ts;
                });
                let name = '';
                try { name = (JSON.parse(localStorage.getItem(NAMES_KEY) || '{}') || {})[this._courseKey()] || ''; } catch (e) { name = ''; }
                const out = [`【${name || '课程'}笔记】`];
                let chap = null;
                for (const t of titles) {
                    const n = notes[t];
                    if (n.chap !== chap) { chap = n.chap; if (chap) out.push('', `## ${chap}`); }
                    out.push('', `### ${t}`, n.t);
                }
                return out.join('\n');
            },
            _copyText(text, okMsg, failMsg) {
                const done = (ok) => {
                    this._notice = { kind: ok ? 'upd' : 'bg', until: Date.now() + 8000, text: ok ? okMsg : failMsg };
                    this._panelKey = '';
                    this._renderPanel();
                };
                const legacy = () => {
                    try {
                        const ta = document.createElement('textarea');
                        ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0';
                        document.body.appendChild(ta); ta.select();
                        const ok = document.execCommand('copy');
                        ta.remove(); done(ok);
                    } catch (e) { done(false); }
                };
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), legacy);
                    else legacy();
                } catch (e) { legacy(); }
            },

            // 进度环
            _ring(pct, color, size, label) {
                const r = (size - 6) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
                return `<span class="xxt-ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
                    `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:var(--x-line)" stroke-width="5"/>` +
                    `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:${color}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>` +
                    `</svg><b>${label}</b></span>`;
            },

            _esc(t) { return String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); },

            _renderToday(el, ss) {
                const q = (k) => el.querySelector(`[data-k="${k}"]`);
                const g = this._goalInfo();
                q('goal').innerHTML = this._ring(g.pct, g.done ? '#22B573' : 'var(--x-accent)', 48, `${Math.floor(g.sec / 60)}′`) +
                    `<span class="xxt-goal-text"><b>${g.done ? '🎯 今日目标已完成' : `今日目标 ${C.dailyGoal} 分钟`}</b>` +
                    `<span>已学 ${fmtShort(g.sec)} · 完成 ${ss.todayNodes} 节${g.done ? '' : ` · 还差 ${fmtShort(g.goal - g.sec)}`}</span></span>`;
                const nt = this._mode === 'course' ? this._currentNodeTitle() : '';
                q('notewrap').style.display = nt ? 'flex' : 'none';
                const ta = q('note');
                if (nt && ta.getAttribute('data-title') !== nt && document.activeElement !== ta) {
                    ta.setAttribute('data-title', nt);
                    ta.value = (this._loadNotes()[nt] || {}).t || '';
                    q('notestate').textContent = ta.value ? '已保存在本机' : '';
                }
            },

            _renderCourseDetail(el, prog) {
                const box = el.querySelector('[data-k="cdetail"]');
                const p = this._progress;
                if (!p || !prog) { box.innerHTML = '<div class="xxt-empty">正在读取课程目录…</div>'; return; }
                const esc = (t) => this._esc(t);
                let h = `<div class="xxt-goal">${this._ring(prog.pct, 'var(--x-accent)', 48, prog.pct + '%')}<span class="xxt-goal-text"><b>已完成 ${p.done} / ${p.total} 节</b><span>${esc(prog.etaText)}</span></span></div>`;
                if (p.manual.length) {
                    h += `<div class="xxt-sec-title"><span>待手动完成</span><small>章节测验、讨论等 · ${p.manual.length} 节</small></div><div class="xxt-todo">` +
                        p.manual.slice(0, 6).map((t) => `<div title="${esc(t)}"><i></i>${esc(t)}</div>`).join('') +
                        (p.manual.length > 6 ? `<div class="xxt-more">还有 ${p.manual.length - 6} 节</div>` : '') + '</div>';
                }
                const notes = this._loadNotes();
                const list = Object.entries(notes).sort((a, b) => b[1].ts - a[1].ts);
                h += `<div class="xxt-sec-title"><span>本课程笔记</span><small>${list.length} 条</small></div>`;
                if (list.length) {
                    h += '<div class="xxt-nlist">' + list.slice(0, 4).map(([t, n]) =>
                        `<div class="xxt-nitem" title="${esc(n.t)}"><b>${esc(t)}</b><span>${esc(n.t.split('\n')[0])}</span></div>`).join('') + '</div>' +
                        '<button type="button" class="xxt-set-btn xxt-wide" data-act="copynotes">复制全部笔记</button>';
                } else {
                    h += '<div class="xxt-empty">还没有笔记。在「今天」里可以随手记下每一节的要点，会按章节整理在这里。</div>';
                }
                box.innerHTML = h;
            },

            _renderRecord(el, ss) {
                const q = (k) => el.querySelector(`[data-k="${k}"]`);
                const st = this._loadStats();
                const total = Object.values(st.days).reduce((a, x) => a + (x.sec || 0), 0);
                const tile = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
                q('recsum').innerHTML = tile(fmtShort(ss.todaySec), '今日') + tile(fmtShort(ss.weekSec), '本周') + tile(`${ss.streak} 天`, '连续学习') + tile(fmtShort(total), '累计');
                const max = Math.max(60, ...ss.week.map((x) => x.sec));
                const wd = '日一二三四五六';
                q('chart').innerHTML =
                    '<div class="xxt-sec-title" style="margin-top:0"><span>最近 7 天</span><small>分钟</small></div>' +
                    '<div class="xxt-bars">' + ss.week.map((x, i) =>
                        `<div class="xxt-bar${i === 6 ? ' today' : ''}" title="${x.key}：${fmtDur(x.sec)}，完成 ${x.nodes} 节"><em>${x.sec >= 60 ? Math.round(x.sec / 60) : ''}</em><i style="height:${Math.round((x.sec / max) * 46)}px"></i></div>`).join('') + '</div>' +
                    '<div class="xxt-days">' + ss.week.map((x, i) => `<span>${i === 6 ? '今天' : '周' + wd[x.date.getDay()]}</span>`).join('') + '</div>';
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const start = new Date(today); start.setDate(start.getDate() - today.getDay() - 7 * 11);
                let cols = '';
                for (let w = 0; w < 12; w++) {
                    cols += '<span class="xxt-hcol">';
                    for (let d = 0; d < 7; d++) {
                        const dt = new Date(start); dt.setDate(start.getDate() + w * 7 + d);
                        if (dt > today) { cols += '<i class="lx"></i>'; continue; }
                        const k = dayKey(dt), sec = (st.days[k] || {}).sec || 0, m = sec / 60;
                        const lv = m < 1 ? 0 : m < 15 ? 1 : m < 30 ? 2 : m < 60 ? 3 : 4;
                        cols += `<i class="l${lv}" title="${k}：${sec >= 60 ? fmtShort(sec) : '未学习'}"></i>`;
                    }
                    cols += '</span>';
                }
                q('heat').innerHTML = '<div class="xxt-sec-title"><span>学习日历</span><small>最近 12 周 · 颜色越深学得越久</small></div>' +
                    `<div class="xxt-hgrid">${cols}</div>` +
                    '<div class="xxt-hlegend">少<i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i>多</div>';
            },

            // ================= 唱片机（浮窗侧边栏） =================
            // 音乐来自用户自己添加的本地文件，保存在本机浏览器（IndexedDB）里，不上传、不内置任何音乐
            _musicDB() {
                if (!this._mdb) {
                    this._mdb = new Promise((res, rej) => {
                        try {
                            const r = indexedDB.open('xxt-v41-music', 1);
                            r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('tracks')) r.result.createObjectStore('tracks', { keyPath: 'id' }); };
                            r.onsuccess = () => res(r.result);
                            r.onerror = () => rej(r.error);
                        } catch (e) { rej(e); }
                    });
                }
                return this._mdb;
            },
            async _musicStore(mode, fn) {
                const db = await this._musicDB();
                return new Promise((res, rej) => {
                    const tx = db.transaction('tracks', mode);
                    const req = fn(tx.objectStore('tracks'));
                    tx.oncomplete = () => res(req && req.result);
                    tx.onerror = () => rej(tx.error);
                });
            },
            async _musicLoad() {
                try {
                    const all = (await this._musicStore('readonly', (s) => s.getAll())) || [];
                    all.sort((a, b) => a.added - b.added);
                    this._tracks = all;
                } catch (e) {
                    this._tracks = [];
                    log('唱片机：读取本地音乐失败 ' + (e && e.message), '#FF9800', 'warn');
                }
                this._renderMusic();
            },
            async _musicAdd(files, fromConv) {
                let n = 0;
                const probe = document.createElement('audio');
                const extType = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg; codecs=opus', wav: 'audio/wav', flac: 'audio/flac', webm: 'audio/webm' };
                const needConv = [];
                for (const f of files) {
                    if (!f) continue;
                    const ext = ((f.name || '').match(/\.([^.]+)$/) || [])[1] || '';
                    const type = /^audio\//.test(f.type || '') ? f.type : extType[ext.toLowerCase()] || '';
                    // 视频文件、浏览器放不了的格式：交给格式转换
                    if (!fromConv && (/^video\//.test(f.type || '') || !type || !probe.canPlayType(type))) { needConv.push(f); continue; }
                    const t = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name: (f.name || '未命名').replace(/\.[^.]+$/, ''), blob: f, added: Date.now() + n };
                    try { await this._musicStore('readwrite', (s) => s.put(t)); n++; } catch (e) { log('唱片机：保存失败（可能是浏览器存储空间不足）', '#FF9800', 'warn'); }
                }
                if (n) log(`唱片机：添加了 ${n} 首音乐`, '#2196F3');
                await this._musicLoad();
                if (n && !this._curTrack && this._tracks.length) this._musicPlay(this._tracks[this._tracks.length - n].id);
                if (needConv.length) this._convQueue(needConv, `有 ${needConv.length} 个文件不能直接播放（视频或特殊格式），已放进下面的列表，点「开始转换」转成 MP3 后会自动加入唱片机`);
            },
            // ================= 唱片机 · 音频格式转换 =================
            // 全部在本机浏览器里完成：用浏览器自带的解码器读出声音，再编码成 MP3（lamejs）或 WAV，不上传任何文件。
            // 音乐软件的加密格式（如 .ncm / .qmc / .kgm）属于版权保护，不提供转换。
            _convOpts() {
                const d = { fmt: 'mp3', br: 192, sr: 44100, ch: 0, add: true, dl: false };
                try { return Object.assign(d, JSON.parse(localStorage.getItem('xxt-v41-conv') || '{}')); } catch (e) { return d; }
            },
            _convSaveOpts(o) { try { localStorage.setItem('xxt-v41-conv', JSON.stringify(o)); } catch (e) { /* ignore */ } },
            _convQueue(files, hint) {
                this._convQ = this._convQ || [];
                for (const f of files) {
                    if (!f) continue;
                    this._convQ.push({ id: Math.random().toString(36).slice(2, 9), file: f, name: f.name || '未命名', status: 'wait', pct: 0, msg: '' });
                }
                this._convHint = hint || '';
                this._convOpen = true;
                this._renderConv();
            },
            async _loadLame() {
                if (window.lamejs && window.lamejs.Mp3Encoder) return window.lamejs;
                if (!this._lameP) {
                    this._lameP = (async () => {
                        for (const url of ['https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js', 'https://unpkg.com/lamejs@1.2.1/lame.min.js']) {
                            try {
                                await new Promise((res, rej) => {
                                    const sc = document.createElement('script');
                                    sc.src = url; sc.async = true;
                                    sc.onload = res; sc.onerror = () => rej(new Error('load'));
                                    (document.head || document.documentElement).appendChild(sc);
                                });
                                if (window.lamejs && window.lamejs.Mp3Encoder) return window.lamejs;
                            } catch (e) { /* 换下一个地址 */ }
                        }
                        throw new Error('MP3 编码组件下载失败，请检查网络，或改用 WAV 格式');
                    })();
                    this._lameP.catch(() => { this._lameP = null; });
                }
                return this._lameP;
            },
            // 不受后台限速影响的让步，转换长音频时界面不卡
            _yield() { return new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); }); },
            async _convOne(it, o) {
                if (/\.(ncm|qmc\d*|qmcflac|qmcogg|mflac\d*|mgg\d*|kgm|kgma|vpr|kwm|tkm|bkcmp3|bkcflac|xm|mmp4)$/i.test(it.name)) {
                    const e = new Error('音乐软件的加密格式，受版权保护，无法转换。请在原音乐软件里导出或下载普通格式'); e.drm = true; throw e;
                }
                it.msg = '读取中…'; this._renderConv();
                const data = await it.file.arrayBuffer();
                if (this._convAbort) throw new Error('已停止');
                it.msg = '解码中…'; this._renderConv();
                const rate = [48000, 44100, 32000, 22050].includes(Number(o.sr)) ? Number(o.sr) : 44100;
                const OCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
                let audio;
                try { audio = await new OCtx(2, 1, rate).decodeAudioData(data); }
                catch (e) { throw new Error('浏览器无法解码这个文件（WMA、APE、AMR 等格式暂不支持），可以先用其他软件转成 MP3'); }
                const ch = Number(o.ch) === 1 ? 1 : Number(o.ch) === 2 ? 2 : Math.min(2, audio.numberOfChannels);
                const L = audio.getChannelData(0), R = audio.numberOfChannels > 1 ? audio.getChannelData(1) : L;
                const len = audio.length;
                const toI16 = (x) => (x < -1 ? -32768 : x > 1 ? 32767 : (x < 0 ? x * 32768 : x * 32767) | 0);
                const base = it.name.replace(/\.[^.]+$/, '') || '未命名';
                if (o.fmt === 'wav') {
                    const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
                    const w = (p, s) => { for (let i = 0; i < s.length; i++) out.setUint8(p + i, s.charCodeAt(i)); };
                    w(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
                    out.setUint16(22, ch, true); out.setUint32(24, rate, true); out.setUint32(28, rate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
                    w(36, 'data'); out.setUint32(40, len * ch * 2, true);
                    let p = 44;
                    for (let i = 0; i < len; i++) {
                        if (ch === 1) { out.setInt16(p, toI16((L[i] + R[i]) / 2), true); p += 2; }
                        else { out.setInt16(p, toI16(L[i]), true); out.setInt16(p + 2, toI16(R[i]), true); p += 4; }
                        if ((i & 0x3ffff) === 0) { it.pct = Math.round((i / len) * 100); this._renderConv(); await this._yield(); if (this._convAbort) throw new Error('已停止'); }
                    }
                    return new File([out.buffer], base + '.wav', { type: 'audio/wav' });
                }
                it.msg = '准备编码…'; this._renderConv();
                const lame = await this._loadLame();
                const br = [128, 192, 256, 320].includes(Number(o.br)) ? Number(o.br) : 192;
                const enc = new lame.Mp3Encoder(ch, rate, br);
                const block = 1152 * 20, parts = [];
                const l16 = new Int16Array(block), r16 = new Int16Array(block);
                for (let i = 0; i < len; i += block) {
                    const n = Math.min(block, len - i);
                    for (let k = 0; k < n; k++) {
                        if (ch === 1) l16[k] = toI16((L[i + k] + R[i + k]) / 2);
                        else { l16[k] = toI16(L[i + k]); r16[k] = toI16(R[i + k]); }
                    }
                    const mp3 = ch === 1 ? enc.encodeBuffer(l16.subarray(0, n)) : enc.encodeBuffer(l16.subarray(0, n), r16.subarray(0, n));
                    if (mp3.length) parts.push(new Uint8Array(mp3));
                    it.pct = Math.round(((i + n) / len) * 100);
                    if ((i / block) % 8 === 0) { this._renderConv(); await this._yield(); if (this._convAbort) throw new Error('已停止'); }
                }
                const end = enc.flush();
                if (end.length) parts.push(new Uint8Array(end));
                return new File(parts, base + '.mp3', { type: 'audio/mpeg' });
            },
            async _convRun() {
                if (this._convRunning) return;
                const q = (this._convQ || []).filter((x) => x.status === 'wait' || x.status === 'fail');
                if (!q.length) return;
                const o = this._convOpts();
                this._convRunning = true; this._convAbort = false;
                this._renderConv();
                const added = [];
                for (const it of q) {
                    if (this._convAbort) break;
                    it.status = 'run'; it.pct = 0; it.msg = '';
                    this._renderConv();
                    try {
                        const out = await this._convOne(it, o);
                        it.status = 'done'; it.pct = 100;
                        it.msg = `已转成 ${out.name.split('.').pop().toUpperCase()} · ${(out.size / 1048576).toFixed(1)} MB`;
                        if (o.add) added.push(out);
                        if (o.dl) {
                            const url = URL.createObjectURL(out), a = document.createElement('a');
                            a.href = url; a.download = out.name; a.style.display = 'none';
                            document.body.appendChild(a); a.click(); a.remove();
                            setTimeout(() => URL.revokeObjectURL(url), 60000);
                        }
                        log(`格式转换：${it.name} → ${out.name}`, '#2196F3');
                    } catch (e) {
                        it.status = e.drm ? 'drm' : (this._convAbort ? 'wait' : 'fail');
                        it.msg = this._convAbort ? '' : (e && e.message) || '转换失败';
                        it.pct = 0;
                    }
                    this._renderConv();
                }
                this._convRunning = false;
                if (added.length) await this._musicAdd(added, true);
                this._renderConv();
            },
            _renderConv() {
                const d = this._musicEl;
                if (!d) return;
                const q = (k) => d.querySelector(`[data-m="${k}"]`);
                d.classList.toggle('conv', !!this._convOpen);
                if (!this._convOpen) return;
                const esc = (t) => this._esc(t);
                const list = this._convQ || [];
                const label = { wait: '等待转换', run: '转换中', done: '完成', fail: '失败', drm: '无法转换' };
                q('convhint').textContent = this._convHint || '';
                q('convhint').style.display = this._convHint ? 'block' : 'none';
                q('convlist').innerHTML = list.length ? list.map((it) =>
                    `<div class="xm-cq-item ${it.status}"><div class="xm-cq-top"><span class="xm-cq-name" title="${esc(it.name)}">${esc(it.name)}</span>` +
                    `<span class="xm-cq-st">${it.status === 'run' ? (it.pct ? it.pct + '%' : esc(it.msg || '转换中')) : label[it.status]}</span>` +
                    (it.status === 'run' ? '' : `<button type="button" class="xm-del" data-cdel="${it.id}" aria-label="移除">×</button>`) + '</div>' +
                    (it.status === 'run' ? `<i class="xm-cq-bar"><b style="width:${it.pct}%"></b></i>` : '') +
                    (it.msg && it.status !== 'run' ? `<div class="xm-cq-msg">${esc(it.msg)}</div>` : '') + '</div>').join('')
                    : '<div class="xm-empty">还没有文件</div>';
                const o = this._convOpts();
                for (const [k, v] of [['cfmt', o.fmt], ['cbr', o.br], ['csr', o.sr], ['cch', o.ch]]) { const el = q(k); if (document.activeElement !== el) el.value = String(v); }
                q('cbr').disabled = o.fmt !== 'mp3';
                q('cadd').checked = !!o.add; q('cdl').checked = !!o.dl;
                const running = !!this._convRunning;
                q('cstart').disabled = running || !list.some((x) => x.status === 'wait' || x.status === 'fail');
                q('cstart').textContent = running ? '转换中…' : '开始转换';
                q('cstop').disabled = !running;
                q('cclear').disabled = running || !list.length;
            },


            async _musicRemove(id) {
                if (String(id).startsWith('gen:')) return;
                if (this._curTrack === id) { this._musicStop(); }
                try { await this._musicStore('readwrite', (s) => s.delete(id)); } catch (e) { /* ignore */ }
                await this._musicLoad();
            },
            _musicAudio() {
                if (this._audio) return this._audio;
                const a = new Audio();
                a.preload = 'auto';
                let vol = 0.6;
                try { const v = parseFloat(localStorage.getItem('xxt-v41-music-vol')); if (v >= 0 && v <= 1) vol = v; } catch (e) { /* ignore */ }
                a.volume = vol;
                a.addEventListener('timeupdate', () => this._musicTick());
                a.addEventListener('loadedmetadata', () => this._musicTick());
                a.addEventListener('play', () => this._renderMusic());
                a.addEventListener('pause', () => this._renderMusic());
                a.addEventListener('ended', () => this._musicNext(true));
                a.addEventListener('error', () => { if (this._curTrack) { log('唱片机：这首音乐无法播放，已跳过', '#FF9800', 'warn'); this._musicNext(true); } });
                this._audio = a;
                return a;
            },
            // 内置环境音：由浏览器实时合成（不是音频文件），没有版权问题，也不占下载体积
            _builtinTracks() {
                return [
                    { id: 'gen:piano', name: '轻钢琴 · 专注', builtin: true },
                    { id: 'gen:rain', name: '窗外雨声', builtin: true },
                    { id: 'gen:waves', name: '海浪', builtin: true },
                    { id: 'gen:fire', name: '壁炉篝火', builtin: true },
                    { id: 'gen:noise', name: '粉红噪音 · 屏蔽杂音', builtin: true },
                ];
            },
            _allTracks() { return this._builtinTracks().concat(this._tracks || []); },
            _musicVolume() {
                if (this._audio) return this._audio.volume;
                try { const x = parseFloat(localStorage.getItem('xxt-v41-music-vol')); return x >= 0 && x <= 1 ? x : 0.6; } catch (e) { return 0.6; }
            },
            _genStop() {
                const g = this._gen;
                this._gen = null;
                if (!g) return;
                g.stopped = true;
                try { g.master.gain.setTargetAtTime(0, g.ctx.currentTime, 0.08); } catch (e) { /* ignore */ }
                setTimeout(() => { for (const n of g.nodes) { try { n.stop(); } catch (e) { /* ignore */ } try { n.disconnect(); } catch (e) { /* ignore */ } } try { g.master.disconnect(); } catch (e) { /* ignore */ } }, 400);
            },
            _genStart(kind) {
                this._genStop();
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return false;
                const ctx = this._genCtx || (this._genCtx = new Ctx());
                if (ctx.state === 'suspended') ctx.resume();
                const g = { kind, ctx, nodes: [], stopped: false };
                const master = ctx.createGain();
                master.gain.setValueAtTime(0, ctx.currentTime);
                master.gain.setTargetAtTime(this._musicVolume(), ctx.currentTime, 0.4);   // 淡入
                master.connect(ctx.destination);
                g.master = master;
                const noise = (type, sec = 6) => {
                    const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
                    let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
                    for (let i = 0; i < len; i++) {
                        const w = Math.random() * 2 - 1;
                        if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
                        else if (type === 'pink') {
                            b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
                            b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
                            d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
                        } else d[i] = w;
                    }
                    return buf;
                };
                const bed = (type, gain, ftype, freq, q) => {
                    const src = ctx.createBufferSource(); src.buffer = noise(type); src.loop = true;
                    const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.value = freq; if (q) f.Q.value = q;
                    const gn = ctx.createGain(); gn.gain.value = gain;
                    src.connect(f).connect(gn).connect(master); src.start();
                    g.nodes.push(src);
                    return gn;
                };
                const lfo = (target, rate, depth) => {
                    const o = ctx.createOscillator(), og = ctx.createGain();
                    o.frequency.value = rate; og.gain.value = depth; o.connect(og).connect(target); o.start(); g.nodes.push(o);
                };
                // 用后台线程计时持续安排后面几秒的声音，页面在后台也不会断
                const loop = (fn, everyMs) => { const step = () => { if (g.stopped) return; fn(); this._wait(step, everyMs); }; step(); };
                const burst = (t, dur, freq, gain, type = 'bandpass') => {
                    const src = ctx.createBufferSource(); src.buffer = g.click || (g.click = noise('white', 0.25));
                    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 1.2;
                    const gn = ctx.createGain(); gn.gain.setValueAtTime(gain, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
                    src.connect(f).connect(gn).connect(master); src.start(t, Math.random() * 0.1, dur + 0.02);
                };
                if (kind === 'rain') {
                    bed('brown', 0.55, 'lowpass', 1100);
                    bed('pink', 0.16, 'highpass', 2500);
                    loop(() => { const t0 = ctx.currentTime; for (let i = 0; i < 14; i++) burst(t0 + Math.random() * 0.5, 0.03 + Math.random() * 0.05, 2500 + Math.random() * 3500, 0.03 + Math.random() * 0.08); }, 500);
                } else if (kind === 'waves') {
                    const w = bed('brown', 0.35, 'lowpass', 700);
                    lfo(w.gain, 0.085, 0.3);
                    const hiss = bed('pink', 0.04, 'bandpass', 1800, 0.6);
                    lfo(hiss.gain, 0.085, 0.035);
                } else if (kind === 'fire') {
                    bed('brown', 0.4, 'lowpass', 380);
                    loop(() => {
                        const t0 = ctx.currentTime;
                        for (let i = 0; i < 6; i++) if (Math.random() < 0.7) burst(t0 + Math.random() * 0.5, 0.008 + Math.random() * 0.02, 1500 + Math.random() * 4000, 0.15 + Math.random() * 0.35, 'highpass');
                    }, 500);
                } else if (kind === 'noise') {
                    bed('pink', 0.5, 'lowpass', 7000);
                } else {
                    // 轻钢琴：五声音阶随机生成，配上回声，不会重复也不会打扰
                    const out = ctx.createGain(); out.gain.value = 0.9;
                    const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.42;
                    const fb = ctx.createGain(); fb.gain.value = 0.38;
                    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2600;
                    out.connect(tone).connect(master); tone.connect(delay); delay.connect(fb).connect(delay); delay.connect(master);
                    g.nodes.push({ stop() {}, disconnect() { try { out.disconnect(); delay.disconnect(); fb.disconnect(); tone.disconnect(); } catch (e) { /* ignore */ } } });
                    const scale = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880];
                    const note = (t, f, v) => {
                        for (const [mul, type, amp] of [[1, 'triangle', 1], [2, 'sine', 0.25], [3, 'sine', 0.08]]) {
                            const o = ctx.createOscillator(), gn = ctx.createGain();
                            o.type = type; o.frequency.value = f * mul;
                            gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.16 * v * amp, t + 0.015);
                            gn.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
                            o.connect(gn).connect(out); o.start(t); o.stop(t + 3);
                        }
                    };
                    let next = ctx.currentTime + 0.3, idx = 4;
                    loop(() => {
                        while (next < ctx.currentTime + 2) {
                            idx = Math.max(0, Math.min(scale.length - 1, idx + Math.round((Math.random() - 0.5) * 4)));
                            note(next, scale[idx], 0.6 + Math.random() * 0.4);
                            if (Math.random() < 0.25) note(next + 0.02, scale[Math.max(0, idx - 2)] / 2, 0.5);
                            next += [0.6, 0.9, 1.2, 1.8][Math.floor(Math.random() * 4)];
                        }
                    }, 700);
                }
                this._gen = g;
                return true;
            },

            _musicPlay(id) {
                const t = this._allTracks().find((x) => x.id === id);
                if (!t) return;
                if (t.builtin) {
                    // 内置环境音：停掉文件播放，改由合成器发声
                    if (this._audio) { try { this._audio.pause(); } catch (e) { /* ignore */ } }
                    if (this._curTrack !== id || !this._gen) {
                        if (this._audioUrl) { URL.revokeObjectURL(this._audioUrl); this._audioUrl = null; }
                        this._genStart(id.slice(4));
                        this._curTrack = id;
                        try { localStorage.setItem('xxt-v41-music-last', id); } catch (e) { /* ignore */ }
                    } else if (this._genCtx && this._genCtx.state === 'suspended') this._genCtx.resume();
                    this._genPaused = false;
                    this._renderMusic();
                    return;
                }
                this._genStop();
                this._genPaused = false;
                const a = this._musicAudio();
                if (this._curTrack !== id) {
                    if (this._audioUrl) URL.revokeObjectURL(this._audioUrl);
                    this._audioUrl = URL.createObjectURL(t.blob);
                    a.src = this._audioUrl;
                    this._curTrack = id;
                    try { localStorage.setItem('xxt-v41-music-last', id); } catch (e) { /* ignore */ }
                    try {
                        if (navigator.mediaSession && window.MediaMetadata) {
                            navigator.mediaSession.metadata = new MediaMetadata({ title: t.name, artist: '学习通助手 · 唱片机' });
                            navigator.mediaSession.setActionHandler('previoustrack', () => this._musicNext(false, -1));
                            navigator.mediaSession.setActionHandler('nexttrack', () => this._musicNext(false));
                        }
                    } catch (e) { /* ignore */ }
                }
                const p = a.play();
                if (p && p.catch) p.catch(() => this._renderMusic());
                this._renderMusic();
            },
            _musicToggle() {
                const a = this._audio;
                if (this._curTrack && this._curTrack.startsWith('gen:')) {
                    const ctx = this._genCtx;
                    if (!this._gen) { this._musicPlay(this._curTrack); return; }
                    if (this._genPaused) { this._genPaused = false; if (ctx) ctx.resume(); }
                    else { this._genPaused = true; if (ctx) ctx.suspend(); }
                    this._renderMusic();
                    return;
                }
                if (!this._curTrack) {
                    const list = this._allTracks();
                    let last = null;
                    try { last = localStorage.getItem('xxt-v41-music-last'); } catch (e) { /* ignore */ }
                    const t = list.find((x) => x.id === last) || list[0];
                    if (t) this._musicPlay(t.id);
                    return;
                }
                if (a.paused) { const p = a.play(); if (p && p.catch) p.catch(() => {}); } else a.pause();
            },
            _musicStop() {
                this._genStop();
                this._genPaused = false;
                if (this._audio) { try { this._audio.pause(); this._audio.removeAttribute('src'); this._audio.load(); } catch (e) { /* ignore */ } }
                if (this._audioUrl) { URL.revokeObjectURL(this._audioUrl); this._audioUrl = null; }
                this._curTrack = null;
                this._renderMusic();
            },
            // auto：一首放完自动接下一首（按播放模式）；step：-1 上一首
            _musicNext(auto, step = 1) {
                const list = this._allTracks();
                if (!list.length) { this._musicStop(); return; }
                const mode = this._musicMode();
                const i = list.findIndex((x) => x.id === this._curTrack);
                if (auto && mode === 'one' && i >= 0 && this._audio) { this._audio.currentTime = 0; this._musicPlay(list[i].id); return; }
                let j;
                if (mode === 'shuffle' && list.length > 1) { do { j = Math.floor(Math.random() * list.length); } while (j === i); }
                else j = ((i < 0 ? 0 : i + step) + list.length) % list.length;
                this._musicPlay(list[j].id);
            },
            _musicMode() {
                let m = 'all';
                try { m = localStorage.getItem('xxt-v41-music-mode') || 'all'; } catch (e) { /* ignore */ }
                return ['all', 'one', 'shuffle'].includes(m) ? m : 'all';
            },
            _musicTick() {
                const d = this._musicEl, a = this._audio;
                if (!d) return;
                const seekEl = d.querySelector('[data-m="seek"]');
                const gen = !!(this._curTrack && this._curTrack.startsWith('gen:'));
                seekEl.disabled = gen;
                if (gen) {
                    d.querySelector('[data-m="time"]').textContent = '环境音 · 一直循环';
                    seekEl.value = 1000; seekEl.style.setProperty('--p', '100%');
                    return;
                }
                if (!a) return;
                const fmt = (t) => { t = isFinite(t) ? Math.floor(t) : 0; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
                d.querySelector('[data-m="time"]').textContent = `${fmt(a.currentTime)} / ${fmt(a.duration)}`;
                const seek = d.querySelector('[data-m="seek"]');
                if (!this._seeking) seek.value = a.duration ? Math.round((a.currentTime / a.duration) * 1000) : 0;
                seek.style.setProperty('--p', (seek.value / 10) + '%');
            },
            _toggleMusic() {
                this._musicOpen = !this._musicOpen;
                if (this._musicOpen && !this._tracks) this._musicLoad();
                this._renderMusic();
                this._panelKey = ''; this._renderPanel();
            },
            _ensureMusic() {
                if (this._musicEl && this._musicEl.isConnected) return this._musicEl;
                const d = document.createElement('div');
                d.id = 'xxt-v41-music';
                d.setAttribute('role', 'dialog');
                d.setAttribute('aria-label', '唱片机');
                const icon = (path, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">${path}</svg>`;
                d.innerHTML =
                    '<style>' +
                    '#xxt-v41-music{position:fixed;z-index:2147483646;box-sizing:border-box;width:288px;display:flex;flex-direction:column;padding:14px 16px 12px;border-radius:16px;' +
                      'background:radial-gradient(120% 70% at 50% 0%,#2C2422 0%,#1B1615 60%,#141110 100%);color:#EDE6E2;box-shadow:0 12px 36px rgba(0,0,0,.4),0 1px 3px rgba(0,0,0,.3);' +
                      'font:13px/1.5 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;opacity:0;transform:translateY(8px) scale(.98);pointer-events:none;' +
                      'transition:opacity .38s cubic-bezier(.22,1,.36,1),transform .38s cubic-bezier(.22,1,.36,1)}' +
                    '#xxt-v41-music.open{opacity:1;transform:none;pointer-events:auto}' +
                    '#xxt-v41-music *{box-sizing:border-box}' +
                    '#xxt-v41-music .xm-head{display:flex;align-items:center;gap:8px}' +
                    '#xxt-v41-music .xm-head b{flex:1;font-size:14px;font-weight:600;letter-spacing:.5px}' +
                    '#xxt-v41-music button{font:inherit;color:inherit;cursor:pointer;margin:0;padding:0;border:0;min-width:0;min-height:0;box-shadow:none;text-transform:none;letter-spacing:normal;line-height:inherit}' +
                    '#xxt-v41-music svg{flex:none}' +
                    '#xxt-v41-music .xm-x{border:0;background:none;color:#A89D98;font-size:18px;line-height:1;padding:2px 6px;border-radius:7px}' +
                    '#xxt-v41-music .xm-x:hover,#xxt-v41-music .xm-x:focus-visible{background:rgba(255,255,255,.08);color:#fff;outline:none}' +
                    '#xxt-v41-music .xm-deck{position:relative;width:208px;height:208px;margin:10px auto 6px}' +
                    '#xxt-v41-music .xm-plinth{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,#2A2321 0 70%,#211B1A 71%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.04)}' +
                    '#xxt-v41-music .xm-disc{position:absolute;inset:12px;border-radius:50%;background:' +
                      'radial-gradient(circle,transparent 0 31%,rgba(0,0,0,.65) 31% 32.5%,transparent 32.5%),' +
                      'repeating-radial-gradient(circle,#161616 0 1.6px,#1f1f1f 1.6px 3.2px),#141414;' +
                      'box-shadow:0 6px 18px rgba(0,0,0,.55),inset 0 0 0 2px #0c0c0c;animation:xm-spin 7s linear infinite;animation-play-state:paused}' +
                    '#xxt-v41-music .xm-disc::after{content:"";position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 30deg,transparent 0 8%,rgba(255,255,255,.07) 12%,transparent 18% 58%,rgba(255,255,255,.05) 62%,transparent 68%)}' +
                    '#xxt-v41-music.playing .xm-disc{animation-play-state:running}' +
                    '#xxt-v41-music .xm-label{position:absolute;inset:31%;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;' +
                      'font-size:12px;font-weight:600;line-height:1.3;color:rgba(255,255,255,.92);text-shadow:0 1px 2px rgba(0,0,0,.35);overflow:hidden;word-break:break-all}' +
                    '#xxt-v41-music .xm-label::after{content:"";position:absolute;width:8px;height:8px;border-radius:50%;background:#1B1615;box-shadow:0 0 0 2px rgba(0,0,0,.25)}' +
                    '#xxt-v41-music .xm-label span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:74px;margin-top:-26px}' +
                    '#xxt-v41-music .xm-arm{position:absolute;right:-6px;top:-10px;width:88px;height:150px;transform-origin:62px 20px;transform:rotate(-26deg);transition:transform .7s cubic-bezier(.22,1,.36,1);pointer-events:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.45))}' +
                    '#xxt-v41-music.playing .xm-arm{transform:rotate(0deg)}' +
                    '@keyframes xm-spin{to{transform:rotate(360deg)}}' +
                    '#xxt-v41-music .xm-now{text-align:center;min-height:38px}' +
                    '#xxt-v41-music .xm-now b{display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
                    '#xxt-v41-music .xm-now span{font-size:11px;color:#A89D98;font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-music input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:4px;margin:6px 0;border-radius:2px;cursor:pointer;' +
                      'background:linear-gradient(to right,var(--xm-accent,#E8A87C) var(--p,0%),rgba(255,255,255,.14) var(--p,0%))}' +
                    '#xxt-v41-music input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.4)}' +
                    '#xxt-v41-music input[type=range]::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:50%;background:#fff}' +
                    '#xxt-v41-music input[type=range]:focus-visible{outline:2px solid rgba(255,255,255,.35);outline-offset:3px}' +
                    '#xxt-v41-music .xm-ctrls{display:flex;align-items:center;justify-content:center;gap:10px;margin:2px 0 8px}' +
                    '#xxt-v41-music .xm-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:0;border-radius:50%;background:none;color:#D9CFCA}' +
                    '#xxt-v41-music .xm-btn:hover,#xxt-v41-music .xm-btn:focus-visible{background:rgba(255,255,255,.08);color:#fff;outline:none}' +
                    '#xxt-v41-music .xm-play{width:44px;height:44px;background:#F3EDEA;color:#1B1615}' +
                    '#xxt-v41-music .xm-play:hover,#xxt-v41-music .xm-play:focus-visible{background:#fff;color:#000}' +
                    '#xxt-v41-music .xm-mode{font-size:11px;font-weight:600;width:auto;padding:0 8px;border-radius:12px;height:24px}' +
                    '#xxt-v41-music .xm-vol{display:flex;align-items:center;gap:8px;color:#A89D98;margin-bottom:8px}' +
                    '#xxt-v41-music .xm-vol input{margin:0}' +
                    '#xxt-v41-music .xm-list{flex:1 1 auto;min-height:60px;max-height:240px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;margin:0 -6px;padding:0 6px;border-top:1px solid rgba(255,255,255,.07)}' +
                    '#xxt-v41-music .xm-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;border:0;border-radius:9px;background:none;text-align:left}' +
                    '#xxt-v41-music .xm-sec{margin:10px 8px 2px;font-size:11px;font-weight:600;color:#7D726D;letter-spacing:.5px}' +
                    '#xxt-v41-music input[type=range]:disabled{cursor:default;opacity:.45}' +
                    '#xxt-v41-music .xm-item:hover{background:rgba(255,255,255,.06)}' +
                    '#xxt-v41-music .xm-item.cur{background:rgba(255,255,255,.1)}' +
                    '#xxt-v41-music .xm-item.cur .xm-name{color:var(--xm-accent,#E8A87C);font-weight:600}' +
                    '#xxt-v41-music .xm-no{flex:none;width:18px;font-size:11px;color:#7D726D;text-align:center;font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-music .xm-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
                    '#xxt-v41-music .xm-del{flex:none;border:0;background:none;color:#7D726D;font-size:15px;line-height:1;padding:2px 4px;border-radius:6px;opacity:0}' +
                    '#xxt-v41-music .xm-item:hover .xm-del,#xxt-v41-music .xm-del:focus-visible{opacity:1}' +
                    '#xxt-v41-music .xm-del:hover{color:#fff;background:rgba(255,255,255,.1)}' +
                    '#xxt-v41-music .xm-eq{flex:none;display:inline-flex;align-items:flex-end;gap:2px;width:18px;height:12px;justify-content:center}' +
                    '#xxt-v41-music .xm-eq i{width:3px;background:var(--xm-accent,#E8A87C);border-radius:1px;animation:xm-eq .9s ease-in-out infinite;animation-play-state:paused}' +
                    '#xxt-v41-music .xm-eq i:nth-child(2){animation-delay:-.3s}#xxt-v41-music .xm-eq i:nth-child(3){animation-delay:-.6s}' +
                    '#xxt-v41-music.playing .xm-eq i{animation-play-state:running}' +
                    '@keyframes xm-eq{0%,100%{height:3px}50%{height:12px}}' +
                    '#xxt-v41-music .xm-empty{padding:6px 8px 4px;color:#7D726D;font-size:12px;line-height:1.6}' +
                    '#xxt-v41-music .xm-add-row{display:flex;gap:8px}' +
                    '#xxt-v41-music .xm-add-row .xm-add{flex:1}' +
                    '#xxt-v41-music .xm-add-row .xm-conv-btn{flex:none;width:auto;padding:8px 12px}' +
                    '#xxt-v41-music .xm-conv{display:none;flex-direction:column;gap:8px;min-height:0}' +
                    '#xxt-v41-music.conv .xm-conv{display:flex}' +
                    '#xxt-v41-music.conv .xm-deck,#xxt-v41-music.conv .xm-now,#xxt-v41-music.conv [data-m=seek],#xxt-v41-music.conv .xm-ctrls,#xxt-v41-music.conv .xm-vol,#xxt-v41-music.conv .xm-list,#xxt-v41-music.conv .xm-add-row,#xxt-v41-music.conv > .xm-hint{display:none}' +
                    '#xxt-v41-music .xm-conv-head{display:flex;align-items:center;margin-top:10px}' +
                    '#xxt-v41-music .xm-conv-head b{flex:1;font-size:13px}' +
                    '#xxt-v41-music .xm-back{font-size:12px}' +
                    '#xxt-v41-music .xm-conv-hint{padding:8px 10px;border-radius:9px;background:rgba(232,168,124,.14);color:#F3D3BC;font-size:12px;line-height:1.5}' +
                    '#xxt-v41-music .xm-drop{display:flex;flex-direction:column;align-items:center;gap:4px;width:100%;padding:16px 10px;border:1px dashed rgba(255,255,255,.25)!important;border-radius:12px;background:rgba(255,255,255,.03);color:#EDE6E2;font-size:13px;font-weight:600;text-align:center}' +
                    '#xxt-v41-music .xm-drop small{font-size:11px;font-weight:400;color:#A89D98;line-height:1.5}' +
                    '#xxt-v41-music .xm-drop:hover,#xxt-v41-music .xm-drop:focus-visible,#xxt-v41-music.drag .xm-drop{border-color:var(--xm-accent,#E8A87C)!important;background:rgba(255,255,255,.06);outline:none}' +
                    '#xxt-v41-music .xm-cq{display:flex;flex-direction:column;gap:6px;max-height:170px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}' +
                    '#xxt-v41-music .xm-cq-item{padding:7px 9px;border-radius:9px;background:rgba(255,255,255,.05)}' +
                    '#xxt-v41-music .xm-cq-top{display:flex;align-items:center;gap:8px}' +
                    '#xxt-v41-music .xm-cq-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}' +
                    '#xxt-v41-music .xm-cq-st{flex:none;font-size:11px;color:#A89D98;font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-music .xm-cq-item.done .xm-cq-st{color:#86EFAC}#xxt-v41-music .xm-cq-item.fail .xm-cq-st,#xxt-v41-music .xm-cq-item.drm .xm-cq-st{color:#FCA5A5}' +
                    '#xxt-v41-music .xm-cq-item .xm-del{opacity:.7}' +
                    '#xxt-v41-music .xm-cq-msg{margin-top:3px;font-size:11px;color:#A89D98;line-height:1.5}' +
                    '#xxt-v41-music .xm-cq-bar{display:block;height:3px;margin-top:6px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden}' +
                    '#xxt-v41-music .xm-cq-bar b{display:block;height:100%;background:var(--xm-accent,#E8A87C);transition:width .2s}' +
                    '#xxt-v41-music .xm-cset{display:grid;grid-template-columns:1fr 1fr;gap:6px 8px}' +
                    '#xxt-v41-music .xm-cset label{display:flex;flex-direction:column;gap:3px;font-size:11px;color:#A89D98}' +
                    '#xxt-v41-music .xm-cset select{width:100%;height:28px;padding:0 6px;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:#241E1C;color:#EDE6E2;font:inherit;font-size:12px}' +
                    '#xxt-v41-music .xm-cset select:disabled{opacity:.45}' +
                    '#xxt-v41-music .xm-cset select:focus-visible{outline:2px solid var(--xm-accent,#E8A87C);outline-offset:1px}' +
                    '#xxt-v41-music .xm-cset .xm-chk{flex-direction:row;align-items:center;gap:6px;color:#D9CFCA;font-size:12px;cursor:pointer}' +
                    '#xxt-v41-music .xm-chk input{accent-color:var(--xm-accent,#E8A87C);margin:0}' +
                    '#xxt-v41-music .xm-cbtns{display:flex;gap:6px}' +
                    '#xxt-v41-music .xm-cbtns button{flex:1;height:32px;border-radius:9px;background:rgba(255,255,255,.08);color:#EDE6E2;font-size:12px;font-weight:600}' +
                    '#xxt-v41-music .xm-cbtns button:hover:not(:disabled),#xxt-v41-music .xm-cbtns button:focus-visible{background:rgba(255,255,255,.14);outline:none}' +
                    '#xxt-v41-music .xm-cbtns .xm-primary{flex:1.4;background:var(--xm-accent,#E8A87C);color:var(--xm-on,#1B1615)}' +
                    '#xxt-v41-music .xm-cbtns .xm-primary:hover:not(:disabled){filter:brightness(1.08);background:var(--xm-accent,#E8A87C)}' +
                    '#xxt-v41-music .xm-cbtns button:disabled{opacity:.4;cursor:default}' +
                    '#xxt-v41-music .xm-add{width:100%;margin-top:8px;padding:8px 0;border:1px dashed rgba(255,255,255,.22);border-radius:10px;background:none;color:#EDE6E2;font-size:12px;font-weight:600}' +
                    '#xxt-v41-music .xm-add:hover,#xxt-v41-music .xm-add:focus-visible,#xxt-v41-music.drag .xm-add{border-color:var(--xm-accent,#E8A87C);color:#fff;background:rgba(255,255,255,.05);outline:none}' +
                    '#xxt-v41-music .xm-hint{margin-top:6px;font-size:10.5px;color:#7D726D;text-align:center}' +
                    '@media (prefers-reduced-motion:reduce){#xxt-v41-music,#xxt-v41-music .xm-arm{transition:none}#xxt-v41-music .xm-disc,#xxt-v41-music .xm-eq i{animation:none}}' +
                    '</style>' +
                    '<div class="xm-head"><b>唱片机</b><button type="button" class="xm-x" data-m="close" aria-label="关闭唱片机">×</button></div>' +
                    '<div class="xm-deck"><div class="xm-plinth"></div><div class="xm-disc"><div class="xm-label" data-m="label"><span data-m="labeltxt">♪</span></div></div>' +
                      '<svg class="xm-arm" viewBox="0 0 88 150" aria-hidden="true"><circle cx="62" cy="20" r="15" fill="#2A2321"/><circle cx="62" cy="20" r="9" fill="#F3EDEA"/><circle cx="62" cy="20" r="3.5" fill="#BDB3AE"/>' +
                      '<path d="M62 20 C 64 60, 66 82, 52 104 L 38 120" fill="none" stroke="#F3EDEA" stroke-width="5" stroke-linecap="round"/>' +
                      '<rect x="22" y="114" width="20" height="13" rx="3" transform="rotate(-38 32 120)" fill="#F3EDEA"/><rect x="14" y="122" width="14" height="14" rx="3" transform="rotate(-38 21 129)" fill="#E2DAD6"/></svg>' +
                    '</div>' +
                    '<div class="xm-now"><b data-m="title">还没有音乐</b><span data-m="time">00:00 / 00:00</span></div>' +
                    '<input type="range" data-m="seek" min="0" max="1000" value="0" aria-label="播放进度">' +
                    '<div class="xm-ctrls">' +
                      `<button type="button" class="xm-btn xm-mode" data-m="mode" title="播放模式"></button>` +
                      `<button type="button" class="xm-btn" data-m="prev" aria-label="上一首">${icon('<path d="M4.5 4.5h3v15h-3zM20 4.5v15L8.5 12z"/>', 20)}</button>` +
                      `<button type="button" class="xm-btn xm-play" data-m="play" aria-label="播放"></button>` +
                      `<button type="button" class="xm-btn" data-m="next" aria-label="下一首">${icon('<path d="M16.5 4.5h3v15h-3zM4 4.5v15L15.5 12z"/>', 20)}</button>` +
                      `<span style="width:44px"></span>` +
                    '</div>' +
                    `<div class="xm-vol">${icon('<path d="M4 9v6h4l5 4V5L8 9zm11.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4z"/>', 15)}<input type="range" data-m="vol" min="0" max="100" aria-label="音量"></div>` +
                    '<div class="xm-list" data-m="list" role="list"></div>' +
                    '<div class="xm-add-row"><button type="button" class="xm-add" data-m="add">＋ 添加本地音乐</button><button type="button" class="xm-add xm-conv-btn" data-m="convopen">⇄ 格式转换</button></div>' +
                    '<input type="file" data-m="file" accept="audio/*,video/*,.mp3,.m4a,.aac,.ogg,.wav,.flac,.opus,.wma,.ape,.amr" multiple hidden>' +
                    '<div class="xm-hint">音乐只保存在这台电脑的浏览器里，不会上传</div>' +
                    '<div class="xm-conv" data-m="conv">' +
                      '<div class="xm-conv-head"><b>音频格式转换</b><button type="button" class="xm-x xm-back" data-m="convback">‹ 返回</button></div>' +
                      '<div class="xm-conv-hint" data-m="convhint"></div>' +
                      '<button type="button" class="xm-drop" data-m="convdrop">点击添加或拖入音频 / 视频文件<small>支持 MP3、M4A、AAC、FLAC、WAV、OGG、OPUS，也能提取 MP4 等视频里的声音</small></button>' +
                      '<input type="file" data-m="convfile" accept="audio/*,video/*" multiple hidden>' +
                      '<div class="xm-cq" data-m="convlist"></div>' +
                      '<div class="xm-cset">' +
                        '<label>格式<select data-m="cfmt"><option value="mp3">MP3</option><option value="wav">WAV（无损）</option></select></label>' +
                        '<label>质量<select data-m="cbr"><option value="128">128 kbps</option><option value="192">192 kbps</option><option value="256">256 kbps</option><option value="320">320 kbps</option></select></label>' +
                        '<label>采样率<select data-m="csr"><option value="44100">44100 Hz</option><option value="48000">48000 Hz</option><option value="32000">32000 Hz</option><option value="22050">22050 Hz</option></select></label>' +
                        '<label>声道<select data-m="cch"><option value="0">与源音频一致</option><option value="2">立体声</option><option value="1">单声道</option></select></label>' +
                        '<label class="xm-chk"><input type="checkbox" data-m="cadd">转换后加入唱片机</label>' +
                        '<label class="xm-chk"><input type="checkbox" data-m="cdl">同时下载到电脑</label>' +
                      '</div>' +
                      '<div class="xm-cbtns"><button type="button" data-m="cclear">清空列表</button><button type="button" data-m="cstop">停止</button><button type="button" class="xm-primary" data-m="cstart">开始转换</button></div>' +
                      '<div class="xm-hint">全部在本机浏览器里转换，不上传文件；音乐软件的加密格式无法转换</div>' +
                    '</div>';
                const q = (k) => d.querySelector(`[data-m="${k}"]`);
                q('close').addEventListener('click', () => this._toggleMusic());
                q('play').addEventListener('click', () => this._musicToggle());
                q('prev').addEventListener('click', () => this._musicNext(false, -1));
                q('next').addEventListener('click', () => this._musicNext(false));
                q('mode').addEventListener('click', () => {
                    const order = ['all', 'one', 'shuffle'];
                    const m = order[(order.indexOf(this._musicMode()) + 1) % 3];
                    try { localStorage.setItem('xxt-v41-music-mode', m); } catch (e) { /* ignore */ }
                    this._renderMusic();
                });
                const seek = q('seek');
                seek.addEventListener('input', () => { this._seeking = true; seek.style.setProperty('--p', (seek.value / 10) + '%'); });
                seek.addEventListener('change', () => {
                    this._seeking = false;
                    const a = this._audio;
                    if (a && a.duration) a.currentTime = (seek.value / 1000) * a.duration;
                });
                const vol = q('vol');
                vol.addEventListener('input', () => {
                    const v = vol.value / 100;
                    this._musicAudio().volume = v;
                    if (this._gen) { try { this._gen.master.gain.setTargetAtTime(v, this._gen.ctx.currentTime, 0.05); } catch (e) { /* ignore */ } }
                    vol.style.setProperty('--p', vol.value + '%');
                    try { localStorage.setItem('xxt-v41-music-vol', String(v)); } catch (e) { /* ignore */ }
                });
                q('add').addEventListener('click', () => q('file').click());
                q('convopen').addEventListener('click', () => { this._convOpen = true; this._convHint = ''; this._renderConv(); });
                q('convback').addEventListener('click', () => { this._convOpen = false; this._renderConv(); this._positionMusic(); });
                q('convdrop').addEventListener('click', () => q('convfile').click());
                q('convfile').addEventListener('change', () => { const fs = [...q('convfile').files]; q('convfile').value = ''; this._convQueue(fs, ''); });
                q('convlist').addEventListener('click', (e) => {
                    const b = e.target.closest('[data-cdel]');
                    if (!b) return;
                    this._convQ = (this._convQ || []).filter((x) => x.id !== b.getAttribute('data-cdel'));
                    this._renderConv();
                });
                const saveOpt = () => {
                    this._convSaveOpts({ fmt: q('cfmt').value, br: Number(q('cbr').value), sr: Number(q('csr').value), ch: Number(q('cch').value), add: q('cadd').checked, dl: q('cdl').checked });
                    this._renderConv();
                };
                for (const k of ['cfmt', 'cbr', 'csr', 'cch', 'cadd', 'cdl']) q(k).addEventListener('change', saveOpt);
                q('cstart').addEventListener('click', () => this._convRun());
                q('cstop').addEventListener('click', () => { this._convAbort = true; });
                q('cclear').addEventListener('click', () => { this._convQ = []; this._convHint = ''; this._renderConv(); });
                q('file').addEventListener('change', () => { const fs = [...q('file').files]; q('file').value = ''; this._musicAdd(fs); });
                q('list').addEventListener('click', (e) => {
                    const del = e.target.closest('[data-del]');
                    if (del) { e.stopPropagation(); this._musicRemove(del.getAttribute('data-del')); return; }
                    const it = e.target.closest('[data-track]');
                    if (!it) return;
                    const id = it.getAttribute('data-track');
                    if (id === this._curTrack) this._musicToggle(); else this._musicPlay(id);
                });
                d.addEventListener('dragover', (e) => { e.preventDefault(); d.classList.add('drag'); });
                d.addEventListener('dragleave', (e) => { if (e.target === d) d.classList.remove('drag'); });
                d.addEventListener('drop', (e) => {
                    e.preventDefault(); d.classList.remove('drag');
                    const fs = [...(e.dataTransfer && e.dataTransfer.files || [])];
                    if (this._convOpen) this._convQueue(fs, ''); else this._musicAdd(fs);
                });
                for (const t of ['keydown', 'keyup', 'keypress']) d.addEventListener(t, (e) => e.stopPropagation());
                document.body.appendChild(d);
                this._musicEl = d;
                return d;
            },
            _positionMusic() {
                const d = this._musicEl, el = this._panel;
                if (!d || !el || !this._musicOpen) return;
                const r = el.getBoundingClientRect();
                const w = d.offsetWidth || 288, h = d.offsetHeight || 560, gap = 12, W = window.innerWidth, H = window.innerHeight;
                // 侧边栏展开时，唱片机让开侧边栏
                const sb = this._sideEl && this._sideEl.classList.contains('show') ? this._sideEl.getBoundingClientRect() : null;
                const right = sb && sb.left >= r.left ? Math.max(r.right, sb.right) : r.right;
                const leftEdge = sb && sb.left < r.left ? Math.min(r.left, sb.left) : r.left;
                const g2 = sb ? 8 : gap;
                let left = right + g2;
                if (left + w > W - 8) left = leftEdge - g2 - w >= 8 ? leftEdge - g2 - w : Math.max(8, W - w - 8);
                // 紧挨着侧边功能栏（或浮窗顶部）展开，不再沉到浮窗底部
                const anchor = sb ? sb.top - 12 : r.top;
                const top = Math.min(Math.max(8, anchor), Math.max(8, H - h - 8));
                d.style.left = Math.round(left) + 'px';
                d.style.top = Math.round(top) + 'px';
                d.style.maxHeight = (H - 16) + 'px';
                try {
                    const cs = getComputedStyle(el);
                    const acc = cs.getPropertyValue('--x-accent').trim(), on = cs.getPropertyValue('--x-on-accent').trim();
                    if (acc) d.style.setProperty('--xm-accent', acc);
                    if (on) d.style.setProperty('--xm-on', on);
                } catch (e) { /* ignore */ }
            },
            _renderMusic() {
                const open = !!this._musicOpen && !!this._panel && !this._panelCollapsed;
                if (!open && !this._musicEl) return;
                const d = this._ensureMusic();
                const q = (k) => d.querySelector(`[data-m="${k}"]`);
                const a = this._audio;
                const isGen = !!(this._curTrack && this._curTrack.startsWith('gen:'));
                const playing = isGen ? !!this._gen && !this._genPaused : !!(a && this._curTrack && !a.paused);
                d.classList.toggle('open', open);
                d.classList.toggle('playing', playing);
                d.setAttribute('aria-hidden', String(!open));
                if (open) d.removeAttribute('inert'); else d.setAttribute('inert', '');
                const list = this._allTracks();
                const mine = this._tracks || [];
                const cur = list.find((x) => x.id === this._curTrack);
                const esc = (t) => this._esc(t);
                q('title').textContent = cur ? cur.name : '点一首开始播放';
                q('labeltxt').textContent = cur ? cur.name : '♪';
                let hue = 24;
                if (cur) { hue = 0; for (const ch of cur.name) hue = (hue * 31 + ch.charCodeAt(0)) % 360; }
                q('label').style.background = `radial-gradient(circle at 35% 30%,hsl(${hue} 55% 62%),hsl(${(hue + 40) % 360} 50% 38%))`;
                q('play').innerHTML = playing
                    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
                    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
                q('play').setAttribute('aria-label', playing ? '暂停' : '播放');
                const mode = this._musicMode();
                q('mode').textContent = { all: '列表循环', one: '单曲循环', shuffle: '随机播放' }[mode];
                const vol = q('vol');
                const v = Math.round(this._musicVolume() * 100);
                if (document.activeElement !== vol) vol.value = v;
                vol.style.setProperty('--p', vol.value + '%');
                const listKey = list.map((x) => x.id).join(',') + '|' + this._curTrack;
                if (this._musicListKey !== listKey) {
                    this._musicListKey = listKey;
                    const row = (t, i) => `<div class="xm-item${t.id === this._curTrack ? ' cur' : ''}${t.builtin ? ' builtin' : ''}" data-track="${esc(t.id)}" role="listitem" tabindex="0" title="${esc(t.name)}">` +
                        (t.id === this._curTrack ? '<span class="xm-eq"><i></i><i></i><i></i></span>' : `<span class="xm-no">${i + 1}</span>`) +
                        `<span class="xm-name">${esc(t.name)}</span>` +
                        (t.builtin ? '' : `<button type="button" class="xm-del" data-del="${esc(t.id)}" aria-label="移除 ${esc(t.name)}">×</button>`) + '</div>';
                    const builtins = list.filter((t) => t.builtin);
                    q('list').innerHTML = '<div class="xm-sec">内置环境音</div>' + builtins.map(row).join('') +
                        '<div class="xm-sec">我的音乐</div>' +
                        (mine.length ? mine.map((t, i) => row(t, i)).join('') : '<div class="xm-empty">点下面的按钮，从电脑里添加喜欢的音乐</div>');
                }
                this._musicTick();
                this._renderConv();
                if (open) this._positionMusic();
                this._musicPlaying = playing;
                this._renderSide();
            },
            _removeMusic() {
                this._musicStop();
                if (this._genCtx) { try { this._genCtx.close(); } catch (e) { /* ignore */ } this._genCtx = null; }
                if (this._musicEl) { try { this._musicEl.remove(); } catch (e) { /* ignore */ } }
                this._musicEl = null;
            },


            // ================= 侧边功能栏（浮窗右侧边缘，点击拉出） =================
            // 不常用的功能放在这里：唱片机、更新记录、反馈
            _ensureSide() {
                if (this._sideEl && this._sideEl.isConnected) return this._sideEl;
                const d = document.createElement('div');
                d.id = 'xxt-v41-side';
                const ico = (p) => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
                const items = [
                    ['music', '唱片机', ico('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 5.5a6.5 6.5 0 016.5 6.5"/>')],
                    ['history', '更新记录', ico('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>')],
                    ['feedback', '反馈问题', ico('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>')],
                ];
                d.innerHTML =
                    '<style>' +
                    '#xxt-v41-side{position:fixed;z-index:2147483647;display:flex;align-items:center;gap:6px;pointer-events:none;font:12px/1.4 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;opacity:0;transition:opacity .3s ease}' +
                    '#xxt-v41-side.show{opacity:1}' +
                    '#xxt-v41-side.left{flex-direction:row-reverse}' +
                    '#xxt-v41-side *{box-sizing:border-box}' +
                    '#xxt-v41-side button{font:inherit;margin:0;padding:0;border:0;min-width:0;min-height:0;text-transform:none;letter-spacing:normal;cursor:pointer}' +
                    '#xxt-v41-side .xs-handle{pointer-events:auto;position:relative;display:flex;align-items:center;justify-content:center;width:16px;height:52px;border-radius:0 10px 10px 0;' +
                      'background:var(--x-bg,#fff);color:var(--x-faint,#9CA3AF);box-shadow:3px 2px 10px rgba(15,23,42,.12);transition:width .25s cubic-bezier(.22,1,.36,1),color .2s,background .2s}' +
                    '#xxt-v41-side.left .xs-handle{border-radius:10px 0 0 10px;box-shadow:-3px 2px 10px rgba(15,23,42,.12)}' +
                    '#xxt-v41-side .xs-handle:hover,#xxt-v41-side .xs-handle:focus-visible{width:20px;color:var(--x-accent,#3B82F6);outline:none}' +
                    '#xxt-v41-side .xs-handle svg{transition:transform .35s cubic-bezier(.22,1,.36,1)}' +
                    '#xxt-v41-side.open .xs-handle svg{transform:rotate(180deg)}' +
                    '#xxt-v41-side.left .xs-handle svg{transform:rotate(180deg)}#xxt-v41-side.left.open .xs-handle svg{transform:none}' +
                    '#xxt-v41-side .xs-dot{position:absolute;top:6px;left:50%;width:6px;height:6px;margin-left:-3px;border-radius:50%;background:var(--x-accent,#3B82F6);display:none;animation:xs-pulse 1.6s ease-in-out infinite}' +
                    '#xxt-v41-side.playing .xs-dot{display:block}' +
                    '@keyframes xs-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.6);opacity:.55}}' +
                    '#xxt-v41-side .xs-tray{pointer-events:none;display:flex;flex-direction:column;gap:4px;padding:6px;border-radius:14px;background:var(--x-bg,#fff);' +
                      'box-shadow:0 8px 24px rgba(15,23,42,.14),0 1px 3px rgba(15,23,42,.08);opacity:0;transform:translateX(-10px) scale(.96);transform-origin:left center;' +
                      'transition:opacity .32s cubic-bezier(.22,1,.36,1),transform .38s cubic-bezier(.22,1,.36,1)}' +
                    '#xxt-v41-side.left .xs-tray{transform:translateX(10px) scale(.96);transform-origin:right center}' +
                    '#xxt-v41-side.open .xs-tray{pointer-events:auto;opacity:1;transform:none}' +
                    '#xxt-v41-side .xs-item{position:relative;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:transparent;color:var(--x-muted,#6B7280);transition:background .15s,color .15s}' +
                    '#xxt-v41-side .xs-item:hover,#xxt-v41-side .xs-item:focus-visible,#xxt-v41-side .xs-item.on{background:var(--x-accent-soft,#E3ECFD);color:var(--x-accent-strong,#2563EB);outline:none}' +
                    '#xxt-v41-side .xs-item[data-s=music].spin svg{animation:xs-spin 2.4s linear infinite}' +
                    '@keyframes xs-spin{to{transform:rotate(360deg)}}' +
                    '#xxt-v41-side .xs-item::after{content:attr(data-label);position:absolute;left:calc(100% + 10px);top:50%;transform:translateY(-50%);white-space:nowrap;padding:4px 8px;border-radius:7px;background:#1F2937;color:#F9FAFB;font-size:12px;opacity:0;pointer-events:none;transition:opacity .15s}' +
                    '#xxt-v41-side.left .xs-item::after{left:auto;right:calc(100% + 10px)}' +
                    '#xxt-v41-side .xs-item:hover::after{opacity:1}' +
                    '@media (prefers-reduced-motion:reduce){#xxt-v41-side,#xxt-v41-side .xs-tray,#xxt-v41-side .xs-handle,#xxt-v41-side .xs-handle svg{transition:none}#xxt-v41-side .xs-dot,#xxt-v41-side .xs-item svg{animation:none!important}}' +
                    '</style>' +
                    '<button type="button" class="xs-handle" data-s="handle" aria-label="更多功能" aria-expanded="false" title="更多功能">' +
                      '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 1.5 7 5 3.5 8.5"/></svg><i class="xs-dot"></i>' +
                    '</button>' +
                    '<div class="xs-tray" data-s="tray" role="toolbar" aria-label="更多功能">' +
                      items.map(([k, label, svg]) => `<button type="button" class="xs-item" data-s="${k}" data-label="${label}" aria-label="${label}">${svg}</button>`).join('') +
                    '</div>';
                const q = (k) => d.querySelector(`[data-s="${k}"]`);
                q('handle').addEventListener('click', () => { this._sideOpen = !this._sideOpen; this._renderSide(); this._positionFloats(); });
                q('music').addEventListener('click', () => this._toggleMusic());
                q('history').addEventListener('click', () => {
                    this._animatePanel(() => { this._histOpen = !this._histOpen; this._histFromSettings = false; this._settingsOpen = false; });
                });
                q('feedback').addEventListener('click', () => {
                    this._animatePanel(() => {
                        const on = !(this._settingsOpen && this._fbOpen);
                        this._settingsOpen = on; this._fbOpen = on; this._histOpen = false;
                    });
                });
                for (const t of ['keydown', 'keyup', 'keypress']) d.addEventListener(t, (e) => e.stopPropagation());
                document.body.appendChild(d);
                this._sideEl = d;
                return d;
            },
            _renderSide() {
                const el = this._panel;
                if (!el) return;
                const d = this._ensureSide();
                const show = !this._panelCollapsed;
                d.classList.toggle('show', show);
                d.classList.toggle('open', show && !!this._sideOpen);
                d.classList.toggle('playing', !!this._musicPlaying);
                d.setAttribute('aria-hidden', String(!show));
                const h = d.querySelector('[data-s="handle"]');
                h.setAttribute('aria-expanded', String(!!this._sideOpen));
                h.tabIndex = show ? 0 : -1;
                const tray = d.querySelector('[data-s="tray"]');
                if (show && this._sideOpen) tray.removeAttribute('inert'); else tray.setAttribute('inert', '');
                const set = (k, on) => { const b = d.querySelector(`[data-s="${k}"]`); b.classList.toggle('on', !!on); b.setAttribute('aria-pressed', String(!!on)); };
                set('music', this._musicOpen);
                set('history', this._histOpen);
                set('feedback', this._settingsOpen && this._fbOpen);
                d.querySelector('[data-s="music"]').classList.toggle('spin', !!this._musicPlaying);
                // 跟随浮窗主题配色
                try {
                    const cs = getComputedStyle(el);
                    for (const v of ['--x-bg', '--x-accent', '--x-accent-soft', '--x-accent-strong', '--x-muted', '--x-faint']) {
                        const val = cs.getPropertyValue(v).trim();
                        if (val) d.style.setProperty(v, val);
                    }
                } catch (e) { /* ignore */ }
                this._positionSide();
            },
            _positionSide() {
                const d = this._sideEl, el = this._panel;
                if (!d || !el) return;
                const r = el.getBoundingClientRect();
                const W = window.innerWidth;
                const trayW = this._sideOpen ? 56 : 0;
                // 浮窗贴着屏幕右边时，侧边栏改到左侧边缘
                const left = r.right + 22 + trayW > W && r.left - 22 - trayW >= 0;
                d.classList.toggle('left', left);
                const h = d.offsetHeight || 52;
                const top = Math.min(Math.max(8, r.top + Math.min(96, r.height / 2) - h / 2), window.innerHeight - h - 8);
                d.style.top = Math.round(top) + 'px';
                if (left) { d.style.left = 'auto'; d.style.right = Math.round(W - r.left) + 'px'; }
                else { d.style.right = 'auto'; d.style.left = Math.round(r.right) + 'px'; }
            },
            _positionFloats() {
                this._positionSide();
                this._positionMusic();
            },
            _removeSide() {
                if (this._sideEl) { try { this._sideEl.remove(); } catch (e) { /* ignore */ } }
                this._sideEl = null;
            },
            // ================= 运行状态浮窗 =================
            _panelStatus() {
                const v = this._video;
                const fmt = (t) => {
                    if (!isFinite(t) || t < 0) return '--:--';
                    t = Math.floor(t);
                    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
                    const pad = (n) => String(n).padStart(2, '0');
                    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
                };
                const GREEN = '#22B573', ORANGE = '#F5A524', RED = '#E5484D', BLUE = '#3B82F6', GREY = '#9CA3AF';
                if (this._mode === 'live') return this._livePanelStatus(fmt, { GREEN, ORANGE, RED, BLUE, GREY });
                if (this._mode === 'list') return this._listPanelStatus({ GREEN, ORANGE, RED, BLUE, GREY });
                if (this._loginExpired) return { color: RED, label: '需要登录', text: '登录可能已过期，请重新登录后刷新页面' };
                switch (this._state) {
                    case 'reading': {
                        const d = this._docProgress || { i: 1, n: 1, pct: 0 };
                        return { color: BLUE, label: '阅读课件', text: `正在阅读课件 ${d.i}/${d.n}`, sub: `本份已读到 ${d.pct}%` };
                    }
                    case 'stopped':
                        if (this._note.startsWith('🎉')) return { color: GREEN, label: '已完成', text: this._note };
                        return { color: GREY, label: '已暂停', text: this._note || '学习已暂停，点击右上角 ▶ 继续' };
                    case 'advancing':
                        return { color: BLUE, label: '下一节', text: '本节完成，正在进入下一节…' };
                    case 'waiting':
                        return { color: ORANGE, label: '等待中', text: this._note || '等待中…' };
                    case 'playing': {
                        if (!v) break;
                        if (this._quizNotified) return { color: RED, label: '需要处理', text: '检测到视频内弹题，请手动作答，答完自动继续' };
                        if (this._blocked) return { color: RED, label: '需要处理', text: '页面暂停了视频，请手动处理后点击播放' };
                        const vp = isFinite(v.duration) && v.duration > 0 ? Math.min(100, Math.round((v.currentTime / v.duration) * 100)) : 0;
                        const sub = `${fmt(v.currentTime)} / ${fmt(v.duration)} · 本节 ${vp}%`;
                        if (!v.paused && (v.readyState < 3 || this._waiting)) return { color: ORANGE, label: '缓冲中', text: `网络缓冲中：${this._title}`, sub };
                        if (v.paused) return { color: ORANGE, label: '继续中', text: `正在继续播放：${this._title}`, sub };
                        return { color: GREEN, label: '学习中', text: `正在学习：${this._title}`, sub };
                    }
                }
                return { color: BLUE, label: '准备中', text: '正在打开本节内容…' };
            },

            // 当前所在章节：如“2 第一单元 · 第 2/10 节”
            _chapterLine() {
                try {
                    const nodes = this._nodes();
                    const idx = this._currentIndex();
                    if (idx < 0) return '';
                    const chapter = this._chapterName(nodes, idx);
                    return `${chapter ? chapter + ' · ' : ''}第 ${idx + 1} / ${nodes.length} 节`;
                } catch (e) {
                    return '';
                }
            },

            _chapterName(nodes, idx) {
                try {
                    if (!nodes) { nodes = this._nodes(); idx = this._currentIndex(); }
                    if (idx < 0) return '';
                    const head = $(nodes.get(idx)).closest('#coursetree > ul > li').find('.firstLayer .posCatalog_name, .firstLayer .posCatalog_title').first();
                    return head.length ? (head.attr('title') || head.text() || '').trim() : '';
                } catch (e) {
                    return '';
                }
            },

            _currentNodeTitle() {
                try {
                    const idx = this._currentIndex();
                    return idx >= 0 ? this._nodeTitle(this._nodes().get(idx)) : '';
                } catch (e) {
                    return '';
                }
            },

            _renderPanel() {
                if (!C.showPanel) { this._removePanel(); return; }
                const st = this._panelStatus();
                if (this._mode === 'course') st.chap = this._chapterLine();
                this._checkAlert(st);
                const prog = this._mode === 'course' ? this._progressLine() : null;
                const key = `${st.color}|${st.label}|${st.text}|${st.sub || ''}|${st.chap || ''}|${prog ? prog.text : ''}|${this._settingsOpen}|${this._mode === 'list' ? JSON.stringify((this._courses || []).map((x) => [x.cid, x.done, x.total])) : ''}|${this._statsOpen}|${Math.floor(this._statSummary().todaySec / 60)}|${SETTING_ITEMS.map(([k]) => C[k] ? 1 : 0).join('')}|${this._panelCollapsed}|${C.playbackRate}|${this._rateGaveUp}|${this._mode}|${this._latest}|${this._updating}|${this._ratesOpen}|${this._userStopped}|${this._lives.map((l) => l.pct + (l.done ? 'd' : '') + (this._liveOpened.has(l.frame || l.info) ? 'o' : '')).join(',')}|${this._liveBlocked}|${this._notice && Date.now() < this._notice.until ? this._notice.text : ''}|${this._tab}|${C.assistMode}|${this._musicOpen}|${this._sideOpen}|${C.theme}|${this._resolvedTheme()}|${C.customColor}|${C.customBase}|${!!this._loadSize()}|${this._fbOpen}|${this._fbType}|${this._histOpen}|${this._whatsNewFrom}|${(() => { try { return localStorage.getItem(WHATSNEW_KEY); } catch (e) { return ''; } })()}|${C.dailyGoal}|${this._notesVer || 0}|${this._mode === 'course' ? this._currentNodeTitle() : ''}|${dayKey()}|${this._progress ? this._progress.manual.join('/') : ''}`;
                const el = this._ensurePanel();
                if (!el || key === this._panelKey) return;
                this._panelKey = key;
                Promise.resolve().then(() => this._fitPanel(el));
                const q = (k) => el.querySelector(`[data-k="${k}"]`);
                q('dot').style.background = st.color;
                this._applyTheme(el);
                q('customset').style.display = C.theme === 'custom' ? 'block' : 'none';
                if (C.theme === 'custom') {
                    if (document.activeElement !== q('cpick')) q('cpick').value = C.customColor;
                    q('chex').textContent = C.customColor.toUpperCase();
                    for (const b of el.querySelectorAll('[data-cbase]')) {
                        const on = b.getAttribute('data-cbase') === C.customBase;
                        b.classList.toggle('on', on);
                        b.setAttribute('aria-checked', String(on));
                    }
                }
                for (const b of el.querySelectorAll('[data-theme-opt]')) {
                    const on = b.getAttribute('data-theme-opt') === C.theme;
                    b.classList.toggle('on', on);
                    b.setAttribute('aria-checked', String(on));
                }
                if (el.classList.contains('xxt-collapsed') !== !!this._panelCollapsed || this._sizeApplied !== el) {
                    el.classList.toggle('xxt-collapsed', !!this._panelCollapsed);
                    this._applySize(el);
                    this._sizeApplied = el;
                }
                q('label').textContent = this._panelCollapsed && prog ? `${st.label} · ${prog.pct}%` : st.label;
                q('text').textContent = st.text;
                q('sub').textContent = st.sub || '';
                q('sub').style.display = st.sub ? 'block' : 'none';
                q('chap').textContent = st.chap ? '📖 ' + st.chap : '';
                q('chap').style.display = st.chap ? 'block' : 'none';
                q('box').style.borderLeftColor = st.color === '#22B573' ? 'var(--x-box-line)' : st.color;
                q('box').style.display = this._panelCollapsed ? 'none' : 'block';
                q('prog').style.display = prog ? 'block' : 'none';
                if (prog) {
                    q('progbar').style.width = prog.pct + '%';
                    q('progman').style.width = prog.manualPct + '%';
                    // 两段之间留一道缝，即使颜色相近也能分清“已完成”和“需手动完成”
                    q('progman').style.marginLeft = prog.manualPct > 0 && prog.pct > 0 ? '2px' : '0';
                    q('progtext').textContent = prog.text;
                    // 打开学习助手时，进度和剩余时间显示在「课程」页里；关闭时显示在状态框里
                    q('progtext').style.display = C.assistMode ? 'none' : 'block';
                    q('prog').title = prog.title;
                }
                const open = !this._panelCollapsed;
                q('settings').style.display = this._settingsOpen && open && !this._fbOpen && !this._histOpen ? 'block' : 'none';
                q('feedback').style.display = this._settingsOpen && open && this._fbOpen && !this._histOpen ? 'block' : 'none';
                q('history').style.display = open && this._histOpen ? 'block' : 'none';
                if (open && this._histOpen) this._renderHistory(el);
                this._renderWhatsNew(el, open && !this._settingsOpen);
                if (this._fbOpen) {
                    const type = this._fbType || 'bug';
                    for (const b of el.querySelectorAll('[data-fbtype]')) {
                        const on = b.getAttribute('data-fbtype') === type;
                        b.classList.toggle('on', on);
                        b.setAttribute('aria-checked', String(on));
                    }
                    q('fbtext').placeholder = type === 'bug'
                        ? '遇到了什么问题？比如：在哪个页面、做了什么、浮窗显示什么…'
                        : '希望增加或改进什么？';
                    q('fbdiag').checked = this._fbDiag !== undefined ? this._fbDiag : type === 'bug';
                }
                // 三个标签页：今天 / 课程 / 记录（回放页只显示“今天”）
                const tab = this._mode === 'live' ? 'today' : (this._tab || (this._mode === 'list' ? 'course' : 'today'));
                const showMain = open && !this._settingsOpen && !this._histOpen;
                const assist = !!C.assistMode;
                q('assist').style.display = showMain ? 'flex' : 'none';
                q('assist').classList.toggle('on', assist);
                q('assist').setAttribute('aria-checked', String(assist));
                q('tabs').style.display = showMain && assist && this._mode !== 'live' ? 'flex' : 'none';
                q('tabind').style.transform = `translateX(calc(${['today', 'course', 'record'].indexOf(tab)} * (100% + 2px)))`;
                for (const b of el.querySelectorAll('[data-tab]')) {
                    const on = b.getAttribute('data-tab') === tab;
                    b.classList.toggle('on', on);
                    b.setAttribute('aria-selected', String(on));
                    b.tabIndex = on ? 0 : -1;
                }
                const ss = this._statSummary();
                // 关闭学习助手时只保留课程列表（列表页）和一行学习时长
                // 三个标签页叠放在同一块区域里，区域高度取最高的那页：切换标签页时浮窗不再忽高忽低
                // （回放页只有“今天”；关闭学习助手时只保留课程列表页的课程总览）
                const stacked = assist && this._mode !== 'live';
                const paneUsed = (n) => showMain && (stacked || (assist ? n === 'today' : n === 'course' && this._mode === 'list'));
                q('panes').style.display = ['today', 'course', 'record'].some(paneUsed) ? 'grid' : 'none';
                for (const n of ['today', 'course', 'record']) {
                    const pane = q('pane-' + n);
                    pane.style.display = paneUsed(n) ? 'flex' : 'none';
                    const active = !stacked || tab === n;
                    pane.classList.toggle('off', !active);
                    pane.setAttribute('aria-hidden', String(!active));
                    if (!active) pane.setAttribute('inert', ''); else pane.removeAttribute('inert');
                }
                if (paneUsed('today')) this._renderToday(el, ss);
                if (paneUsed('course')) {
                    q('cdetail').style.display = this._mode === 'course' ? 'block' : 'none';
                    if (this._mode === 'list') this._renderCourseList(el);
                    else { q('courses').style.display = 'none'; this._renderCourseDetail(el, prog); }
                }
                if (paneUsed('record')) this._renderRecord(el, ss);
                q('statstext').innerHTML = `本周 <b>${fmtShort(ss.weekSec)}</b>${ss.streak ? ` · 连续 <b>${ss.streak}</b> 天` : ''} · 查看学习记录`;
                q('statsplain').style.display = showMain && !assist ? 'flex' : 'none';
                q('statsplain').innerHTML = `<span>今日 <b>${fmtShort(ss.todaySec)}</b> · 本周 <b>${fmtShort(ss.weekSec)}</b>${ss.streak ? ` · 连续 <b>${ss.streak}</b> 天` : ''}</span>`;
                q('goalset').style.display = assist ? 'block' : 'none';
                const br = el.querySelector('[data-set="breakRemind"]');
                if (br) br.closest('label').style.display = assist ? '' : 'none';
                for (const b of el.querySelectorAll('[data-goal]')) b.classList.toggle('on', Number(b.getAttribute('data-goal')) === C.dailyGoal);
                q('restore').style.display = !this._panelCollapsed && this._loadSize() ? 'inline-flex' : 'none';
                if (this._musicEl || this._musicOpen) this._renderMusic();
                else this._renderSide();
                q('gear').classList.toggle('on', this._settingsOpen);
                q('gear').setAttribute('aria-expanded', String(this._settingsOpen));
                for (const inp of el.querySelectorAll('[data-set]')) inp.checked = !!C[inp.getAttribute('data-set')];
                q('toggle').textContent = this._panelCollapsed ? '+' : '–';
                q('toggle').title = this._panelCollapsed ? '展开' : '收起';
                q('toggle').setAttribute('aria-label', q('toggle').title);
                const pw = q('power');
                const paused = this._userStopped;
                pw.classList.toggle('paused', paused);
                pw.title = paused ? '继续运行脚本' : '停止脚本';
                pw.setAttribute('aria-label', pw.title);
                pw.innerHTML = paused
                    ? '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 2.8v10.4c0 .6.7 1 1.2.6l8-5.2a.7.7 0 000-1.2l-8-5.2c-.5-.4-1.2 0-1.2.6z"/></svg>'
                    : '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="2"/></svg>';
                const hasUpd = !!this._latest;
                q('upd').style.display = hasUpd ? 'inline-block' : 'none';
                q('ver').classList.toggle('xxt-has-upd', hasUpd);
                q('tip1').textContent = this._updating ? `正在更新到 v${this._latest}…` : hasUpd ? `发现新版本 v${this._latest}` : '开源 · 1668919739/xuexitongScript';
                q('tip2').textContent = this._updating ? '请稍候' : hasUpd
                    ? (this._updateFailed ? '更新失败，点击重试' : C.autoUpdate ? '将在下一小节开始前自动更新 · 点击立即更新' : '点击立即更新，无需刷新页面')
                    : '已是最新版本 · 点击查看源码、反馈问题';
                const showRates = this._mode === 'course' && !this._panelCollapsed && this._settingsOpen;
                q('rates').style.display = showRates ? 'flex' : 'none';
                q('ratehint').style.display = showRates && this._rateGaveUp ? 'block' : 'none';
                const nt = this._notice && Date.now() < this._notice.until ? this._notice : null;
                if (!nt) this._notice = null;
                q('notice').style.display = nt && !this._panelCollapsed ? 'flex' : 'none';
                if (nt) {
                    q('notice').className = 'xxt-notice ' + nt.kind;
                    q('noticetext').textContent = nt.text + (nt.link ? ' ' : '');
                    if (nt.link) {
                        const a = document.createElement('a');
                        a.href = nt.link.href; a.target = '_blank'; a.rel = 'noopener';
                        a.textContent = nt.link.label + ' ›';
                        q('noticetext').appendChild(a);
                    }
                }
                const livePending = this._mode === 'course' ? this._lives.filter((l) => !l.done) : [];
                q('liverow').style.display = livePending.length && !this._panelCollapsed ? 'flex' : 'none';
                if (livePending.length) {
                    const p = livePending.map((l) => `${Math.floor(l.pct)}%`).join('、');
                    q('livetext').textContent = `直播回放 ${livePending.length} 个未完成 · ${p}`;
                    q('livetext').title = livePending.map((l, i) => `第 ${i + 1} 个：已看 ${l.pct}%，需 ${l.need}%`).join('\n');
                    const openedCount = livePending.filter((l) => this._liveOpened.has(l.frame || l.info)).length;
                    q('livebtn').textContent = this._liveBlocked || openedCount === 0 ? '打开直播回放'
                        : openedCount < livePending.length ? '打开下一个' : '再次打开';
                }
                q('ratecur').textContent = `${C.playbackRate}x`;
                q('rates').classList.toggle('open', this._ratesOpen);
                q('ratebtn').setAttribute('aria-expanded', String(this._ratesOpen));
                for (const btn of el.querySelectorAll('[data-rate]')) {
                    btn.classList.toggle('on', Number(btn.getAttribute('data-rate')) === C.playbackRate);
                    btn.tabIndex = this._ratesOpen ? 0 : -1;
                }
            },

            // 浮窗比屏幕还高时才允许内部滚动；平时不裁剪，版本号气泡等可以正常显示在浮窗外
            _fitPanel(el) {
                if (!el) return;
                const body = el.querySelector('[data-k="body"]');
                if (!body) return;
                const cs = getComputedStyle(el);
                const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
                const tall = body.scrollHeight + pad > window.innerHeight - 24 || (el.classList.contains('xxt-sized') && body.scrollHeight > body.clientHeight + 1);
                if (tall !== el.classList.contains('xxt-scroll')) el.classList.toggle('xxt-scroll', tall);
            },

            _ensurePanel() {
                if (this._panel && this._panel.isConnected) return this._panel;
                if (!document.body) return null;
                const el = document.createElement('div');
                el.id = 'xxt-v41-panel';
                el.style.cssText = [
                    'position:fixed', 'left:20px', 'bottom:20px', 'z-index:2147483647', 'box-sizing:border-box',
                    'width:324px', 'padding:16px', 'border-radius:16px', 'background:var(--x-bg)', 'color:var(--x-fg)',
                    'box-shadow:0 8px 28px rgba(15,23,42,.12),0 1px 3px rgba(15,23,42,.08)',
                    'font:14px/1.5 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif',
                ].join(';');
                el.innerHTML =
                    '<style>' +
                    '#xxt-v41-panel{--x-bg:#fff;--x-fg:#1F2937;--x-strong:#111827;--x-text2:#374151;--x-muted:#6B7280;--x-faint:#9CA3AF;--x-soft:#F6F8FB;--x-soft2:#F1F3F6;--x-line:#E5E9F0;--x-line-strong:#CBD2DC;--x-input:#FBFCFD;--x-switch-off:#D1D5DB;--x-accent:#3B82F6;--x-accent-strong:#2563EB;--x-accent-soft:#E3ECFD;--x-accent-softer:#EEF4FF;--x-accent-ring:#93C5FD;--x-accent-text:#1D4ED8;--x-box-line:#A7C7F2;--x-on-accent:#fff;--x-manual:#F5A524;transition:background-color .35s ease,color .35s ease}' +
                    '#xxt-v41-panel[data-theme="mint"]{--x-soft:#F4FAF7;--x-soft2:#EDF5F1;--x-line:#DDEBE4;--x-accent:#10B981;--x-accent-strong:#059669;--x-accent-soft:#D1FAE5;--x-accent-softer:#ECFDF5;--x-accent-ring:#6EE7B7;--x-accent-text:#047857;--x-box-line:#A7E3CC}' +
                    '#xxt-v41-panel[data-theme="sakura"]{--x-soft:#FCF6F9;--x-soft2:#F7EEF3;--x-line:#F0DDE7;--x-accent:#EC4899;--x-accent-strong:#DB2777;--x-accent-soft:#FCE7F3;--x-accent-softer:#FDF2F8;--x-accent-ring:#F9A8D4;--x-accent-text:#BE185D;--x-box-line:#F5B8D5}' +
                    '#xxt-v41-panel[data-theme="violet"]{--x-soft:#F8F7FD;--x-soft2:#F1EFFA;--x-line:#E4E0F3;--x-accent:#8B5CF6;--x-accent-strong:#7C3AED;--x-accent-soft:#EDE9FE;--x-accent-softer:#F5F3FF;--x-accent-ring:#C4B5FD;--x-accent-text:#6D28D9;--x-box-line:#CDBEF8}' +
                    '#xxt-v41-panel[data-theme="latte"]{--x-bg:#FFFDFA;--x-soft:#F8F3EC;--x-soft2:#F2EBE2;--x-line:#E9DFD3;--x-input:#FFFDF9;--x-accent:#B4835A;--x-accent-strong:#93643F;--x-accent-soft:#F3E8DD;--x-accent-softer:#FAF4EE;--x-accent-ring:#DDBF9F;--x-accent-text:#7C5130;--x-box-line:#E2C9B0}' +
                    '#xxt-v41-panel[data-theme="dark"]{color-scheme:dark;--x-bg:#1E232B;--x-fg:#E5E9F0;--x-strong:#F3F4F6;--x-text2:#CBD5E1;--x-muted:#9AA4B2;--x-faint:#6B7480;--x-soft:#262C36;--x-soft2:#2D3440;--x-line:#374151;--x-line-strong:#4B5563;--x-input:#232933;--x-switch-off:#4B5563;--x-accent:#60A5FA;--x-accent-strong:#93C5FD;--x-accent-soft:#1E3A5F;--x-accent-softer:#1C2A40;--x-accent-ring:#3B82F6;--x-accent-text:#BFDBFE;--x-box-line:#3B5B8A;box-shadow:0 10px 32px rgba(0,0,0,.45),0 1px 3px rgba(0,0,0,.4)!important}' +
                    '#xxt-v41-panel.xxt-custom{--x-accent:var(--x-c);--x-accent-strong:color-mix(in srgb,var(--x-c) 80%,#000);--x-accent-soft:color-mix(in srgb,var(--x-c) 16%,var(--x-bg));--x-accent-softer:color-mix(in srgb,var(--x-c) 8%,var(--x-bg));--x-accent-ring:color-mix(in srgb,var(--x-c) 50%,var(--x-bg));--x-accent-text:color-mix(in srgb,var(--x-c) 72%,var(--x-strong));--x-box-line:color-mix(in srgb,var(--x-c) 45%,var(--x-bg));--x-soft:color-mix(in srgb,var(--x-c) 4%,#F6F8FB);--x-soft2:color-mix(in srgb,var(--x-c) 6%,#F1F3F6);--x-line:color-mix(in srgb,var(--x-c) 10%,#E5E9F0)}' +
                    '#xxt-v41-panel.xxt-custom[data-theme="dark"]{--x-accent-strong:color-mix(in srgb,var(--x-c) 70%,#fff);--x-soft:color-mix(in srgb,var(--x-c) 6%,#262C36);--x-soft2:color-mix(in srgb,var(--x-c) 8%,#2D3440);--x-line:color-mix(in srgb,var(--x-c) 12%,#374151)}' +
                    '#xxt-v41-panel .xxt-custom-row{display:flex;align-items:center;gap:8px;margin:2px 0 6px;padding:8px 10px;border-radius:9px;background:var(--x-bg);box-shadow:inset 0 0 0 1px var(--x-line)}' +
                    '#xxt-v41-panel .xxt-custom-row input[type=color]{flex:none;width:34px;height:26px;padding:0;border:0;border-radius:7px;background:none;cursor:pointer}' +
                    '#xxt-v41-panel .xxt-custom-row input[type=color]::-webkit-color-swatch-wrapper{padding:0}' +
                    '#xxt-v41-panel .xxt-custom-row input[type=color]::-webkit-color-swatch{border:0;border-radius:7px}' +
                    '#xxt-v41-panel .xxt-custom-row code{flex:1;font:12px/1 ui-monospace,Menlo,Consolas,monospace;color:var(--x-text2)}' +
                    '#xxt-v41-panel .xxt-custom-row .xxt-goal-opts{margin:0}' +
                    '#xxt-v41-panel .xxt-custom-row .xxt-rate-opt{flex:none;padding:3px 9px}' +
                    '#xxt-v41-panel .xxt-presets{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 4px}' +
                    '#xxt-v41-panel .xxt-presets button{width:20px;height:20px;padding:0;border:0;border-radius:50%;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.1)}' +
                    '#xxt-v41-panel .xxt-presets button:hover,#xxt-v41-panel .xxt-presets button:focus-visible{outline:2px solid var(--x-accent-ring);outline-offset:1px}' +
                    '#xxt-v41-panel[data-theme="dark"] .xxt-notice.upd{background:#1E3A5F;color:#BFDBFE}' +
                    '#xxt-v41-panel[data-theme="dark"] .xxt-notice.bg{background:#3B2F14;color:#FCD34D}' +
                    '#xxt-v41-panel[data-theme="dark"] .xxt-notice.tip,#xxt-v41-panel[data-theme="dark"] .xxt-notice.rest{background:#123326;color:#86EFAC}' +
                    '#xxt-v41-panel[data-theme="dark"] .xxt-live-row{background:#3A2414}#xxt-v41-panel[data-theme="dark"] .xxt-live-text{color:#FDBA74}' +
                    '#xxt-v41-panel[data-theme="dark"] [data-k="ver"].xxt-has-upd{background:#3B2F14;color:#FCD34D}' +
                    '#xxt-v41-panel[data-theme="dark"] .xxt-power:hover{background:#3F1D1D}' +
                    '#xxt-v41-panel .xxt-themes{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px 0 4px}' +
                    '#xxt-v41-panel .xxt-theme{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 2px;border:0;border-radius:9px;background:var(--x-bg);box-shadow:inset 0 0 0 1px var(--x-line);font:inherit;font-size:11px;color:var(--x-text2);cursor:pointer}' +
                    '#xxt-v41-panel .xxt-theme i{display:block;width:18px;height:18px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}' +
                    '#xxt-v41-panel[data-theme="dark"] .xxt-theme i,#xxt-v41-panel[data-theme="dark"] .xxt-presets button{box-shadow:inset 0 0 0 1px rgba(255,255,255,.28)}' +
                    '#xxt-v41-panel .xxt-theme:hover{box-shadow:inset 0 0 0 1px var(--x-accent-ring)}' +
                    '#xxt-v41-panel .xxt-theme.on{box-shadow:inset 0 0 0 2px var(--x-accent);color:var(--x-strong);font-weight:600}' +
                    '#xxt-v41-panel .xxt-theme:focus-visible{outline:2px solid var(--x-accent-ring);outline-offset:1px}' +
                    '#xxt-v41-panel{display:flex;flex-direction:column}' +
                    '#xxt-v41-panel .xxt-body{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}' +
                    '#xxt-v41-panel .xxt-body > *{flex-shrink:0}' +
                    '#xxt-v41-panel.xxt-sized .xxt-panes{flex:1 0 auto;grid-template-rows:minmax(0,1fr)}' +
                    '#xxt-v41-panel.xxt-sized [data-k="pane-record"] .xxt-bars{height:max(64px,calc(100% - 330px))}' +
                    '#xxt-v41-panel.xxt-sized .xxt-note{max-height:none}' +
                    '#xxt-v41-panel .xxt-rz{position:absolute;z-index:3;display:block}' +
                    '#xxt-v41-panel .xxt-rz-n,#xxt-v41-panel .xxt-rz-s{left:12px;right:12px;height:8px;cursor:ns-resize}' +
                    '#xxt-v41-panel .xxt-rz-n{top:-4px}#xxt-v41-panel .xxt-rz-s{bottom:-4px}' +
                    '#xxt-v41-panel .xxt-rz-e,#xxt-v41-panel .xxt-rz-w{top:12px;bottom:12px;width:8px;cursor:ew-resize}' +
                    '#xxt-v41-panel .xxt-rz-e{right:-4px}#xxt-v41-panel .xxt-rz-w{left:-4px}' +
                    '#xxt-v41-panel .xxt-rz-ne,#xxt-v41-panel .xxt-rz-nw,#xxt-v41-panel .xxt-rz-se,#xxt-v41-panel .xxt-rz-sw{width:16px;height:16px}' +
                    '#xxt-v41-panel .xxt-rz-ne{top:-4px;right:-4px;cursor:nesw-resize}#xxt-v41-panel .xxt-rz-sw{bottom:-4px;left:-4px;cursor:nesw-resize}' +
                    '#xxt-v41-panel .xxt-rz-nw{top:-4px;left:-4px;cursor:nwse-resize}' +
                    '#xxt-v41-panel .xxt-rz-se{bottom:-2px;right:-2px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 0 55%,var(--x-line-strong) 55% 62%,transparent 62% 72%,var(--x-line-strong) 72% 79%,transparent 79%);border-radius:0 0 14px 0;opacity:.8}' +
                    '#xxt-v41-panel .xxt-rz-se:hover{opacity:1}' +
                    '#xxt-v41-panel.xxt-collapsed .xxt-rz{display:none}' +
                    '#xxt-v41-panel.xxt-resizing,#xxt-v41-panel.xxt-resizing *{user-select:none;transition:none!important}' +
                    '#xxt-v41-panel.xxt-scroll{max-height:calc(100vh - 24px)}' +
                    '#xxt-v41-panel.xxt-scroll .xxt-body{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;margin-right:-8px;padding-right:8px}' +
                    '#xxt-v41-panel.xxt-scroll .xxt-tip{bottom:auto;top:calc(100% + 10px)}' +
                    '#xxt-v41-panel.xxt-scroll .xxt-tip::after{top:auto;bottom:100%;border-top-color:transparent;border-bottom-color:#1F2937}' +
                    '#xxt-v41-panel button{margin:0;min-width:0;min-height:0;text-transform:none;letter-spacing:normal}' +
                    '#xxt-v41-panel svg{flex:none}' +
                    '#xxt-v41-panel .xxt-ver-wrap{position:relative;display:inline-flex}' +
                    '#xxt-v41-panel.xxt-collapsed{width:auto!important;min-width:230px;padding:10px 12px!important}' +
                    '#xxt-v41-panel.xxt-collapsed .xxt-logo{width:32px!important;height:32px!important;border-radius:9px!important}' +
                    '#xxt-v41-panel .xxt-toggle{align-self:flex-start;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-top:-1px;border:0;border-radius:7px;background:transparent;color:var(--x-faint);font:20px/1 sans-serif;cursor:pointer;padding:0}' +
                    '#xxt-v41-panel .xxt-toggle:hover,#xxt-v41-panel .xxt-toggle:focus-visible{background:var(--x-soft2);color:var(--x-text2);outline:none}' +
                    '#xxt-v41-panel .xxt-assist{display:flex;align-items:center;gap:10px;width:100%;margin-top:10px;padding:8px 12px;border:0;border-radius:10px;background:var(--x-soft);font:inherit;text-align:left;cursor:pointer;transition:background .15s}' +
                    '#xxt-v41-panel .xxt-assist:hover{background:var(--x-soft2)}' +
                    '#xxt-v41-panel .xxt-assist.on{background:var(--x-accent-softer)}' +
                    '#xxt-v41-panel .xxt-assist:focus-visible{outline:2px solid var(--x-accent-ring);outline-offset:2px}' +
                    '#xxt-v41-panel .xxt-assist-t{flex:1;min-width:0;display:flex;flex-direction:column}' +
                    '#xxt-v41-panel .xxt-assist-t b{font-size:13px;font-weight:600;color:var(--x-strong)}' +
                    '#xxt-v41-panel .xxt-assist-t small{font-size:11px;color:var(--x-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
                    '#xxt-v41-panel .xxt-assist-sw{flex:none;position:relative;width:32px;height:18px;border-radius:9px;background:var(--x-switch-off);transition:background .15s}' +
                    '#xxt-v41-panel .xxt-assist-sw::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform .15s}' +
                    '#xxt-v41-panel .xxt-assist.on .xxt-assist-sw{background:var(--x-accent)}' +
                    '#xxt-v41-panel .xxt-assist.on .xxt-assist-sw::after{transform:translateX(14px)}' +
                    '#xxt-v41-panel .xxt-stats.plain{cursor:default}#xxt-v41-panel .xxt-stats.plain .xxt-chev{display:none}' +
                    '#xxt-v41-panel .xxt-tabs{display:flex;gap:2px;margin-top:10px;padding:3px;border-radius:10px;background:var(--x-soft2)}' +
                    '#xxt-v41-panel .xxt-tabs{position:relative}' +
                    '#xxt-v41-panel .xxt-tabs button{position:relative;z-index:1;flex:1;font:inherit;font-size:13px;border:0;border-radius:8px;padding:5px 0;background:transparent;color:var(--x-muted);cursor:pointer;transition:color .3s ease}' +
                    '#xxt-v41-panel .xxt-tab-ind{position:absolute;z-index:0;top:3px;bottom:3px;left:3px;width:calc((100% - 10px) / 3);border-radius:8px;background:var(--x-bg);box-shadow:0 1px 2px rgba(15,23,42,.08);transition:transform .45s cubic-bezier(.22,1,.36,1)}' +
                    '#xxt-v41-panel .xxt-tabs button:hover{color:var(--x-strong)}' +
                    '#xxt-v41-panel .xxt-tabs button.on{color:var(--x-strong);font-weight:600}' +
                    '#xxt-v41-panel .xxt-tabs button:focus-visible{outline:2px solid var(--x-accent-ring);outline-offset:1px}' +
                    '#xxt-v41-panel .xxt-panes{display:grid;margin-top:12px}' +
                    '#xxt-v41-panel .xxt-pane{grid-area:1/1;min-width:0;flex-direction:column;transition:opacity .36s cubic-bezier(.22,1,.36,1) .14s,transform .36s cubic-bezier(.22,1,.36,1) .14s,visibility 0s linear .14s}' +
                    '#xxt-v41-panel .xxt-pane.off{opacity:0;transform:translateY(6px);visibility:hidden;pointer-events:none;transition:opacity .14s ease,transform .14s ease,visibility 0s linear .14s}' +
                    '#xxt-v41-panel [data-k="pane-today"] .xxt-notewrap{flex:1;flex-direction:column;min-height:0}' +
                    '#xxt-v41-panel [data-k="pane-today"] .xxt-note{flex:1}' +
                    '#xxt-v41-panel [data-k="pane-today"] .xxt-stats{margin-top:auto;padding-top:10px}' +
                    '@media (prefers-reduced-motion:reduce){#xxt-v41-panel .xxt-pane,#xxt-v41-panel .xxt-pane.off{transition:none}}' +
                    '#xxt-v41-panel .xxt-goal{display:flex;align-items:center;gap:12px}' +
                    '#xxt-v41-panel .xxt-ring{position:relative;flex:none;display:inline-flex}' +
                    '#xxt-v41-panel .xxt-ring circle{transition:stroke-dashoffset .5s ease}' +
                    '#xxt-v41-panel .xxt-ring b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--x-strong);font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-goal-text{display:flex;flex-direction:column;min-width:0;gap:2px}' +
                    '#xxt-v41-panel .xxt-goal-text b{font-size:14px;font-weight:600;color:var(--x-strong)}' +
                    '#xxt-v41-panel .xxt-goal-text span{font-size:12px;color:var(--x-muted);font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-sec-title{display:flex;align-items:baseline;gap:6px;margin:12px 0 6px;font-size:12px;font-weight:600;color:var(--x-text2)}' +
                    '#xxt-v41-panel .xxt-sec-title small{margin-left:auto;font-weight:400;font-size:11px;color:var(--x-faint)}' +
                    '#xxt-v41-panel .xxt-note{display:block;box-sizing:border-box;width:100%;min-height:62px;max-height:160px;resize:vertical;margin:0;padding:8px 10px;border:1px solid var(--x-line);border-radius:9px;background:var(--x-input);font:inherit;font-size:13px;line-height:1.5;color:var(--x-fg)}' +
                    '#xxt-v41-panel .xxt-note:focus{outline:none;border-color:var(--x-accent-ring);background:var(--x-bg);box-shadow:0 0 0 3px rgba(59,130,246,.12)}' +
                    '#xxt-v41-panel .xxt-note::placeholder{color:var(--x-faint)}' +
                    '#xxt-v41-panel .xxt-todo{display:flex;flex-direction:column;gap:4px}' +
                    '#xxt-v41-panel .xxt-todo div{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--x-text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
                    '#xxt-v41-panel .xxt-todo i{flex:none;width:11px;height:11px;border-radius:3px;border:1.5px solid var(--x-manual)}' +
                    '#xxt-v41-panel .xxt-todo .xxt-more{color:var(--x-faint);padding-left:19px}' +
                    '#xxt-v41-panel .xxt-nlist{display:flex;flex-direction:column;gap:6px}' +
                    '#xxt-v41-panel .xxt-nitem{padding:7px 10px;border-radius:9px;background:var(--x-soft)}' +
                    '#xxt-v41-panel .xxt-nitem b{display:block;font-size:12px;font-weight:600;color:var(--x-strong);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
                    '#xxt-v41-panel .xxt-nitem span{display:block;font-size:12px;color:var(--x-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
                    '#xxt-v41-panel .xxt-wide{display:block;width:100%;margin-top:8px;flex:none}' +
                    '#xxt-v41-panel .xxt-empty{font-size:12px;color:var(--x-faint);line-height:1.6}' +
                    '#xxt-v41-panel .xxt-recsum{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}' +
                    '#xxt-v41-panel .xxt-recsum div{display:flex;flex-direction:column;align-items:center;padding:8px 2px;border-radius:9px;background:var(--x-soft)}' +
                    '#xxt-v41-panel .xxt-recsum b{font-size:13px;font-weight:700;color:var(--x-strong);white-space:nowrap;font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-recsum span{font-size:11px;color:var(--x-muted)}' +
                    '#xxt-v41-panel .xxt-hgrid{display:flex;gap:3px;justify-content:center}' +
                    '#xxt-v41-panel .xxt-hcol{display:flex;flex-direction:column;gap:3px}' +
                    '#xxt-v41-panel .xxt-hgrid i,#xxt-v41-panel .xxt-hlegend i{display:block;width:14px;height:14px;border-radius:3px}' +
                    '#xxt-v41-panel .xxt-hlegend{display:flex;align-items:center;justify-content:flex-end;gap:3px;margin-top:6px;font-size:10px;color:var(--x-faint)}' +
                    '#xxt-v41-panel .xxt-hlegend i{width:10px;height:10px;border-radius:2px}' +
                    '#xxt-v41-panel .l0{background:var(--x-soft2)}#xxt-v41-panel .l1{background:color-mix(in srgb,var(--x-accent) 22%,var(--x-soft2))}#xxt-v41-panel .l2{background:color-mix(in srgb,var(--x-accent) 45%,var(--x-soft2))}#xxt-v41-panel .l3{background:color-mix(in srgb,var(--x-accent) 72%,var(--x-soft2))}#xxt-v41-panel .l4{background:var(--x-accent)}#xxt-v41-panel .lx{background:transparent}' +
                    '#xxt-v41-panel .xxt-fb-entry{color:var(--x-accent-strong);font-weight:600}' +
                    '#xxt-v41-panel .xxt-wn{margin-top:10px;padding:10px 12px;border-radius:10px;background:linear-gradient(135deg,var(--x-accent-softer),var(--x-soft));color:var(--x-accent-text)}' +
                    '#xxt-v41-panel .xxt-wn-head{display:flex;align-items:center;gap:8px}' +
                    '#xxt-v41-panel .xxt-wn-head b{flex:1;font-size:13px;font-weight:600}' +
                    '#xxt-v41-panel .xxt-wn ul,#xxt-v41-panel .xxt-hv ul{margin:6px 0 0;padding-left:18px;font-size:12px;line-height:1.6;color:var(--x-text2)}' +
                    '#xxt-v41-panel .xxt-wn ul{list-style:none;padding-left:0}' +
                    '#xxt-v41-panel .xxt-wn li{margin:2px 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}' +
                    '#xxt-v41-panel .xxt-wn li::before{content:"•";color:var(--x-accent);font-weight:700;margin-right:6px}' +
                    '#xxt-v41-panel .xxt-wn li.xxt-wn-more::before{content:none}' +
                    '#xxt-v41-panel .xxt-wn li.xxt-wn-more{color:var(--x-muted)}' +
                    '#xxt-v41-panel .xxt-wn-all{margin-top:6px;padding:0;border:0;background:none;font:inherit;font-size:12px;font-weight:600;color:var(--x-accent-strong);cursor:pointer}' +
                    '#xxt-v41-panel .xxt-wn-all:hover,#xxt-v41-panel .xxt-wn-all:focus-visible{text-decoration:underline;outline:none}' +
                    '#xxt-v41-panel .xxt-hv{padding:8px 0;border-top:1px solid var(--x-line)}' +
                    '#xxt-v41-panel .xxt-hv:first-child{border-top:0;padding-top:0}' +
                    '#xxt-v41-panel .xxt-hv-head{display:flex;align-items:center;gap:6px}' +
                    '#xxt-v41-panel .xxt-hv-head b{font-size:13px;color:var(--x-strong);font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-hv-head span{font-size:10px;font-weight:600;color:var(--x-accent-strong);background:var(--x-accent-soft);border-radius:5px;padding:0 6px}' +
                    '#xxt-v41-panel .xxt-hv-head time{margin-left:auto;font-size:11px;color:var(--x-faint);font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-wn-date{font-size:11px;color:var(--x-muted);font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-wn-note,#xxt-v41-panel .xxt-hv-note{margin-top:8px;padding:8px 10px;border-radius:9px;background:var(--x-bg);box-shadow:inset 3px 0 0 var(--x-accent);font-size:12px;line-height:1.6;color:var(--x-text2)}' +
                    '#xxt-v41-panel .xxt-hv-note{background:var(--x-soft2)}' +
                    '#xxt-v41-panel .xxt-wn-note b,#xxt-v41-panel .xxt-hv-note b{display:block;margin-bottom:2px;font-size:11px;font-weight:600;color:var(--x-accent-strong)}' +
                    '#xxt-v41-panel .xxt-hv li.sub{list-style:circle;margin-left:14px;color:var(--x-muted)}' +
                    '#xxt-v41-panel .xxt-fb-head{display:flex;align-items:center;margin-bottom:8px}' +
                    '#xxt-v41-panel .xxt-fb-head b{flex:1;font-size:13px;color:var(--x-strong)}' +
                    '#xxt-v41-panel .xxt-fb-back{border:0;background:none;font:inherit;font-size:12px;color:var(--x-muted);cursor:pointer;padding:2px 4px;border-radius:6px}' +
                    '#xxt-v41-panel .xxt-fb-back:hover,#xxt-v41-panel .xxt-fb-back:focus-visible{color:var(--x-accent-strong);background:var(--x-accent-soft);outline:none}' +
                    '#xxt-v41-panel .xxt-fb .xxt-note{margin-top:6px;min-height:84px}' +
                    '#xxt-v41-panel .xxt-fb-send{background:var(--x-accent)!important;color:var(--x-on-accent)!important;box-shadow:none!important;font-weight:600}' +
                    '#xxt-v41-panel .xxt-fb-send:hover,#xxt-v41-panel .xxt-fb-send:focus-visible{background:var(--x-accent-strong)!important}' +
                    '#xxt-v41-panel .xxt-fb-hint{margin-top:6px;font-size:11px;color:var(--x-faint);line-height:1.5}' +
                    '#xxt-v41-panel .xxt-set-label{margin-top:10px;font-size:13px;color:var(--x-text2)}' +
                    '#xxt-v41-panel .xxt-goal-opts{display:flex;gap:6px;margin:6px 0 4px}' +
                    '#xxt-v41-panel .xxt-notice.rest{background:#ECFDF5;color:#065F46}' +
                    '@media (prefers-reduced-motion:reduce){#xxt-v41-panel .xxt-ring circle,#xxt-v41-panel .xxt-tabs button,#xxt-v41-panel .xxt-tab-ind,#xxt-v41-panel .xxt-toggle,#xxt-v41-panel .xxt-logo{transition:none}}' +
                    '#xxt-v41-panel .xxt-head{display:flex;align-items:center;gap:10px;cursor:grab;touch-action:none}' +
                    '#xxt-v41-panel .xxt-head:active{cursor:grabbing}' +
                    '#xxt-v41-panel .xxt-actions{align-self:flex-start;display:flex;align-items:center;gap:2px;margin-right:-6px}' +
                    '#xxt-v41-panel .xxt-gear{align-self:flex-start;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-top:-1px;border:0;border-radius:7px;background:transparent;color:var(--x-faint);cursor:pointer;padding:0}' +
                    '#xxt-v41-panel .xxt-gear:hover,#xxt-v41-panel .xxt-gear:focus-visible,#xxt-v41-panel .xxt-gear.on{background:var(--x-accent-soft);color:var(--x-accent-strong);outline:none}' +
                    '#xxt-v41-panel .xxt-prog{margin-top:8px}' +
                    '#xxt-v41-panel .xxt-prog-track{display:flex;height:4px;border-radius:2px;background:var(--x-line);overflow:hidden}' +
                    '#xxt-v41-panel .xxt-prog-man{height:100%;background:repeating-linear-gradient(-45deg,var(--x-manual) 0 3px,color-mix(in srgb,var(--x-manual) 55%,#fff) 3px 6px);transition:width .4s ease,margin .4s ease}' +
                    '#xxt-v41-panel .xxt-prog-bar{height:100%;background:var(--x-accent);transition:width .4s ease}' +
                    '#xxt-v41-panel .xxt-prog-text{margin-top:4px;font-size:12px;color:var(--x-muted);font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-courses{margin-top:0}' +
                    '#xxt-v41-panel .xxt-continue{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;padding:10px 12px;border:0;border-radius:10px;background:var(--x-accent);color:var(--x-on-accent);font:inherit;text-align:left;cursor:pointer}' +
                    '#xxt-v41-panel .xxt-continue:hover,#xxt-v41-panel .xxt-continue:focus-visible{background:var(--x-accent-strong);outline:none}' +
                    '#xxt-v41-panel .xxt-continue b{font-size:14px;font-weight:600}' +
                    '#xxt-v41-panel .xxt-continue span{font-size:12px;opacity:.9;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
                    '#xxt-v41-panel .xxt-clist{display:flex;flex-direction:column;gap:6px;margin-top:8px;max-height:260px;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin}' +
                    '#xxt-v41-panel .xxt-crow{display:flex;flex-direction:column;gap:3px;width:100%;padding:8px 10px;border:0;border-radius:9px;background:var(--x-soft);font:inherit;text-align:left;cursor:pointer}' +
                    '#xxt-v41-panel .xxt-crow:hover,#xxt-v41-panel .xxt-crow:focus-visible{background:var(--x-accent-soft);outline:none}' +
                    '#xxt-v41-panel .xxt-cname{font-size:13px;color:var(--x-strong);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}' +
                    '#xxt-v41-panel .xxt-cmeta{display:flex;font-size:11px;color:var(--x-muted);font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-cmeta em{margin-left:auto;font-style:normal;color:var(--x-accent-strong);font-weight:600}' +
                    '#xxt-v41-panel .xxt-ctrack{display:block;height:3px;border-radius:2px;background:var(--x-line);overflow:hidden}' +
                    '#xxt-v41-panel .xxt-ctrack i{display:block;height:100%;background:var(--x-accent)}' +
                    '#xxt-v41-panel .xxt-cmore{margin-top:6px;font-size:12px;color:var(--x-muted)}' +
                    '#xxt-v41-panel .xxt-stats{display:flex;align-items:center;gap:6px;width:100%;margin-top:10px;padding:0;border:0;background:none;font:inherit;font-size:12px;color:var(--x-muted);cursor:pointer;text-align:left}' +
                    '#xxt-v41-panel .xxt-stats span{flex:1;min-width:0;font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-stats b{color:var(--x-strong);font-weight:600}' +
                    '#xxt-v41-panel .xxt-stats:hover span{color:var(--x-text2)}' +

                    '#xxt-v41-panel .xxt-chart{margin-top:12px}' +
                    '#xxt-v41-panel .xxt-bars{display:flex;align-items:flex-end;gap:6px;height:64px}' +
                    '#xxt-v41-panel .xxt-bar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:3px}' +
                    '#xxt-v41-panel .xxt-bar i{display:block;width:100%;max-width:22px;min-height:2px;border-radius:4px 4px 2px 2px;background:color-mix(in srgb,var(--x-accent) 35%,var(--x-soft))}' +
                    '#xxt-v41-panel .xxt-bar.today i{background:var(--x-accent)}' +
                    '#xxt-v41-panel .xxt-bar em{font-style:normal;font-size:10px;color:var(--x-muted);font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-days{display:flex;gap:6px;margin-top:4px}' +
                    '#xxt-v41-panel .xxt-days span{flex:1;text-align:center;font-size:10px;color:var(--x-faint)}' +
                    '#xxt-v41-panel .xxt-settings{margin-top:12px;padding:10px 12px;border-radius:10px;background:var(--x-soft);max-height:min(62vh,460px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}' +
                    '#xxt-v41-panel .xxt-set-row{display:flex;align-items:center;gap:10px;padding:5px 0;cursor:pointer}' +
                    '#xxt-v41-panel .xxt-set-row span{flex:1;min-width:0;font-size:13px;color:var(--x-text2)}' +
                    '#xxt-v41-panel .xxt-set-row small{display:block;font-size:11px;color:var(--x-faint);line-height:1.35}' +
                    '#xxt-v41-panel .xxt-switch{appearance:none;-webkit-appearance:none;flex:none;width:32px;height:18px;border-radius:9px;background:var(--x-switch-off);position:relative;cursor:pointer;margin:0;transition:background .15s}' +
                    '#xxt-v41-panel .xxt-switch::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform .15s}' +
                    '#xxt-v41-panel .xxt-switch:checked{background:var(--x-accent)}' +
                    '#xxt-v41-panel .xxt-switch:checked::after{transform:translateX(14px)}' +
                    '#xxt-v41-panel .xxt-switch:focus-visible{outline:2px solid var(--x-accent-ring);outline-offset:2px}' +
                    '#xxt-v41-panel .xxt-set-actions{display:flex;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--x-line)}' +
                    '#xxt-v41-panel .xxt-set-btn{flex:1;font:inherit;font-size:12px;border:0;border-radius:7px;padding:6px 0;background:var(--x-bg);color:var(--x-text2);cursor:pointer;box-shadow:inset 0 0 0 1px var(--x-line)}' +
                    '#xxt-v41-panel .xxt-set-btn:hover,#xxt-v41-panel .xxt-set-btn:focus-visible{background:var(--x-accent-soft);color:var(--x-accent-strong);outline:none}' +
                    '@media (prefers-reduced-motion:reduce){#xxt-v41-panel .xxt-prog-bar,#xxt-v41-panel .xxt-switch,#xxt-v41-panel .xxt-switch::after{transition:none}}' +
                    '#xxt-v41-panel .xxt-power{align-self:flex-start;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin-top:-1px;border:0;border-radius:7px;background:transparent;color:var(--x-faint);cursor:pointer;padding:0}' +
                    '#xxt-v41-panel .xxt-power:hover,#xxt-v41-panel .xxt-power:focus-visible{background:#FEE2E2;color:#DC2626;outline:none}' +
                    '#xxt-v41-panel .xxt-power.paused{color:#16A34A}' +
                    '#xxt-v41-panel .xxt-power.paused:hover,#xxt-v41-panel .xxt-power.paused:focus-visible{background:#DCFCE7;color:#15803D}' +
                    '#xxt-v41-panel.xxt-enter{transform-origin:left bottom;animation:xxt-enter .7s cubic-bezier(.22,1,.36,1) both}' +
                    '@keyframes xxt-enter{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:.999;transform:none}}' +
                    '#xxt-v41-panel .xxt-toggle{transition:transform .45s cubic-bezier(.22,1,.36,1),background .15s,color .15s}' +
                    '#xxt-v41-panel.xxt-collapsed .xxt-toggle{transform:rotate(90deg)}' +
                    '#xxt-v41-panel .xxt-logo{transition:width .52s cubic-bezier(.22,1,.36,1),height .52s cubic-bezier(.22,1,.36,1),border-radius .52s}' +
                    '@media (prefers-reduced-motion:reduce){#xxt-v41-panel.xxt-enter{animation:none}}' +
                    '#xxt-v41-panel .xxt-rate-row{display:flex;align-items:center;gap:6px;margin:2px 0 4px}' +
                    '#xxt-v41-panel .xxt-notice{display:flex;align-items:flex-start;gap:8px;margin-top:10px;padding:8px 10px;border-radius:9px;font-size:12px;line-height:1.5}' +
                    '#xxt-v41-panel .xxt-notice.upd{background:var(--x-accent-softer);color:var(--x-accent-text)}' +
                    '#xxt-v41-panel .xxt-notice.bg{background:#FFFBEB;color:#92400E}' +
                    '#xxt-v41-panel .xxt-notice.tip{background:#F0FDF4;color:#166534}' +
                    '#xxt-v41-panel .xxt-notice a{color:inherit;font-weight:600;text-decoration:underline;text-underline-offset:2px}' +
                    '#xxt-v41-panel .xxt-notice-text{flex:1;min-width:0}' +
                    '#xxt-v41-panel .xxt-notice-x{flex:none;border:0;background:transparent;color:inherit;opacity:.6;font-size:15px;line-height:1;cursor:pointer;padding:0 2px}' +
                    '#xxt-v41-panel .xxt-notice-x:hover{opacity:1}' +
                    '#xxt-v41-panel .xxt-live-row{display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px 10px;border-radius:9px;background:#FFF7ED}' +
                    '#xxt-v41-panel .xxt-live-text{flex:1;min-width:0;font-size:12px;color:#9A3412;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
                    '#xxt-v41-panel .xxt-live-btn{flex:none;font:inherit;font-size:12px;font-weight:600;border:0;border-radius:7px;padding:4px 10px;background:#F97316;color:#fff;cursor:pointer}' +
                    '#xxt-v41-panel .xxt-live-btn:hover,#xxt-v41-panel .xxt-live-btn:focus-visible{background:#EA580C;outline:none}' +
                    '#xxt-v41-panel .xxt-rate-btn{flex:none;display:inline-flex;align-items:center;gap:4px;font:inherit;font-size:12px;color:var(--x-text2);background:var(--x-soft2);border:0;border-radius:7px;padding:4px 9px;cursor:pointer}' +
                    '#xxt-v41-panel .xxt-rate-btn b{color:var(--x-accent-strong);font-weight:600;font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-rate-btn:hover,#xxt-v41-panel .xxt-rate-btn:focus-visible{background:var(--x-accent-soft);outline:none}' +
                    '#xxt-v41-panel .xxt-chev{font-style:normal;color:var(--x-faint);display:inline-block;transition:transform .22s ease}' +
                    '#xxt-v41-panel .xxt-rate-row.open .xxt-chev{transform:rotate(180deg)}' +
                    '#xxt-v41-panel .xxt-rate-opts{display:flex;gap:6px;flex:1;max-width:0;opacity:0;overflow:hidden;transform:translateX(-6px);' +
                      'transition:max-width .26s ease,opacity .2s ease,transform .26s ease;pointer-events:none}' +
                    '#xxt-v41-panel .xxt-rate-row.open .xxt-rate-opts{max-width:240px;opacity:1;transform:none;pointer-events:auto}' +
                    '#xxt-v41-panel .xxt-rate-opt{flex:1;min-width:0;font:inherit;font-size:12px;border:0;border-radius:7px;padding:4px 0;cursor:pointer;background:var(--x-soft2);color:var(--x-text2);white-space:nowrap}' +
                    '#xxt-v41-panel .xxt-rate-opt:hover{background:var(--x-accent-soft)}' +
                    '#xxt-v41-panel .xxt-rate-opt.on{background:var(--x-accent);color:var(--x-on-accent);font-weight:600}' +
                    '@media (prefers-reduced-motion:reduce){#xxt-v41-panel .xxt-rate-opts,#xxt-v41-panel .xxt-chev{transition:none}}' +
                    '#xxt-v41-panel [data-k="ver"]{white-space:nowrap;display:inline-flex;align-items:center;font-size:12px;font-weight:600;color:var(--x-muted);background:var(--x-soft2);border-radius:6px;padding:1px 7px;text-decoration:none;font-variant-numeric:tabular-nums;transition:background .15s,color .15s}' +
                    '#xxt-v41-panel [data-k="ver"]:hover,#xxt-v41-panel [data-k="ver"]:focus-visible{background:var(--x-accent-soft);color:var(--x-accent-strong);outline:none}' +
                    '#xxt-v41-panel .xxt-tip{position:absolute;right:-64px;bottom:calc(100% + 10px);display:flex;flex-direction:column;gap:2px;white-space:nowrap;' +
                      'padding:8px 11px;border-radius:9px;background:#1F2937;color:#F9FAFB;font-size:12px;line-height:1.45;box-shadow:0 6px 18px rgba(15,23,42,.22);' +
                      'opacity:0;transform:translateY(4px);pointer-events:none;transition:opacity .14s ease,transform .14s ease;z-index:1}' +
                    '#xxt-v41-panel .xxt-tip b{font-weight:600}' +
                    '#xxt-v41-panel .xxt-upd{display:none;position:relative;width:7px;height:7px;margin-left:5px;border-radius:50%;background:#F59E0B;vertical-align:1px}' +
                    '#xxt-v41-panel .xxt-upd::after{content:"";position:absolute;inset:0;border-radius:50%;background:#F59E0B;animation:xxt-ping 1.8s cubic-bezier(0,0,.2,1) infinite}' +
                    '#xxt-v41-panel [data-k="ver"].xxt-has-upd{background:#FEF3C7;color:#B45309}' +
                    '@keyframes xxt-ping{0%{transform:scale(1);opacity:.7}75%,100%{transform:scale(2.6);opacity:0}}' +
                    '#xxt-v41-panel .xxt-tip span{color:var(--x-faint);font-size:11px}' +
                    '#xxt-v41-panel .xxt-tip::after{content:"";position:absolute;right:82px;top:100%;border:6px solid transparent;border-top-color:#1F2937}' +
                    '#xxt-v41-panel .xxt-ver-wrap:hover .xxt-tip,#xxt-v41-panel [data-k="ver"]:focus-visible + .xxt-tip{opacity:1;transform:translateY(0)}' +
                    '@media (prefers-reduced-motion:reduce){#xxt-v41-panel .xxt-tip{transition:none}#xxt-v41-panel .xxt-upd::after{animation:none;opacity:0}}' +
                    '</style>' +
                    '<div data-k="body" class="xxt-body">' +
                    '<div data-k="head" class="xxt-head" aria-label="按住标题栏可拖动浮窗">' +
                      '<div class="xxt-logo" style="width:40px;height:40px;border-radius:12px;background:var(--x-accent-softer);display:flex;align-items:center;justify-content:center;flex:none">' +
                        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color:var(--x-accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
                          '<path d="M12 6.5C10.3 5.2 7.9 4.6 4 4.8v13.4c3.9-.2 6.3.4 8 1.7 1.7-1.3 4.1-1.9 8-1.7V4.8c-3.9-.2-6.3.4-8 1.7z"/>' +
                          '<path d="M12 6.5v13.4M7 9h2.5M7 12h2.5M14.5 9H17M14.5 12H17"/></svg>' +
                      '</div>' +
                      '<div style="flex:1;min-width:0">' +
                        '<div class="xxt-title-row" style="display:flex;align-items:center;flex-wrap:wrap;gap:2px 8px">' +
                          '<span style="font-size:16px;font-weight:700;color:var(--x-strong);white-space:nowrap">学习通助手</span>' +
                          '<span class="xxt-ver-wrap">' +
                            `<a data-k="ver" href="${REPO_URL}" target="_blank" rel="noopener" aria-label="版本 v${VERSION}">v${VERSION}<i data-k="upd" class="xxt-upd"></i></a>` +
                            '<span class="xxt-tip" role="tooltip"><b data-k="tip1">开源 · 1668919739/xuexitongScript</b><span data-k="tip2">已是最新版本 · 点击查看源码、反馈问题</span></span>' +
                          '</span>' +
                        '</div>' +
                        '<div style="display:flex;align-items:center;gap:6px;margin-top:2px;font-size:13px;color:var(--x-muted)">' +
                          '<span data-k="dot" style="width:7px;height:7px;border-radius:50%;flex:none"></span>' +
                          '<span data-k="label"></span>' +
                        '</div>' +
                      '</div>' +
                      '<div class="xxt-actions">' +
                      '<button type="button" data-k="restore" class="xxt-gear" title="还原默认大小（Alt+Shift+R）" aria-label="还原默认大小" style="display:none">' +
                        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>' +
                      '</button>' +
                      '<button type="button" data-k="gear" class="xxt-gear" title="设置" aria-label="设置" aria-expanded="false">' +
                        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>' +
                      '</button>' +
                      '<button type="button" data-k="power" class="xxt-power"></button>' +
                      '<button type="button" data-k="toggle" class="xxt-toggle"></button>' +
                      '</div>' +
                    '</div>' +
                    '<div data-k="box" style="margin-top:14px;padding:11px 14px;border-radius:10px;background:var(--x-soft);border-left:3px solid var(--x-box-line)">' +
                      '<div data-k="chap" style="margin-bottom:4px;font-size:12px;color:var(--x-muted);word-break:break-all"></div>' +
                      '<div data-k="text" style="color:var(--x-text2);word-break:break-all"></div>' +
                      '<div data-k="sub" style="margin-top:4px;font-size:12px;color:var(--x-faint);font-variant-numeric:tabular-nums"></div>' +
                      '<div data-k="prog" class="xxt-prog" style="display:none"><div class="xxt-prog-track"><div data-k="progbar" class="xxt-prog-bar"></div><div data-k="progman" class="xxt-prog-man"></div></div><div data-k="progtext" class="xxt-prog-text"></div></div>' +
                    '</div>' +
                    '<div data-k="whatsnew" class="xxt-wn" style="display:none">' +
                      '<div class="xxt-wn-head"><b data-k="wntitle"></b><small data-k="wndate" class="xxt-wn-date"></small><button type="button" data-k="wnx" class="xxt-notice-x" aria-label="关闭更新说明">×</button></div>' +
                      '<ul data-k="wnlist"></ul>' +
                      '<div data-k="wnnote" class="xxt-wn-note" style="display:none"></div>' +
                      '<button type="button" data-k="wnall" class="xxt-wn-all">查看全部更新记录 ›</button>' +
                    '</div>' +
                    '<button type="button" data-k="assist" class="xxt-assist" role="switch" aria-checked="true">' +
                      '<span class="xxt-assist-t"><b>学习助手</b><small>今日目标 · 本节笔记 · 学习记录 · 休息提醒</small></span><i class="xxt-assist-sw"></i>' +
                    '</button>' +
                    '<div data-k="tabs" class="xxt-tabs" role="tablist" aria-label="学习助手"><i data-k="tabind" class="xxt-tab-ind"></i>' +
                      '<button type="button" role="tab" data-tab="today">今天</button>' +
                      '<button type="button" role="tab" data-tab="course">课程</button>' +
                      '<button type="button" role="tab" data-tab="record">记录</button>' +
                    '</div>' +
                    '<div data-k="panes" class="xxt-panes">' +
                    '<div data-k="pane-today" class="xxt-pane" role="tabpanel">' +
                      '<div data-k="goal" class="xxt-goal"></div>' +
                      '<div data-k="notewrap" class="xxt-notewrap" style="display:none">' +
                        '<div class="xxt-sec-title"><span>本节笔记</span><small data-k="notestate"></small></div>' +
                        '<textarea data-k="note" class="xxt-note" rows="3" maxlength="2000" placeholder="随手记下这一节的要点…（只保存在本机）"></textarea>' +
                      '</div>' +
                      '<button type="button" data-k="stats" class="xxt-stats" title="查看学习记录"><span data-k="statstext"></span><i class="xxt-chev">›</i></button>' +
                    '</div>' +
                    '<div data-k="pane-course" class="xxt-pane" role="tabpanel">' +
                      '<div data-k="cdetail"></div>' +
                      '<div data-k="courses" class="xxt-courses" style="display:none"></div>' +
                    '</div>' +
                    '<div data-k="pane-record" class="xxt-pane" role="tabpanel">' +
                      '<div data-k="recsum" class="xxt-recsum"></div>' +
                      '<div data-k="chart" class="xxt-chart"></div>' +
                      '<div data-k="heat" class="xxt-heat"></div>' +
                    '</div>' +
                    '</div>' +
                    '<div data-k="statsplain" class="xxt-stats plain"></div>' +
                    '<div data-k="settings" class="xxt-settings" style="display:none">' +
                      '<div data-k="rates" class="xxt-rate-row">' +
                        '<button type="button" data-k="ratebtn" class="xxt-rate-btn" aria-expanded="false">倍速 <b data-k="ratecur"></b><i class="xxt-chev">›</i></button>' +
                        '<div data-k="rateopts" class="xxt-rate-opts">' +
                          RATE_OPTIONS.map((r) => `<button type="button" data-rate="${r}" class="xxt-rate-opt">${r}x</button>`).join('') +
                        '</div>' +
                      '</div>' +
                      '<div data-k="ratehint" style="display:none;margin-top:6px;font-size:12px;color:#B45309">本课程限制倍速，当前按页面允许的速度播放</div>' +
                      '<div data-k="goalset"><div class="xxt-set-label">每日学习目标</div>' +
                      '<div class="xxt-goal-opts">' + GOAL_OPTIONS.map((m) => `<button type="button" data-goal="${m}" class="xxt-rate-opt">${m} 分钟</button>`).join('') + '</div></div>' +
                      '<div class="xxt-set-label">浮窗主题</div>' +
                      '<div class="xxt-themes" role="radiogroup" aria-label="浮窗主题">' + THEMES.map(([k, name, color]) =>
                        `<button type="button" class="xxt-theme" data-theme-opt="${k}" role="radio" title="${name}"><i style="background:${color || THEME_SWATCH[k]}"></i>${name}</button>`).join('') + '</div>' +
                      '<div data-k="customset" style="display:none">' +
                        '<div class="xxt-custom-row"><input type="color" data-k="cpick" aria-label="选择主色"><code data-k="chex"></code>' +
                          '<div class="xxt-goal-opts" role="radiogroup" aria-label="底色"><button type="button" class="xxt-rate-opt" data-cbase="light" role="radio">浅色</button><button type="button" class="xxt-rate-opt" data-cbase="dark" role="radio">深色</button></div>' +
                        '</div>' +
                        '<div class="xxt-presets" aria-label="常用颜色">' + ['#3B82F6', '#06B6D4', '#14B8A6', '#22C55E', '#84CC16', '#EAB308', '#F97316', '#EF4444', '#E11D48', '#D946EF', '#6366F1', '#64748B'].map((c) =>
                          `<button type="button" data-cpreset="${c}" style="background:${c}" title="${c}" aria-label="${c}"></button>`).join('') + '</div>' +
                      '</div>' +
                      SETTING_ITEMS.map(([k, name, desc]) => `<label class="xxt-set-row"><span>${name}<small>${desc}</small></span><input type="checkbox" class="xxt-switch" data-set="${k}"></label>`).join('') +
                      '<div class="xxt-set-actions">' +
                        '<button type="button" data-k="fbopen" class="xxt-set-btn xxt-fb-entry">反馈问题 / 提建议</button>' +
                        '<button type="button" data-k="histopen" class="xxt-set-btn">更新记录</button>' +
                      '</div>' +
                      '<div class="xxt-set-actions" style="border-top:0;padding-top:0">' +
                        '<button type="button" data-k="diag" class="xxt-set-btn">复制诊断信息</button>' +
                        '<button type="button" data-k="resetpos" class="xxt-set-btn" title="快捷键 Alt+Shift+R">浮窗复位</button>' +
                      '</div>' +
                    '</div>' +
                    '<div data-k="history" class="xxt-settings xxt-hist" style="display:none">' +
                      '<div class="xxt-fb-head"><b>更新记录</b><button type="button" data-k="histback" class="xxt-fb-back">‹ 返回</button></div>' +
                      '<div data-k="histlist"></div>' +
                    '</div>' +
                    '<div data-k="feedback" class="xxt-settings xxt-fb" style="display:none">' +
                      '<div class="xxt-fb-head"><b>反馈问题 / 提建议</b><button type="button" data-k="fbback" class="xxt-fb-back">‹ 返回</button></div>' +
                      '<div class="xxt-goal-opts" role="radiogroup" aria-label="反馈类型">' +
                        '<button type="button" data-fbtype="bug" class="xxt-rate-opt" role="radio">遇到问题</button>' +
                        '<button type="button" data-fbtype="idea" class="xxt-rate-opt" role="radio">改进建议</button>' +
                      '</div>' +
                      '<textarea data-k="fbtext" class="xxt-note" rows="4" maxlength="2000"></textarea>' +
                      '<label class="xxt-set-row" style="padding-top:8px"><span>附带诊断信息<small>版本、运行状态、最近日志，不含账号和网址参数</small></span><input type="checkbox" class="xxt-switch" data-k="fbdiag"></label>' +
                      '<div class="xxt-set-actions" style="border-top:0;padding-top:4px">' +
                        '<button type="button" data-k="fbcopy" class="xxt-set-btn">复制内容</button>' +
                        '<button type="button" data-k="fbsend" class="xxt-set-btn xxt-fb-send">在 GitHub 提交</button>' +
                      '</div>' +
                      '<div class="xxt-fb-hint">GitHub 需要登录，打不开时点「复制内容」，再发给作者即可。</div>' +
                    '</div>' +
                    '<div data-k="liverow" class="xxt-live-row" style="display:none">' +
                      '<span data-k="livetext" class="xxt-live-text"></span>' +
                      '<button type="button" data-k="livebtn" class="xxt-live-btn">打开直播回放</button>' +
                    '</div>' +
                    '<div data-k="notice" class="xxt-notice" style="display:none">' +
                      '<span data-k="noticetext" class="xxt-notice-text"></span>' +
                      '<button type="button" data-k="noticex" class="xxt-notice-x" aria-label="关闭提示">×</button>' +
                    '</div>' +
                    '</div>' +
                    ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map((d) => `<i data-rz="${d}" class="xxt-rz xxt-rz-${d}"${d === 'se' ? ' title="拖动调整浮窗大小，双击恢复默认大小"' : ''}></i>`).join('');
                el.querySelector('[data-k="ratebtn"]').addEventListener('click', () => {
                    this._ratesOpen = !this._ratesOpen;
                    this._panelKey = '';
                    this._renderPanel();
                });
                for (const btn of el.querySelectorAll('[data-rate]')) {
                    btn.addEventListener('click', () => {
                        this._ratesOpen = false;            // 选好后自动收起
                        this.setRate(btn.getAttribute('data-rate'));
                    });
                }
                el.querySelector('[data-k="ver"]').addEventListener('click', (e) => {
                    if (!this._latest) return;          // 没有新版本：正常打开仓库
                    e.preventDefault();
                    this._doUpdate(true);
                });
                el.querySelector('[data-k="livebtn"]').addEventListener('click', () => this._openNextLive());
                el.querySelector('[data-k="courses"]').addEventListener('click', (e) => {
                    const b = e.target.closest('[data-open]');
                    if (b) this._openFromList(b.getAttribute('data-open'));
                });
                el.querySelector('[data-k="assist"]').addEventListener('click', () => this._animatePanel(() => this._toggleAssist()));
                el.querySelector('[data-k="stats"]').addEventListener('click', () => {
                    if (!C.assistMode) return;
                    this._animatePanel(() => { this._tab = 'record'; });
                });
                const tabs = el.querySelector('[data-k="tabs"]');
                tabs.addEventListener('click', (e) => {
                    const b = e.target.closest('[data-tab]');
                    if (!b) return;
                    this._animatePanel(() => { this._tab = b.getAttribute('data-tab'); });
                });
                tabs.addEventListener('keydown', (e) => {
                    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                    const list = [...tabs.querySelectorAll('[data-tab]')];
                    const i = list.findIndex((b) => b.classList.contains('on'));
                    const nb = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
                    this._animatePanel(() => { this._tab = nb.getAttribute('data-tab'); });
                    nb.focus();
                    e.preventDefault();
                });
                el.querySelector('[data-k="cdetail"]').addEventListener('click', (e) => {
                    if (e.target.closest('[data-act="copynotes"]')) this._copyText(this._notesText(), '已复制本课程的全部笔记', '复制失败，请稍后再试');
                });
                for (const b of el.querySelectorAll('[data-goal]')) b.addEventListener('click', () => this._setGoal(Number(b.getAttribute('data-goal'))));
                const note = el.querySelector('[data-k="note"]');
                let noteTimer = 0;
                const saveNote = () => {
                    clearTimeout(noteTimer); noteTimer = 0;
                    this._saveNote(note.getAttribute('data-title'), note.value);
                    const st = el.querySelector('[data-k="notestate"]');
                    if (st) st.textContent = note.value.trim() ? '已保存在本机' : '';
                };
                note.addEventListener('input', () => {
                    const st = el.querySelector('[data-k="notestate"]');
                    if (st) st.textContent = '正在保存…';
                    clearTimeout(noteTimer);
                    noteTimer = setTimeout(saveNote, 600);
                });
                note.addEventListener('blur', () => { if (noteTimer) saveNote(); this._panelKey = ''; });
                // 在笔记里打字时，不让页面把按键当成播放器快捷键
                for (const t of ['keydown', 'keyup', 'keypress']) note.addEventListener(t, (e) => e.stopPropagation());
                el.querySelector('[data-k="gear"]').addEventListener('click', () => {
                    this._animatePanel(() => {
                        this._settingsOpen = this._histOpen ? true : !this._settingsOpen;
                        this._fbOpen = false; this._histOpen = false;
                    });
                });
                for (const inp of el.querySelectorAll('[data-set]')) {
                    inp.addEventListener('change', () => this._toggleSetting(inp.getAttribute('data-set'), inp.checked));
                }
                el.querySelector('[data-k="diag"]').addEventListener('click', () => this._copyDiagnostics());
                const openHist = () => this._animatePanel(() => { this._histOpen = true; this._histFromSettings = this._settingsOpen; this._settingsOpen = false; });
                el.querySelector('[data-k="histopen"]').addEventListener('click', openHist);
                el.querySelector('[data-k="wnall"]').addEventListener('click', () => { this._dismissWhatsNew(); openHist(); });
                el.querySelector('[data-k="histback"]').addEventListener('click', () => this._animatePanel(() => { this._histOpen = false; this._settingsOpen = !!this._histFromSettings; }));
                el.querySelector('[data-k="wnx"]').addEventListener('click', () => this._animatePanel(() => this._dismissWhatsNew()));
                el.querySelector('[data-k="fbopen"]').addEventListener('click', () => this._animatePanel(() => { this._fbOpen = true; }));
                el.querySelector('[data-k="fbback"]').addEventListener('click', () => this._animatePanel(() => { this._fbOpen = false; }));
                for (const b of el.querySelectorAll('[data-fbtype]')) {
                    b.addEventListener('click', () => { this._fbType = b.getAttribute('data-fbtype'); this._fbDiag = undefined; this._panelKey = ''; this._renderPanel(); });
                }
                const fbtext = el.querySelector('[data-k="fbtext"]');
                for (const t of ['keydown', 'keyup', 'keypress']) fbtext.addEventListener(t, (e) => e.stopPropagation());
                el.querySelector('[data-k="fbdiag"]').addEventListener('change', (e) => { this._fbDiag = e.target.checked; });
                el.querySelector('[data-k="fbcopy"]').addEventListener('click', () => this._sendFeedback(false));
                el.querySelector('[data-k="fbsend"]').addEventListener('click', () => this._sendFeedback(true));
                el.querySelector('[data-k="resetpos"]').addEventListener('click', () => this._resetPanelPos());
                el.querySelector('[data-k="restore"]').addEventListener('click', () => this._restoreSize(false));
                for (const b of el.querySelectorAll('[data-theme-opt]')) b.addEventListener('click', () => this._setTheme(b.getAttribute('data-theme-opt')));
                const cpick = el.querySelector('[data-k="cpick"]');
                cpick.addEventListener('input', () => this._setCustom(cpick.value, null, false));     // 拖动取色时实时预览
                cpick.addEventListener('change', () => this._setCustom(cpick.value, null, true));    // 选定后保存
                for (const b of el.querySelectorAll('[data-cbase]')) b.addEventListener('click', () => this._setCustom(null, b.getAttribute('data-cbase'), true));
                for (const b of el.querySelectorAll('[data-cpreset]')) b.addEventListener('click', () => this._setCustom(b.getAttribute('data-cpreset'), null, true));
                if (!this._onSchemeChange) {
                    this._onSchemeChange = () => { if (C.theme === 'auto') { this._panelKey = ''; this._renderPanel(); } };
                    try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', this._onSchemeChange); } catch (e) { /* ignore */ }
                }
                if (!this._onRestoreKey) {
                    // 快捷键 Alt+Shift+R：浮窗回到默认位置和大小（拉得太大、太小或拖到看不见时用）
                    this._onRestoreKey = (e) => {
                        if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && (e.code === 'KeyR' || /^r$/i.test(e.key))) {
                            e.preventDefault();
                            if (this._panelCollapsed) { this._panelCollapsed = false; }
                            this._restoreSize(true);
                        }
                    };
                    window.addEventListener('keydown', this._onRestoreKey, true);
                }
                this._bindDrag(el, el.querySelector('[data-k="head"]'));
                this._bindResize(el);
                el.querySelector('[data-k="noticex"]').addEventListener('click', () => {
                    if (this._notice && this._notice.kind === 'tip') { try { localStorage.setItem(TMHINT_KEY, '1'); } catch (e) { /* ignore */ } }
                    this._notice = null;
                    this._panelKey = '';
                    this._renderPanel();
                });
                el.querySelector('[data-k="power"]').addEventListener('click', () => {
                    if (this._userStopped) this.run();
                    else this.stop();
                });
                el.querySelector('[data-k="toggle"]').addEventListener('click', () => {
                    this._animatePanel(() => { this._panelCollapsed = !this._panelCollapsed; });
                });
                if (!window.__xxtPanelShown) {
                    window.__xxtPanelShown = true;
                    el.classList.add('xxt-enter');
                    el.addEventListener('animationend', (e) => { if (e.target === el) el.classList.remove('xxt-enter'); });
                }
                document.body.appendChild(el);
                this._applySize(el);
                this._sizeApplied = el;
                this._applyPanelPos(el);
                if (!this._onResize) {
                    this._onResize = () => { if (this._panel) { this._applySize(this._panel); this._applyPanelPos(this._panel); this._fitPanel(this._panel); this._positionFloats(); } };
                    window.addEventListener('resize', this._onResize);
                }
                this._panel = el;
                this._panelKey = '';
                return el;
            },

            // 浮窗尺寸变化（收起 / 展开 / 切换标签页 / 打开设置）时的过渡动画：
            // 先记下旧尺寸，改完再量新尺寸，从旧尺寸平滑过渡过去，新出现的内容淡入
            _animatePanel(change) {
                const el = this._panel;
                const finish = () => { this._panelKey = ''; this._renderPanel(); if (this._panel) this._fitPanel(this._panel); };
                let reduce = false;
                try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
                if (!el || !el.isConnected || reduce || typeof el.animate !== 'function') {
                    change(); finish();
                    if (this._panel) this._applyPanelPos(this._panel);
                    return;
                }
                if (this._resizeAnim) this._resizeAnim.cancel();
                for (const g of el.querySelectorAll(':scope > .xxt-ghost')) g.remove();
                const box = (r, cs) => ({ width: r.width + 'px', height: r.height + 'px', padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}` });
                const body = el.querySelector('[data-k="body"]') || el;
                const visible = () => [...body.children].filter((c) => c.tagName !== 'STYLE' && c.offsetParent !== null);
                const pr = el.getBoundingClientRect();
                const from = box(pr, getComputedStyle(el));
                // 先给当前可见的内容拍一份“快照”：改动后消失的部分用快照原地淡出，而不是一下子没了
                const before = new Map();
                for (const c of visible()) {
                    if (c.getAttribute('data-k') === 'head') { before.set(c, null); continue; }
                    const r = c.getBoundingClientRect();
                    const ghost = c.cloneNode(true);
                    const tas = c.querySelectorAll('textarea'), gtas = ghost.querySelectorAll('textarea');
                    tas.forEach((t, i) => { if (gtas[i]) gtas[i].value = t.value; });
                    ghost.classList.add('xxt-ghost');
                    ghost.removeAttribute('data-k');
                    for (const n of ghost.querySelectorAll('[data-k],[id]')) { n.removeAttribute('data-k'); n.removeAttribute('id'); }
                    ghost.setAttribute('aria-hidden', 'true');
                    ghost.style.cssText += `;position:absolute;margin:0;left:${r.left - pr.left}px;top:${r.top - pr.top}px;width:${r.width}px;height:${r.height}px;pointer-events:none;z-index:2;box-sizing:border-box`;
                    before.set(c, ghost);
                }
                change(); finish();
                this._applyPanelPos(el);
                const to = box(el.getBoundingClientRect(), getComputedStyle(el));
                const sizeEase = 'cubic-bezier(.65,0,.35,1)';     // 尺寸变化：慢起慢收，不会一下子跳过去
                const fadeEase = 'cubic-bezier(.22,1,.36,1)';
                const resized = from.width !== to.width || from.height !== to.height;
                if (resized) {
                    el.style.overflow = 'hidden';
                    const a = el.animate([from, to], { duration: 480, easing: sizeEase });
                    this._resizeAnim = a;
                    const done = () => { if (this._resizeAnim === a) { this._resizeAnim = null; el.style.overflow = ''; } this._positionFloats(); };
                    a.onfinish = done; a.oncancel = done;
                }
                const after = new Set(visible());
                // 消失的内容：快照留在原来的位置（跟着浮窗一起收缩、被裁剪），同时淡出
                for (const [c, ghost] of before) {
                    if (!ghost || after.has(c)) continue;
                    el.appendChild(ghost);
                    const g = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' });
                    g.onfinish = () => ghost.remove();
                    g.oncancel = () => ghost.remove();
                }
                // 新出现的内容：等旧内容淡出后依次淡入
                [...after].filter((c) => !before.has(c)).forEach((c, i) => {
                    c.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
                        { duration: 420, delay: (resized ? 160 : 60) + i * 45, easing: fadeEase, fill: 'backwards' });
                });
            },

            _removePanel() {
                this._removeSide();
                if (this._musicEl) { this._musicOpen = false; this._renderMusic(); }
                if (this._onRestoreKey) { window.removeEventListener('keydown', this._onRestoreKey, true); this._onRestoreKey = null; }
                if (this._panel) {
                    try { this._panel.remove(); } catch (e) { /* ignore */ }
                }
                this._panel = null;
                this._panelKey = '';
            },

            // ================= 目录与学习步骤 =================
            _nodes() {
                let nodes = $('#coursetree').children('ul').children('li').find('.posCatalog_select:not(.firstLayer)');
                if (!nodes.length) nodes = $('#coursetree .posCatalog_select:not(.firstLayer)');
                return nodes;
            },

            // 当前目录节点是否已显示“已完成”（绿色对勾）
            _activeNodeCompleted() {
                const node = this._nodes().filter('.posCatalog_active').first();
                if (!node.length) return false;
                return node.find('.icon_Completed, [class*="icon_Completed"], [class*="icon_complete"]').length > 0;
            },

            _currentIndex() {
                const nodes = this._nodes();
                return nodes.index(nodes.filter('.posCatalog_active').first());
            },

            _clickNode(idx) {
                const span = $(this._nodes().get(idx)).find('.posCatalog_name').get(0);
                if (!span) return false;
                this._clicking = true;
                try { span.click(); } finally { this._clicking = false; }
                return true;
            },

            _goToNode(idx) {
                const nodes = this._nodes();
                if (idx >= nodes.length) {
                    log('============== 本课程学习完成了 ==============', '#4CAF50');
                    this._stop();
                    this._note = `🎉 本课程已全部学习完成${this._courseSummary()}`;
                    return;
                }
                const span = $(nodes.get(idx)).find('.posCatalog_name');
                // 离开时这一节还没完成：说明剩下的是脚本不做的任务（章节测验、讨论等），记为“需手动完成”
                const curIdx = this._currentIndex();
                if (curIdx >= 0 && curIdx < idx && this._nodeTitle(nodes.get(curIdx)) === this._processedTitle) this._markManual(nodes.get(curIdx));
                log(`切换到：${span.attr('title') || span.text().trim()}（${idx + 1}/${nodes.length}）`, '#2196F3');
                this._enterLoading('next');
                if (!this._clickNode(idx)) {
                    log('找不到可点击的课程节点，已停止', '#F44336', 'error');
                    this._stop();
                    this._note = '找不到课程节点，已停止';
                }
            },

            _stepTitle() {
                const el = document.getElementsByClassName('prev_title')[0];
                return el ? (el.title || el.textContent || '').trim() : '';
            },

            _clickVideoTab() {
                const tab = $('.prev_white:visible').filter((_, el) =>
                    /^\d*视频$/.test(($(el).text() || '').replace(/\s+/g, ''))
                ).get(0);
                if (!tab) return false;
                this._stepTried++;
                this._lastStepClickTs = Date.now();
                this._unitStartTs = Date.now();
                this._ignoreUntil = Date.now() + 1500;
                log('切换到“视频”页签', '#2196F3');
                this._clicking = true;
                try {
                    tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                } finally {
                    this._clicking = false;
                }
                return true;
            },

            _advanceChapterTest() {
                if (Date.now() - this._lastStepClickTs < 4000) return;
                if (this._testAdvanceTimes >= 3) {
                    this._state = 'waiting';
                    this._note = '章节测验页跳转失败，请手动处理后切换小节';
                    log('章节测验页连续跳转失败，已暂停，请手动处理后切换小节', '#F44336', 'warn');
                    return;
                }
                const btn = $('#prevNextFocusNext:visible, #right1:visible, .nextChapter:visible').first().get(0);
                if (!btn) {
                    this._state = 'waiting';
                    this._note = '章节测验页未找到下一步按钮，请手动处理';
                    log('未找到章节测验的下一步按钮，已暂停', '#FF9800', 'warn');
                    return;
                }
                this._testAdvanceTimes++;
                this._lastStepClickTs = Date.now();
                this._unitStartTs = Date.now();
                this._ignoreUntil = Date.now() + 1500;
                log('检测到章节测验，进入下一学习步骤', '#607D8B');
                this._clicking = true;
                try {
                    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                } finally {
                    this._clicking = false;
                }
            },

            _bindPageEvents() {
                $(document).off(NS)
                    .on('click' + NS, '#coursetree .posCatalog_name', () => {
                        if (this._clicking) return;
                        log('检测到手动切换小节，准备接管', '#607D8B');
                        this._enterLoading('manual');
                    })
                    .on('click' + NS, '.prev_white', (e) => {
                        if (this._clicking) return;
                        const text = ($(e.currentTarget).text() || '').replace(/\s+/g, '');
                        this._enterLoading('manual-step');
                        if (text.includes('视频')) {
                            log('检测到手动切换到视频页签，准备接管', '#607D8B');
                        } else {
                            this._state = 'waiting';
                            this._note = '已切到非视频页签，切回视频或切换小节后自动继续';
                            log('已切到非视频页签，脚本暂停接管；切回视频页签或切换小节后自动继续', '#607D8B');
                        }
                    });
            },
        };

        return app;
    }
})();
