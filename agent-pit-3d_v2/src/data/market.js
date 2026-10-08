/**
 * 模拟行情源：真实接入时，把 MarketFeed 换成 WebSocket / SSE 即可。
 * 这里的价位会随 tick() 持续漂移，供大屏指数、滚动条屏和 Agent 盈亏联动使用。
 */
const SEED = [
  { s: '上证指数', c: '000001.SH', px: 3264.58, chg: 0.62 },
  { s: '深证成指', c: '399001.SZ', px: 10472.10, chg: 1.04 },
  { s: '创业板指', c: '399006.SZ', px: 2188.42, chg: 1.71 },
  { s: '科创50',   c: '000688.SH', px: 982.16, chg: 2.23 },
  { s: '沪深300',  c: '000300.SH', px: 3841.05, chg: 0.81 },
  { s: '北证50',   c: '899050.BJ', px: 1286.44, chg: 3.12 },
  { s: '恒生指数', c: 'HSI',       px: 20518.30, chg: 1.48 },
  { s: '国企指数', c: 'HSCEI',     px: 7412.88, chg: 1.21 },
  { s: '纳斯达克', c: 'IXIC',      px: 18203.76, chg: 0.44 },
  { s: '标普500',  c: 'INX',       px: 5721.18, chg: 0.18 },
  { s: '道琼斯',   c: 'DJI',       px: 42327.50, chg: -0.12 },
  { s: '日经225',  c: 'N225',      px: 38741.20, chg: -0.34 },
  { s: 'BTC',      c: 'BTC-USD',   px: 68412.00, chg: 2.86 },
  { s: 'ETH',      c: 'ETH-USD',   px: 2618.44, chg: 1.93 },
  { s: '黄金',      c: 'XAU',      px: 2658.70, chg: 0.28 },
  { s: '原油',      c: 'WTI',      px: 71.24, chg: -1.05 },
];

const VOL = [0.0008, 0.0022, 0.0045, 0.009, 0.018, 0.04];

export function createMarket() {
  const rows = SEED.map((q, i) => ({
    ...q,
    prev: q.px,
    vol: VOL[Math.min(i, VOL.length - 1)],
    hist: Array.from({ length: 40 }, (_, k) => q.px * (1 + Math.sin(k * 0.6 + i) * 0.012)),
    last: '-',
  }));
  let t = 0;
  return {
    rows,
    tick() {
      t++;
      rows.forEach((q, i) => {
        const drift = (q.chg / 100) * 0.04;
        const shock = (Math.random() - 0.5) * 2 * q.vol + drift * q.vol;
        q.px = Math.max(q.px * (1 + shock), 0.0001);
        q.prev = rows[(i * 7 + t) % rows.length].px; // 参考前值
        q.chg = ((q.px / (q.px / (1 + q.chg / 100) * (1 - 0.0005))) - 1) * 100;
        // 用一条更平滑的自回归维持 chg 连续性
        const target = SEED[i].chg;
        q.chg = q.chg * 0.96 + target * 0.04 + (Math.random() - 0.5) * q.vol * 60;
        q.hist.push(q.px);
        if (q.hist.length > 40) q.hist.shift();
        q.last = (Math.random() < 0.18 ? ['↗', '↘', '·'][Math.floor(Math.random() * 3)] : '');
      });
    },
    snapshot() {
      const total = rows.length;
      const up = rows.filter((q) => q.chg > 0).length;
      const down = rows.filter((q) => q.chg < 0).length;
      const flat = total - up - down;
      const avgChg = rows.reduce((a, q) => a + q.chg, 0) / total;
      const lead = [...rows].sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg))[0];
      const mover = [...rows].sort((a, b) => b.px - a.px * 0 + (Math.random() - 0.5))[0];
      return { rows, total, up, down, flat, avgChg, lead, mover, t };
    },
  };
}

/* ---------- Agent 模拟：生成交易行为与状态机 ---------- */

const SIDE = ['买入', '卖出', '加仓', '减仓', '平仓', '撤单'];
const OBJ = ['中际旭创', '寒武纪-U', '宁德时代', '贵州茅台', '招商银行', '恒瑞医药', '中信证券', '中国平安',
             '沪电股份', '新易盛', '北方华创', '中芯国际', '腾讯控股', '美团-W', '比亚迪', '长江电力',
             'TSLA', 'NVDA', 'AAPL', 'BTC/USDT', 'ETH/USDT', 'IF主连', 'IO期权', '510300 ETF'];

export function createAgentRuntime(agents, market, log) {
  const data = {};
  agents.forEach((a) => {
    data[a.id] = {
      state: 'idle', task: '—', tool: a.tool, side: '', target: '', px: 0, qty: 0,
      pnl: +(Math.random() * 40 - 8).toFixed(2), orders: 0, filled: 0, risk: 12 + Math.random() * 60 | 0,
      thinkSec: 0, waitSec: 0, lastDeal: null,
    };
  });
  let danger = null;

  function pickAgent() { return agents[Math.floor(Math.random() * agents.length)]; }

  function transact(a, kind) {
    const id = a.id;
    const d = data[id];
    const sym = OBJ[Math.floor(Math.random() * OBJ.length)];
    const m = market.rows[Math.floor(Math.random() * Math.min(8, market.rows.length))];
    const side = SIDE[Math.floor(Math.random() * SIDE.length)];
    const qty = [100, 200, 300, 500, 800, 1000, 1200, 2000, 5000][Math.floor(Math.random() * 9)];
    const px = +(m ? m.px : 10 + Math.random() * 90).toFixed(2);
    d.side = side; d.target = sym; d.px = px; d.qty = qty;
    d.orders++;
    if (kind === 'warn' || side === '平仓' || Math.random() < 0.35) d.state = 'wait';
    else d.state = 'run';
    if (kind === 'big') d.state = 'wait';
    const edge = side === '买入' || side === '加仓' ? -1 : 1;
    const slip = (Math.random() - 0.5) * 1.6 + edge * 0.6;
    const deal = {
      sym, side, px, qty,
      pnl: +(slip * (qty / 100) * (px / 100)).toFixed(2),
    };
    d.lastDeal = deal;
    d.pnl = +(d.pnl + deal.pnl).toFixed(2);
    if (d.pnl > 200) d.pnl = +(d.pnl * 0.94).toFixed(2);
    if (d.pnl < -180) d.pnl = +(d.pnl * 0.9 + 6).toFixed(2);
    if (kind !== 'warn') { d.filled++; }
    d.task = `${side} ${sym} ${qty}股 @${px}`;
    const lvl = (kind === 'big' || kind === 'warn') ? 'warn' : (side === '买入' || side === '加仓' ? 'buy' : 'sell');
    log.push(lvl, `${a.name.padEnd(7)}│${sym.padEnd(8)}│${side} ${qty}股 @${px}  ≈ ${deal.pnl >= 0 ? '+' : ''}${deal.pnl}`);
    return deal;
  }

  return {
    data,
    get danger() { return danger; },
    tick() {
      market.tick();
      const snap = market.snapshot();
      // 风控/合规是常驻"研判"态
      data.risk.state = Math.random() < 0.75 ? 'think' : 'run';
      data.comp.state = Math.random() < 0.6 ? 'think' : 'run';
      data.fund.state = Math.random() < 0.5 ? 'think' : 'run';
      // 其余角色：低概率产生交易动作
      const busy = agents.filter((a) => ['risk', 'comp', 'fund'].includes(a.id));
      busy.forEach((a) => { if (Math.random() < 0.5) transact(a, 'tick'); });
      const n = 1 + (Math.random() < 0.18 ? 2 : 0) + (Math.random() < 0.06 ? 2 : 0);
      for (let i = 0; i < n; i++) {
        const a = pickAgent();
        if (['risk', 'comp', 'fund'].includes(a.id)) continue;
        const r = Math.random();
        if (r < 0.62) transact(a, 'tick');
        else if (r < 0.86) {
          data[a.id].state = 'think';
          data[a.id].task = ['等待成交回报', '扫描盘口异动', '回测参数调优', '监控板块轮动'][Math.floor(Math.random() * 4)];
        } else {
          data[a.id].state = 'idle';
          data[a.id].task = ['策略休眠', '等待开盘信号', '复盘上一笔'][Math.floor(Math.random() * 3)];
        }
      }
      // 大单 / 风控告警
      if (Math.random() < 0.05) {
        const a = pickAgent();
        const deal = transact(a, 'big');
        danger = { agent: a, deal, t: Date.now() };
        log.push('warn', `风控预警│${a.name} 单笔偏离阈值，已挂起待人工审批`);
        setTimeout(() => { danger = null; }, 6500);
      }
      // 状态自然衰减
      agents.forEach((a) => {
        const d = data[a.id];
        if (d.state === 'wait') { d.waitSec++; if (d.waitSec > 6 + Math.random() * 8) { d.state = 'run'; d.waitSec = 0; } }
        else if (d.state === 'think') { d.thinkSec++; if (d.thinkSec > 9 + Math.random() * 12) { d.state = 'idle'; d.thinkSec = 0; } }
        else d.waitSec = 0;
        d.risk = Math.max(4, Math.min(96, d.risk + (Math.random() - 0.5) * 6 | 0));
      });
      return snap;
    },
  };
}
