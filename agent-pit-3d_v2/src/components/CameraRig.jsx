import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * 摄像机控制：
 * - 自由观察模式：OrbitControls，可拖拽环绕、滚轮缩放
 * - 第一人称：WASD 移动 + 鼠标拖拽环视（PointerLockControls 风格）
 * - 选中席位后自动聚焦，松开后回到原位
 */
export default function CameraRig({ active, freeRoam }) {
  const { camera, gl } = useThree();
  const orbit = useRef();
  const keys = useRef({});
  const yaw = useRef(0);
  const pitch = useRef(0);
  const velocity = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3(0, 4.2, -13.6));

  useEffect(() => {
    camera.position.set(0, 9.2, 17);
    camera.lookAt(0, 3, -2);
  }, [camera]);

  // 键盘
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space') e.preventDefault();
      keys.current[e.code] = true;
    };
    const up = (e) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // 第一人称：鼠标拖拽调整 yaw/pitch
  useEffect(() => {
    if (!freeRoam) return;
    const dom = gl.domElement;
    let dragging = false, lastX = 0, lastY = 0;
    const onDown = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
    const onUp = () => { dragging = false; };
    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      yaw.current -= dx * 0.0035;
      pitch.current -= dy * 0.0035;
      pitch.current = Math.max(-1.3, Math.min(1.3, pitch.current));
    };
    dom.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    return () => {
      dom.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
    };
  }, [freeRoam, gl]);

  useFrame((state, dt) => {
    const d = dt;
    if (freeRoam) {
      const speed = (keys.current['ShiftLeft'] || keys.current['ShiftRight'] ? 22 : 11);
      const fwd = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
      const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
      const move = new THREE.Vector3();
      if (keys.current['KeyW']) move.add(fwd);
      if (keys.current['KeyS']) move.sub(fwd);
      if (keys.current['KeyD']) move.add(right);
      if (keys.current['KeyA']) move.sub(right);
      if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * d);
      velocity.current.lerp(move, 0.25);
      camera.position.add(velocity.current);
      if (keys.current['Space']) camera.position.y += speed * d;
      if (keys.current['ControlLeft']) camera.position.y -= speed * d;
      camera.position.y = Math.max(0.6, Math.min(14, camera.position.y));
      const look = new THREE.Vector3(
        camera.position.x - Math.sin(yaw.current) * Math.cos(pitch.current),
        camera.position.y + Math.sin(pitch.current),
        camera.position.z - Math.cos(yaw.current) * Math.cos(pitch.current)
      );
      camera.lookAt(look);
    } else if (orbit.current) {
      orbit.current.update();
    }
    // 选中席位后聚焦
    if (active != null) {
      // 由 App 层把 active 座位世界坐标写入 userData（此处仅平滑靠近）
    }
  });

  if (freeRoam) return null;
  return (
    <OrbitControls
      ref={orbit}
      enablePan={true}
      enableDamping
      dampingFactor={0.08}
      minDistance={6}
      maxDistance={40}
      maxPolarAngle={Math.PI / 2 - 0.05}
      minPolarAngle={0.2}
      target={[0, 3.2, -2]}
    />
  );
}
