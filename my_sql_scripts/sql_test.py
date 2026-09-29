#!/usr/bin/env python3
"""MySQL 连接测试脚本。

通过 TCP 连接 127.0.0.1:3306 验证 MySQL 可用性，并执行基本查询。

环境要求：
    pip install pymysql
    或 pip install mysql-connector-python

退出码：
    0 - 所有测试通过
    1 - 连接失败
    2 - SQL 执行失败
"""

import argparse
import sys
import time
from datetime import datetime

# 尝试导入可用的 MySQL 驱动
try:
    import pymysql
    DRIVER = "pymysql"
except ImportError:
    try:
        import mysql.connector
        DRIVER = "mysql.connector"
    except ImportError:
        print("ERROR: 未找到 MySQL 驱动，请安装：", file=sys.stderr)
        print("  pip install pymysql", file=sys.stderr)
        print("  或 pip install mysql-connector-python", file=sys.stderr)
        sys.exit(1)

DEFAULT_CONFIG = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "root123",
    "database": "testdb",
    "charset": "utf8mb4",
    "connect_timeout": 5,
}


def parse_args():
    p = argparse.ArgumentParser(description="MySQL 连接测试")
    p.add_argument("--host", default=DEFAULT_CONFIG["host"])
    p.add_argument("--port", type=int, default=DEFAULT_CONFIG["port"])
    p.add_argument("--user", default=DEFAULT_CONFIG["user"])
    p.add_argument("--password", default=DEFAULT_CONFIG["password"])
    p.add_argument("--database", default=DEFAULT_CONFIG["database"])
    p.add_argument("--quiet", action="store_true", help="只输出关键结果")
    return p.parse_args()


def get_conn(args):
    if DRIVER == "pymysql":
        return pymysql.connect(
            host=args.host,
            port=args.port,
            user=args.user,
            password=args.password,
            database=args.database,
            charset=DEFAULT_CONFIG["charset"],
            connect_timeout=DEFAULT_CONFIG["connect_timeout"],
        )
    # mysql.connector
    return mysql.connector.connect(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        database=args.database,
        connection_timeout=DEFAULT_CONFIG["connect_timeout"],
    )


def log(msg, quiet=False):
    if not quiet:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def header(title):
    print("=" * 60)
    print(f" {title}")
    print("=" * 60)


def main():
    args = parse_args()
    quiet = args.quiet

    header(f"MySQL 连接测试 (driver={DRIVER})")
    log(f"目标: {args.user}@{args.host}:{args.port}/{args.database}", quiet)

    # 1. TCP 端口可达性
    import socket
    t0 = time.time()
    try:
        with socket.create_connection((args.host, args.port), timeout=3) as s:
            tcp_ms = (time.time() - t0) * 1000
            log(f"TCP 端口可达，耗时 {tcp_ms:.1f}ms", quiet)
    except (socket.timeout, ConnectionRefusedError, OSError) as e:
        print(f"FAIL: TCP 不可达 -> {e}", file=sys.stderr)
        print("提示: 是否执行了 /workspace/scripts/mysql-start.sh？", file=sys.stderr)
        return 1

    # 2. 鉴权 + 握手
    log("正在连接 ...", quiet)
    t0 = time.time()
    try:
        conn = get_conn(args)
    except Exception as e:
        print(f"FAIL: 连接失败 -> {e}", file=sys.stderr)
        return 1
    handshake_ms = (time.time() - t0) * 1000
    log(f"连接成功，握手耗时 {handshake_ms:.1f}ms", quiet)

    failures = []
    try:
        with conn.cursor() as cur:
            # 3. 服务版本
            cur.execute("SELECT VERSION()")
            version = cur.fetchone()[0]
            log(f"MySQL 版本: {version}", quiet)

            # 4. 当前数据库
            cur.execute("SELECT DATABASE(), USER(), @@hostname")
            db, user, host = cur.fetchone()
            log(f"当前: db={db}, user={user}@{host}", quiet)

            # 5. testdb 是否存在
            cur.execute(
                "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA "
                "WHERE SCHEMA_NAME = %s", (args.database,)
            )
            exists = cur.fetchone() is not None
            if exists:
                log(f"数据库 '{args.database}' 存在 ✓", quiet)
            else:
                warn = f"WARN: 数据库 '{args.database}' 不存在"
                print(warn, file=sys.stderr)
                failures.append(warn)

            # 6. 读写测试
            table = "_sql_test_tmp"
            cur.execute(f"DROP TABLE IF EXISTS `{table}`")
            cur.execute(
                f"CREATE TABLE `{table}` ("
                f"  id INT PRIMARY KEY, "
                f"  msg VARCHAR(50), "
                f"  ts DATETIME DEFAULT CURRENT_TIMESTAMP"
                f")"
            )
            cur.execute(
                f"INSERT INTO `{table}` (id, msg) VALUES (%s, %s)",
                (1, f"hello from python at {int(time.time())}"),
            )
            conn.commit()
            cur.execute(f"SELECT id, msg, ts FROM `{table}`")
            row = cur.fetchone()
            log(f"写入+查询: {row}", quiet)

            cur.execute(f"DROP TABLE `{table}`")
            conn.commit()
            log("临时表清理 ✓", quiet)

            # 7. InnoDB 状态
            cur.execute(
                "SELECT engine, COUNT(*) FROM information_schema.tables "
                "WHERE table_schema = %s GROUP BY engine",
                (args.database,),
            )
            engines = cur.fetchall()
            log(f"{args.database} 引擎分布: {engines or '空数据库'}", quiet)

    except Exception as e:
        print(f"FAIL: SQL 执行失败 -> {e}", file=sys.stderr)
        try:
            conn.rollback()
        except Exception:
            pass
        return 2
    finally:
        try:
            conn.close()
        except Exception:
            pass

    # 8. 总结
    print()
    header("测试结果")
    print(f"TCP 连接     ✓ ({tcp_ms:.1f}ms)")
    print(f"MySQL 握手   ✓ ({handshake_ms:.1f}ms)")
    print(f"权限/数据库  {'✓' if not failures else '✗'}")
    print(f"读/写/清理   ✓")
    if failures:
        print("\n警告:")
        for f in failures:
            print(f"  - {f}")
        return 0  # 警告不视为失败

    print(f"\n所有检查通过，可正常使用 {args.host}:{args.port}")
    return 0


if __name__ == "__main__":
    sys.exit(main())