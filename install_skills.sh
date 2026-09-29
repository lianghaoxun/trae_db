#!/usr/bin/env bash
# 将 /workspace/skills 下的每个 skill 复制到 plugin 目录并生成注册骨架。
# 重启 TRAE 后即可在会话里调用这些 skill。
set -euo pipefail

SRC_ROOT="/workspace/skills"
PLUGIN_ROOT="/data/user/plugins/trae-remote-official/workspace-skills"
PLUGIN_VERSION="0.1.0"
PLUGIN_NAME="workspace-skills"
PLUGIN_DISPLAY="工作区 Skills"
PLUGIN_DESC="从 /workspace/skills 复制并注册的 skill 集合，独立维护于 plugin 目录。"

if [[ ! -d "$SRC_ROOT" ]]; then
  echo "[install_skills] 未发现 $SRC_ROOT，无需安装。"
  exit 0
fi

PLUGIN_DIR="$PLUGIN_ROOT/$PLUGIN_VERSION"
SKILLS_DIR="$PLUGIN_DIR/skills"
PLUGIN_JSON_DIR="$PLUGIN_DIR/.trae-plugin"
ASSETS_DIR="$PLUGIN_DIR/assets"

mkdir -p "$SKILLS_DIR" "$PLUGIN_JSON_DIR" "$ASSETS_DIR"

# 复制每个 skill（保留 SKILL.md / references/ / scripts/ / assets/）
shopt -s nullglob
for skill_dir in "$SRC_ROOT"/*/; do
  name="$(basename "$skill_dir")"
  dest="$SKILLS_DIR/$name"
  rm -rf "$dest"
  cp -a "$skill_dir" "$dest"
  echo "[install_skills] 已复制: $name"
done
shopt -u nullglob

# 写入 plugin.json
cat > "$PLUGIN_JSON_DIR/plugin.json" <<EOF
{
  "name": "$PLUGIN_NAME",
  "version": "$PLUGIN_VERSION",
  "displayName": "$PLUGIN_DISPLAY",
  "displayNameEn": "Workspace Skills",
  "description": "$PLUGIN_DESC",
  "author": { "name": "Workspace" },
  "license": "UNLICENSED",
  "keywords": ["workspace", "skills"],
  "skills": "./skills/",
  "interface": {
    "displayName": "$PLUGIN_DISPLAY",
    "shortDescription": "$PLUGIN_DESC",
    "longDescription": "$PLUGIN_DESC",
    "developerName": "Workspace",
    "category": "Utilities",
    "capabilities": ["Read", "Write"],
    "defaultPrompt": ["Use the workspace skills to complete this task."],
    "brandColor": "#FFFFFF",
    "composerIcon": "./assets/icon.svg",
    "logo": "./assets/icon.svg",
    "screenshots": []
  }
}
EOF

# 兜底图标
if [[ ! -f "$ASSETS_DIR/icon.svg" ]]; then
  cat > "$ASSETS_DIR/icon.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="12" fill="#1f6feb"/>
  <path d="M16 22h32v6H16zm0 12h32v6H16zm0 12h22v6H16z" fill="#ffffff"/>
</svg>
SVG
fi

echo "[install_skills] 完成。请重启 TRAE 以加载新 skill。"
