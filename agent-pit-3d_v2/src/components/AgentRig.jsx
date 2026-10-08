import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const STATE_COLOR = { run: '#00e5ff', think: '#ffb300', wait: '#ff3b47', idle: '#5a7090' };
const STATE_GLOW = { run: '#00e5ff', think: '#ffb300', wait: '#ff3b47', idle: '#3a4a63' };
const STATE_TOOL = { run: '⚡', think: '🧠', wait: '⏸', idle: '·' };

/**
 * 完全程序化生成的 3D 小人（不依赖外部模型资源）。
 * 部位拆分：头 / 躯干 / 左右臂 / 左右腿 / 显示屏面部 / 肩甲装饰，
 * 每帧用贝塞尔曲线插值关节角度，实现走/站/摆臂的连贯动作。
 */
export default function AgentRig({ agent, runtime, active, danger, onClick, layout, freeRoam }) {
  const group = useRef();
  const body = useRef();
  const head = useRef();
  const armL = useRef(), armR = useRef();
  const legL = useRef(), legR = useRef();
  const glow = useRef();
  const halo = useRef();
  const [hover, setHover] = useState(false);

  const home = useMemo(() => {
    if (layout === 'ring') {
      const i = agent.index ?? 0, n = agent.total ?? 16;
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return new THREE.Vector3(Math.cos(a) * 5.2, 0, Math.sin(a) * 5.2);
    }
    const p = agent.pos ?? [0, 0];
    return new THREE.Vector3(p[0], 0, p[1]);
  }, [layout, agent.pos, agent.index, agent.total]);

  const target = useRef(home.clone());
  const cur = useRef(home.clone());
  const facing = useRef(Math.atan2(0, -1));
  const walk = useRef(0);
  const bob = useRef(0);
  const stateColor = useRef(new THREE.Color(STATE_COLOR.idle));
  const targetColor = useRef(new THREE.Color(STATE_COLOR.idle));
  const alertPulse = useRef(0);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const d = runtime || {};
    const st = d.state || 'idle';
    targetColor.current.set(STATE_COLOR[st] || STATE_COLOR.idle);
    stateColor.current.lerp(targetColor.current, Math.min(1, dt * 5));
    const col = stateColor.current;

    // 圆桌会审：think 态的小人自动聚拢到圆桌
    if (layout === 'ring' && st === 'think') {
      const ang = Math.atan2(home.z, home.x);
      target.current.set(Math.cos(ang) * 2.6, 0, Math.sin(ang) * 2.6);
    } else {
      target.current.copy(home);
    }

    // 待机/挂起时随机离席溜达
    if ((st === 'idle' && Math.random() < 0.0015) || (st === 'wait' && Math.random() < 0.004)) {
      const a = Math.random() * Math.PI * 2, r = 1.6 + Math.random() * 2.4;
      target.current.set(home.x + Math.cos(a) * r, 0, home.z + Math.sin(a) * r);
    }

    const delta = target.current.clone().sub(cur.current);
    const dist = delta.length();
    const speed = st === 'wait' ? 2.4 : 3.0;
    if (dist > 0.02) {
      const step = Math.min(dist, speed * dt);
      cur.current.add(delta.normalize().multiplyScalar(step));
      const desired = Math.atan2(delta.x, delta.z);
      let diff = desired - facing.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      facing.current += diff * Math.min(1, dt * 8);
      walk.current += step * 2.6;
      bob.current = Math.sin(walk.current * 2.2) * 0.09;
    } else {
      bob.current = Math.sin(t * 1.6 + home.x) * 0.035;
    }

    if (group.current) {
      group.current.position.set(cur.current.x, bob.current, cur.current.z);
      group.current.rotation.y = facing.current;
    }

    // 待机微微呼吸 / 挂起时上下弹跳
    const breath = 1 + Math.sin(t * 2 + home.x * 2) * 0.015;
    if (body.current) body.current.scale.y = breath;

    // 走/站姿态：手臂与腿交替摆动，曲线缓动
    const swing = Math.sin(walk.current) * Math.min(1, dist * 1.2) * 0.7;
    if (armL.current) armL.current.rotation.x = swing;
    if (armR.current) armR.current.rotation.x = -swing;
    if (legL.current) legL.current.rotation.x = -swing * 0.8;
    if (legR.current) legR.current.rotation.x = swing * 0.8;

    // 挂起态：举起双手 + 警戒脉冲；研判态：单臂托腮
    if (st === 'wait') {
      if (armL.current) armL.current.rotation.x = -1.9;
      if (armR.current) armR.current.rotation.x = -1.9;
      alertPulse.current = 1;
    } else if (st === 'think') {
      if (armR.current) armR.current.rotation.x = -2.0;
      if (armL.current) armL.current.rotation.x = 0.15;
      alertPulse.current = 0;
    } else {
      alertPulse.current *= 0.9;
    }

    // 屏幕面部表情（材质 emoji 纹理）
    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.6 + home.z) * 0.35;
      head.current.rotation.z = Math.sin(t * 0.4 + home.x) * 0.06;
    }

    // 脚下光环：半径与透明度随状态呼吸
    if (halo.current) {
      const baseR = st === 'wait' ? 1.15 : 0.95;
      const pulse = 1 + (st === 'wait' ? Math.sin(t * 7) : st === 'run' ? Math.sin(t * 3.4) : Math.sin(t * 1.8)) * 0.12;
      halo.current.scale.setScalar(baseR * pulse);
      halo.current.material.color.copy(col);
      halo.current.material.opacity = (st === 'wait' ? 0.55 : st === 'run' ? 0.42 : st === 'think' ? 0.32 : 0.18) * (hover || active ? 1.6 : 1);
    }
    // 头顶警示光晕
    if (glow.current) {
      glow.current.material.color.copy(col);
      const gp = st === 'wait' ? (0.6 + Math.sin(t * 8) * 0.4) : st === 'run' ? 0.5 + Math.sin(t * 3) * 0.25 : 0.22;
      glow.current.material.opacity = Math.max(0, gp);
      glow.current.scale.setScalar(0.55 + alertPulse.current * 0.35 + (active ? 0.25 : 0));
    }
  });

  const accent = agent.color;
  const isWait = (runtime?.state || 'idle') === 'wait';
  const isDanger = danger && danger.agent.id === agent.id;

  return (
    <group ref={group} position={home.toArray()}
           onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
           onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
           onClick={onClick}>
      {/* 脚下状态光环 */}
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} receiveShadow>
        <ringGeometry args={[0.42, 0.82, 48]} />
        <meshBasicMaterial transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* 地板落影 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
        <circleGeometry args={[0.62, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.42} depthWrite={false} />
      </mesh>

      <group ref={body} position={[0, 0.62, 0]}>
        {/* 躯干：金属漆 + 前胸状态灯 */}
        <mesh castShadow>
          <capsuleGeometry args={[0.3, 0.52, 8, 16]} />
          <meshStandardMaterial color={accent} metalness={0.55} roughness={0.32} envMapIntensity={1.1} />
        </mesh>
        {/* 前胸面板 */}
        <mesh position={[0, 0.06, 0.27]}>
          <boxGeometry args={[0.42, 0.28, 0.04]} />
          <meshStandardMaterial color="#0c1422" metalness={0.2} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.06, 0.293]}>
          <boxGeometry args={[0.36, 0.2, 0.012]} />
          <meshBasicMaterial color={stateColor.current} toneMapped={false} />
        </mesh>
        {/* 腰带/编号 */}
        <mesh position={[0, -0.36, 0]}>
          <torusGeometry args={[0.32, 0.045, 12, 24]} />
          <meshStandardMaterial color="#101a2c" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* 头：显示屏面部 */}
        <group ref={head} position={[0, 0.72, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.46, 0.42, 0.4]} />
            <meshStandardMaterial color="#101a28" metalness={0.4} roughness={0.45} />
          </mesh>
          {/* 面部屏幕 */}
          <mesh position={[0, 0.02, 0.205]}>
            <planeGeometry args={[0.36, 0.26]} />
            <FaceMaterial color={col} state={runtime?.state || 'idle'} />
          </mesh>
          {/* 头顶警示灯 */}
          <mesh ref={glow} position={[0, 0.27, 0]}>
            <sphereGeometry args={[0.13, 16, 16]} />
            <meshBasicMaterial transparent toneMapped={false} />
          </mesh>
          {/* 天线 */}
          <mesh position={[0.12, 0.32, 0.02]} rotation={[0, 0, -0.3]}>
            <cylinderGeometry args={[0.02, 0.02, 0.26, 8]} />
            <meshStandardMaterial color={accent} metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0.2, 0.5, 0.02]}>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
        </group>

        {/* 肩甲装饰：左右 */}
        <mesh position={[-0.34, 0.42, 0]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[0.16, 0.2, 0.4]} />
          <meshStandardMaterial color="#0d1522" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.34, 0.42, 0]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[0.16, 0.2, 0.4]} />
          <meshStandardMaterial color="#0d1522" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* 手臂 */}
        <group ref={armL} position={[-0.36, 0.34, 0]}>
          <mesh castShadow position={[0, -0.26, 0]}>
            <capsuleGeometry args={[0.09, 0.4, 6, 10]} />
            <meshStandardMaterial color="#0d1522" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.56, 0]}>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial color={accent} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
        <group ref={armR} position={[0.36, 0.34, 0]}>
          <mesh castShadow position={[0, -0.26, 0]}>
            <capsuleGeometry args={[0.09, 0.4, 6, 10]} />
            <meshStandardMaterial color="#0d1522" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.56, 0]}>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial color={accent} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>

        {/* 腿 */}
        <group ref={legL} position={[-0.16, -0.44, 0]}>
          <mesh castShadow position={[0, -0.26, 0]}>
            <capsuleGeometry args={[0.1, 0.38, 6, 10]} />
            <meshStandardMaterial color="#0a111c" metalness={0.5} roughness={0.45} />
          </mesh>
        </group>
        <group ref={legR} position={[0.16, -0.44, 0]}>
          <mesh castShadow position={[0, -0.26, 0]}>
            <capsuleGeometry args={[0.1, 0.38, 6, 10]} />
            <meshStandardMaterial color="#0a111c" metalness={0.5} roughness={0.45} />
          </mesh>
        </group>
      </group>

      {/* 选中 / 悬停：立柱光标 */}
      {(active || hover) && (
        <mesh position={[0, 1.55, 0]}>
          <coneGeometry args={[0.1, 0.22, 4]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
      )}
      {isWait && (
        <mesh position={[0, 2.05, 0]}>
          <torusGeometry args={[0.18, 0.025, 8, 24]} />
          <meshBasicMaterial color="#ff3b47" toneMapped={false} />
        </mesh>
      )}
      {isDanger && (
        <pointLight position={[0, 1.2, 0]} color="#ff3b47" intensity={1.6} distance={5} />
      )}
    </group>
  );
}

/* ---------- 面部屏幕材质：用 canvas 画 emoji 表情 ---------- */
function FaceMaterial({ color, state }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 192;
    const ctx = c.getContext('2d');
    const t = { run: ['◕','‿','◕'], think: ['◔','_','◔'], wait: ['×','_','×'], idle: ['-','_','-'] }[state] || ['-','_','-'];
    // 屏底
    const g = ctx.createLinearGradient(0, 0, 0, 192);
    g.addColorStop(0, '#0a3a2a'); g.addColorStop(1, '#021a12');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 192);
    // 扫描线
    ctx.fillStyle = 'rgba(0,229,180,0.05)';
    for (let y = 0; y < 192; y += 4) ctx.fillRect(0, y, 256, 1);
    // 眼睛
    ctx.fillStyle = '#39ffd0';
    ctx.font = 'bold 92px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#39ffd0'; ctx.shadowBlur = 18;
    ctx.fillText(t[0], 80, 96);
    ctx.fillText(t[2], 176, 96);
    // 嘴
    ctx.fillStyle = '#39ffd0'; ctx.shadowBlur = 10;
    ctx.font = 'bold 60px monospace';
    ctx.fillText(t[1], 128, 150);
    ctx.shadowBlur = 0;
    // 边框刻度
    ctx.strokeStyle = 'rgba(57,255,208,0.35)'; ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, 244, 180);
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; tx.needsUpdate = true;
    return tx;
  }, [state]);
  return <meshBasicMaterial map={tex} toneMapped={false} />;
}
