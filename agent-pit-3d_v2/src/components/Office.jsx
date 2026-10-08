import React, { useMemo } from 'react';
import { ScreenTexture, useScreen } from './ScreenTexture.jsx';
import * as THREE from 'three';

/**
 * 证券作战室场景：
 * - 深色镜面地板 + 玻璃幕墙 + 条形吸顶灯（证券交易大厅质感）
 * - 中央大屏：市场态势（领涨/领跌/涨跌家数/均值）
 * - 两侧行情条屏 + 委托队列屏
 * - 工位阵列（3 种布局可切换）
 * - 圆桌会审区
 */
export default function Office({ layout, snap, danger, children }) {
  const cols = 6;
  const agents = React.Children.toArray(children);
  const positions = useMemo(() => {
    const out = [];
    if (layout === 'ring') {
      const n = agents.length || 16;
      for (let i = 0; i < n; i++) out.push({ i, total: n, pos: [0, 0] });
      return out;
    }
    const rows = Math.ceil((agents.length || 1) / cols);
    const gapX = 3.0, gapZ = 3.6;
    const startX = -((cols - 1) * gapX) / 2;
    const startZ = -((rows - 1) * gapZ) / 2;
    agents.forEach((_, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const fwd = r % 2 === 0 ? 1 : -1;
      out.push({ i, total: 0, pos: [startX + c * gapX, startZ + r * gapZ + (fwd < 0 ? -0.9 : 0.9)] });
    });
    return out;
  }, [layout, agents.length]);

  return (
    <group>
      <Floor />
      <Ceiling />
      <Walls />
      <Screens snap={snap} danger={danger} layout={layout} />
      <Desks positions={positions} layout={layout} />
      <MeetingTable />
      {React.Children.map(children, (child, i) =>
        child && typeof child === 'object' && child.type
          ? React.cloneElement(child, { ...positions[i] })
          : child
      )}
    </group>
  );
}

/* ---------- 地板：深色反光 + 网格 ---------- */
function Floor() {
  return (
    <group>
      {/* 主地板 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#0a1020" metalness={0.85} roughness={0.28} envMapIntensity={0.6} />
      </mesh>
      {/* 工位区引导网格 */}
      <gridHelper args={[46, 46, '#1a3a5a', '#12233a']} position={[0, 0.011, 0]} />
      {/* 中央通道发光带 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[2.4, 30]} />
        <meshBasicMaterial color="#00a8ff" transparent opacity={0.08} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.021, 0]}>
        <planeGeometry args={[0.08, 30]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.5} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ---------- 吊顶：证券交易大厅条形灯阵列 ---------- */
function Ceiling() {
  const lights = [];
  for (let i = 0; i < 5; i++) {
    const z = -12 + i * 6;
    lights.push(
      <group key={i} position={[0, 6.2, z]}>
        <mesh>
          <boxGeometry args={[26, 0.18, 1.1]} />
          <meshStandardMaterial color="#0d1830" metalness={0.6} roughness={0.4} emissive="#0a2a4a" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0, -0.16, 0]}>
          <planeGeometry args={[25.2, 0.7]} />
          <meshBasicMaterial color="#9fd0ff" transparent opacity={0.9} toneMapped={false} />
        </mesh>
        <pointLight position={[0, -1.4, 0]} intensity={0.6} color="#a8d0ff" distance={14} decay={2} />
      </group>
    );
  }
  return <group>{lights}</group>;
}

/* ---------- 四周环境：玻璃幕墙 + 外墙 ---------- */
function Walls() {
  const glassMat = <meshPhysicalMaterial color="#1b3a5c" metalness={0.1} roughness={0.08} transmission={0.6} thickness={0.4} envMapIntensity={1.2} clearcoat={1} />;
  return (
    <group>
      {/* 背墙：深色吸音板 + 灯带 */}
      <mesh position={[0, 3.4, -15]}>
        <boxGeometry args={[48, 7.2, 0.4]} />
        <meshStandardMaterial color="#0b1322" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* 侧墙：玻璃幕墙（映射环境，金融区高楼质感） */}
      <mesh position={[-15, 3.4, 0]} rotation={[0, Math.PI / 2, 0]}>{glassMat}</mesh>
      <mesh position={[15, 3.4, 0]} rotation={[0, -Math.PI / 2, 0]}>{glassMat}</mesh>
      {/* 前墙玻璃 */}
      <mesh position={[0, 3.4, 15]} rotation={[0, Math.PI, 0]}>{glassMat}</mesh>
      {/* 灯带轮廓 */}
      <mesh position={[0, 6.9, -14.75]}>
        <boxGeometry args={[46, 0.1, 0.1]} />
        <meshBasicMaterial color="#00e5ff" toneMapped={false} />
      </mesh>
      {/* 立柱 */}
      {[-12, 0, 12].map((x) => (
        <mesh key={x} position={[x, 3.5, -14.6]} castShadow>
          <boxGeometry args={[0.7, 7, 0.7]} />
          <meshStandardMaterial color="#0e1830" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- 大屏 + 侧屏：共用 ScreenTexture ---------- */
function Screens({ snap, danger, layout }) {
  return (
    <group>
      {/* 中央主屏 */}
      <group position={[0, 4.2, -13.6]}>
        <mesh>
          <boxGeometry args={[15.5, 5.6, 0.5]} />
          <meshStandardMaterial color="#050912" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.27]}>
          <planeGeometry args={[14.8, 5.0]} />
          <ScreenTexture type="main" snap={snap} danger={danger} />
        </mesh>
        {/* 边框发光条 */}
        {[[-7.9, 0, 0.28], [7.9, 0, 0.28]].map((p, i) => (
          <mesh key={i} position={p}>
            <boxGeometry args={[0.06, 5.2, 0.06]} />
            <meshBasicMaterial color="#00e5ff" toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* 左侧屏：行情条 */}
      <group position={[-11.6, 3.2, -10.5]} rotation={[0, 0.5, 0]}>
        <mesh>
          <boxGeometry args={[6.4, 3.4, 0.35]} />
          <meshStandardMaterial color="#050912" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.19]}>
          <planeGeometry args={[6.0, 3.0]} />
          <ScreenTexture type="ticker" snap={snap} />
        </mesh>
      </group>

      {/* 右侧屏：委托队列 / 风控 */}
      <group position={[11.6, 3.2, -10.5]} rotation={[0, -0.5, 0]}>
        <mesh>
          <boxGeometry args={[6.4, 3.4, 0.35]} />
          <meshStandardMaterial color="#050912" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.19]}>
          <planeGeometry args={[6.0, 3.0]} />
          <ScreenTexture type="queue" snap={snap} danger={danger} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------- 工位：显示器 + 键盘 + 状态指示灯 ---------- */
function Desks({ positions, layout }) {
  if (layout === 'ring') return <ConferenceDesks />;
  return (
    <group>
      {positions.map((p, i) => {
        const a = (i * 47) % 360;
        const col = new THREE.Color().setHSL((a % 360) / 360, 0.55, 0.55);
        return (
          <group key={i} position={[p.pos[0], 0, p.pos[1]]}>
            {/* 桌板 */}
            <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.5, 0.08, 1.1]} />
              <meshStandardMaterial color="#0e1828" metalness={0.6} roughness={0.4} />
            </mesh>
            {/* 桌腿 */}
            {[[-0.65, -0.45], [0.65, -0.45], [-0.65, 0.45], [0.65, 0.45]].map((l, k) => (
              <mesh key={k} position={[l[0], 0.37, l[1]]} castShadow>
                <boxGeometry args={[0.07, 0.7, 0.07]} />
                <meshStandardMaterial color="#16233a" metalness={0.7} roughness={0.35} />
              </mesh>
            ))}
            {/* 显示器 */}
            <group position={[0, 1.42, -0.42]}>
              <mesh castShadow>
                <boxGeometry args={[1.18, 0.72, 0.05]} />
                <meshStandardMaterial color="#080d18" metalness={0.6} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0, 0.028]}>
                <planeGeometry args={[1.1, 0.64]} />
                <ScreenTexture type="monitor" idx={i} />
              </mesh>
              {/* 底座 */}
              <mesh position={[0, -0.42, 0.12]} castShadow>
                <boxGeometry args={[0.22, 0.18, 0.16]} />
                <meshStandardMaterial color="#101a2c" metalness={0.6} roughness={0.4} />
              </mesh>
            </group>
            {/* 键盘 */}
            <mesh position={[0, 0.79, 0.22]}>
              <boxGeometry args={[0.72, 0.04, 0.26]} />
              <meshStandardMaterial color="#0a1220" metalness={0.4} roughness={0.6} emissive="#062a3a" emissiveIntensity={0.3} />
            </mesh>
            {/* 席号牌 */}
            <mesh position={[0.62, 0.86, 0]}>
              <boxGeometry args={[0.2, 0.1, 0.02]} />
              <meshBasicMaterial color={col} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function ConferenceDesks() {
  return null;
}

/* ---------- 圆桌会审区 ---------- */
function MeetingTable() {
  const chairs = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    chairs.push(
      <mesh key={i} position={[Math.cos(a) * 2.5, 0.5, Math.sin(a) * 2.5]} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#12203a" metalness={0.6} roughness={0.4} />
      </mesh>
    );
  }
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.0, 2.0, 0.12, 32]} />
        <meshStandardMaterial color="#122a4a" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* 会审屏 */}
      <group position={[0, 3.2, -3.6]} rotation={[0, 0, 0]}>
        <mesh>
          <boxGeometry args={[4.4, 2.4, 0.3]} />
          <meshStandardMaterial color="#050912" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.16]}>
          <planeGeometry args={[4.1, 2.1]} />
          <ScreenTexture type="meeting" />
        </mesh>
      </group>
      {chairs}
    </group>
  );
}
