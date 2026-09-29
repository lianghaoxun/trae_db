# AGENTS

## Skill 安装与注册

- Skill **源文件**存放在 `/workspace/skills/<skill-name>/`，作为本项目代码维护。
- Skill **副本与注册信息**位于 `/data/user/plugins/trae-remote-official/workspace-skills/<version>/`，由 `install_skills.sh` 脚本复制并生成 plugin.json，独立维护。
- 新会话启动时，只需执行 `bash /workspace/install_skills.sh` 即可把 `/workspace/skills` 下的全部 skill 重新复制并注册到 plugin 目录，**无需在会话内进行任何额外说明**，从而减少上下文 token 消耗。

## 日常使用

- 修改 `/workspace/skills/` 下的源文件后，再次运行脚本可同步到 plugin 目录。
- TRAE 启动时会扫描 plugin 目录，因此脚本执行完后需**重启 TRAE** 才会生效。
