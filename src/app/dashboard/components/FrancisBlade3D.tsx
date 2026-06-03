'use client'
// ============================================================
// フランシス水車 ランナーベーン単体 3Dビュー（Three.js）
// 修正版: 立体的な翼型表示
//   - 前縁・後縁・スパン端キャップを追加し閉じた翼型に
//   - computeVertexNormals() で正しい法線を自動計算
//   - カメラを斜め前方に配置し翼厚が見えるように
//   - 多方向ライティングで立体感を強調
//   - Three.js を動的ロードして黒画面問題を解消
// ============================================================
import { useEffect, useRef, useState } from 'react'
import type { TurbineResults } from '@/types'
import { exportSTL } from '@/lib/stl-exporter'

interface Props { results: TurbineResults }

export function FrancisBlade3D({ results }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const sceneRef     = useRef<{
    rebuild: (b1: number, b2: number, tc: number, sp: number, wire: boolean) => void
    toggleWire: (v: boolean) => void
  } | null>(null)
  const geoStoreRef = useRef<object[]>([])
  const [exporting, setExporting] = useState(false)

  const fd = results.dimensions.francisDetail
  if (!fd) return null

  const [beta1, setBeta1] = useState(Math.round(fd.beta1b))
  const [beta2, setBeta2] = useState(Math.round(fd.beta2b))
  const Ns = results.specificSpeed
  const [tc,   setTc]   = useState(Math.round(Math.max(9, Math.min(18, 18 - (Ns - 100) / 200 * 8))))
  const [span, setSpan] = useState(Math.round(fd.B1 * 1000))
  const [showWire, setShowWire] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    const canvas    = canvasRef.current
    if (!container || !canvas) return

    // ── Three.js 動的ロード ──
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
    script.onload = () => initScene()
    script.onerror = () => console.error('[FrancisBlade3D] Three.js load failed')
    document.head.appendChild(script)

    let cleanupFn: (() => void) | null = null

    function initScene() {
      if (!container || !canvas) return
      const THREE = (window as unknown as { THREE: typeof import('three') }).THREE

      // ── レンダラー・シーン・カメラ ──
      const renderer = new THREE.WebGLRenderer({ canvas: canvas as HTMLCanvasElement, antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x1c1408)
      scene.fog = new THREE.FogExp2(0x1c1408, 0.12)

      // 斜め前方からのカメラ（翼厚が見えるように）
      const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 30)
      camera.position.set(0.7, 0.45, 1.1)
      camera.lookAt(0, 0, 0)

      function resize() {
        if (!container) return
        const w = container.clientWidth, h = container.clientHeight
        if (!w || !h) return
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
      resize()

      // ── 多方向ライティング（立体感を強調）──
      scene.add(new THREE.AmbientLight(0xfff8ed, 0.35))
      const key = new THREE.DirectionalLight(0xfef3c7, 1.6)
      key.position.set(2, 3, 3); scene.add(key)
      const fill = new THREE.DirectionalLight(0xf59e0b, 0.7)
      fill.position.set(-2, 1, -1); scene.add(fill)
      const back = new THREE.DirectionalLight(0xffffff, 0.3)
      back.position.set(0, -2, -2); scene.add(back)
      const rim = new THREE.PointLight(0xffeedd, 1.0, 8)
      rim.position.set(-1.5, 2, -1); scene.add(rim)
      scene.add(new THREE.GridHelper(4, 24, 0x7a5220, 0x2a1f0e))

      // ── マテリアル ──
      const mBlade = new THREE.MeshPhongMaterial({
        color: 0xf59e0b, specular: 0xffdd88, shininess: 120, side: THREE.DoubleSide
      })
      const mW = new THREE.MeshBasicMaterial({
        color: 0xfcd34d, wireframe: true, transparent: true, opacity: 0.2
      })

      // ── NACA翼厚分布 ──
      function nacaY(x: number, t: number) {
        if (x <= 0) x = 1e-4
        return (t / 0.2) * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1015 * x * x * x * x)
      }

      // ── キャンバー（sin積分） ──
      function camberAt(x: number, b1r: number, b2r: number) {
        const N = 30, dx = x / N; let yc = 0
        for (let i = 0; i < N; i++) {
          const a = b1r + (b2r - b1r) * dx * i
          const b = b1r + (b2r - b1r) * dx * (i + 1)
          yc += (Math.sin(a) + Math.sin(b)) / 2 * dx
        }
        return yc
      }

      // ── ジオメトリ生成（閉じた翼型・正確な法線） ──
      function buildGeo(b1deg: number, b2deg: number, tcPct: number, spanMm: number): import('three').BufferGeometry {
        const chord = 0.65
        const spanM = spanMm / 1000
        const b1r = b1deg * Math.PI / 180
        const b2r = b2deg * Math.PI / 180
        const nC = 30, nS = 20
        const thickRatio = tcPct / 100

        // キャンバースケール
        let ycMax = 0
        for (let i = 0; i <= 20; i++) {
          const y = Math.abs(camberAt(i / 20, b1r, b2r))
          if (y > ycMax) ycMax = y
        }
        const cScale = ycMax > 0 ? chord * 0.15 / ycMax : 0
        const tScale = chord * thickRatio

        const upper: number[] = [], lower: number[] = []

        for (let js = 0; js <= nS; js++) {
          const sv = js / nS
          const b1l = b1r - sv * 0.08, b2l = b2r - sv * 0.05
          for (let ic = 0; ic <= nC; ic++) {
            const x = ic / nC
            const yc = camberAt(x, b1l, b2l) * cScale
            const yt = nacaY(x, 1.0) * tScale
            const px = x * chord - chord / 2
            const pz = sv * spanM - spanM / 2
            upper.push(px, yc + yt, pz)
            lower.push(px, yc - yt, pz)
          }
        }

        const stride = nC + 1
        const nV = (nS + 1) * stride
        const allPos = upper.concat(lower)
        const idx: number[] = []

        // 上面ポリゴン
        for (let js = 0; js < nS; js++) {
          for (let ic = 0; ic < nC; ic++) {
            const b = js * stride + ic, n = b + stride
            idx.push(b, n, b + 1, n, n + 1, b + 1)
          }
        }
        // 下面ポリゴン（法線反転）
        for (let js = 0; js < nS; js++) {
          for (let ic = 0; ic < nC; ic++) {
            const b = nV + js * stride + ic, n = b + stride
            idx.push(b, b + 1, n, n, b + 1, n + 1)
          }
        }
        // 前縁キャップ（ic=0）
        for (let js = 0; js < nS; js++) {
          const u0 = js * stride, u1 = (js + 1) * stride
          const l0 = nV + js * stride, l1 = nV + (js + 1) * stride
          idx.push(u0, l0, u1, l0, l1, u1)
        }
        // 後縁キャップ（ic=nC）
        for (let js = 0; js < nS; js++) {
          const u0 = js * stride + nC, u1 = (js + 1) * stride + nC
          const l0 = nV + js * stride + nC, l1 = nV + (js + 1) * stride + nC
          idx.push(u0, u1, l0, l0, u1, l1)
        }
        // スパン端キャップ（js=0）
        for (let ic = 0; ic < nC; ic++) {
          idx.push(ic, ic + 1, nV + ic, nV + ic, ic + 1, nV + ic + 1)
        }
        // スパン端キャップ（js=nS）
        for (let ic = 0; ic < nC; ic++) {
          const u0 = nS * stride + ic, u1 = nS * stride + ic + 1
          const l0 = nV + nS * stride + ic, l1 = nV + nS * stride + ic + 1
          idx.push(u0, l0, u1, l0, l1, u1)
        }

        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3))
        geo.setIndex(idx)
        geo.computeVertexNormals()  // 正確な法線を自動計算
        return geo
      }

      // ── ブレード・矢印グループ ──
      const bladeGroup = new THREE.Group()
      scene.add(bladeGroup)
      const arrowGroup = new THREE.Group(); scene.add(arrowGroup)

      function updateArrows(b1deg: number, b2deg: number) {
        while (arrowGroup.children.length) arrowGroup.remove(arrowGroup.children[0])
        const b1r = b1deg * Math.PI / 180, b2r = b2deg * Math.PI / 180
        const sc = 0.32
        const le = new THREE.Vector3(-0.65 / 2, 0, 0)
        const te = new THREE.Vector3(0.65 / 2, 0, 0)
        arrowGroup.add(new THREE.ArrowHelper(
          new THREE.Vector3(Math.cos(b1r), Math.sin(b1r), 0), le, sc, 0x60a5fa, sc * 0.22, sc * 0.14))
        arrowGroup.add(new THREE.ArrowHelper(
          new THREE.Vector3(1, 0, 0), le, sc * 0.7, 0x34d399, sc * 0.22, sc * 0.14))
        arrowGroup.add(new THREE.ArrowHelper(
          new THREE.Vector3(Math.cos(b2r), Math.sin(b2r), 0), te, sc, 0xc084fc, sc * 0.22, sc * 0.14))
      }

      function rebuild(b1: number, b2: number, tcV: number, spV: number, wire: boolean) {
        while (bladeGroup.children.length) {
          const m = bladeGroup.children[0] as import('three').Mesh
          m.geometry?.dispose()
          bladeGroup.remove(m)
        }
        const geo = buildGeo(b1, b2, tcV, spV)
        geoStoreRef.current = [geo]
        const bladeMesh = new THREE.Mesh(geo, mBlade)
        bladeGroup.add(bladeMesh)
        const wireMesh = new THREE.Mesh(geo, mW)
        wireMesh.visible = wire
        wireMesh.name = 'wire'
        bladeGroup.add(wireMesh)
        updateArrows(b1, b2)
      }

      sceneRef.current = {
        rebuild,
        toggleWire: (v: boolean) => {
          const wm = bladeGroup.getObjectByName('wire') as import('three').Mesh
          if (wm) wm.visible = v
        },
      }

      rebuild(beta1, beta2, tc, span, showWire)

      // ── マウス操作 ──
      let rotY = 0.3, rotX = 0.25, isDrag = false, mpx = 0, mpy = 0
      const md = (e: MouseEvent) => { isDrag = true; mpx = e.clientX; mpy = e.clientY }
      const mu = () => { isDrag = false }
      const mm = (e: MouseEvent) => {
        if (!isDrag) return
        rotY += (e.clientX - mpx) * 0.009
        rotX += (e.clientY - mpy) * 0.007
        rotX = Math.max(-1.4, Math.min(1.4, rotX))
        mpx = e.clientX; mpy = e.clientY
      }
      const mw = (e: WheelEvent) => {
        camera.position.multiplyScalar(1 + e.deltaY * 0.001)
        camera.position.clampLength(0.3, 6)
        e.preventDefault()
      }
      canvas.addEventListener('mousedown', md)
      window.addEventListener('mouseup', mu)
      canvas.addEventListener('mousemove', mm)
      canvas.addEventListener('wheel', mw, { passive: false })

      // ── アニメーション ──
      let animId = 0
      function animate() {
        animId = requestAnimationFrame(animate)
        resize()
        bladeGroup.rotation.y = rotY; bladeGroup.rotation.x = rotX
        arrowGroup.rotation.y = rotY; arrowGroup.rotation.x = rotX
        renderer.render(scene, camera)
      }
      animate()

      cleanupFn = () => {
        cancelAnimationFrame(animId)
        canvas.removeEventListener('mousedown', md)
        window.removeEventListener('mouseup', mu)
        canvas.removeEventListener('mousemove', mm)
        canvas.removeEventListener('wheel', mw)
        renderer.dispose()
      }
    }

    return () => {
      cleanupFn?.()
      script.remove()
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.rebuild(beta1, beta2, tc, span, showWire)
  }, [beta1, beta2, tc, span])

  useEffect(() => {
    sceneRef.current?.toggleWire(showWire)
  }, [showWire])

  const handleExportSTL = async () => {
    if (!geoStoreRef.current.length) return
    setExporting(true)
    await exportSTL(geoStoreRef.current, `francis_blade_b1-${beta1}_b2-${beta2}_tc${tc}_span${span}mm.stl`)
    setExporting(false)
  }

  return (
    <div>
      <div ref={containerRef} style={{ width: '100%', aspectRatio: '16/10', maxHeight: 440, position: 'relative', borderRadius: 6, overflow: 'hidden', background: '#1c1408' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        <div style={{ position: 'absolute', top: 10, left: 12, fontFamily: 'monospace', fontSize: 11, color: 'var(--accent)', lineHeight: 1.8, pointerEvents: 'none' }}>
          ランナーベーン単体 3Dビュー<br/>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>ドラッグ: 回転　スクロール: ズーム</span>
        </div>
        <div style={{ position: 'absolute', top: 10, right: 12, fontFamily: 'monospace', fontSize: 10, color: 'var(--muted)', textAlign: 'right', lineHeight: 2.2, background: 'rgba(26,18,6,0.82)', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)' }}>
          {([
            ['β1b', beta1, setBeta1, 30, 85, '°'],
            ['β2b', beta2, setBeta2, 10, 50, '°'],
            ['t/c', tc,   setTc,    8,  20, '%'],
            ['スパン', span, setSpan, 100, 600, 'mm'],
          ] as [string, number, (v: number) => void, number, number, string][]).map(([label, val, setter, min, max, unit]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <span style={{ minWidth: 36 }}>{label}</span>
              <input type="range" min={min} max={max} value={val}
                onChange={e => setter(+e.target.value)}
                style={{ width: 72, accentColor: 'var(--accent)' }}/>
              <span style={{ minWidth: 30, color: 'var(--accent)' }}>{val}{unit}</span>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', bottom: 10, left: 12, display: 'flex', gap: 8 }}>
          <button onClick={() => setShowWire(v => !v)}
            style={{ fontSize: 10, fontFamily: 'monospace', background: showWire ? 'rgba(245,158,11,0.2)' : 'rgba(180,83,9,0.1)', border: `1px solid ${showWire ? 'var(--accent)' : 'var(--border)'}`, color: showWire ? 'var(--accent)' : 'var(--muted)', padding: '3px 10px', cursor: 'pointer', borderRadius: 3 }}>
            ワイヤー
          </button>
          <button onClick={handleExportSTL} disabled={exporting}
            style={{ fontSize: 10, fontFamily: 'monospace', background: exporting ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.18)', border: '1px solid var(--accent)', color: exporting ? 'var(--muted)' : 'var(--accent)', padding: '3px 12px', cursor: exporting ? 'not-allowed' : 'pointer', borderRadius: 3 }}>
            {exporting ? 'エクスポート中...' : '⬇ STL'}
          </button>
        </div>
        <div style={{ position: 'absolute', bottom: 10, right: 12, fontFamily: 'monospace', fontSize: 10, color: 'var(--muted)', textAlign: 'right', lineHeight: 1.9, pointerEvents: 'none' }}>
          <span style={{ color: '#60a5fa' }}>■</span> w1 入口相対速度<br/>
          <span style={{ color: '#34d399' }}>■</span> u1 周速<br/>
          <span style={{ color: '#c084fc' }}>■</span> w2 出口相対速度
        </div>
      </div>
    </div>
  )
}
