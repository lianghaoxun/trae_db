import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { AGENTS, UP, DOWN, fmtPnl } from './data/agents.js';
import { createMarket, createAgentRuntime } from './data/market.js';
import Office from './components/Office.jsx';
import AgentRig from './components/AgentRig.jsx';
import CameraRig from './components/CameraRig.jsx';
import { ScreenSpace } from './components/ScreenSpace.jsx';
import { useScreen } from './components/ScreenTexture.jsx';
import TickerTape from './components/TickerTape.jsx';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function App() {
  const market = useMemo(() => createMarket(), []);
  const logRef = useRef({ push: () => {} });
  const rt = useMemo(() => createAgentRuntime(AGENTS, market, logRef.current), [market]);
  const { data, danger } = rt;

  const [running, setRunning] = useState(false);
  const [snap, setSnap] = useState(() => market.snapshot());
  const [log, setLog] = useState([]);
  const [active, setActive] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [freeRoam, setFreeRoam] = useState(false);
  const [layout, setLayout] = useState('pit'); // pit | rows | ring

  const logBuf = useRef([]);
  logRef.current.push = (lv, msg) => {
    logBuf.current.push({ lv, msg, t: new Date() });
    if (logBuf.current.length > 400) logBuf.current.splice(0, logBuf.current.length - 400);
    if (logBuf.current.length % 4 === 0) setLog(logBuf.current.slice(-120));
  };

  // 主循环：行情 tick -> Agent 状态机 -> HUD 刷新
  useEffect(() => {
    if (!running) return;
    let raf, acc = 0, last = performance.now();
    const step = () => {
      const cur = performance.now();
      acc += cur - last; last = cur;
      while (acc >= 520) { acc -= 520; const s = rt.tick(); if (Math.random() < 0.3) setSnap(s); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running, rt]);

  // 整点刷新 HUD 与时钟
  useEffect(() => {
    const id = setInterval(() => {
      setSnap(market.snapshot());
      setLog(logBuf.current.slice(-120));
      setNow(new Date());
    }, 1500);
    return () => clearInterval(id);
  }, [market]);

  // KPI 汇总
  const kpi = useMemo(() => {
    const agents = AGENTS.map((a) => data[a.id]);
    const filled = agents.reduce((a, d) => a + d.filled, 0);
    const orders = agents.reduce((a, d) => a + d.orders, 0);
    const pnl = agents.reduce((a, d) => a + d.pnl, 0);
    const win = agents.filter((d) => d.pnl > 0).length;
    return { filled, orders, pnl, win, total: agents.length };
  }, [snap, data]);

  const sendOrder = (id) => {
    const a = AGENTS.find((x) => x.id === id); if (!a) return;
    const d = data[id];
    d.state = 'run';
    const deal = { sym: d.target || '沪深300ETF', side: '手动指令', px: d.px || 3.84, qty: 1000 };
    d.lastDeal = deal; d.orders++; d.filled++;
    d.task = `执行 ${deal.side} ${deal.sym} ${deal.qty}股`;
    logRef.current.push('info', `${a.name} 收到人工指令 → 已路由至执行网关`);
  };
  const cancelOrder = (id) => {
    const a = AGENTS.find((x) => x.id === id); if (!a) return;
    const d = data[id];
    d.state = 'idle'; d.task = '指令已撤销，等待复核';
    logRef.current.push('warn', `${a.name} 指令撤销，仓位已冻结`);
  };

  return (
    <div className="app">
      <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <PerspectiveCamera makeDefault fov={52} position={[0, 9.2, 17]} />
        <color attach="background" args={['#05080f']} />
        <fog attach="fog" args={['#05080f', 26, 64]} />

        <hemisphereLight args={['#4a6da8', '#0a0f1a', 0.5]} />
        <directionalLight
          castShadow position={[12, 22, 8]} intensity={1.5}
          color="#cfe6ff" shadow-mapSize-width={2048} shadow-mapSize-height={2048}
          shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24}
          shadow-bias={-0.0005}
        />
        <directionalLight position={[-10, 8, -6]} intensity={0.6} color="#1f4a7a" />
        {/* 屏幕光：作战区冷蓝光 */}
        <pointLight position={[0, 6, -10]} intensity={4.2} color="#00a8ff" distance={30} decay={1.8} />
        <pointLight position={[0, 5, 9]} intensity={2.6} color="#0a4a8a" distance={26} decay={2} />

        <Office layout={layout} danger={danger} snap={snap}>
          {AGENTS.map((a) => (
            <AgentRig key={a.id} agent={a} runtime={data[a.id]} active={active === a.id} danger={danger}
                      onClick={(e) => { e.stopPropagation(); setActive(a.id); }}
                      layout={layout} freeRoam={freeRoam} />
          ))}
        </Office>

        <TickerTape symbols={snap.rows.slice(0, 6)} />
        <CameraRig active={active} freeRoam={freeRoam} />
        <AdaptiveDpr pixelated />
      </Canvas>

      {/* ===== 顶部：品牌 + 全市场滚动条屏 + 时钟 ===== */}
      <div className="hud-top">
        <div className="brand">
          <span className="logo">AGENT PIT · v2</span>
          <span className="title">证券交易作战室</span>
          <span className="sub">TRADING FLOOR / {layout.toUpperCase()}</span>
        </div>
        <div className="market-ticker">
          <div className="mh"><span className="dot" />LIVE</div>
          <div className="track">
            <div className="strip">
              {snap.rows.concat(snap.rows).map((q, i) => (
                <span key={i} className="item">
                  <span className="sym">{q.s}</span>
                  <span className="px">{q.px.toFixed(q.px < 100 ? 2 : 2)}</span>
                  <span className={'chg ' + (q.chg >= 0 ? 'up' : 'down')}>
                    {q.chg >= 0 ? '▲' : '▼'} {Math.abs(q.chg).toFixed(2)}%
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="clock">
          <b>{now.toLocaleTimeString('zh-CN', { hour12: false })}</b>
          盘中 · T+{(snap.t || 0) % 9999} · 毫秒级
        </div>
      </div>

      {/* ===== 右侧面板组 ===== */}
      <div className="hud-right">
        <div className="panel">
          <div className="panel-h"><b>市场态势</b><span className="tag">MARKET</span></div>
          <div className="kpi-row">
            <div className="kpi"><div className="v up">{snap.up}</div><div className="l">上涨</div></div>
            <div className="kpi"><div className="v down">{snap.down}</div><div className="l">下跌</div></div>
            <div className="kpi"><div className="v" style={{ color: '#7d93b3' }}>{snap.flat}</div><div className="l">平盘</div></div>
            <div className="kpi"><div className="v" style={{ color: (snap.avgChg || 0) >= 0 ? UP : DOWN }}>{(snap.avgChg || 0) >= 0 ? '+' : ''}{(snap.avgChg || 0).toFixed(2)}%</div><div className="l">均值涨跌</div></div>
          </div>
          <div className="kpi-row">
            <div className="kpi"><div className="v up">{kpi.filled}</div><div className="l">已成交笔数</div></div>
            <div className="kpi"><div className="v" style={{ color: '#2979ff' }}>{kpi.orders}</div><div className="l">总委托</div></div>
            <div className="kpi"><div className={'v ' + (kpi.pnl >= 0 ? 'up' : 'down')}>{fmtPnl(kpi.pnl)}</div><div className="l">组合浮盈(bp)</div></div>
            <div className="kpi"><div className="v warn">{kpi.win}/{kpi.total}</div><div className="l">盈利/总数</div></div>
          </div>
          <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--txt-dim)', fontFamily: 'var(--mono)' }}>
            领涨 <span className="pos">{snap.lead ? snap.lead.s : '—'}</span>｜
            弱势 <span className="neg">{snap.rows.slice().sort((a, b) => a.chg - b.chg)[0]?.s || '—'}</span>｜
            总品种 {snap.total}
          </div>
        </div>

        <div className="panel">
          <div className="panel-h"><b>交易席位</b><span className="tag">{AGENTS.length} AGENTS</span></div>
          <div className="roster">
            {AGENTS.map((a) => {
              const d = data[a.id];
              return (
                <div key={a.id} className={'agent-row' + (active === a.id ? ' active' : '')}
                     onClick={() => setActive(active === a.id ? null : a.id)}>
                  <div className="avatar-mini" style={{ background: a.color }}>{a.emoji}</div>
                  <div className="meta">
                    <div className="name">
                      <span className={'dot ' + d.state} />
                      {a.name}
                    </div>
                    <div className="role">{a.role} · {a.desk}席</div>
                    <div className="task">{d.task}</div>
                  </div>
                  <div className="st">
                    <div className={'pnl ' + (d.pnl >= 0 ? 'pos' : 'neg')}>{fmtPnl(d.pnl)}</div>
                    <div style={{ color: 'var(--txt-dim)' }}>{d.filled}笔</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="panel-h"><b>委托与成交流</b><span className="tag">ORDER STREAM</span></div>
          <div className="feed">
            {log.length === 0 && <div className="empty">尚未产生委托。点击 ▶ 开盘 启动模拟行情。</div>}
            {log.slice().reverse().map((l, i) => (
              <div key={i} className="line">
                <span className="t">{l.t.toLocaleTimeString('zh-CN', { hour12: false })}</span>
                <span className={'lv ' + l.lv}>{l.lv === 'buy' ? 'BUY' : l.lv === 'sell' ? 'SELL' : l.lv === 'warn' ? 'RISK' : l.lv === 'ok' ? 'FILL' : 'INFO'}</span>
                <span>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== 左下：详情弹窗 ===== */}
      {active && (() => {
        const a = AGENTS.find((x) => x.id === active); const d = data[active];
        return (
          <div className="detail">
            <div className="panel">
              <div className="panel-h">
                <b style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: a.color, display: 'inline-block' }} />
                  {a.name} · {a.desk}席
                </b>
                <span className="tag" onClick={() => setActive(null)} style={{ cursor: 'pointer' }}>✕</span>
              </div>
              <div className="body">
                <div style={{ fontSize: 12, color: 'var(--txt-dim)', marginBottom: 10 }}>{a.role}｜策略模型 <span className="tag-pill">{a.tool}</span></div>
                <div className="grid">
                  <div className="cell"><div className="l">当前状态</div><div className="v" style={{ color: d.state === 'wait' ? UP : d.state === 'think' ? '#ffb300' : d.state === 'run' ? '#00e5ff' : '#7d93b3' }}>{d.state === 'run' ? '执行中' : d.state === 'think' ? '研判中' : d.state === 'wait' ? '待审批' : '待机'}</div></div>
                  <div className="cell"><div className="l">浮盈 (bp)</div><div className={'v ' + (d.pnl >= 0 ? 'pos' : 'neg')}>{fmtPnl(d.pnl)}</div></div>
                  <div className="cell full"><div className="l">最新动作</div><div className="v" style={{ fontSize: 12 }}>{d.task}</div></div>
                  <div className="cell"><div className="l">今日委托</div><div className="v">{d.orders}</div></div>
                  <div className="cell"><div className="l">已成交</div><div className="v">{d.filled}</div></div>
                  <div className="cell"><div className="l">胜率</div><div className="v" style={{ color: d.filled ? (d.pnl >= 0 ? '#69f0ae' : '#ff8a80') : '#7d93b3' }}>{d.filled ? Math.round((d.pnl >= 0 ? 0.55 : 0.42) * 100) : 0}%</div></div>
                  <div className="cell"><div className="l">风险敞口</div><div className="v" style={{ color: d.risk > 75 ? UP : d.risk > 50 ? '#ffb300' : '#69f0ae' }}>{d.risk}%</div><div className="bar-mini"><i style={{ width: d.risk + '%' }} /></div></div>
                </div>
                <div className="actions">
                  <button className="btn primary" onClick={() => sendOrder(active)}>📤 发送指令</button>
                  <button className="btn" onClick={() => cancelOrder(active)}>⏹ 撤销</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== 底部控制条 ===== */}
      <div className="hud-bottom">
        <div className="ctrl">
          <button className={'btn ' + (running ? 'on' : 'primary')} onClick={() => setRunning((v) => !v)}>
            {running ? '⏸ 暂停行情' : '▶ 开盘'}
          </button>
          <button className="btn" onClick={() => {
            logBuf.current = []; setLog([]);
            AGENTS.forEach((a) => { const d = data[a.id]; d.orders = 0; d.filled = 0; d.pnl = 0; d.task = '—'; d.state = 'idle'; });
            logRef.current.push('info', '已重置全部席位状态'); setSnap(market.snapshot());
          }}>⟲ 重置席位</button>
        </div>
        <div className="ctrl">
          <button className={'btn ' + (layout === 'pit' ? 'on' : '')} onClick={() => setLayout('pit')}>🏛 剧场式</button>
          <button className={'btn ' + (layout === 'rows' ? 'on' : '')} onClick={() => setLayout('rows')}>🗂 分组阵列</button>
          <button className={'btn ' + (layout === 'ring' ? 'on' : '')} onClick={() => setLayout('ring')}>⭕ 圆桌会审</button>
        </div>
        <div className="ctrl">
          <button className={'btn ' + (freeRoam ? 'on' : '')} onClick={() => setFreeRoam((v) => !v)}>
            {freeRoam ? '🎮 第一人称 (WASD)' : '👁 环绕观察'}
          </button>
        </div>
        <div className="hint">
          {freeRoam ? 'WASD 移动 · 鼠标拖拽视角 · Space/Shift 升降 · 滚轮缩放' : '拖动旋转 · 滚轮缩放 · 点击席位查看委托明细'}
          <br />行情为模拟数据，仅用于可视化演示，不构成投资建议
        </div>
      </div>

      {/* ===== 图例 ===== */}
      <div className="legend">
        <div className="panel">
          <div className="row"><span className="dot run" />执行中（下单/撮合）</div>
          <div className="row"><span className="dot think" />研判中（扫描/风控/合规）</div>
          <div className="row"><span className="dot wait" />待审批（大单/异常挂起）</div>
          <div className="row"><span className="dot idle" />待机</div>
        </div>
      </div>
    </div>
  );
}
