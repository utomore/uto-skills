/**
 * _help.mjs — `--help` 的唯一實作(不可執行,只給同目錄的腳本 import)。
 *
 * 每支腳本的檔頭**本來就有**「用法 + Exit code」區塊,給讀原始碼的人看。
 * 這支把同一段在執行期印出來,所以 `--help` 與檔頭**永遠是同一份文字** ——
 * 另寫一個 USAGE 常數就是第二份,而第二份只會在改旗標的時候被忘記。
 * `scan-status.mjs` 原本就是那樣:檔頭一份、`USAGE` 常數一份,兩份已經開始不一樣。
 *
 * 為什麼要有 `--help`:旗標、參數與 exit code 數值屬於**腳本自己**,寫進 skill 的
 * markdown 就是抄一份到會漂的地方。skill 文檔只留「一行常用指令」與「誰能用、
 * 用到什麼程度」——後者腳本產不出來(它不知道是誰在呼叫它),前者內聯比跑一次
 * `--help` 少一趟 round-trip。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * 取出該檔檔頭區塊註解裡「用法:」開始到區塊結束的部分,剝掉 ` * ` 前綴。
 * @param {string} metaUrl 呼叫端的 `import.meta.url`
 */
export function usageBlock(metaUrl) {
  const src = readFileSync(fileURLToPath(metaUrl), "utf8");
  const head = src.match(/\/\*\*([\s\S]*?)\*\//);   // 檔案可能以 #! 開頭,不能綁在第 0 個字元
  if (!head) return "(這支腳本的檔頭沒有區塊註解,用法請直接讀原始碼)";
  const lines = head[1].split(/\r?\n/).map((l) => l.replace(/^\s*\* ?/, ""));
  const from = lines.findIndex((l) => /^用法[:：]/.test(l.trim()));
  if (from < 0) return "(這支腳本的檔頭沒有「用法:」段,用法請直接讀原始碼)";
  return lines.slice(from).join("\n").trimEnd();
}

/**
 * argv 帶 `--help` / `-h` 時印出用法並以 0 結束。**放在參數解析的最前面**:
 * 求助不該被「未知選項」擋下來,那是最需要看說明的時候。
 */
export function printHelpIfAsked(argv, metaUrl) {
  if (!argv.some((a) => a === "--help" || a === "-h")) return;
  console.log(usageBlock(metaUrl));
  process.exit(0);
}
