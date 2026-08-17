---
name: func-spec
description: 撰寫功能/改善規格書 — 兩種模式:「feature」深度討論新功能後產出 docs/spec/func-000x-<slug>.md;「enhance」檢視現有程式碼架構後產出 docs/enhance/enhance-000x-<slug>.md 優化規格。皆含相依性、介面、TodoList 與 1-to-1 測試。觸發詞:功能規格、func spec、新功能、規格書、feature spec、優化規格、改善規格、enhance spec。Use when specifying a new feature (func-spec:feature) or a code-based improvement (func-spec:enhance) before implementation.
user-invocable: true
---

# /func-spec — 功能/改善規格書

先讀取 `../_shared/conventions.md`,遵守其中所有文檔慣例。

本檔只負責路由;實際步驟分散在本目錄另外三份檔案,**只讀取當下用得到的那份**,不要為了完整性把三份都讀完:

- `common.md`:兩模式共用的「前置」與「共通紀律」
- `feature.md`:feature 模式專屬步驟(F1、F2)
- `enhance.md`:enhance 模式專屬步驟(E1、E2、E3)

## 模式判斷

- `/func-spec:feature` 或引數含 `feature` / 「新功能」 → **feature 模式**
- `/func-spec:enhance` 或引數含 `enhance` / 「優化」 / 「改善」 → **enhance 模式**
- 無法判斷 → 用 AskUserQuestion 問開發者要走哪個模式

兩個模式差別在出發點與產出位置:feature 是「還不存在的功能」,以討論為主,產出 `docs/spec/func-000x-<slug>.md`;enhance 是「已存在的程式碼」,**必須先讀程式碼**才有資格討論,產出 `docs/enhance/enhance-000x-<slug>.md`。

## 執行順序

1. 讀取 `common.md`,依「前置」章節執行(讀 architecture.md → 相關 subarch → 相關 ADR → 掃新編號)
2. 依模式判斷結果,讀取 `feature.md` 或 `enhance.md`(**只讀對應那份**),依其步驟執行到文件產出完成
3. 讀取 `common.md` 的「共通紀律」章節,依序執行相依性一致性檢查、回頭檢查架構文件、收尾
