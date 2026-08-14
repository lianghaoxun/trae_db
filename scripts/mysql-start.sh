#!/bin/bash
# MySQL 启动脚本
# 优先级：
#   1) /workspace/docker-images/mysql_data （持久化数据，配置了 datadir）
#   2) /var/lib/mysql                   （apt 默认 datadir）
# 监听：127.0.0.1:3306 + 127.0.0.1:33060

set -e

SOCK_DIR="/run/mysqld"
LOG_FILE="/tmp/mysqld.log"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[mysql-start]${NC} $*"; }
warn() { echo -e "${YELLOW}[mysql-start]${NC} $*"; }
err()  { echo -e "${RED}[mysql-start]${NC} $*" >&2; }

# 1. 决定 datadir
PERSIST_DIR="/workspace/docker-images/mysql_data"
DEFAULT_DIR="/var/lib/mysql"

if [ -d "$PERSIST_DIR/mysql" ]; then
  DATA_DIR="$PERSIST_DIR"
  log "使用持久化 datadir: $DATA_DIR"
elif [ -d "$DEFAULT_DIR/mysql" ]; then
  DATA_DIR="$DEFAULT_DIR"
  log "使用默认 datadir: $DATA_DIR"
else
  err "datadir 不存在且未初始化："
  err "  - 持久化: $PERSIST_DIR/mysql"
  err "  - 默认:   $DEFAULT_DIR/mysql"
  err "请先执行 /workspace/scripts/mysql-install.sh，或初始化数据目录"
  exit 1
fi

# 2. 是否已运行
if pgrep -x mysqld > /dev/null 2>&1; then
  warn "mysqld 已在运行，跳过启动"
  pgrep -ax mysqld
  exit 0
fi

# 3. 准备 socket 目录（tmpfs，重启后会清空）
mkdir -p "$SOCK_DIR"
chown -R mysql:mysql "$SOCK_DIR"

# 4. 启动 mysqld
log "启动 mysqld ..."
setsid nohup mysqld --user=mysql --datadir="$DATA_DIR" --daemonize >> "$LOG_FILE" 2>&1

# 5. 等待端口
TIMEOUT=20
while [ $TIMEOUT -gt 0 ]; do
  if ss -tln 2>/dev/null | grep -q ":3306 "; then
    break
  fi
  sleep 1
  TIMEOUT=$((TIMEOUT - 1))
done

if [ $TIMEOUT -eq 0 ]; then
  err "mysqld 启动超时，查看日志: $LOG_FILE"
  tail -30 "$LOG_FILE" 2>/dev/null
  exit 1
fi

# 6. 输出状态
log "mysqld 启动成功"
pgrep -ax mysqld
echo
log "监听端口:"
ss -tlnp 2>/dev/null | grep -E "3306|33060" | awk '{print "  " $0}'
echo
log "datadir: $DATA_DIR"
log "测试连接: mysql -h 127.0.0.1 -uroot -proot123 -e \"SHOW DATABASES;\""
log "停止服务: /workspace/scripts/mysql-stop.sh"