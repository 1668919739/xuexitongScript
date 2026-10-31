// 紫微排盘引擎（ziwei/ziwei.min.js）回归：
// 1. 主脚本引用的引擎文件存在，许可声明在包里；
// 2. 结构不变量：12 宫齐全且逆排、14 主星各出现一次、生年四化恰好 4 颗、命宫标记与命宫地支一致；
// 3. 与「未合并农历库」构建的快照逐宫比对（tests/fixtures/ziwei-snapshot.json），确认合并 lunar 库没有改变排盘结果；
// 4. 农历→公历、晚子时换日用的辅助函数；
// 5. 浮窗里的 _ziweiResolveInput（从 v3_optimized.js 抽取源码执行，不复制实现）。
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
let failed = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { failed++; console.log('  ✗ ' + msg); } };
const src = readFileSync(resolve(root, 'v3_optimized.js'), 'utf8');
const engineFile = (/const ZIWEI_ENGINE_FILE = '([^']+)';/.exec(src) || [])[1];
ok(!!engineFile && existsSync(resolve(root, engineFile)), `主脚本引用的引擎文件存在：${engineFile}`);
if (!engineFile || !existsSync(resolve(root, engineFile))) { console.log('\n[ziwei-engine] 引擎文件缺失'); process.exit(1); }
const code = readFileSync(resolve(root, engineFile), 'utf8');

ok(/ziwei-doushu[\s\S]*MIT[\s\S]*iztro[\s\S]*MIT[\s\S]*lunar-javascript[\s\S]*MIT/.test(code.slice(0, 800)), '包头保留三个上游项目的 MIT 声明');
ok(readFileSync(resolve(root, 'ziwei/LICENSE-THIRD-PARTY.txt'), 'utf8').split('Permission is hereby granted').length === 4, 'LICENSE-THIRD-PARTY.txt 含三份完整许可文本');

const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(code, ctx);
const Z = ctx.XxtZiwei;
for (const k of ['generateChart', 'detectPatterns', 'getMingGongSummary', 'lunarToSolar', 'leapMonthOfLunarYear', 'shiftGregorianDate']) ok(typeof Z[k] === 'function', `导出 ${k}`);

const BR = '子丑寅卯辰巳午未申酉戌亥';
const PALACES = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
const MAJOR = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
const key = (c) => ({
    ming: BR[c.mingGongBranch], shen: BR[c.shenGongBranch], ju: c.wuxingJuName, mingZhu: c.mingZhu, shenZhu: c.shenZhu, yy: c.yinYangGender,
    lunar: [c.lunarInfo.lunarYear, c.lunarInfo.lunarMonth, c.lunarInfo.lunarDay, c.lunarInfo.isLeapMonth], pillars: c.lunarInfo.fourPillars,
    palaces: Object.fromEntries([...c.palaces].sort((a, b) => a.branch - b.branch).map((p) => [BR[p.branch], p.name + '|' + p.stars.map((s) => s.name + (s.brightnessRaw || '') + (s.siHua ? '化' + s.siHua : '')).join(',')])),
    daxian: c.daXians.map((d) => d.startAge + '-' + d.endAge + BR[d.palaceBranch]).join(' '),
});

console.log('结构不变量');
let structBad = 0, n = 0;
for (let y = 1920; y <= 2040; y += 7) for (const m of [1, 4, 8, 12]) for (const h of [0, 5, 11]) for (const g of ['male', 'female']) {
    n++;
    const c = Z.generateChart({ year: y, month: m, day: 10 + (h % 7), hour: h, gender: g });
    const byBranch = new Map(c.palaces.map((p) => [p.branch, p]));
    const names = c.palaces.map((p) => p.name);
    const majors = c.palaces.flatMap((p) => p.stars.filter((s) => s.type === 'major').map((s) => s.name));
    const sihua = c.palaces.flatMap((p) => p.stars.filter((s) => s.siHua).map((s) => s.siHua)).sort().join('');
    const bad = byBranch.size !== 12
        || PALACES.some((nm) => !names.includes(nm))
        || PALACES.some((nm, k) => byBranch.get(((c.mingGongBranch - k) % 12 + 12) % 12).name !== nm)
        || MAJOR.some((s) => majors.filter((x) => x === s).length !== 1)
        || sihua !== ['禄', '权', '科', '忌'].sort().join('')
        || !byBranch.get(c.mingGongBranch).isMingGong;
    if (bad) { structBad++; if (structBad < 3) console.log('    ', JSON.stringify({ y, m, h, g })); }
}
ok(structBad === 0, `${n} 张盘结构完整（12 宫逆排、14 主星各一、生年四化 4 颗、命宫标记一致）`);

console.log('与未合并农历库构建的快照比对');
const snap = JSON.parse(readFileSync(resolve(root, 'tests/fixtures/ziwei-snapshot.json'), 'utf8'));
for (const { input, expect } of snap.charts) {
    const got = key(Z.generateChart(input));
    const diff = Object.keys(expect).filter((k) => JSON.stringify(got[k]) !== JSON.stringify(expect[k]));
    ok(diff.length === 0, `${input.year}-${input.month}-${input.day} ${BR[input.hour]}时 ${input.gender === 'male' ? '男' : '女'}` + (diff.length ? ` 不一致字段：${diff.join(',')}` : ''));
}

console.log('农历 / 换日辅助');
const s = (o) => o && `${o.year}-${o.month}-${o.day}`;
ok(s(Z.lunarToSolar(1990, 1, 1, false)) === '1990-1-27', '1990 年正月初一 = 1990-01-27');
ok(s(Z.lunarToSolar(2023, 2, 1, true)) === '2023-3-22', '2023 年闰二月初一 = 2023-03-22');
ok(s(Z.lunarToSolar(2020, 4, 10, true)) === '2020-6-1', '2020 年闰四月初十 = 2020-06-01');
ok(Z.lunarToSolar(2023, 3, 1, true) === null, '不存在的闰三月返回 null，不顺延');
ok(Z.leapMonthOfLunarYear(2023) === 2 && Z.leapMonthOfLunarYear(2024) === 0, '闰月查询');
ok(s(Z.shiftGregorianDate({ year: 2023, month: 12, day: 31 }, 1)) === '2024-1-1', '跨年换日');

console.log('浮窗输入换算（_ziweiResolveInput）');
const m = /\n(\s*)_ziweiResolveInput\(f, Z\) \{[\s\S]*?\n\1\},/.exec(src);
ok(!!m, '从 v3_optimized.js 抽到 _ziweiResolveInput');
if (m) {
    const obj = vm.runInNewContext(`({${m[0].trim()}})`);
    const r = (f) => obj._ziweiResolveInput(f, Z);
    const a = r({ cal: 'solar', year: 1990, month: 5, day: 15, hour: 6, gender: 'male' });
    ok(a.ok && s(a.birth) === '1990-5-15' && a.birth.hour === 6, '公历直接排盘');
    const b = r({ cal: 'solar', year: 2023, month: 12, day: 31, hour: 12, gender: 'female' });
    ok(b.ok && s(b.birth) === '2024-1-1' && b.birth.hour === 0 && /晚子时/.test(b.note), '晚子时（23:00 后）归到次日子时并提示');
    const c = r({ cal: 'lunar', year: 2023, month: 2, day: 1, leap: true, hour: 3, gender: 'male' });
    ok(c.ok && s(c.birth) === '2023-3-22', '农历闰月换成公历');
    const d = r({ cal: 'lunar', year: 2023, month: 3, day: 1, leap: true, hour: 3, gender: 'male' });
    ok(!d.ok && /闰/.test(d.error), '农历闰月不存在时报错，不顺延');
    const e = r({ cal: 'solar', year: 2023, month: 2, day: 30, hour: 3, gender: 'male' });
    ok(!e.ok, '不存在的公历日期报错');
    const f = r({ cal: 'solar', year: 1800, month: 1, day: 1, hour: 3, gender: 'male' });
    ok(!f.ok, '超出 1900–2100 报错');
}

console.log('星曜含义与 AI 解读提示词（_zwPrompt）');
ok(MAJOR.every((n) => Z.STAR_DESCRIPTIONS && Z.STAR_DESCRIPTIONS[n] && Z.STAR_DESCRIPTIONS[n].keywords), '引擎导出 14 主星的基本含义');
const topicsSrc = (/\n    const ZIWEI_TOPICS = \[[\s\S]*?\n    \];/.exec(src) || [])[0];
const pm = /\n(\s*)_zwPrompt\(chart, patterns, topicKey, desc\) \{[\s\S]*?\n\1\},/.exec(src);
ok(!!topicsSrc && !!pm, '从 v3_optimized.js 抽到 ZIWEI_TOPICS 与 _zwPrompt');
if (topicsSrc && pm) {
    const obj = vm.runInNewContext(`${topicsSrc.trim()}\n({ topics: ZIWEI_TOPICS, ${pm[0].trim()} })`);
    const chart = Z.generateChart({ year: 1990, month: 5, day: 15, hour: 6, gender: 'male' });
    const pats = Z.detectPatterns(chart);
    ok(obj.topics.map((t) => t[1]).join('') === '命格性格感情事业财运健康', '六个主题：命格 性格 感情 事业 财运 健康');
    for (const [key, label, focus] of obj.topics) {
        const { system, user } = obj._zwPrompt(chart, pats, key, Z.STAR_DESCRIPTIONS);
        const palacesOk = PALACES.every((n) => user.includes(`- ${n}（`));
        ok(palacesOk && user.includes(`「${label}」`) && focus.every((f) => user.includes(f)), `「${label}」提示词含 12 宫、主题和重点宫位`);
    }
    const { system, user } = obj._zwPrompt(chart, pats, 'career', Z.STAR_DESCRIPTIONS);
    ok(/不要编造古籍原文或倪海厦的原话/.test(system) && /不做医学诊断/.test(system) && /不预言寿命/.test(system), '系统提示词限制：不编造引文、不做医学诊断、不做绝对化预言');
    ok(['化禄：太阳（在财帛）', '化权：武曲（在疾厄）', '化科：太阴（在财帛）', '化忌：天同（在迁移）'].every((x) => user.includes(x)), '生年四化按禄权科忌列出并标明所在宫');
    const huaSec = user.split('【生年四化】')[1].split('【格局】')[0].trim().split('\n').map((x) => x.slice(3, 4)).join('');
    ok(huaSec === '禄权科忌', `【生年四化】按禄权科忌排序：${huaSec}`);
    ok(pats.every((p) => user.includes(p.name)) && user.includes('【出处：《紫微斗数全书》'), '格局与自带出处写进提示词');
    ok(user.includes('天梁：荫护·医药·长辈') || /天梁：[^\n]+；[^\n]+；五行/.test(user), '盘上主星的基本含义写进提示词');
    ok(/- 命宫（丁亥，身宫，大限 5–14 岁）：主星 天梁\(陷\)/.test(user), `命宫行格式正确`);
    ok(/官禄（[^）]*）：主星 无（空宫，借对宫/.test(user), '空宫写明借对宫的星');
    let threw = false; try { obj._zwPrompt(chart, pats, 'nope', {}); } catch (e) { threw = true; }
    ok(threw, '未知主题报错');
}

if (failed) { console.log(`\n[ziwei-engine] ${failed} 项失败`); process.exit(1); }
console.log('\n[ziwei-engine] 全部通过');
