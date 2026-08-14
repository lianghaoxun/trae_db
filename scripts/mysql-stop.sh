#!/bin/bash
# MySQL 停止脚本
# 优先 mysqladmin shutdown，失败则 SIGTERM → SIGKILL。

set -e

MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASS="${MYSQL_PASS:-root123}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[mysql-stop]${NC} $*"; }
warn() { echo -e "${YELLOW}[mysql-stop]${NC} $*"; }
err()  { echo -e "${RED}[mysql-stop]${NC} $*" >&2; }

# 1. 是否在运行（严格按进程名匹配）
if ! pgrep -x mysqld > /dev/null 2>&1; then
  warn "mysqld 未运行"
  exit 0
fi

# 2. 优雅停止
if command -v mysqladmin > /dev/null 2>&1; then
  log "通过 mysqladmin shutdown 优雅停止 ..."
  if mysqladmin -h 127.0.0.1 -u"$MYSQL_USER" -p"$MYSQL_PASS" shutdown 2>/dev/null; then
    :
  else
    warn "mysqladmin 失败，尝试 SIGTERM"
    pkill -TERM -x mysqld 2>/dev/null || true
  fi
else
  warn "mysqladmin 不可用，直接 SIGTERM"
  pkill -TERM -x mysqld 2>/dev/null || true
fi

# 3. 等待退出
TIMEOUT=15
while [ $TIMEOUT -gt 0 ]; do
  if ! pgrep -x mysqld > /dev/null 2>&1; then
    break
  fi
  sleep 1
  TIMEOUT=$((TIMEOUT - 1))
done

# 4. 强制 SIGKILL
if pgrep -x mysqld > /dev/null 2>&1; then
  warn "超时未退出，强制 SIGKILL"
  pkill -KILL -x mysqld 2>/dev/null || true
  sleep 1
fi

# 5. 清理 socket
rm -f /run/mysqld/mysqld.sock /run/mysqld/mysqlx.sock /run/mysqld/mysqld.pid 2>/dev/null || true

# 6. 最终验证
if pgrep -x mysqld > /dev/null 2>&1; then
  err "mysqld 仍在运行"
  pgrep -ax mysqld
  exit 1
fi

log "mysqld 已停止"