#!/bin/bash
# MySQL 卸载脚本
# 作用：停止 mysqld，卸载 mysql-server/mysql-client，删除默认 datadir（/var/lib/mysql）
# 注意：默认保留 /workspace/docker-images/mysql_data（持久化数据），脚本会询问是否一并删除。

set -e

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[mysql-uninstall]${NC} $*"; }
warn()  { echo -e "${YELLOW}[mysql-uninstall]${NC} $*"; }
err()   { echo -e "${RED}[mysql-uninstall]${NC} $*" >&2; }

# 1. 必须是 root
if [ "$(id -u)" -ne 0 ]; then
  err "请用 root 运行: sudo $0"
  exit 1
fi

# 2. 优雅停止 mysqld（如在运行）
if pgrep -x mysqld > /dev/null 2>&1; then
  log "检测到 mysqld 运行中，先停止 ..."
  if command -v mysqladmin > /dev/null 2>&1; then
    mysqladmin -uroot -proot123 shutdown 2>/dev/null || \
      mysqladmin -uroot shutdown 2>/dev/null || true
  fi
  pkill -TERM -x mysqld 2>/dev/null || true
  sleep 2
  pkill -KILL -x mysqld 2>/dev/null || true
  rm -f /run/mysqld/mysqld.sock /run/mysqld/mysqlx.sock 2>/dev/null || true
fi

# 3. apt 卸载
log "卸载 mysql-server / mysql-client ..."
DEBIAN_FRONTEND=noninteractive apt-get purge -y mysql-server mysql-client mysql-common 2>&1 | tail -5 || true
DEBIAN_FRONTEND=noninteractive apt-get autoremove -y 2>&1 | tail -3 || true
DEBIAN_FRONTEND=noninteractive apt-get clean 2>&1 | tail -1 || true

# 4. 删除默认 datadir / 配置 / 日志
log "清理默认数据 / 配置目录 ..."
rm -rf /var/lib/mysql
rm -rf /var/lib/mysql-files
rm -rf /var/lib/mysql-keyring
# 保留 /etc/mysql（apt reinstall/postinst 需要这个目录存在才能读取配置）
# 仅清空其中的用户自定义文件，不动 mysql.cnf 和 debian-start 等
rm -rf /etc/mysql/conf.d/*
rm -rf /etc/mysql/mysql.conf.d/*
rm -rf /var/log/mysql*
rm -rf /run/mysqld
rm -f /tmp/mysqld.log

# 5. 询问是否删除 /workspace/docker-images/mysql_data（持久化数据）
PERSIST_DIR="/workspace/docker-images/mysql_data"
if [ -d "$PERSIST_DIR" ]; then
  echo
  warn "检测到持久化数据目录: $PERSIST_DIR"
  warn "该目录可能包含你的数据库内容 / SSL 私钥。"
  echo
  read -r -p "是否一并删除? [y/N] " ans
  case "$ans" in
    [yY]|[yY][eE][sS])
      log "删除 $PERSIST_DIR ..."
      rm -rf "$PERSIST_DIR"
      log "已删除"
      ;;
    *)
      warn "保留 $PERSIST_DIR（如需后续使用，请重新跑 mysql-install.sh + 配置 datadir）"
      ;;
  esac
fi

# 6. 验证
echo
log "=========================================="
log "卸载完成 ✓"
log "=========================================="
echo -n "mysql 命令: "
command -v mysql > /dev/null 2>&1 && echo "仍存在 ⚠" || echo "已移除 ✓"
echo -n "mysqld 进程: "
pgrep -x mysqld > /dev/null && echo "仍在运行 ⚠" || echo "已停止 ✓"
echo -n "/var/lib/mysql: "
[ -d /var/lib/mysql ] && echo "存在 ⚠" || echo "已删除 ✓"
echo
log "如需重新安装: /workspace/scripts/mysql-install.sh"