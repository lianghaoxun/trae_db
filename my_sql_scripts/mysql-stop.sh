#!/bin/bash
# MySQL 停止脚本

set -e

MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASS="${MYSQL_PASS:-root123}"
PID_PATTERN="mysqld --user=mysql"

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[mysql-stop]${NC} $*"; }
warn() { echo -e "${YELLOW}[mysql-stop]${NC} $*"; }
err() { echo -e "${RED}[mysql-stop]${NC} $*" >&2; }

# 1. 检查是否在运行
if ! pgrep -f "$PID_PATTERN" > /dev/null 2>&1; then
  warn "mysqld 未运行"
  exit 0
fi

# 2. 优雅停止（mysqladmin shutdown）
if command -v mysqladmin > /dev/null 2>&1; then
  log "通过 mysqladmin shutdown 优雅停止 ..."
  if mysqladmin -h 127.0.0.1 -u"$MYSQL_USER" -p"$MYSQL_PASS" shutdown 2>/dev/null; then
    log "mysqladmin 调用成功，等待进程退出 ..."
  else
    warn "mysqladmin 失败，尝试 SIGTERM"
    pkill -TERM -f "$PID_PATTERN" 2>/dev/null || true
  fi
else
  warn "mysqladmin 不可用，直接 SIGTERM"
  pkill -TERM -f "$PID_PATTERN" 2>/dev/null || true
fi

# 3. 等待进程退出
TIMEOUT=15
while [ $TIMEOUT -gt 0 ]; do
  if ! pgrep -f "$PID_PATTERN" > /dev/null 2>&1; then
    break
  fi
  sleep 1
  TIMEOUT=$((TIMEOUT - 1))
done

# 4. 如果还活着，强制 SIGKILL
if pgrep -f "$PID_PATTERN" > /dev/null 2>&1; then
  warn "超时未退出，强制 SIGKILL"
  pkill -KILL -f "$PID_PATTERN" 2>/dev/null || true
  sleep 2
fi

# 5. 清理 socket 文件
rm -f /run/mysqld/mysqld.sock /run/mysqld/mysqlx.sock /run/mysqld/mysqld.pid 2>/dev/null || true

# 6. 最终状态
if pgrep -f "$PID_PATTERN" > /dev/null 2>&1; then
  err "mysqld 仍在运行"
  pgrep -af "$PID_PATTERN" | grep -v "zsh\|bash\|grep"
  exit 1
fi

log "mysqld 已停止"