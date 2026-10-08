import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * 屏幕空间叠加层：把 3D 世界坐标投影到 HTML/CSS2D，用于
 * - 大屏向外发射的锥形光（选席高亮）
 * - 席位名字气泡（可选）
 * 此处用一个投影的发光平面模拟大屏光锥打到地板的效果。
 */
export function ScreenSpace() {
  const ref = useRef();
  useFrame(({ camera }) => {
    if (!ref.current) return;
    ref.current.quaternion.copy(camera.quaternion);
  });
  return (
    <mesh ref={ref} position={[0, 0.02, -9]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[16, 12]} />
      <meshBasicMaterial color="#00a8ff" transparent opacity={0.05} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
