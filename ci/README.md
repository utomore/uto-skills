# ci/

給用 dev-flow 或 lawful 的專案複製的 CI 範本，兩套各自獨立，拿你用的那一套就好：

| 你的專案用 | 看這裡 | 內容 |
|---|---|---|
| dev-flow(`.design/`) | [`ci/dev-flow/`](dev-flow/README.md) | `contract.mjs`、GitHub Actions、GitLab CI、CODEOWNERS |
| lawful(`.lawful/`) | [`ci/lawful/`](lawful/README.md) | 同上 |

兩套做同一件事：一條 PR 進來，對帳文檔與程式碼、跑建置、跑整套測試，任一紅就合不進主線。建置與測試的指令從 `system.md` / `Cone.md` 讀，不需要任何 AI。
