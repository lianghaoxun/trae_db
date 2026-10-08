import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * 悬挂在作战室前方的「交易所」招牌：
 * 用 canvas 生成一块文字贴图，替代外部图片资源。
 * 做成了双面发光板，两面都能看到。
 */
export default function TickerTape({ symbols = [] }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#04101e'); g.addColorStop(1, '#01060e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 128);
    ctx.strokeStyle = 'rgba(0,229,255,0.6)'; ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, 1012, 116);
    ctx.fillStyle = '#00e5ff'; ctx.font = 'bold 40px monospace';
    ctx.fillText('◆ AGENT PIT · 证券交易作战室  TRADING FLOOR', 24, 52);
    ctx.fillStyle = '#7d93b3'; ctx.font = '24px monospace';
    ctx.fillText('MARKET · RISK · COMPLIANCE · EXECUTION  |  LIVE SIMULATION', 24, 92);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  const data = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 96;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a0510'; ctx.fillRect(0, 0, 1024, 96);
    ctx.font = '30px monospace';
    let x = 24;
    symbols.forEach((q) => {
      const txt = `${q.s} ${q.px.toFixed(2)} ${(q.chg >= 0 ? '▲ ' : '▼ ') + Math.abs(q.chg).toFixed(2) + '%'}   `;
      ctx.fillStyle = q.chg >= 0 ? '#ff3b47' : '#00c896';
      ctx.fillText(txt, x, 60);
      x += ctx.measureText(txt).width + 20;
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { canvas: c, ctx, tex: t };
  }, [symbols]);

  // 让条屏内容随行情更新
  const ref = React.useRef();
  React.useEffect(() => {
    let raf;
    const loop = () => {
      const c = data.canvas, ctx = data.ctx;
      ctx.fillStyle = '#0a0510'; ctx.fillRect(0, 0, 1024, 96);
      ctx.font = '30px monospace';
      let x = 24 - ((performance.now() / 40) % 760);
      symbols.forEach((q) => {
        if (!q) return;
        const txt = `${q.s} ${q.px.toFixed(2)} ${(q.chg >= 0 ? '▲ ' : '▼ ') + Math.abs(q.chg).toFixed(2) + '%'}   `;
        ctx.fillStyle = q.chg >= 0 ? '#ff3b47' : '#00c896';
        ctx.fillText(txt, x, 60);
        x += ctx.measureText(txt).width + 20;
        if (x > 1024) return;
      });
      data.tex.needsUpdate = true;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [data, symbols]);

  return (
    <group position={[0, 7.6, 12.6]} rotation={[-0.05, 0, 0]}>
      <mesh>
        <boxGeometry args={[14, 1.7, 0.3]} />
        <meshStandardMaterial color="#05080f" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.16]}>
        <planeGeometry args={[13.4, 1.3]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* 底部滚动条屏 */}
      <group position={[0, -1.9, 0.1]}>
        <mesh>
          <boxGeometry args={[13.6, 1.1, 0.2]} />
          <meshStandardMaterial color="#05080f" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0.11]}>
          <planeGeometry args={[13.2, 0.8]} />
          <meshBasicMaterial map={data.tex} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
