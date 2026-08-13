#!/bin/bash
# MySQL 启动脚本
# - datadir: /workspace/docker-images/mysql_data
# - 监听: 127.0.0.1:3306 + 127.0.0.1:33060

set -e

DATA_DIR="/workspace/docker-images/mysql_data"
SOCK_DIR="/run/mysqld"
LOG_FILE="/tmp/mysqld.log"
PID_PATTERN="mysqld --user=mysql"

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[mysql-start]${NC} $*"; }
warn() { echo -e "${YELLOW}[mysql-start]${NC} $*"; }
err() { echo -e "${RED}[mysql-start]${NC} $*" >&2; }

# 1. 检查 datadir
if [ ! -d "$DATA_DIR" ]; then
  err "datadir 不存在: $DATA_DIR"
  err "请先执行迁移或初始化（参考 /workspace/清理要求.md）"
  exit 1
fi

if [ ! -d "$DATA_DIR/mysql" ]; then
  err "datadir 未初始化: $DATA_DIR/mysql 不存在"
  exit 1
fi

# 2. 检查是否已运行
if pgrep -f "$PID_PATTERN" > /dev/null 2>&1; then
  warn "mysqld 已在运行，跳过启动"
  pgrep -af "$PID_PATTERN" | grep -v "zsh\|bash\|grep"
  exit 0
fi

# 3. 准备 socket 目录（tmpfs，重启后会清空）
mkdir -p "$SOCK_DIR"
chown -R mysql:mysql "$SOCK_DIR"

# 4. 启动 mysqld（daemonize 模式，setsid 脱离会话）
log "启动 mysqld ..."
setsid nohup mysqld --user=mysql --daemonize >> "$LOG_FILE" 2>&1

# 5. 等待端口就绪
TIMEOUT=15
while [ $TIMEOUT -gt 0 ]; do
  if ss -tln 2>/dev/null | grep -q ":3306 "; then
    break
  fi
  sleep 1
  TIMEOUT=$((TIMEOUT - 1))
done

if [ $TIMEOUT -eq 0 ]; then
  err "mysqld 启动超时，查看日志: $LOG_FILE"
  tail -20 "$LOG_FILE" 2>/dev/null
  exit 1
fi

# 6. 输出状态
log "mysqld 启动成功"
pgrep -af "$PID_PATTERN" | grep -v "zsh\|bash\|grep"
echo
log "监听端口:"
ss -tlnp 2>/dev/null | grep -E "3306|33060" | awk '{print "  " $0}'
echo
log "datadir: $DATA_DIR"
log "测试连接: mysql -h 127.0.0.1 -uroot -proot123 -e \"SHOW DATABASES;\""
log "停止服务: /workspace/scripts/mysql-stop.sh"