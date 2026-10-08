import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';

/**
 * 所有屏幕共用一个基于 canvas 的纹理工厂。
 * 用法：<meshBasicMaterial map={useScreen(render, deps)} />
 * render(ctx, w, h, snap, danger, t) 每帧被调用，写入画布后标记 needsUpdate。
 * 关闭 toneMapping 保证自发光屏幕不受场景光照压暗。
 */

export function useScreen(render, deps = []) {
  const ref = useRef(null);
  if (!ref.current) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    ref.current = { canvas: c, ctx, tex, last: 0 };
  }
  useEffect(() => () => ref.current?.tex.dispose(), []);
  const obj = ref.current;

  // 每帧驱动绘制
  useEffect(() => {
    let raf;
    const loop = (t) => {
      render(obj.ctx, obj.canvas.width, obj.canvas.height, t);
      obj.tex.needsUpdate = true;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, deps);

  return obj.tex;
}

export function ScreenTexture({ type, snap, danger, idx = 0 }) {
  const tex = useScreen((ctx, w, h, t) => {
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    if (type === 'main') drawMain(ctx, w, h, snap, danger, t);
    else if (type === 'ticker') drawTicker(ctx, w, h, snap, t);
    else if (type === 'queue') drawQueue(ctx, w, h, snap, danger, t);
    else if (type === 'monitor') drawMonitor(ctx, w, h, idx, t);
    else if (type === 'meeting') drawMeeting(ctx, w, h, t);
    ctx.restore();
  }, [type, snap, danger, idx]);

  return <ScreenTextureMap map={tex} />;
}

function ScreenTextureMap({ map }) {
  return <meshBasicMaterial map={map} toneMapped={false} />;
}

/* ================= 绘制例程 ================= */

function bg(ctx, w, h, top, bot) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

function scanlines(ctx, w, h) {
  ctx.fillStyle = 'rgba(0,229,255,0.05)';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
}

const UP = '#ff3b47', DOWN = '#00c896', ACC = '#00e5ff', WARN = '#ffb300', DIM = '#5a7090';

function fmt(v) { return v == null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }); }

/* ---- 中央主屏：市场态势总览 ---- */
function drawMain(ctx, w, h, snap, danger, t) {
  bg(ctx, w, h, '#04101e', '#02070f');
  scanlines(ctx, w, h);
  // 标题
  ctx.fillStyle = ACC; ctx.font = 'bold 22px monospace';
  ctx.fillText('◆ 市场态势总览 · MARKET OPS', 18, 30);
  ctx.fillStyle = DIM; ctx.font = '13px monospace';
  ctx.fillText('TRADING FLOOR / ' + new Date().toLocaleTimeString('zh-CN', { hour12: false }) + ' · T+' + ((snap?.t || 0) % 9999), 18, 50);

  const rows = (snap && snap.rows) || [];
  // 涨跌家数
  const up = snap?.up || 0, down = snap?.down || 0, flat = snap?.flat || 0, tot = Math.max(snap?.total || 1, 1);
  const bx = 18, by = 66, bw = 240, bh = 26;
  ctx.fillStyle = '#0a1828'; ctx.fillRect(bx, by, bw, bh);
  const uw = bw * up / tot, dw = bw * down / tot, fw = bw * flat / tot;
  ctx.fillStyle = UP; ctx.fillRect(bx, by, uw, bh);
  ctx.fillStyle = '#3a4a63'; ctx.fillRect(bx + uw, by, fw, bh);
  ctx.fillStyle = DOWN; ctx.fillRect(bx + uw + fw, by, dw, bh);
  ctx.fillStyle = '#d6e4f5'; ctx.font = '13px monospace';
  ctx.fillText(`▲ ${up}`, bx + 8, by + 18);
  ctx.fillText(`— ${flat}`, bx + uw + fw / 2 - 12, by + 18);
  ctx.fillText(`▼ ${down}`, bx + uw + fw + dw - 46, by + 18);
  ctx.fillStyle = DIM; ctx.fillText(`均值涨跌 ${(snap?.avgChg || 0).toFixed(2)}%`, bx, by + 50);

  // 领涨 / 领跌
  const lead = snap?.lead;
  ctx.fillStyle = DIM; ctx.font = '12px monospace';
  ctx.fillText('领涨品种', bx, by + 78);
  ctx.fillStyle = UP; ctx.font = 'bold 26px monospace';
  ctx.fillText(lead ? lead.s : '—', bx, by + 108);
  ctx.font = '15px monospace'; ctx.fillText((lead ? '+' : '') + (lead ? lead.chg.toFixed(2) : '0.00') + '%', bx + 132, by + 104);
  ctx.fillStyle = DOWN; ctx.font = 'bold 26px monospace';
  const lag = [...rows].sort((a, b) => a.chg - b.chg)[0];
  ctx.fillText(lag ? lag.s : '—', bx, by + 150);
  ctx.font = '15px monospace'; ctx.fillText((lag ? lag.chg.toFixed(2) : '0.00') + '%', bx + 132, by + 146);

  // 右侧：涨幅榜（mini K 线柱）
  const rx = 300, rw = w - rx - 18;
  ctx.fillStyle = DIM; ctx.font = '12px monospace';
  ctx.fillText('涨幅榜', rx, 66);
  const top = [...rows].sort((a, b) => b.chg - a.chg).slice(0, 9);
  top.forEach((q, i) => {
    const y = 80 + i * 20;
    ctx.fillStyle = '#d6e4f5'; ctx.font = '13px monospace';
    ctx.fillText(q.s, rx, y);
    // mini bar
    const max = Math.max(...top.map((x) => Math.abs(x.chg)), 0.01);
    const bw2 = rw - 150;
    const bx2 = rx + 86;
    const v = Math.abs(q.chg) / max * bw2;
    ctx.fillStyle = q.chg >= 0 ? 'rgba(255,59,71,0.25)' : 'rgba(0,200,150,0.25)';
    ctx.fillRect(bx2, y - 12, bw2, 14);
    ctx.fillStyle = q.chg >= 0 ? UP : DOWN;
    ctx.fillRect(bx2, y - 12, v, 14);
    ctx.fillStyle = DIM; ctx.fillText(fmt(q.px), bx2 + bw2 + 8, y);
    ctx.fillStyle = q.chg >= 0 ? UP : DOWN;
    ctx.fillText((q.chg >= 0 ? '+' : '') + q.chg.toFixed(2) + '%', bx2 + bw2 + 76, y);
  });

  // 底部：大单/风控告警跑马灯
  const warnY = h - 40;
  ctx.fillStyle = danger ? 'rgba(255,59,71,0.25)' : 'rgba(0,229,255,0.10)';
  ctx.fillRect(0, warnY, w, 40);
  ctx.fillStyle = danger ? WARN : ACC; ctx.font = 'bold 16px monospace';
  const msg = danger
    ? `⚠ 风控预警：${danger.agent.name} 单笔偏离阈值 · ${danger.deal.sym} ${danger.deal.side} ${danger.deal.qty}股 @${danger.deal.px} · 已挂起待人工审批`
    : '✓ 风控规则通过 · 全部仓位敞口在正常区间 · 组合回撤 -0.34%';
  const off = -((t * 0.06) % (msg.length * 10 + w));
  ctx.fillText(msg, Math.max(0, off), warnY + 26);
  if (off < 0) ctx.fillText(msg, w + off, warnY + 26);
}

/* ---- 左侧条屏：行情滚动 ---- */
function drawTicker(ctx, w, h, snap, t) {
  bg(ctx, w, h, '#03101c', '#01060e');
  scanlines(ctx, w, h);
  ctx.fillStyle = ACC; ctx.font = 'bold 18px monospace';
  ctx.fillText('◆ 实时行情 TICKER', 14, 26);
  ctx.fillStyle = DIM; ctx.font = '11px monospace';
  ctx.fillText('PRICE / CHG% / LAST TRADE', 14, 42);
  ctx.fillStyle = 'rgba(0,229,255,0.25)'; ctx.fillRect(14, 50, w - 28, 1);
  const rows = (snap && snap.rows) || [];
  rows.slice(0, 8).forEach((q, i) => {
    const y = 72 + i * 28;
    // 涨跌幅竖条
    const bh = 18;
    ctx.fillStyle = q.chg >= 0 ? 'rgba(255,59,71,0.2)' : 'rgba(0,200,150,0.2)';
    ctx.fillRect(14, y - bh + 4, 4, bh);
    ctx.fillStyle = q.chg >= 0 ? UP : DOWN;
    ctx.fillRect(14, y - bh + 4 + bh * (1 - Math.min(Math.abs(q.chg) / 4, 1)), 4, bh * Math.min(Math.abs(q.chg) / 4, 1));
    ctx.fillStyle = '#d6e4f5'; ctx.font = '15px monospace';
    ctx.fillText(q.s, 30, y);
    ctx.fillStyle = '#d6e4f5'; ctx.font = 'bold 16px monospace';
    ctx.fillText(fmt(q.px), 150, y);
    ctx.fillStyle = q.chg >= 0 ? UP : DOWN;
    ctx.font = '14px monospace';
    ctx.fillText((q.chg >= 0 ? '▲ ' : '▼ ') + Math.abs(q.chg).toFixed(2) + '%', 280, y);
    // sparkline
    drawSpark(ctx, q.hist, 360, y - 9, 100, 18, q.chg >= 0 ? UP : DOWN);
  });
}

function drawSpark(ctx, hist, x, y, w, h, col) {
  if (!hist || hist.length < 2) return;
  const min = Math.min(...hist), max = Math.max(...hist);
  const k = (max - min) || 1;
  ctx.beginPath();
  hist.forEach((v, i) => {
    const px = x + (i / (hist.length - 1)) * w;
    const py = y + h - ((v - min) / k) * h;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  });
  ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.stroke();
}

/* ---- 右侧屏：委托队列 / 风控 ---- */
function drawQueue(ctx, w, h, snap, danger, t) {
  bg(ctx, w, h, '#100804', '#0a0301');
  scanlines(ctx, w, h);
  ctx.fillStyle = WARN; ctx.font = 'bold 18px monospace';
  ctx.fillText('◆ 委托与风控 QUEUE', 14, 26);
  ctx.fillStyle = DIM; ctx.font = '11px monospace';
  ctx.fillText('ORDER BOOK / RISK ALERT', 14, 42);
  ctx.fillStyle = 'rgba(255,179,0,0.25)'; ctx.fillRect(14, 50, w - 28, 1);

  ctx.fillStyle = DOWN; ctx.font = '12px monospace'; ctx.fillText('卖一 报价', 14, 68);
  ctx.fillStyle = UP; ctx.fillText('买一 报价', 230, 68);
  // 五档盘口
  for (let i = 0; i < 5; i++) {
    const y = 86 + i * 18;
    const off = (i + 1) * 0.01;
    ctx.fillStyle = DOWN; ctx.font = '14px monospace';
    ctx.fillText('3264.' + String(58 - i * 2).padStart(2, '0'), 14, y);
    ctx.fillStyle = DIM; ctx.fillText(String(1200 - i * 183), 120, y);
    ctx.fillStyle = UP;
    ctx.fillText('3264.' + String(56 - i * 2).padStart(2, '0'), 230, y);
    ctx.fillStyle = DIM; ctx.fillText(String(980 + i * 211), 330, y);
  }
  // 成交量柱
  ctx.fillStyle = DIM; ctx.fillText('分时成交', 14, 196);
  for (let i = 0; i < 26; i++) {
    const v = Math.abs(Math.sin(i * 0.7 + t * 0.005)) * 40 + Math.random() * 8;
    ctx.fillStyle = i % 2 ? 'rgba(255,59,71,0.6)' : 'rgba(0,200,150,0.6)';
    ctx.fillRect(14 + i * 11, 240 - v, 7, v);
  }
  // 风控面板
  ctx.fillStyle = WARN; ctx.font = '12px monospace'; ctx.fillText('风险敞口', 14, 260);
  const lv = danger ? 92 : 38;
  ctx.fillStyle = '#0a1828'; ctx.fillRect(90, 248, 180, 12);
  ctx.fillStyle = lv > 75 ? WARN : '#00c896';
  ctx.fillRect(90, 248, 180 * lv / 100, 12);
  ctx.fillStyle = DIM; ctx.font = '11px monospace';
  ctx.fillText(lv + '%', 276, 260);
}

/* ---- 工位显示器：K 线 / 深度图 ---- */
function drawMonitor(ctx, w, h, idx, t) {
  bg(ctx, w, h, '#03080f', '#01030a');
  scanlines(ctx, w, h);
  ctx.strokeStyle = 'rgba(0,229,255,0.10)'; ctx.lineWidth = 1;
  for (let gx = 0; gx < w; gx += 32) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
  for (let gy = 0; gy < h; gy += 32) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
  const seed = idx * 13 + 1;
  const base = 40 + (seed % 40);
  const points = [];
  for (let i = 0; i < 26; i++) {
    const v = base + Math.sin(i * 0.6 + seed + t * 0.003) * 22 + Math.sin(i * 0.2 + seed) * 10;
    points.push(v);
  }
  const min = Math.min(...points) - 6, max = Math.max(...points) + 6;
  const k = (max - min) || 1;
  // candles
  points.forEach((v, i) => {
    const cx = 14 + i * ((w - 28) / 25);
    const cw = 6;
    const o = v + (Math.sin(i + seed) * 6);
    const cl = Math.min(v, o), ch = Math.max(v, o);
    const isUp = o > v;
    ctx.fillStyle = isUp ? 'rgba(255,59,71,0.85)' : 'rgba(0,200,150,0.85)';
    ctx.fillRect(cx, 8 + (h - 16) * (1 - (ch - min) / k), cw, Math.max(1, (h - 16) * ((ch - cl) / k)));
    ctx.fillRect(cx - 1, 8 + (h - 16) * (1 - (Math.max(v, o) - min) / k), cw + 2, 1);
    ctx.fillRect(cx - 1, 8 + (h - 16) * (1 - (Math.min(v, o) - min) / k), cw + 2, 1);
  });
  ctx.fillStyle = ACC; ctx.font = 'bold 14px monospace';
  ctx.fillText('K ' + idx, 8, 16);
}

/* ---- 会审屏 ---- */
function drawMeeting(ctx, w, h, t) {
  bg(ctx, w, h, '#05101e', '#02070f');
  scanlines(ctx, w, h);
  ctx.fillStyle = ACC; ctx.font = 'bold 20px monospace';
  ctx.fillText('◆ 策略会审 · STRATEGY REVIEW', 20, 30);
  ctx.fillStyle = DIM; ctx.font = '13px monospace';
  ctx.fillText('CONFIDENCE 0.82 · SENTIMENT 0.64 · VOLATILITY ▲', 20, 50);
  // 四象限
  const items = ['宏观对冲', '因子选股', 'ETF套利', '期权波动率'];
  const cols = ['#00e5ff', '#ffb300', '#7c4dff', '#69f0ae'];
  items.forEach((it, i) => {
    const x = 20 + (i % 2) * (w / 2 - 10);
    const y = 70 + Math.floor(i / 2) * 90;
    ctx.fillStyle = 'rgba(0,229,255,0.08)'; ctx.fillRect(x, y, w / 2 - 30, 76);
    ctx.strokeStyle = cols[i]; ctx.strokeRect(x, y, w / 2 - 30, 76);
    ctx.fillStyle = cols[i]; ctx.font = 'bold 16px monospace'; ctx.fillText(it, x + 12, y + 24);
    ctx.fillStyle = '#d6e4f5'; ctx.font = '13px monospace';
    ctx.fillText('信号 ' + (0.5 + Math.sin(t * 0.004 + i) * 0.4).toFixed(2), x + 12, y + 46);
    ctx.fillText('建议 ' + (i % 2 ? '减仓' : '加仓'), x + 130, y + 46);
    // bar
    const v = 20 + Math.abs(Math.sin(t * 0.005 + i * 2)) * 90;
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x + 12, y + 56, 150, 8);
    ctx.fillStyle = cols[i]; ctx.fillRect(x + 12, y + 56, v * 1.5, 8);
  });
}
