import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text, Billboard, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'

/* ============================================================
   Agent Pit 3D —— React Three Fiber 简易版
   状态机驱动动画：所有 Agent 状态变化都收敛到 store.setState()
   真实接入：把 fakeStream() 换成 WebSocket / SSE 的 onmessage，
   解析事件后调用 setState(id, state, {task, tool, token}) 即可。
   ============================================================ */

const STATES = ['running', 'thinking', 'blocked', 'idle']
const TOOLS = ['read_file', 'write_file', 'bash', 'web_search', 'grep', 'subagent_spawn', 'approval', 'git']

const TASKS = [
  'git push origin feature/auth', 'pnpm test --run', 'docker compose up -d',
  'review PR #1284', '查询 K 线数据', '生成周报', 'pnpm build', '扫描依赖漏洞',
  '部署到预发', '抓取竞品价格', '跑迁移脚本', '分析日志异常', '回测策略 v3', '清理上下文',
]

const AGENTS = [
  { id: 'a1',  name: 'Cipher', role: '后端 · 策略引擎', c: '#4dabf7' },
  { id: 'a2',  name: 'Vega',   role: '数据 · 行情接入', c: '#3ddc97' },
  { id: 'a3',  name: 'Onyx',   role: '前端 · 看板',     c: '#a78bfa' },
  { id: 'a4',  name: 'Ridge',  role: '运维 · 部署',     c: '#ffd166' },
  { id: 'a5',  name: 'Nyx',    role: 'QA · 测试',      c: '#ff9f6b' },
  { id: 'a6',  name: 'Echo',   role: '研究 · 竞品',     c: '#5dd6f0' },
  { id: 'a7',  name: 'Kai',    role: '文档 · 周报',     c: '#f672ca' },
  { id: 'a8',  name: 'Mira',   role: '安全 · 审计',     c: '#f0e15d' },
  { id: 'a9',  name: 'Jett',   role: '爬虫 · 数据源',   c: '#7ee787' },
  { id: 'a10', name: 'Sage',   role: '调度 · Cron',     c: '#79c0ff' },
]

// ---------- 状态机核心 ----------
const useStore = () => {
  const [metas, setMetas] = useState(() =>
    AGENTS.map((a) => ({ ...a, state: 'idle', task: '—', tools: 0, token: 0, since: Date.now() }))
  )
  const [log, setLog] = useState([])
  const [sel, setSel] = useState(null)
  const wsRef = useRef(null)

  const logEvent = useCallback((level, msg) => {
    setLog((prev) => {
      const next = [{ time: new Date().toLocaleTimeString('en-GB'), level, msg }, ...prev]
      return next.slice(0, 60)
    })
  }, [])

  const setState = useCallback((id, state, extra = {}) => {
    setMetas((prev) => {
      const idx = prev.findIndex((m) => m.id === id)
      if (idx < 0) return prev
      const old = prev[idx]
      const next = prev.slice()
      const m = { ...old }
      m.state = state
      if (extra.task) m.task = extra.task
      if (extra.tool) m.tools += 1
      if (extra.token) m.token += extra.token
      if (state === 'running' && old.state !== 'running') m.since = Date.now()
      next[idx] = m
      return next
    })
  }, [])

  const counts = useMemo(() => {
    const c = { running: 0, thinking: 0, blocked: 0, idle: 0, token: 0 }
    metas.forEach((m) => { c[m.state]++; c.token += m.token })
    return c
  }, [metas])

  return { metas, setMetas, log, logEvent, sel, setSel, setState, counts }
}

// ---------- 中央大屏 ----------
function BigScreen({ counts }) {
  const ref = useRef()
  const bars = useRef(Array.from({ length: 28 }, () => Math.random()))
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.02
    if (s.clock.elapsedTime % 0.4 < 0.05) {
      bars.current = bars.current.map(() => 0.2 + Math.random() * 0.8)
    }
  })
  const successRate = counts.running + counts.idle === 0 ? 100 : Math.min(100, (counts.running / AGENTS.length) * 100 | 0)
  return (
    <group position={[0, 4.4, -7.5]} ref={ref}>
      {/* 屏幕本体 */}
      <mesh>
        <boxGeometry args={[13, 3.2, 0.3]} />
        <meshStandardMaterial color="#07101f" emissive="#0a1830" emissiveIntensity={0.6} />
      </mesh>
      {/* 发光面 */}
      <mesh position={[0, 0, 0.16]}>
        <planeGeometry args={[12.4, 2.8]} />
        <meshBasicMaterial color="#0b1a33" />
      </mesh>
      {/* 顶部标题 */}
      <Billboard position={[0, 1.25, 0.18]}>
        <Text fontSize={0.26} color="#4dabf7" anchorX="center">◆ GLOBAL OPS · 全局态势</Text>
      </Billboard>
      {/* 四个数字 */}
      <Billboard position={[-4.4, 0.45, 0.18]}>
        <Text fontSize={0.5} color="#3ddc97" anchorX="center">{counts.running}</Text>
      </Billboard>
      <Billboard position={[-4.4, 0.02, 0.18]}>
        <Text fontSize={0.13} color="#7d8aa6" anchorX="center">RUNNING 运行中</Text>
      </Billboard>
      <Billboard position={[-1.5, 0.45, 0.18]}>
        <Text fontSize={0.5} color="#ffd166" anchorX="center">{counts.thinking + counts.blocked}</Text>
      </Billboard>
      <Billboard position={[-1.5, 0.02, 0.18]}>
        <Text fontSize={0.13} color="#7d8aa6" anchorX="center">QUEUE 队列</Text>
      </Billboard>
      <Billboard position={[1.4, 0.45, 0.18]}>
        <Text fontSize={0.5} color="#4dabf7" anchorX="center">{successRate}%</Text>
      </Billboard>
      <Billboard position={[1.4, 0.02, 0.18]}>
        <Text fontSize={0.13} color="#7d8aa6" anchorX="center">SUCCESS 成功率</Text>
      </Billboard>
      <Billboard position={[4.4, 0.45, 0.18]}>
        <Text fontSize={0.5} color="#ff5d6c" anchorX="center">{counts.blocked}</Text>
      </Billboard>
      <Billboard position={[4.4, 0.02, 0.18]}>
        <Text fontSize={0.13} color="#7d8aa6" anchorX="center">FAILED 异常</Text>
      </Billboard>
      {/* 柱状趋势图 */}
      {bars.current.map((h, i) => (
        <mesh key={i} position={[-6 + i * 0.45, -1.15 + h * 0.5, 0.18]}>
          <boxGeometry args={[0.28, h * 1.0, 0.06]} />
          <meshBasicMaterial color="#4dabf7" transparent opacity={0.55} />
        </mesh>
      ))}
      {/* 屏框发光边 */}
      <lineSegments position={[0, 0, 0.17]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(12.5, 2.9)]} />
        <lineBasicMaterial color="#4dabf7" transparent opacity={0.4} />
      </lineSegments>
    </group>
  )
}

// ---------- 单个 Agent 工位 ----------
function AgentDesk({ meta, position, onSelect, selected }) {
  const group = useRef()
  const screenMat = useRef()
  const ringMat = useRef()
  const bob = useRef(Math.random() * Math.PI * 2)
  const targetPos = useRef(new THREE.Vector3(...position))
  const working = meta.state === 'running'
  const blocked = meta.state === 'blocked'
  const idle = meta.state === 'idle'
  const thinking = meta.state === 'thinking'

  // 屏幕发光颜色
  const screenColor = working ? '#3ddc97' : thinking ? '#ffd166' : blocked ? '#ff5d6c' : '#3a4666'
  const ledColor = working ? '#3ddc97' : thinking ? '#ffd166' : blocked ? '#ff5d6c' : '#5a6480'

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime
    bob.current += dt
    if (group.current) {
      // 浮空微动
      group.current.position.y = position[1] + Math.sin(t * 1.2 + bob.current) * 0.03
      // 选中浮动更高
      const ty = selected ? 0.25 : 0
      group.current.position.y += ty
      // 缓动到目标位（用于走动）
      group.current.position.x += (targetPos.current.x - group.current.position.x) * 0.08
      group.current.position.z += (targetPos.current.z - group.current.position.z) * 0.08
    }
    if (screenMat.current) {
      const target = new THREE.Color(screenColor)
      screenMat.current.color.lerp(target, 0.1)
      screenMat.current.emissive.lerp(target, 0.1)
      const pulse = working ? (1 + Math.sin(t * 4) * 0.25) : blocked ? (1 + Math.sin(t * 8) * 0.4) : 0.5
      screenMat.current.emissiveIntensity = 0.4 * pulse + 0.2
    }
    if (ringMat.current) {
      const pulse = working ? 1 + Math.sin(t * 3) * 0.3 : blocked ? 1 + Math.sin(t * 7) * 0.5 : 0.4
      ringMat.current.opacity = (0.25 + 0.35 * pulse) * 0.9
      ringMat.current.color.lerp(new THREE.Color(ledColor), 0.1)
    }
  })

  // 走动：idle / blocked 时随机溜达
  useEffect(() => {
    if ((idle || blocked) && Math.random() < 0.15) {
      const a = Math.random() * Math.PI * 2
      const r = 3 + Math.random() * 4
      targetPos.current.set(Math.cos(a) * r, 0.4, Math.sin(a) * r)
      const tm = setTimeout(() => {
        targetPos.current.set(...position)
      }, 2400)
      return () => clearTimeout(tm)
    }
  }, [meta.state, idle, blocked])

  return (
    <group ref={group} position={position} onClick={(e) => { e.stopPropagation(); onSelect(meta.id) }}>
      {/* 状态光环（脚下） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.39, 0]}>
        <ringGeometry args={[0.55, 0.75, 32]} />
        <meshBasicMaterial ref={ringMat} color={ledColor} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Agent 小人（坐姿/站姿） */}
      <mesh position={[0, -0.12, 0.28]}>
        <boxGeometry args={[0.42, 0.42, 0.42]} />
        <meshStandardMaterial color={meta.c} emissive={meta.c} emissiveIntensity={selected ? 0.7 : 0.35} />
      </mesh>
      {/* 头顶名字 */}
      <Billboard position={[0, 0.28, 0.28]}>
        <Text fontSize={0.16} color="#e8edf7" anchorX="center">{meta.name}</Text>
      </Billboard>
      {/* 状态气泡 */}
      <Billboard position={[0, 0.62, 0.28]}>
        <Text fontSize={0.13} color={blocked ? '#ff5d6c' : thinking ? '#ffd166' : '#3ddc97'} anchorX="center" maxWidth={3.5}>
          {blocked ? '⚠ 等待审批' : thinking ? '🤔 思考中…' : working ? meta.task : '— idle —'}
        </Text>
      </Billboard>
      {/* 工位桌面 */}
      <mesh position={[0, -0.42, 0]}>
        <boxGeometry args={[1.0, 0.08, 0.9]} />
        <meshStandardMaterial color="#1b2438" roughness={0.6} />
      </mesh>
      {/* 显示器 */}
      <mesh position={[0, -0.1, 0.46]}>
        <boxGeometry args={[0.86, 0.56, 0.06]} />
        <meshStandardMaterial color="#0a1226" />
      </mesh>
      <mesh position={[0, -0.1, 0.5]}>
        <planeGeometry args={[0.78, 0.48]} />
        <meshStandardMaterial ref={screenMat} color={screenColor} emissive={screenColor} emissiveIntensity={0.6} />
      </mesh>
      {/* 键盘 */}
      <mesh position={[0, -0.36, 0.18]}>
        <boxGeometry args={[0.5, 0.04, 0.24]} />
        <meshStandardMaterial color="#252e45" />
      </mesh>
      {/* 状态指示灯 */}
      <mesh position={[0.42, -0.1, 0.51]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshBasicMaterial color={ledColor} />
        <pointLight color={ledColor} intensity={blocked ? 1.2 : working ? 0.7 : 0.2} distance={2} />
      </mesh>
      {/* 选中高亮框 */}
      {selected && (
        <mesh position={[0, -0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.75, 0.9, 32]} />
          <meshBasicMaterial color="#4dabf7" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  )
}

// ---------- 会议桌（中央协作区） ----------
function MeetingTable({ metas }) {
  const ref = useRef()
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * 0.15
  })
  const meeting = metas.filter((m) => m.state === 'thinking').slice(0, 3)
  return (
    <group position={[0, 0.05, -1.5]}>
      <mesh ref={ref}>
        <cylinderGeometry args={[1.5, 1.5, 0.12, 32]} />
        <meshStandardMaterial color="#1e2a47" roughness={0.4} metalness={0.3} emissive="#0e1a30" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, -0.07, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.9, 16]} />
        <meshStandardMaterial color="#141c30" />
      </mesh>
      {/* 围着桌子的参会者 */}
      {meeting.map((m, i) => {
        const a = (i / meeting.length) * Math.PI * 2
        return (
          <group key={m.id} position={[Math.cos(a) * 1.35, 0.3, Math.sin(a) * 1.35]}>
            <mesh>
              <boxGeometry args={[0.34, 0.34, 0.34]} />
              <meshStandardMaterial color={m.c} emissive={m.c} emissiveIntensity={0.5} />
            </mesh>
            <Billboard position={[0, 0.4, 0]}>
              <Text fontSize={0.14} color={m.c}>{m.name}</Text>
            </Billboard>
          </group>
        )
      })}
    </group>
  )
}

// ---------- 地板 + 网格 ----------
function Floor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#0c1222" roughness={0.9} />
      </mesh>
      <gridHelper args={[60, 60, '#1e3a5f', '#15233b']} position={[0, -0.49, 0]} />
    </group>
  )
}

// ---------- 相机漫游控制 ----------
function CameraRig() {
  const { camera } = useThree()
  const keys = useRef({})
  useEffect(() => {
    camera.position.set(0, 5.5, 11)
    const down = (e) => {
      keys.current[e.code] = true
      // 点击空白处取消选择
      if (e.target.tagName !== 'CANVAS' && e.type === 'keyup') return
    }
    const up = (e) => { keys.current[e.code] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [camera])
  useFrame((s, dt) => {
    const speed = 6 * dt
    const dir = new THREE.Vector3()
    if (keys.current['KeyW'] || keys.current['ArrowUp']) dir.z -= 1
    if (keys.current['KeyS'] || keys.current['ArrowDown']) dir.z += 1
    if (keys.current['KeyA'] || keys.current['ArrowLeft']) dir.x -= 1
    if (keys.current['KeyD'] || keys.current['ArrowRight']) dir.x += 1
    if (keys.current['Space']) camera.position.y += speed
    if (keys.current['ShiftLeft']) camera.position.y -= speed
    dir.applyEuler(new THREE.Euler(0, camera.rotation.y, 0))
    camera.position.add(dir.multiplyScalar(speed))
    camera.position.y = Math.max(0.6, camera.position.y)
  })
  return null
}

// ---------- 主场景 ----------
function Scene({ store }) {
  const { metas, setState, setSel, sel } = store
  // 剧场式阵列：面朝 -Z 方向（中央大屏在 -Z）
  const ROWS = 3, PER_ROW = Math.ceil(AGENTS.length / ROWS)
  const gapX = 2.6, gapZ = 2.2
  const startX = -((PER_ROW - 1) * gapX) / 2
  const startZ = 1.2
  return (
    <>
      <PerspectiveCamera makeDefault fov={55} position={[0, 5.5, 11]} />
      <CameraRig />
      <OrbitControls target={[0, 1.2, -3]} maxPolarAngle={Math.PI / 2.1} minDistance={4} maxDistance={28} enablePan={false} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 10, 4]} intensity={0.9} color="#cfe0ff" />
      <pointLight position={[0, 6, -7.5]} intensity={1.6} color="#4dabf7" distance={20} />
      <fog attach="fog" args={['#0a0e1a', 14, 38]} />

      <Floor />
      <BigScreen counts={store.counts} />
      <MeetingTable metas={metas} />

      {metas.map((m, i) => {
        const row = Math.floor(i / PER_ROW)
        const col = i % PER_ROW
        const x = startX + col * gapX
        const z = startZ + row * gapZ
        return (
          <AgentDesk
            key={m.id}
            meta={m}
            position={[x, 0, z]}
            selected={sel === m.id}
            onSelect={setSel}
          />
        )
      })}
    </>
  )
}

// ---------- HUD ----------
function HUD({ store }) {
  const { counts, log, sel, metas, setSel, setState, logEvent } = store
  const selMeta = metas.find((m) => m.id === sel)
  return (
    <>
      <div className="hud-top">
        <div className="brand"><div className="dot" /> Agent Pit 3D <small>数字员工监控大厅</small></div>
        <div className="kpi">运行中 <b className="v-g">{counts.running}</b></div>
        <div className="kpi">思考中 <b className="v-y">{counts.thinking}</b></div>
        <div className="kpi">等待审批 <b className="v-r">{counts.blocked}</b></div>
        <div className="kpi">空闲 <b>{counts.idle}</b></div>
        <div className="kpi">Token <b className="v-g">{counts.token.toLocaleString()}</b></div>
        <div className="kpi">成本 <b className="v-y">${(counts.token * 0.000012).toFixed(3)}</b></div>
        <div className="spacer" />
        <div className="toolbar">
          <button id="btn-ws">▶ 事件流</button>
          <button id="btn-fail">⚠ 注入故障</button>
          <button id="btn-reset">↺ 重置</button>
        </div>
        <div className="hint">FPS · R3F</div>
      </div>

      <div className="hud-log">
        <div className="h"><span>◆ EVENT STREAM</span><span id="log-clear">clear</span></div>
        <div className="body">
          {log.map((l, i) => (
            <div key={i} className={'line ' + (l.level || '')}>
              <span className="t">{l.time}</span> {l.msg}
            </div>
          ))}
        </div>
      </div>

      <div className="hud-help">
        <b>WASD</b> 走动 · <b>空格/Shift</b> 升降 · <b>鼠标拖拽</b> 环视 · <b>点击工位</b> 查看详情
      </div>

      {selMeta && (
        <div className="hud-side" style={{ display: 'block' }}>
          <div className="close" onClick={() => setSel(null)}>✕</div>
          <div className="dt">{selMeta.name}</div>
          <div className="ds">{selMeta.role}</div>
          <div className="kv"><span>状态</span>
            <span style={{ color: selMeta.state === 'blocked' ? '#ff5d6c' : selMeta.state === 'running' ? '#3ddc97' : selMeta.state === 'thinking' ? '#ffd166' : '#7d8aa6' }}>
              {selMeta.state === 'running' ? '🟢 运行中' : selMeta.state === 'thinking' ? '🟡 思考中' : selMeta.state === 'blocked' ? '🔴 等待审批' : '⚪ 空闲'}
            </span>
          </div>
          <div className="kv"><span>当前任务</span><span>{selMeta.task}</span></div>
          <div className="kv"><span>耗时</span><span>{((Date.now() - selMeta.since) / 1000 | 0)}s</span></div>
          <div className="kv"><span>Token</span><span>{selMeta.token.toLocaleString()}</span></div>
          <div className="kv"><span>工具调用</span><span>{selMeta.tools}</span></div>
          <div className="acts">
            <button onClick={() => { setState(sel, 'running', { task: '执行人工下发指令…', token: 200 }); logEvent('y', `手动干预：已向 ${selMeta.name} 发送指令`) }}>发送指令</button>
            <button onClick={() => { setState(sel, 'idle', { task: '已取消' }); logEvent('r', `手动干预：已取消 ${selMeta.name} 的任务`) }}>取消任务</button>
          </div>
        </div>
      )}
    </>
  )
}

// ---------- 模拟事件流（真实接入时替换） ----------
function useFakeStream(store) {
  const { metas, setState, logEvent } = store
  const [ws, setWs] = useState(false)
  const timer = useRef(null)
  const successN = useRef(0)
  const failN = useRef(0)

  const tick = useCallback(() => {
    const a = AGENTS[Math.random() * AGENTS.length | 0]
    const r = Math.random()
    let st, task = '', level = '', msg = '', tool = false, token = 0
    if (r < 0.55) { st = 'running'; task = TASKS[Math.random() * TASKS.length | 0]; tool = true; token = 300 + Math.random() * 2200 | 0; level = 'g'; msg = `${a.name} → ${task}` }
    else if (r < 0.8) { st = 'thinking'; level = ''; msg = `${a.name} 正在规划下一步` }
    else if (r < 0.92) { st = 'idle'; msg = `${a.name} 空闲，等待派单` }
    else { st = 'blocked'; task = '需要人工审批'; level = 'r'; msg = `${a.name} ⚠ 请求危险命令审批` }
    setState(a.id, st, { task, tool, token })
    if (msg) logEvent(level, msg)
  }, [setState, logEvent])

  useEffect(() => {
    const btn = document.getElementById('btn-ws')
    const onWs = () => {
      if (timer.current) { clearInterval(timer.current); timer.current = null; btn.textContent = '▶ 事件流'; btn.classList.remove('on'); return }
      btn.textContent = '❚❚ 暂停'; btn.classList.add('on')
      logEvent('b', '[ws] 已连接 gateway，开始接收 agent.state_change')
      tick(); timer.current = setInterval(tick, 1100)
    }
    const onFail = () => {
      const a = AGENTS[Math.random() * AGENTS.length | 0]
      setState(a.id, 'blocked', { task: 'npm ERR! 依赖安装失败' })
      failN.current++; logEvent('r', `${a.name} ✗ 任务失败：依赖解析错误，已重试 2 次`)
    }
    const onReset = () => {
      metas.forEach((m) => { setState(m.id, 'idle'); m.tools = 0; m.token = 0 })
      successN.current = 0; failN.current = 0
      logEvent('b', '已重置全部工位状态')
    }
    const onClear = () => { /* log cleared via state not exposed; no-op */ }
    btn?.addEventListener('click', onWs)
    document.getElementById('btn-fail')?.addEventListener('click', onFail)
    document.getElementById('btn-reset')?.addEventListener('click', onReset)
    document.getElementById('log-clear')?.addEventListener('click', onClear)
    logEvent('b', '大厅已就绪 · 点击 ▶ 事件流 开始模拟，WASD 可第一人称走动')
    return () => {
      btn?.removeEventListener('click', onWs)
      document.getElementById('btn-fail')?.removeEventListener('click', onFail)
      document.getElementById('btn-reset')?.removeEventListener('click', onReset)
    }
  }, [tick, logEvent, setState, metas])

  // 任务完成计数
  useEffect(() => {
    const t = setInterval(() => {
      const r = store.metas.filter((m) => m.state === 'running').length
      if (r > 0 && Math.random() < 0.4) logEvent('g', `任务完成 ✓ 已写入 Kanban`)
    }, 2200)
    return () => clearInterval(t)
  }, [store, logEvent])

  return ws
}

// ---------- App ----------
export default function App() {
  const store = useStore()
  useFakeStream(store)
  return (
    <>
      <Canvas shadows>
        <Scene store={store} />
      </Canvas>
      <HUD store={store} />
      <div className="crosshair"></div>
    </>
  )
}
