# 协作约定

## 推送必须授权

- **任何 `git push`（含 `--force`、推新分支、推 tag）都必须先获得用户明确许可。**
- 未获许可时：改动只留在本地工作区，或只做 `git commit`，不执行 `git push`。
- 提法是「要不要推」而不是「已经推了」。
- 用户说「推」「推送」「发版」之类的明确指令，才算许可；一次许可只对应当次推送。

## 其他

- 改完代码先跑 `node tests/verify-v3.mjs` 和 `node tests/ncm-verify.mjs`，再谈提交。
- 版本号只改 `v3_optimized.js` 里的 `VERSION` 常量，`v3_optimized.user.js` 与 `version.json` 由 `node scripts/build-userscript.mjs` 生成，不要手改。
