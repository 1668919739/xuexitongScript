# 协作约定

## 推送必须授权

- **任何 `git push`（含 `--force`、推新分支、推 tag）都必须先获得用户明确许可。**
- 未获许可时：改动只留在本地工作区，或只做 `git commit`，不执行 `git push`。
- 提法是「要不要推」而不是「已经推了」。
- 用户说「推」「推送」「发版」之类的明确指令，才算许可；一次许可只对应当次推送。

## 发版流程（每次发布必须完整走完）

1. 只改 `v3_optimized.js` 里的 `VERSION` 常量；`v3_optimized.user.js` 与 `version.json` 由
   `node scripts/build-userscript.mjs` 生成，**不要手改**。
2. `CHANGELOG`（代码内）和 `CHANGELOG.md` 各加一条，版本号与日期对齐。
3. 跑全部测试：`npm run test:all`
   （`verify-v3` / `ncm-verify` / `popup-recognize` / `rate-maintain` / `panel-status`）。
4. **征求推送许可**（见上节）。
5. 获准后 `git push`。
6. `npm run release` —— 自动清 jsDelivr 缓存，并逐个核对 **raw / CDN 六个链接**的版本号
   （`version.json`、`v3_optimized.user.js`、`v3_optimized.js`），全部一致才算发布完成。
7. 把 `release.mjs` 的输出原样报给用户；若有不一致，等几十秒重跑，仍不一致要说明原因。

## 其他

- 改完代码先跑测试，再谈提交。
- 测试脚本从 `v3_optimized.js` **抽取函数源码**执行，不复制算法副本，避免测试与实现脱节。
- 自建样本只能验证「实现自洽」；验证算法本身要有第三方实现或真实文件 + 独立解码器（如 ffmpeg）。
