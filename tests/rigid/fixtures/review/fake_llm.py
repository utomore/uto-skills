"""假的模型：讀 stdin 的提示詞，回三個發現。

- 第一個落在新增行上（留下）。
- 第二個落在 context 行上（丟掉）。
- 第三個的檔案不在 diff 裡（丟掉）。
回覆前後夾雜文字，驗 parse_findings 只取 JSON 物件。
"""

import json
import sys

sys.stdin.read()
findings = {
    "findings": [
        {
            "file": "src/shop/api/app.py",
            "line": 11,
            "layer": "api",
            "rule": "不放：接線、規則",
            "reason": "依總額決定要不要回訂單，是業務規則",
            "move_to": "domains/orders",
        },
        {
            "file": "src/shop/api/app.py",
            "line": 8,
            "layer": "api",
            "rule": "不放：接線、規則",
            "reason": "這是 context 行",
            "move_to": "domains/orders",
        },
        {
            "file": "src/shop/cli/main.py",
            "line": 3,
            "layer": "cli",
            "rule": "不放：接線、規則",
            "reason": "這個檔不在 diff 裡",
            "move_to": "domains/orders",
        },
    ]
}
print("Here is my review:\n" + json.dumps(findings, ensure_ascii=False) + "\nDone.")
