/**
 * v2 阵容：证券交易作战室
 * 每个 Agent = 一类交易/风控/研究角色。
 * color 用于状态光、服饰主色、UI 标签；emoji 用于列表小头像（程序化小人本身已按 color 上色）。
 */
export const AGENTS = [
  { id: 'alpha',   name: 'ALPHA-7',   role: '短线择时',     emoji: '⚡', color: '#ff5252', tool: 'MACD/KDJ 共振',   desk: 'A1' },
  { id: 'macro',   name: 'MACRO-1',   role: '宏观对冲',     emoji: '🌐', color: '#ffb300', tool: 'FedWatch / 汇率',  desk: 'A2' },
  { id: 'arb',     name: 'ARB-X',     role: 'ETF 套利',     emoji: '🔁', color: '#00e5ff', tool: '一/二级市场价差', desk: 'A3' },
  { id: 'mm',      name: 'MM-02',     role: '做市商',       emoji: '💧', color: '#2979ff', tool: '盘口深度模型',   desk: 'A4' },
  { id: 'quant',   name: 'QUANT-9',   role: '因子选股',     emoji: '🧮', color: '#7c4dff', tool: '多因子回归',     desk: 'A5' },
  { id: 'news',    name: 'NEWS-3',    role: '舆情监控',     emoji: '📰', color: '#18ffff', tool: 'NLP 快讯流',     desk: 'A6' },
  { id: 'risk',    name: 'RISK-00',   role: '实时风控',     emoji: '🛡️', color: '#ff6e40', tool: 'VaR / 穿透校验', desk: 'B1' },
  { id: 'comp',    name: 'COMP-1',    role: '合规审查',     emoji: '📜', color: '#69f0ae', tool: '监管规则库',     desk: 'B2' },
  { id: 'fund',    name: 'FUND-5',    role: '资金调度',     emoji: '💰', color: '#ffd740', tool: '两融 / 银证转账', desk: 'B3' },
  { id: 'kline',   name: 'KLINE-4',   role: 'K线形态',      emoji: '📊', color: '#e040fb', tool: '量价结构扫描',   desk: 'B4' },
  { id: 'fut',     name: 'FUT-88',    role: '股指期现',     emoji: '📈', color: '#00b0ff', tool: '基差套利',       desk: 'B5' },
  { id: 'opt',     name: 'OPT-2',     role: '期权波动率',   emoji: '🎯', color: '#76ff03', tool: 'Greeks 对冲',    desk: 'B6' },
  { id: 'hk',      name: 'HK-11',     role: '港股通',       emoji: '🇭🇰', color: '#ff8a80', tool: '南向资金流',     desk: 'C1' },
  { id: 'us',      name: 'US-77',     role: '美股盘前',     emoji: '🇺🇸', color: '#82b1ff', tool: '盘前期货联动',   desk: 'C2' },
  { id: 'crypto',  name: 'CT-0x',     role: '加密套利',     emoji: '🪙', color: '#ffab00', tool: '跨所价差',       desk: 'C3' },
  { id: 'ops',     name: 'OPS-0',     role: '交易执行',     emoji: '⚙️', color: '#b0bec5', tool: 'VWAP / TWAP',    desk: 'C4' },
];

export const STATES = ['run', 'think', 'wait', 'idle'];

export const STATE_LABEL = { run: '执行中', think: '研判中', wait: '待审批', idle: '待机' };

/** 红涨绿跌（A股惯例），用于所有价格/盈亏着色 */
export const UP = '#ff3b47';
export const DOWN = '#00c896';
export const fmtPnl = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);
