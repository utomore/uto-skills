// 假的整套測試:把留檔的輸出原樣印出來,讓 --run 有東西可讀。
import fs from 'node:fs';
process.stdout.write(fs.readFileSync(new URL('./test.log', import.meta.url), 'utf8'));
