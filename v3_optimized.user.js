// ==UserScript==
// @name         学习通自动刷课脚本 V4.1
// @namespace    local.codex.xuexitong
// @version      4.2.6
// @description  自动播放、卡顿分级恢复、防暂停拉扯、运行状态浮窗、课件自动翻看、直播回放保活、自动切换下一节，并在页面结构异常时安全停止
// @author       Codex
// @match        *://mooc1.chaoxing.com/mycourse/studentstudy*
// @match        *://*.chaoxing.com/mycourse/studentstudy*
// @match        *://*.chaoxing.com/mooc2-ans/mycourse/studentstudy*
// @match        *://zhibo.chaoxing.com/*
// @include      /^https?:\/\/live[\w-]*\.chaoxing\.com\//
// @updateURL    https://github.com/1668919739/xuexitongScript/raw/master/v3_optimized.user.js
// @downloadURL  https://github.com/1668919739/xuexitongScript/raw/master/v3_optimized.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 只在顶层页面运行；唯一例外是直播回放页里跨域嵌入的播放器（live*.chaoxing.com）
    const IS_LIVE_PLAYER = /^live[\w-]*\.chaoxing\.com$/i.test(location.hostname);
    if (window.top !== window && !IS_LIVE_PLAYER) return;

    // 版本号唯一来源：浮窗徽章和油猴 @version 都从这里读取，发版时只改这一处
    const VERSION = '4.2.6';
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
                console.error('%c脚本启动超时：未检测到课程目录（#coursetree）。请确认当前处于课程播放页或直播回放页。', 'color:#F44336;font-weight:bold');
            }
        }, 1000);
    }

    function createApp($) {
        const C = {
            playbackRate: 1.5,          // 期望倍速
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
            completedPageDwellMs: 2000, // 无视频且已完成的小节，停留多久后进入下一小节
            readDocs: true,             // 自动翻看课件（PPT/PDF/文档）任务点：逐步滚动到底部
            docStepMs: 700,             // 课件每次滚动的间隔
            docMaxSteps: 400,           // 每份课件最多滚动次数
            liveStallMs: 20000,         // 直播回放多久无进度判定为卡住
            autoUpdate: true,           // 发现新版本后，在两个小节之间自动静默更新（不打断正在播放的视频）
            videoSelector: 'video#video_html5_api, video[id*="video_html5"], .video-js video',
            quizSelector: '[class*="videoquiz"]', // 视频内弹题浮层
        };

        // 浮窗里选择的倍速保存在本地，刷新页面、换课程后保持
        const RATE_KEY = 'xxt-v41-rate';
        const RATE_OPTIONS = [1, 1.25, 1.5, 2];
        try {
            const saved = parseFloat(localStorage.getItem(RATE_KEY));
            if (RATE_OPTIONS.includes(saved)) C.playbackRate = saved;
        } catch (e) { /* 无法读取本地存储时使用默认倍速 */ }

        const log = (msg, color = '#607D8B', level = 'log') =>
            console[level](`%c[学习通V4.1] ${msg}`, `color:${color}`);

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
                this._timer = setInterval(() => this._tick(), C.tickMs);
                this._enterLoading('start');
                this._renderPanel();
                this._startUpdateCheck();
            },
            run() {
                this._userStopped = false;
                if (!this._timer) this._timer = setInterval(() => this._tick(), C.tickMs);
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
                this._note = '脚本已停止，点击右上角 ▶ 继续运行';
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
                if (this._timer) clearInterval(this._timer);
                this._timer = null;
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
                const id = setTimeout(() => {
                    this._timeouts.delete(id);
                    if (token === this._token && this._state !== 'stopped') fn();
                }, ms);
                this._timeouts.add(id);
                return id;
            },
            _clearTimeouts() {
                for (const id of this._timeouts) clearTimeout(id);
                this._timeouts.clear();
            },

            // ================= 主循环 =================
            _tick() {
                try {
                    this._tickInner();
                } finally {
                    this._renderPanel();
                }
            },

            _tickInner() {
                if (this._mode === 'live') { this._liveTick(); return; }
                this._maybeAutoUpdate();
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
                const stopVis = (e) => e.stopImmediatePropagation();

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
                    this._docProgress = null;
                    this._state = 'loading';
                    this._unitStartTs = Date.now() - 3000;
                });
                return true;
            },

            async _readDocs(docs, token) {
                const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
                this._timer = setInterval(() => this._tick(), C.tickMs);
                this._state = 'loading';
                this._renderPanel();
                if (!playerOnly) this._startUpdateCheck();
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
                            if (watch === null && /^(watchTime|playTime|currentTime|curTime|playbackTime)$/i.test(k)) watch = n;
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
                if (this._state === 'stopped') return { color: c.GREEN, label: '已完成', text: this._note };
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
            _startUpdateCheck() {
                this._checkUpdate();
                if (!this._updateTimer) this._updateTimer = setInterval(() => this._checkUpdate(), 6 * 3600 * 1000);
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
                switch (this._state) {
                    case 'reading': {
                        const d = this._docProgress || { i: 1, n: 1, pct: 0 };
                        return { color: BLUE, label: '阅读中', text: `正在翻看课件 ${d.i}/${d.n}`, sub: `本份已翻到 ${d.pct}%` };
                    }
                    case 'stopped':
                        if (this._note.startsWith('🎉')) return { color: GREEN, label: '已完成', text: this._note };
                        return { color: GREY, label: '已停止', text: this._note || '脚本已停止，执行 app.run() 继续' };
                    case 'advancing':
                        return { color: BLUE, label: '切换中', text: '即将进入下一小节…' };
                    case 'waiting':
                        return { color: ORANGE, label: '等待中', text: this._note || '等待中…' };
                    case 'playing': {
                        if (!v) break;
                        if (this._quizNotified) return { color: RED, label: '需要处理', text: '检测到视频内弹题，请手动作答，答完自动继续' };
                        if (this._blocked) return { color: RED, label: '需要处理', text: '页面暂停了视频，请手动处理后点击播放' };
                        const sub = `${fmt(v.currentTime)} / ${fmt(v.duration)} · ${v.playbackRate}x`;
                        if (!v.paused && (v.readyState < 3 || this._waiting)) return { color: ORANGE, label: '缓冲中', text: `网络缓冲中：${this._title}`, sub };
                        if (v.paused) return { color: ORANGE, label: '恢复中', text: `正在恢复播放：${this._title}`, sub };
                        return { color: GREEN, label: '播放中', text: `正在播放：${this._title}`, sub };
                    }
                }
                return { color: BLUE, label: '加载中', text: '正在加载视频…' };
            },

            // 当前所在章节：如“2 第一单元 · 第 2/10 节”
            _chapterLine() {
                try {
                    const nodes = this._nodes();
                    const idx = this._currentIndex();
                    if (idx < 0) return '';
                    const node = $(nodes.get(idx));
                    let chapter = '';
                    const cell = node.closest('#coursetree > ul > li');
                    const head = cell.find('.firstLayer .posCatalog_name, .firstLayer .posCatalog_title').first();
                    if (head.length) chapter = (head.attr('title') || head.text() || '').trim();
                    return `${chapter ? chapter + ' · ' : ''}第 ${idx + 1} / ${nodes.length} 节`;
                } catch (e) {
                    return '';
                }
            },

            _renderPanel() {
                if (!C.showPanel) { this._removePanel(); return; }
                const st = this._panelStatus();
                if (this._mode !== 'live') st.chap = this._chapterLine();
                const key = `${st.color}|${st.label}|${st.text}|${st.sub || ''}|${st.chap || ''}|${this._panelCollapsed}|${C.playbackRate}|${this._rateGaveUp}|${this._mode}|${this._latest}|${this._updating}|${this._ratesOpen}|${this._userStopped}`;
                const el = this._ensurePanel();
                if (!el || key === this._panelKey) return;
                this._panelKey = key;
                const q = (k) => el.querySelector(`[data-k="${k}"]`);
                q('dot').style.background = st.color;
                q('label').textContent = st.label;
                q('text').textContent = st.text;
                q('sub').textContent = st.sub || '';
                q('sub').style.display = st.sub ? 'block' : 'none';
                q('chap').textContent = st.chap ? '📖 ' + st.chap : '';
                q('chap').style.display = st.chap ? 'block' : 'none';
                q('box').style.borderLeftColor = st.color === '#22B573' ? '#A7C7F2' : st.color;
                q('box').style.display = this._panelCollapsed ? 'none' : 'block';
                q('toggle').textContent = this._panelCollapsed ? '+' : '–';
                q('toggle').title = this._panelCollapsed ? '展开' : '收起';
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
                    : '已是最新版本 · 点击查看源码';
                const showRates = this._mode !== 'live' && !this._panelCollapsed;
                q('rates').style.display = showRates ? 'flex' : 'none';
                q('ratehint').style.display = showRates && this._rateGaveUp ? 'block' : 'none';
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
                    'width:316px', 'padding:16px', 'border-radius:16px', 'background:#fff', 'color:#1F2937',
                    'box-shadow:0 8px 28px rgba(15,23,42,.12),0 1px 3px rgba(15,23,42,.08)',
                    'font:14px/1.5 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif',
                ].join(';');
                el.innerHTML =
                    '<style>' +
                    '#xxt-v41-panel .xxt-ver-wrap{position:relative;display:inline-flex}' +
                    '#xxt-v41-panel .xxt-power{align-self:flex-start;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;margin-top:-1px;border:0;border-radius:7px;background:transparent;color:#9CA3AF;cursor:pointer;padding:0}' +
                    '#xxt-v41-panel .xxt-power:hover,#xxt-v41-panel .xxt-power:focus-visible{background:#FEE2E2;color:#DC2626;outline:none}' +
                    '#xxt-v41-panel .xxt-power.paused{color:#16A34A}' +
                    '#xxt-v41-panel .xxt-power.paused:hover,#xxt-v41-panel .xxt-power.paused:focus-visible{background:#DCFCE7;color:#15803D}' +
                    '#xxt-v41-panel.xxt-enter{animation:xxt-enter .32s cubic-bezier(.2,.8,.2,1) both}' +
                    '@keyframes xxt-enter{from{opacity:0;transform:translateY(12px)}to{opacity:.999;transform:none}}' +
                    '@media (prefers-reduced-motion:reduce){#xxt-v41-panel.xxt-enter{animation:none}}' +
                    '#xxt-v41-panel .xxt-rate-row{display:flex;align-items:center;gap:6px;margin-top:12px}' +
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
                    '<div style="display:flex;align-items:center;gap:12px">' +
                      '<div style="width:44px;height:44px;border-radius:12px;background:#EAF2FE;display:flex;align-items:center;justify-content:center;flex:none">' +
                        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
                          '<path d="M12 6.5C10.3 5.2 7.9 4.6 4 4.8v13.4c3.9-.2 6.3.4 8 1.7 1.7-1.3 4.1-1.9 8-1.7V4.8c-3.9-.2-6.3.4-8 1.7z"/>' +
                          '<path d="M12 6.5v13.4M7 9h2.5M7 12h2.5M14.5 9H17M14.5 12H17"/></svg>' +
                      '</div>' +
                      '<div style="flex:1;min-width:0">' +
                        '<div style="display:flex;align-items:center;gap:8px">' +
                          '<span style="font-size:17px;font-weight:700;color:#111827;white-space:nowrap">学习通助手</span>' +
                          '<span class="xxt-ver-wrap">' +
                            `<a data-k="ver" href="${REPO_URL}" target="_blank" rel="noopener" aria-label="版本 v${VERSION}">v${VERSION}<i data-k="upd" class="xxt-upd"></i></a>` +
                            '<span class="xxt-tip" role="tooltip"><b data-k="tip1">开源 · 1668919739/xuexitongScript</b><span data-k="tip2">已是最新版本 · 点击查看源码</span></span>' +
                          '</span>' +
                        '</div>' +
                        '<div style="display:flex;align-items:center;gap:6px;margin-top:2px;font-size:13px;color:#6B7280">' +
                          '<span data-k="dot" style="width:7px;height:7px;border-radius:50%;flex:none"></span>' +
                          '<span data-k="label"></span>' +
                        '</div>' +
                      '</div>' +
                      '<button type="button" data-k="power" class="xxt-power"></button>' +
                      '<span data-k="toggle" style="align-self:flex-start;cursor:pointer;color:#9CA3AF;font-size:20px;line-height:1;padding:2px 6px;user-select:none"></span>' +
                    '</div>' +
                    '<div data-k="box" style="margin-top:14px;padding:11px 14px;border-radius:10px;background:#F6F8FB;border-left:3px solid #A7C7F2">' +
                      '<div data-k="chap" style="margin-bottom:4px;font-size:12px;color:#6B7280;word-break:break-all"></div>' +
                      '<div data-k="text" style="color:#374151;word-break:break-all"></div>' +
                      '<div data-k="sub" style="margin-top:4px;font-size:12px;color:#9CA3AF;font-variant-numeric:tabular-nums"></div>' +
                    '</div>' +
                    '<div data-k="rates" class="xxt-rate-row">' +
                      '<button type="button" data-k="ratebtn" class="xxt-rate-btn" aria-expanded="false">倍速 <b data-k="ratecur"></b><i class="xxt-chev">›</i></button>' +
                      '<div data-k="rateopts" class="xxt-rate-opts">' +
                        RATE_OPTIONS.map((r) => `<button type="button" data-rate="${r}" class="xxt-rate-opt">${r}x</button>`).join('') +
                      '</div>' +
                    '</div>' +
                    '<div data-k="ratehint" style="display:none;margin-top:6px;font-size:12px;color:#B45309">本课程限制倍速，当前按页面允许的速度播放</div>';
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
                el.querySelector('[data-k="power"]').addEventListener('click', () => {
                    if (this._userStopped) this.run();
                    else this.stop();
                });
                el.querySelector('[data-k="toggle"]').addEventListener('click', () => {
                    this._panelCollapsed = !this._panelCollapsed;
                    this._panelKey = '';
                    this._renderPanel();
                });
                if (!window.__xxtPanelShown) {
                    window.__xxtPanelShown = true;
                    el.classList.add('xxt-enter');
                    el.addEventListener('animationend', (e) => { if (e.target === el) el.classList.remove('xxt-enter'); });
                }
                document.body.appendChild(el);
                this._panel = el;
                this._panelKey = '';
                return el;
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
                    this._note = '🎉 本课程已全部学习完成';
                    return;
                }
                const span = $(nodes.get(idx)).find('.posCatalog_name');
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
