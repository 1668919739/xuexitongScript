(function () {
    'use strict';

    // 只在顶层页面运行；唯一例外是直播回放页里跨域嵌入的播放器（live*.chaoxing.com）
    const IS_LIVE_PLAYER = /^live[\w-]*\.chaoxing\.com$/i.test(location.hostname);
    if (window.top !== window && !IS_LIVE_PLAYER) return;

    // 版本号唯一来源：浮窗徽章和油猴 @version 都从这里读取，发版时只改这一处
    const VERSION = '4.4.4';
    // 每个版本的一句话更新说明：更新后浮窗会短暂显示当前版本这一条（同步记录在 CHANGELOG.md）
    const CHANGELOG = {
        '4.4.4': '后台防卡顿：切到别的窗口时以极小音量播放，并防止浏览器冻结页面',
        '4.4.3': '弹题等需要处理时改用急促的警示音，和普通提示音区分开',
        '4.4.2': '浮窗设置里可以直接反馈问题或提建议',
        '4.4.1': '关闭学习助手时，状态框里重新显示课程进度和预计剩余时间',
        '4.4.0': '浮窗改版为学习助手：今天 / 课程 / 记录三个标签页、本节笔记、每日目标、休息提醒、学习日历',
        '4.3.1': '油猴版改为通过国内 CDN 检查更新，不再因 GitHub 访问慢而更新失败',
        '4.3.0': '课程总进度与剩余时间、设置面板、一键复制诊断信息、提示音与系统通知、浮窗可拖动、登录过期提醒',
        '4.2.8': '页面在后台时给出提示、更新后显示更新说明、增加问题反馈入口',
        '4.2.7': '直播回放自动打开，浮窗显示回放进度',
        '4.2.6': '一键停止 / 继续，浮窗出场动画',
    };
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
            dailyGoal: 60,              // 每日学习目标（分钟）
            breakRemind: false,         // 连续学习一段时间后提醒休息（默认关闭）
            breakAfterMin: 45,          // 连续学习多少分钟提醒休息
            videoSelector: 'video#video_html5_api, video[id*="video_html5"], .video-js video',
            quizSelector: '[class*="videoquiz"]', // 视频内弹题浮层
        };

        // 浮窗里选择的倍速保存在本地，刷新页面、换课程后保持
        const RATE_KEY = 'xxt-v41-rate';
        const SEEN_KEY = 'xxt-v41-seen-version';
        const SETTINGS_KEY = 'xxt-v41-settings';
        const POS_KEY = 'xxt-v41-panel-pos';
        const STATS_KEY = 'xxt-v41-stats';
        const TMHINT_KEY = 'xxt-v41-tm-hint-dismissed';
        const LAST_KEY = 'xxt-v41-last-course';
        const NAMES_KEY = 'xxt-v41-course-names';
        const NOTES_PREFIX = 'xxt-v41-notes-';
        const GOAL_OPTIONS = [30, 60, 90, 120];
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
        } catch (e) { /* 读取失败时使用默认设置 */ }
        const saveSettings = () => {
            try {
                const o = {};
                for (const [k] of SETTING_ITEMS) o[k] = C[k];
                o.dailyGoal = C.dailyGoal;
                o.assistMode = C.assistMode;
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
                if (!from || from === VERSION) return;
                const note = CHANGELOG[VERSION];
                this._notice = { kind: 'upd', until: Date.now() + 15000, text: `已更新到 v${VERSION}${note ? '：' + note : ''}` };
                log(`已从 v${from} 更新到 v${VERSION}${note ? '：' + note : ''}`, '#4CAF50');
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
                    `设置：倍速 ${C.playbackRate}x · 每日目标 ${C.dailyGoal} 分钟 · ${SETTING_ITEMS.map(([k, name]) => `${name}${C[k] ? '开' : '关'}`).join(' · ')}`,
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
                try { localStorage.removeItem(POS_KEY); } catch (e) { /* ignore */ }
                if (this._panel) this._applyPanelPos(this._panel);
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
                    `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#E5E9F0" stroke-width="5"/>` +
                    `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>` +
                    `</svg><b>${label}</b></span>`;
            },

            _esc(t) { return String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); },

            _renderToday(el, ss) {
                const q = (k) => el.querySelector(`[data-k="${k}"]`);
                const g = this._goalInfo();
                q('goal').innerHTML = this._ring(g.pct, g.done ? '#22B573' : '#3B82F6', 48, `${Math.floor(g.sec / 60)}′`) +
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
                let h = `<div class="xxt-goal">${this._ring(prog.pct, '#3B82F6', 48, prog.pct + '%')}<span class="xxt-goal-text"><b>已完成 ${p.done} / ${p.total} 节</b><span>${esc(prog.etaText)}</span></span></div>`;
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
                const key = `${st.color}|${st.label}|${st.text}|${st.sub || ''}|${st.chap || ''}|${prog ? prog.text : ''}|${this._settingsOpen}|${this._mode === 'list' ? JSON.stringify((this._courses || []).map((x) => [x.cid, x.done, x.total])) : ''}|${this._statsOpen}|${Math.floor(this._statSummary().todaySec / 60)}|${SETTING_ITEMS.map(([k]) => C[k] ? 1 : 0).join('')}|${this._panelCollapsed}|${C.playbackRate}|${this._rateGaveUp}|${this._mode}|${this._latest}|${this._updating}|${this._ratesOpen}|${this._userStopped}|${this._lives.map((l) => l.pct + (l.done ? 'd' : '') + (this._liveOpened.has(l.frame || l.info) ? 'o' : '')).join(',')}|${this._liveBlocked}|${this._notice && Date.now() < this._notice.until ? this._notice.text : ''}|${this._tab}|${C.assistMode}|${this._fbOpen}|${this._fbType}|${C.dailyGoal}|${this._notesVer || 0}|${this._mode === 'course' ? this._currentNodeTitle() : ''}|${dayKey()}|${this._progress ? this._progress.manual.join('/') : ''}`;
                const el = this._ensurePanel();
                if (!el || key === this._panelKey) return;
                this._panelKey = key;
                const q = (k) => el.querySelector(`[data-k="${k}"]`);
                q('dot').style.background = st.color;
                el.classList.toggle('xxt-collapsed', !!this._panelCollapsed);
                q('label').textContent = this._panelCollapsed && prog ? `${st.label} · ${prog.pct}%` : st.label;
                q('text').textContent = st.text;
                q('sub').textContent = st.sub || '';
                q('sub').style.display = st.sub ? 'block' : 'none';
                q('chap').textContent = st.chap ? '📖 ' + st.chap : '';
                q('chap').style.display = st.chap ? 'block' : 'none';
                q('box').style.borderLeftColor = st.color === '#22B573' ? '#A7C7F2' : st.color;
                q('box').style.display = this._panelCollapsed ? 'none' : 'block';
                q('prog').style.display = prog ? 'block' : 'none';
                if (prog) {
                    q('progbar').style.width = prog.pct + '%';
                    q('progman').style.width = prog.manualPct + '%';
                    q('progtext').textContent = prog.text;
                    // 打开学习助手时，进度和剩余时间显示在「课程」页里；关闭时显示在状态框里
                    q('progtext').style.display = C.assistMode ? 'none' : 'block';
                    q('prog').title = prog.title;
                }
                const open = !this._panelCollapsed;
                q('settings').style.display = this._settingsOpen && open && !this._fbOpen ? 'block' : 'none';
                q('feedback').style.display = this._settingsOpen && open && this._fbOpen ? 'block' : 'none';
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
                const showMain = open && !this._settingsOpen;
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

            _ensurePanel() {
                if (this._panel && this._panel.isConnected) return this._panel;
                if (!document.body) return null;
                const el = document.createElement('div');
                el.id = 'xxt-v41-panel';
                el.style.cssText = [
                    'position:fixed', 'left:20px', 'bottom:20px', 'z-index:2147483647', 'box-sizing:border-box',
                    'width:324px', 'padding:16px', 'border-radius:16px', 'background:#fff', 'color:#1F2937',
                    'box-shadow:0 8px 28px rgba(15,23,42,.12),0 1px 3px rgba(15,23,42,.08)',
                    'font:14px/1.5 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif',
                ].join(';');
                el.innerHTML =
                    '<style>' +
                    '#xxt-v41-panel .xxt-ver-wrap{position:relative;display:inline-flex}' +
                    '#xxt-v41-panel.xxt-collapsed{width:auto!important;min-width:230px;padding:10px 12px!important}' +
                    '#xxt-v41-panel.xxt-collapsed .xxt-logo{width:32px!important;height:32px!important;border-radius:9px!important}' +
                    '#xxt-v41-panel .xxt-toggle{align-self:flex-start;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;margin-top:-1px;border:0;border-radius:7px;background:transparent;color:#9CA3AF;font:20px/1 sans-serif;cursor:pointer;padding:0}' +
                    '#xxt-v41-panel .xxt-toggle:hover,#xxt-v41-panel .xxt-toggle:focus-visible{background:#F1F3F6;color:#374151;outline:none}' +
                    '#xxt-v41-panel .xxt-assist{display:flex;align-items:center;gap:10px;width:100%;margin-top:10px;padding:8px 12px;border:0;border-radius:10px;background:#F6F8FB;font:inherit;text-align:left;cursor:pointer;transition:background .15s}' +
                    '#xxt-v41-panel .xxt-assist:hover{background:#EEF2F7}' +
                    '#xxt-v41-panel .xxt-assist.on{background:#EEF4FF}' +
                    '#xxt-v41-panel .xxt-assist:focus-visible{outline:2px solid #93C5FD;outline-offset:2px}' +
                    '#xxt-v41-panel .xxt-assist-t{flex:1;min-width:0;display:flex;flex-direction:column}' +
                    '#xxt-v41-panel .xxt-assist-t b{font-size:13px;font-weight:600;color:#111827}' +
                    '#xxt-v41-panel .xxt-assist-t small{font-size:11px;color:#6B7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
                    '#xxt-v41-panel .xxt-assist-sw{flex:none;position:relative;width:32px;height:18px;border-radius:9px;background:#D1D5DB;transition:background .15s}' +
                    '#xxt-v41-panel .xxt-assist-sw::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform .15s}' +
                    '#xxt-v41-panel .xxt-assist.on .xxt-assist-sw{background:#3B82F6}' +
                    '#xxt-v41-panel .xxt-assist.on .xxt-assist-sw::after{transform:translateX(14px)}' +
                    '#xxt-v41-panel .xxt-stats.plain{cursor:default}#xxt-v41-panel .xxt-stats.plain .xxt-chev{display:none}' +
                    '#xxt-v41-panel .xxt-tabs{display:flex;gap:2px;margin-top:10px;padding:3px;border-radius:10px;background:#F1F3F6}' +
                    '#xxt-v41-panel .xxt-tabs{position:relative}' +
                    '#xxt-v41-panel .xxt-tabs button{position:relative;z-index:1;flex:1;font:inherit;font-size:13px;border:0;border-radius:8px;padding:5px 0;background:transparent;color:#6B7280;cursor:pointer;transition:color .3s ease}' +
                    '#xxt-v41-panel .xxt-tab-ind{position:absolute;z-index:0;top:3px;bottom:3px;left:3px;width:calc((100% - 10px) / 3);border-radius:8px;background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.08);transition:transform .45s cubic-bezier(.22,1,.36,1)}' +
                    '#xxt-v41-panel .xxt-tabs button:hover{color:#111827}' +
                    '#xxt-v41-panel .xxt-tabs button.on{color:#111827;font-weight:600}' +
                    '#xxt-v41-panel .xxt-tabs button:focus-visible{outline:2px solid #93C5FD;outline-offset:1px}' +
                    '#xxt-v41-panel .xxt-panes{display:grid;margin-top:12px}' +
                    '#xxt-v41-panel .xxt-pane{grid-area:1/1;min-width:0;flex-direction:column;transition:opacity .42s cubic-bezier(.22,1,.36,1),transform .42s cubic-bezier(.22,1,.36,1),visibility 0s linear 0s}' +
                    '#xxt-v41-panel .xxt-pane.off{opacity:0;transform:translateY(8px);visibility:hidden;pointer-events:none;transition:opacity .22s ease,transform .22s ease,visibility 0s linear .22s}' +
                    '#xxt-v41-panel [data-k="pane-today"] .xxt-notewrap{flex:1;flex-direction:column;min-height:0}' +
                    '#xxt-v41-panel [data-k="pane-today"] .xxt-note{flex:1}' +
                    '#xxt-v41-panel [data-k="pane-today"] .xxt-stats{margin-top:auto;padding-top:10px}' +
                    '@media (prefers-reduced-motion:reduce){#xxt-v41-panel .xxt-pane,#xxt-v41-panel .xxt-pane.off{transition:none}}' +
                    '#xxt-v41-panel .xxt-goal{display:flex;align-items:center;gap:12px}' +
                    '#xxt-v41-panel .xxt-ring{position:relative;flex:none;display:inline-flex}' +
                    '#xxt-v41-panel .xxt-ring circle{transition:stroke-dashoffset .5s ease}' +
                    '#xxt-v41-panel .xxt-ring b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#111827;font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-goal-text{display:flex;flex-direction:column;min-width:0;gap:2px}' +
                    '#xxt-v41-panel .xxt-goal-text b{font-size:14px;font-weight:600;color:#111827}' +
                    '#xxt-v41-panel .xxt-goal-text span{font-size:12px;color:#6B7280;font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-sec-title{display:flex;align-items:baseline;gap:6px;margin:12px 0 6px;font-size:12px;font-weight:600;color:#374151}' +
                    '#xxt-v41-panel .xxt-sec-title small{margin-left:auto;font-weight:400;font-size:11px;color:#9CA3AF}' +
                    '#xxt-v41-panel .xxt-note{display:block;box-sizing:border-box;width:100%;min-height:62px;max-height:160px;resize:vertical;margin:0;padding:8px 10px;border:1px solid #E5E9F0;border-radius:9px;background:#FBFCFD;font:inherit;font-size:13px;line-height:1.5;color:#1F2937}' +
                    '#xxt-v41-panel .xxt-note:focus{outline:none;border-color:#93C5FD;background:#fff;box-shadow:0 0 0 3px rgba(59,130,246,.12)}' +
                    '#xxt-v41-panel .xxt-note::placeholder{color:#9CA3AF}' +
                    '#xxt-v41-panel .xxt-todo{display:flex;flex-direction:column;gap:4px}' +
                    '#xxt-v41-panel .xxt-todo div{display:flex;align-items:center;gap:8px;font-size:12px;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
                    '#xxt-v41-panel .xxt-todo i{flex:none;width:11px;height:11px;border-radius:3px;border:1.5px solid #F5A524}' +
                    '#xxt-v41-panel .xxt-todo .xxt-more{color:#9CA3AF;padding-left:19px}' +
                    '#xxt-v41-panel .xxt-nlist{display:flex;flex-direction:column;gap:6px}' +
                    '#xxt-v41-panel .xxt-nitem{padding:7px 10px;border-radius:9px;background:#F6F8FB}' +
                    '#xxt-v41-panel .xxt-nitem b{display:block;font-size:12px;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
                    '#xxt-v41-panel .xxt-nitem span{display:block;font-size:12px;color:#6B7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
                    '#xxt-v41-panel .xxt-wide{display:block;width:100%;margin-top:8px;flex:none}' +
                    '#xxt-v41-panel .xxt-empty{font-size:12px;color:#9CA3AF;line-height:1.6}' +
                    '#xxt-v41-panel .xxt-recsum{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}' +
                    '#xxt-v41-panel .xxt-recsum div{display:flex;flex-direction:column;align-items:center;padding:8px 2px;border-radius:9px;background:#F6F8FB}' +
                    '#xxt-v41-panel .xxt-recsum b{font-size:13px;font-weight:700;color:#111827;white-space:nowrap;font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-recsum span{font-size:11px;color:#6B7280}' +
                    '#xxt-v41-panel .xxt-hgrid{display:flex;gap:3px;justify-content:center}' +
                    '#xxt-v41-panel .xxt-hcol{display:flex;flex-direction:column;gap:3px}' +
                    '#xxt-v41-panel .xxt-hgrid i,#xxt-v41-panel .xxt-hlegend i{display:block;width:14px;height:14px;border-radius:3px}' +
                    '#xxt-v41-panel .xxt-hlegend{display:flex;align-items:center;justify-content:flex-end;gap:3px;margin-top:6px;font-size:10px;color:#9CA3AF}' +
                    '#xxt-v41-panel .xxt-hlegend i{width:10px;height:10px;border-radius:2px}' +
                    '#xxt-v41-panel .l0{background:#EEF1F5}#xxt-v41-panel .l1{background:#D6E4FB}#xxt-v41-panel .l2{background:#A9C6F5}#xxt-v41-panel .l3{background:#6FA0EE}#xxt-v41-panel .l4{background:#3B82F6}#xxt-v41-panel .lx{background:transparent}' +
                    '#xxt-v41-panel .xxt-fb-entry{color:#2563EB;font-weight:600}' +
                    '#xxt-v41-panel .xxt-fb-head{display:flex;align-items:center;margin-bottom:8px}' +
                    '#xxt-v41-panel .xxt-fb-head b{flex:1;font-size:13px;color:#111827}' +
                    '#xxt-v41-panel .xxt-fb-back{border:0;background:none;font:inherit;font-size:12px;color:#6B7280;cursor:pointer;padding:2px 4px;border-radius:6px}' +
                    '#xxt-v41-panel .xxt-fb-back:hover,#xxt-v41-panel .xxt-fb-back:focus-visible{color:#2563EB;background:#E3ECFD;outline:none}' +
                    '#xxt-v41-panel .xxt-fb .xxt-note{margin-top:6px;min-height:84px}' +
                    '#xxt-v41-panel .xxt-fb-send{background:#3B82F6!important;color:#fff!important;box-shadow:none!important;font-weight:600}' +
                    '#xxt-v41-panel .xxt-fb-send:hover,#xxt-v41-panel .xxt-fb-send:focus-visible{background:#2563EB!important}' +
                    '#xxt-v41-panel .xxt-fb-hint{margin-top:6px;font-size:11px;color:#9CA3AF;line-height:1.5}' +
                    '#xxt-v41-panel .xxt-set-label{margin-top:10px;font-size:13px;color:#374151}' +
                    '#xxt-v41-panel .xxt-goal-opts{display:flex;gap:6px;margin:6px 0 4px}' +
                    '#xxt-v41-panel .xxt-notice.rest{background:#ECFDF5;color:#065F46}' +
                    '@media (prefers-reduced-motion:reduce){#xxt-v41-panel .xxt-ring circle,#xxt-v41-panel .xxt-tabs button,#xxt-v41-panel .xxt-tab-ind,#xxt-v41-panel .xxt-toggle,#xxt-v41-panel .xxt-logo{transition:none}}' +
                    '#xxt-v41-panel .xxt-head{display:flex;align-items:center;gap:12px;cursor:grab;touch-action:none}' +
                    '#xxt-v41-panel .xxt-head:active{cursor:grabbing}' +
                    '#xxt-v41-panel .xxt-actions{align-self:flex-start;display:flex;align-items:center;gap:2px;margin-right:-6px}' +
                    '#xxt-v41-panel .xxt-gear{align-self:flex-start;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;margin-top:-1px;border:0;border-radius:7px;background:transparent;color:#9CA3AF;cursor:pointer;padding:0}' +
                    '#xxt-v41-panel .xxt-gear:hover,#xxt-v41-panel .xxt-gear:focus-visible,#xxt-v41-panel .xxt-gear.on{background:#E3ECFD;color:#2563EB;outline:none}' +
                    '#xxt-v41-panel .xxt-prog{margin-top:8px}' +
                    '#xxt-v41-panel .xxt-prog-track{display:flex;height:4px;border-radius:2px;background:#E5E9F0;overflow:hidden}' +
                    '#xxt-v41-panel .xxt-prog-man{height:100%;background:#F5A524;transition:width .4s ease}' +
                    '#xxt-v41-panel .xxt-prog-bar{height:100%;background:#3B82F6;transition:width .4s ease}' +
                    '#xxt-v41-panel .xxt-prog-text{margin-top:4px;font-size:12px;color:#6B7280;font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-courses{margin-top:0}' +
                    '#xxt-v41-panel .xxt-continue{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;padding:10px 12px;border:0;border-radius:10px;background:#3B82F6;color:#fff;font:inherit;text-align:left;cursor:pointer}' +
                    '#xxt-v41-panel .xxt-continue:hover,#xxt-v41-panel .xxt-continue:focus-visible{background:#2563EB;outline:none}' +
                    '#xxt-v41-panel .xxt-continue b{font-size:14px;font-weight:600}' +
                    '#xxt-v41-panel .xxt-continue span{font-size:12px;opacity:.9;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
                    '#xxt-v41-panel .xxt-clist{display:flex;flex-direction:column;gap:6px;margin-top:8px;max-height:260px;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin}' +
                    '#xxt-v41-panel .xxt-crow{display:flex;flex-direction:column;gap:3px;width:100%;padding:8px 10px;border:0;border-radius:9px;background:#F6F8FB;font:inherit;text-align:left;cursor:pointer}' +
                    '#xxt-v41-panel .xxt-crow:hover,#xxt-v41-panel .xxt-crow:focus-visible{background:#E3ECFD;outline:none}' +
                    '#xxt-v41-panel .xxt-cname{font-size:13px;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}' +
                    '#xxt-v41-panel .xxt-cmeta{display:flex;font-size:11px;color:#6B7280;font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-cmeta em{margin-left:auto;font-style:normal;color:#2563EB;font-weight:600}' +
                    '#xxt-v41-panel .xxt-ctrack{display:block;height:3px;border-radius:2px;background:#E5E9F0;overflow:hidden}' +
                    '#xxt-v41-panel .xxt-ctrack i{display:block;height:100%;background:#3B82F6}' +
                    '#xxt-v41-panel .xxt-cmore{margin-top:6px;font-size:12px;color:#6B7280}' +
                    '#xxt-v41-panel .xxt-stats{display:flex;align-items:center;gap:6px;width:100%;margin-top:10px;padding:0;border:0;background:none;font:inherit;font-size:12px;color:#6B7280;cursor:pointer;text-align:left}' +
                    '#xxt-v41-panel .xxt-stats span{flex:1;min-width:0;font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-stats b{color:#111827;font-weight:600}' +
                    '#xxt-v41-panel .xxt-stats:hover span{color:#374151}' +

                    '#xxt-v41-panel .xxt-chart{margin-top:12px}' +
                    '#xxt-v41-panel .xxt-bars{display:flex;align-items:flex-end;gap:6px;height:64px}' +
                    '#xxt-v41-panel .xxt-bar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:3px}' +
                    '#xxt-v41-panel .xxt-bar i{display:block;width:100%;max-width:22px;min-height:2px;border-radius:4px 4px 2px 2px;background:#BFD3F6}' +
                    '#xxt-v41-panel .xxt-bar.today i{background:#3B82F6}' +
                    '#xxt-v41-panel .xxt-bar em{font-style:normal;font-size:10px;color:#6B7280;font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-days{display:flex;gap:6px;margin-top:4px}' +
                    '#xxt-v41-panel .xxt-days span{flex:1;text-align:center;font-size:10px;color:#9CA3AF}' +
                    '#xxt-v41-panel .xxt-settings{margin-top:12px;padding:10px 12px;border-radius:10px;background:#F6F8FB}' +
                    '#xxt-v41-panel .xxt-set-row{display:flex;align-items:center;gap:10px;padding:5px 0;cursor:pointer}' +
                    '#xxt-v41-panel .xxt-set-row span{flex:1;min-width:0;font-size:13px;color:#374151}' +
                    '#xxt-v41-panel .xxt-set-row small{display:block;font-size:11px;color:#9CA3AF;line-height:1.35}' +
                    '#xxt-v41-panel .xxt-switch{appearance:none;-webkit-appearance:none;flex:none;width:32px;height:18px;border-radius:9px;background:#D1D5DB;position:relative;cursor:pointer;margin:0;transition:background .15s}' +
                    '#xxt-v41-panel .xxt-switch::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform .15s}' +
                    '#xxt-v41-panel .xxt-switch:checked{background:#3B82F6}' +
                    '#xxt-v41-panel .xxt-switch:checked::after{transform:translateX(14px)}' +
                    '#xxt-v41-panel .xxt-switch:focus-visible{outline:2px solid #93C5FD;outline-offset:2px}' +
                    '#xxt-v41-panel .xxt-set-actions{display:flex;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid #E5E9F0}' +
                    '#xxt-v41-panel .xxt-set-btn{flex:1;font:inherit;font-size:12px;border:0;border-radius:7px;padding:6px 0;background:#fff;color:#374151;cursor:pointer;box-shadow:inset 0 0 0 1px #E5E9F0}' +
                    '#xxt-v41-panel .xxt-set-btn:hover,#xxt-v41-panel .xxt-set-btn:focus-visible{background:#E3ECFD;color:#2563EB;outline:none}' +
                    '@media (prefers-reduced-motion:reduce){#xxt-v41-panel .xxt-prog-bar,#xxt-v41-panel .xxt-switch,#xxt-v41-panel .xxt-switch::after{transition:none}}' +
                    '#xxt-v41-panel .xxt-power{align-self:flex-start;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;margin-top:-1px;border:0;border-radius:7px;background:transparent;color:#9CA3AF;cursor:pointer;padding:0}' +
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
                    '#xxt-v41-panel .xxt-notice.upd{background:#EFF6FF;color:#1D4ED8}' +
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
                    '#xxt-v41-panel .xxt-rate-btn{flex:none;display:inline-flex;align-items:center;gap:4px;font:inherit;font-size:12px;color:#4B5563;background:#F1F3F6;border:0;border-radius:7px;padding:4px 9px;cursor:pointer}' +
                    '#xxt-v41-panel .xxt-rate-btn b{color:#2563EB;font-weight:600;font-variant-numeric:tabular-nums}' +
                    '#xxt-v41-panel .xxt-rate-btn:hover,#xxt-v41-panel .xxt-rate-btn:focus-visible{background:#E3ECFD;outline:none}' +
                    '#xxt-v41-panel .xxt-chev{font-style:normal;color:#9CA3AF;display:inline-block;transition:transform .22s ease}' +
                    '#xxt-v41-panel .xxt-rate-row.open .xxt-chev{transform:rotate(180deg)}' +
                    '#xxt-v41-panel .xxt-rate-opts{display:flex;gap:6px;flex:1;max-width:0;opacity:0;overflow:hidden;transform:translateX(-6px);' +
                      'transition:max-width .26s ease,opacity .2s ease,transform .26s ease;pointer-events:none}' +
                    '#xxt-v41-panel .xxt-rate-row.open .xxt-rate-opts{max-width:240px;opacity:1;transform:none;pointer-events:auto}' +
                    '#xxt-v41-panel .xxt-rate-opt{flex:1;min-width:0;font:inherit;font-size:12px;border:0;border-radius:7px;padding:4px 0;cursor:pointer;background:#F1F3F6;color:#4B5563;white-space:nowrap}' +
                    '#xxt-v41-panel .xxt-rate-opt:hover{background:#E3ECFD}' +
                    '#xxt-v41-panel .xxt-rate-opt.on{background:#3B82F6;color:#fff;font-weight:600}' +
                    '@media (prefers-reduced-motion:reduce){#xxt-v41-panel .xxt-rate-opts,#xxt-v41-panel .xxt-chev{transition:none}}' +
                    '#xxt-v41-panel [data-k="ver"]{white-space:nowrap;display:inline-flex;align-items:center;font-size:12px;font-weight:600;color:#6B7280;background:#F1F3F6;border-radius:6px;padding:1px 7px;text-decoration:none;font-variant-numeric:tabular-nums;transition:background .15s,color .15s}' +
                    '#xxt-v41-panel [data-k="ver"]:hover,#xxt-v41-panel [data-k="ver"]:focus-visible{background:#E3ECFD;color:#2563EB;outline:none}' +
                    '#xxt-v41-panel .xxt-tip{position:absolute;right:-64px;bottom:calc(100% + 10px);display:flex;flex-direction:column;gap:2px;white-space:nowrap;' +
                      'padding:8px 11px;border-radius:9px;background:#1F2937;color:#F9FAFB;font-size:12px;line-height:1.45;box-shadow:0 6px 18px rgba(15,23,42,.22);' +
                      'opacity:0;transform:translateY(4px);pointer-events:none;transition:opacity .14s ease,transform .14s ease;z-index:1}' +
                    '#xxt-v41-panel .xxt-tip b{font-weight:600}' +
                    '#xxt-v41-panel .xxt-upd{display:none;position:relative;width:7px;height:7px;margin-left:5px;border-radius:50%;background:#F59E0B;vertical-align:1px}' +
                    '#xxt-v41-panel .xxt-upd::after{content:"";position:absolute;inset:0;border-radius:50%;background:#F59E0B;animation:xxt-ping 1.8s cubic-bezier(0,0,.2,1) infinite}' +
                    '#xxt-v41-panel [data-k="ver"].xxt-has-upd{background:#FEF3C7;color:#B45309}' +
                    '@keyframes xxt-ping{0%{transform:scale(1);opacity:.7}75%,100%{transform:scale(2.6);opacity:0}}' +
                    '#xxt-v41-panel .xxt-tip span{color:#9CA3AF;font-size:11px}' +
                    '#xxt-v41-panel .xxt-tip::after{content:"";position:absolute;right:82px;top:100%;border:6px solid transparent;border-top-color:#1F2937}' +
                    '#xxt-v41-panel .xxt-ver-wrap:hover .xxt-tip,#xxt-v41-panel [data-k="ver"]:focus-visible + .xxt-tip{opacity:1;transform:translateY(0)}' +
                    '@media (prefers-reduced-motion:reduce){#xxt-v41-panel .xxt-tip{transition:none}#xxt-v41-panel .xxt-upd::after{animation:none;opacity:0}}' +
                    '</style>' +
                    '<div data-k="head" class="xxt-head" title="按住拖动浮窗">' +
                      '<div class="xxt-logo" style="width:44px;height:44px;border-radius:12px;background:#EAF2FE;display:flex;align-items:center;justify-content:center;flex:none">' +
                        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
                          '<path d="M12 6.5C10.3 5.2 7.9 4.6 4 4.8v13.4c3.9-.2 6.3.4 8 1.7 1.7-1.3 4.1-1.9 8-1.7V4.8c-3.9-.2-6.3.4-8 1.7z"/>' +
                          '<path d="M12 6.5v13.4M7 9h2.5M7 12h2.5M14.5 9H17M14.5 12H17"/></svg>' +
                      '</div>' +
                      '<div style="flex:1;min-width:0">' +
                        '<div style="display:flex;align-items:center;gap:8px">' +
                          '<span style="font-size:17px;font-weight:700;color:#111827;white-space:nowrap">学习通助手</span>' +
                          '<span class="xxt-ver-wrap">' +
                            `<a data-k="ver" href="${REPO_URL}" target="_blank" rel="noopener" aria-label="版本 v${VERSION}">v${VERSION}<i data-k="upd" class="xxt-upd"></i></a>` +
                            '<span class="xxt-tip" role="tooltip"><b data-k="tip1">开源 · 1668919739/xuexitongScript</b><span data-k="tip2">已是最新版本 · 点击查看源码、反馈问题</span></span>' +
                          '</span>' +
                        '</div>' +
                        '<div style="display:flex;align-items:center;gap:6px;margin-top:2px;font-size:13px;color:#6B7280">' +
                          '<span data-k="dot" style="width:7px;height:7px;border-radius:50%;flex:none"></span>' +
                          '<span data-k="label"></span>' +
                        '</div>' +
                      '</div>' +
                      '<div class="xxt-actions">' +
                      '<button type="button" data-k="gear" class="xxt-gear" title="设置" aria-label="设置" aria-expanded="false">' +
                        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>' +
                      '</button>' +
                      '<button type="button" data-k="power" class="xxt-power"></button>' +
                      '<button type="button" data-k="toggle" class="xxt-toggle"></button>' +
                      '</div>' +
                    '</div>' +
                    '<div data-k="box" style="margin-top:14px;padding:11px 14px;border-radius:10px;background:#F6F8FB;border-left:3px solid #A7C7F2">' +
                      '<div data-k="chap" style="margin-bottom:4px;font-size:12px;color:#6B7280;word-break:break-all"></div>' +
                      '<div data-k="text" style="color:#374151;word-break:break-all"></div>' +
                      '<div data-k="sub" style="margin-top:4px;font-size:12px;color:#9CA3AF;font-variant-numeric:tabular-nums"></div>' +
                      '<div data-k="prog" class="xxt-prog" style="display:none"><div class="xxt-prog-track"><div data-k="progbar" class="xxt-prog-bar"></div><div data-k="progman" class="xxt-prog-man"></div></div><div data-k="progtext" class="xxt-prog-text"></div></div>' +
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
                      SETTING_ITEMS.map(([k, name, desc]) => `<label class="xxt-set-row"><span>${name}<small>${desc}</small></span><input type="checkbox" class="xxt-switch" data-set="${k}"></label>`).join('') +
                      '<div class="xxt-set-actions">' +
                        '<button type="button" data-k="fbopen" class="xxt-set-btn xxt-fb-entry">反馈问题 / 提建议</button>' +
                      '</div>' +
                      '<div class="xxt-set-actions" style="border-top:0;padding-top:0">' +
                        '<button type="button" data-k="diag" class="xxt-set-btn">复制诊断信息</button>' +
                        '<button type="button" data-k="resetpos" class="xxt-set-btn">浮窗回到左下角</button>' +
                      '</div>' +
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
                    '</div>';
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
                    this._animatePanel(() => { this._settingsOpen = !this._settingsOpen; this._fbOpen = false; });
                });
                for (const inp of el.querySelectorAll('[data-set]')) {
                    inp.addEventListener('change', () => this._toggleSetting(inp.getAttribute('data-set'), inp.checked));
                }
                el.querySelector('[data-k="diag"]').addEventListener('click', () => this._copyDiagnostics());
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
                this._bindDrag(el, el.querySelector('[data-k="head"]'));
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
                this._applyPanelPos(el);
                this._panel = el;
                this._panelKey = '';
                return el;
            },

            // 浮窗尺寸变化（收起 / 展开 / 切换标签页 / 打开设置）时的过渡动画：
            // 先记下旧尺寸，改完再量新尺寸，从旧尺寸平滑过渡过去，新出现的内容淡入
            _animatePanel(change) {
                const el = this._panel;
                const finish = () => { this._panelKey = ''; this._renderPanel(); };
                let reduce = false;
                try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
                if (!el || !el.isConnected || reduce || typeof el.animate !== 'function') {
                    change(); finish();
                    if (this._panel) this._applyPanelPos(this._panel);
                    return;
                }
                if (this._resizeAnim) this._resizeAnim.cancel();
                const box = (r, cs) => ({ width: r.width + 'px', height: r.height + 'px', padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}` });
                const visible = () => [...el.children].filter((c) => c.tagName !== 'STYLE' && c.offsetParent !== null);
                const from = box(el.getBoundingClientRect(), getComputedStyle(el));
                const before = new Set(visible());
                change(); finish();
                this._applyPanelPos(el);
                const to = box(el.getBoundingClientRect(), getComputedStyle(el));
                const ease = 'cubic-bezier(.22,1,.36,1)';
                if (from.width !== to.width || from.height !== to.height) {
                    el.style.overflow = 'hidden';
                    const a = el.animate([from, to], { duration: 520, easing: ease });
                    this._resizeAnim = a;
                    const done = () => { if (this._resizeAnim === a) { this._resizeAnim = null; el.style.overflow = ''; } };
                    a.onfinish = done; a.oncancel = done;
                }
                visible().filter((c) => !before.has(c)).forEach((c, i) => {
                    c.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
                        { duration: 460, delay: 120 + i * 50, easing: ease, fill: 'backwards' });
                });
            },

            _removePanel() {
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
