#!/bin/bash
# MySQL 安装脚本
# 作用：安装 mysql-server，初始化配置，安装后默认不启动。
# 启动方式：/workspace/scripts/mysql-start.sh
# 停止方式：/workspace/scripts/mysql-stop.sh

set -e

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[mysql-install]${NC} $*"; }
warn()  { echo -e "${YELLOW}[mysql-install]${NC} $*"; }
err()   { echo -e "${RED}[mysql-install]${NC} $*" >&2; }

# 1. 必须是 root
if [ "$(id -u)" -ne 0 ]; then
  err "请用 root 运行: sudo $0"
  exit 1
fi

# 2. 包管理器检测（仅支持 Debian/Ubuntu apt）
if ! command -v apt-get > /dev/null 2>&1; then
  err "当前仅支持 Debian/Ubuntu (apt-get)"
  exit 1
fi

# 3. 检查是否已经安装
if dpkg -s mysql-server > /dev/null 2>&1; then
  warn "mysql-server 已安装，跳过安装步骤"
  dpkg -s mysql-server | grep -E "^Version:" || true
else
  log "更新 apt 索引 ..."
  apt-get update -qq

  log "安装 mysql-server ..."
  DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server
fi

# 4. 安装必要工具（确保 mysqladmin / mysql 客户端可用）
for pkg in mysql-client rsync; do
  if ! dpkg -s "$pkg" > /dev/null 2>&1; then
    log "安装 $pkg ..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y "$pkg"
  fi
done

# 4.5 保护：apt install/postinst 启动 mysqld 依赖 /etc/mysql/conf.d/ 与
#     /etc/mysql/mysql.conf.d/ 目录读取配置。先确保它们存在。
mkdir -p /etc/mysql/conf.d /etc/mysql/mysql.conf.d

# 4.6 修复可能遗留的 broken 包（极端情况：uninstall 残留 + install 出现冲突）
if dpkg --audit 2>/dev/null | grep -q "Packages"; then
  warn "检测到 dpkg 异常，尝试 --fix-broken ..."
  DEBIAN_FRONTEND=noninteractive apt-get install -y -f 2>&1 | tail -3 || true
fi

# 5. 准备 mysql 用户和 socket 目录
if ! id mysql > /dev/null 2>&1; then
  err "系统用户 mysql 不存在，安装可能异常"
  exit 1
fi

mkdir -p /run/mysqld
chown -R mysql:mysql /run/mysqld

# 6. 准备 datadir（默认 /var/lib/mysql，作为回退）
#    优先保留 /workspace/docker-images/mysql_data（如已存在）
DATA_DIR="/workspace/docker-images/mysql_data"
if [ -d "$DATA_DIR/mysql" ]; then
  log "检测到现有 datadir: $DATA_DIR，跳过初始化"
elif [ ! -d /var/lib/mysql/mysql ]; then
  log "默认 datadir 未初始化，由 mysqld 首次启动自动完成"
else
  log "默认 datadir 已存在: /var/lib/mysql"
fi

# 7. 安装 mysql-start.sh / mysql-stop.sh（如果还没装）
SCRIPT_DIR="/workspace/scripts"
mkdir -p "$SCRIPT_DIR"
for f in mysql-start.sh mysql-stop.sh; do
  src="$SCRIPT_DIR/$f"
  if [ ! -f "$src" ]; then
    err "缺少脚本: $src，请先从仓库恢复或手动创建"
  elif [ ! -x "$src" ]; then
    chmod +x "$src"
    log "已赋可执行权限: $src"
  fi
done

# 8. 配置 root 密码 + testdb
#    无论 mysqld 当前是否运行，都确保密码与库就绪。
NEED_SHUTDOWN=0
MYSQLD_PIDS=$(pgrep -x mysqld 2>/dev/null || true)
if [ -n "$MYSQLD_PIDS" ]; then
  warn "检测到 mysqld 已在运行 (pid=$MYSQLD_PIDS)，配置完成后将关闭"
  NEED_SHUTDOWN=1
else
  log "mysqld 未运行，临时启动用于配置 root 密码与 testdb"
  mkdir -p /run/mysqld
  chown -R mysql:mysql /run/mysqld
  setsid nohup mysqld --user=mysql --daemonize >> /tmp/mysqld.log 2>&1
  # 等待端口
  for _ in $(seq 1 20); do
    if ss -tln 2>/dev/null | grep -q ":3306 "; then break; fi
    sleep 1
  done
  if ! pgrep -x mysqld > /dev/null 2>&1; then
    err "mysqld 临时启动失败，无法配置 root"
    tail -20 /tmp/mysqld.log 2>/dev/null
    exit 1
  fi
  NEED_SHUTDOWN=1
fi

# 8.1 通过 socket 设置 root 密码 + 创建 testdb
if mysql --protocol=socket -uroot <<'EOF' 2>&1 | tail -3
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'root123';
CREATE DATABASE IF NOT EXISTS testdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'root123';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
EOF
then
  log "root 密码 (root123) 与 testdb 已初始化 ✓"
else
  err "root 密码配置失败"
  exit 1
fi

# 8.2 关闭 mysqld（脚本结束时必须是“未运行”状态）
if [ "$NEED_SHUTDOWN" = "1" ]; then
  log "关闭 mysqld ..."
  mysqladmin -uroot -proot123 shutdown 2>/dev/null || true
  sleep 2
  if pgrep -x mysqld > /dev/null 2>&1; then
    pkill -KILL -x mysqld 2>/dev/null || true
    sleep 1
  fi
  rm -f /run/mysqld/mysqld.sock /run/mysqld/mysqlx.sock 2>/dev/null || true
fi
log "mysqld 当前未运行 ✓"

# 9. 验证最终状态
echo
log "=========================================="
log "安装完成 ✓（mysqld 当前未运行）"
log "=========================================="
echo "版本:        $(mysql --version)"
echo "root 密码:   root123"
echo "testdb:      已创建"
echo "datadir:     /workspace/docker-images/mysql_data（若存在）"
echo "             或 /var/lib/mysql（默认）"
echo
log "启动:  /workspace/scripts/mysql-start.sh"
log "停止:  /workspace/scripts/mysql-stop.sh"
log "测试:  python3 /workspace/scripts/sql_test.py"
log "卸载:  /workspace/scripts/mysql-uninstall.sh"