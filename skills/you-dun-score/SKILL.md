---
name: you-dun-score
description: Process "优盾分" (you-dun score) CSV files under a given target directory — create  per-subdir app_code folders, replace 优盾分.csv with the latest 优盾分_new.csv, then move the new  优盾分.csv into the matching app_code folder. Use when the user asks to handle 优盾分 CSV batch  processing on a network path.
---

# 优盾分 CSV 批处理

处理某个目标目录下的所有子目录中的 `优盾分` 系列 CSV 文件。

## 触发条件

- 用户说"处理优盾分"、"跑一下优盾分流程"、"you-dun score"等
- 涉及 `优盾分.csv` / `优盾分_new.csv` 的批处理
- 网络共享路径下的批量整理

## 流程

### 0. 询问目标目录

用 AskUserQuestion 询问用户要处理的目标目录的完整网络路径。
例：`\\192.168.10.14\mydisk\测试网络路径\4.测试返回结果\model_score\20260918\AA39`

记录为 `BASE`。

### 1. 列出 `BASE` 下的所有子目录

```bash
ls -1 "$BASE"
```

### 2. 在每个子目录中创建 `app_code` 文件夹

```bash
for d in "$BASE"/*/; do
  mkdir -p "$d/app_code"
done
```

### 3. 扫描每个子目录中的 CSV

```bash
for d in "$BASE"/*/; do
  echo "=== $d ==="
  ls "$d" | grep -E '优盾分(_new)?\.csv$'
done
```

### 4. CSV 替换

- 同时有 `优盾分.csv` 和 `优盾分_new.csv`：删旧 `优盾分.csv`，`_new.csv` 重命名为 `优盾分.csv`
- 只有 `优盾分_new.csv`：直接重命名
- 只有 `优盾分.csv`：跳过

```bash
for d in "$BASE"/*/; do
    NEW=$(ls "$d"/*优盾分_new.csv 2>/dev/null | head -1)
    if [ -n "$NEW" ]; then
      OLD="${NEW%_new.csv}.csv"
      rm -f "$OLD"
      mv "$NEW" "$OLD"
    fi
done
```

  ### 5. 移动 `优盾分.csv` 到 `app_code`

  ```bash
  for d in "$BASE"/*/; do
    FILE=$(ls "$d"/*优盾分.csv 2>/dev/null | grep -v _check | head -1)
    if [ -n "$FILE" ]; then
      mv "$FILE" "$d/app_code/"
    fi
  done
  ```

  ### 6. 校验

  ```bash
  for d in "$BASE"/*/; do
    echo "=== $d/app_code ==="
    ls "$d/app_code"
  done
  ```

  每个 `app_code` 应只剩一个 `优盾分.csv`。

  ## 注意事项

  - 网络路径用 `//server/share/...` 或 `\\server\share\...` 都可
  - 不可逆操作前先 `ls` 确认
  - `优盾分_check.csv` 保留原位
  - 已有 `app_code` 时 `mkdir -p` 不报错
  - 无 `优盾分` 相关 csv 时步骤 4-5 静默跳过