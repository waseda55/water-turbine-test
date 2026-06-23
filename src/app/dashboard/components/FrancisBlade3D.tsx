'use client'
// ============================================================
// フランシス水車 ランナーベーン単体 3Dビュー（Three.js）
// v3: コード長・スパン 寸法線ON/OFF追加（デフォルトOFF）
// ============================================================
import { useEffect, useRef, useState } from 'react'
import type { TurbineResults } from '@/types'
import { exportSTL } from '@/lib/stl-exporter'

interface Props { results: TurbineResults }

export function FrancisBlade3D({ results }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const overlayRef    = useRef<HTMLCanvasElement>(null)
  const sceneRef      = useRef<{
    rebuild: (b1: number, b2: number, tc: number, sp: number, wire: boolean) => void
    toggleWire: (v: boolean) => void
  } | null>(null)
  const geoStoreRef   = useRef<object[]>([])
  const camTargetRef  = useRef({ r: 1.4, thetaY: 0.3, thetaX: 0.25 })
  const stateRef      = useRef<{ isDrag: boolean; px: number; py: number } | null>(null)
  const dimVisRef     = useRef(false)
  const dimGroupRef   = useRef<unknown>(null)
  const cameraRef     = useRef<unknown>(null)

  const [exporting,   setExporting]  = useState(false)
  const [activeView,  setActiveView] = useState<'top'|'front'|'side'|null>(null)
  const [dimVisible,  setDimVisible] = useState(false)

  const fd = results.dimensions.francisDetail
  if (!fd) return null

  const [beta1, setBeta1] = useState(Math.round(fd.beta1b))
  const [beta2, setBeta2] = useState(Math.round(fd.beta2b))
  const Ns = results.specificSpeed
  const [tc,   setTc]   = useState(Math.round(Math.max(9, Math.min(18, 18 - (Ns - 100) / 200 * 8))))
  const [span, setSpan] = useState(Math.round(fd.B1 * 1000))
  const [showWire, setShowWire] = useState(false)

  // dimVisible が変わったら ref に反映
  useEffect(() => { dimVisRef.current = dimVisible }, [dimVisible])

  useEffect(() => {
    const container = containerRef.current
    const canvas    = canvasRef.current
    const overlay   = overlayRef.current
    if (!container || !canvas || !overlay) return

    const state = { isDrag: false, px: 0, py: 0 }
    stateRef.current = state

    camTargetRef.current = { r: 1.4, thetaY: 0.3, thetaX: 0.25 }
    const camCur = { r: 1.4, thetaY: 0.3, thetaX: 0.25 }

    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
    script.onload  = () => initScene()
    script.onerror = () => console.error('[FrancisBlade3D] Three.js load failed')
    document.head.appendChild(script)

    let cleanupFn: (() => void) | null = null

    function initScene() {
      if (!container || !canvas || !overlay) return
      const THREE = (window as unknown as { THREE: typeof import('three') }).THREE

      const renderer = new THREE.WebGLRenderer({ canvas: canvas as HTMLCanvasElement, antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x1c1408, 1)

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x1c1408)
      scene.fog = new THREE.FogExp2(0x1c1408, 0.12)

      const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 30)
      cameraRef.current = camera

      const ctx = overlay.getContext('2d')!

      function applyCamera() {
        const { r, thetaY, thetaX } = camCur
        camera.position.set(
          r * Math.cos(thetaX) * Math.sin(thetaY),
          r * Math.sin(thetaX),
          r * Math.cos(thetaX) * Math.cos(thetaY)
        )
        camera.lookAt(0, 0, 0)
      }

      function resize() {
        if (!container || !overlay) return
        const w = container.clientWidth, h = container.clientHeight
        if (!w || !h) return
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        overlay.width  = w
        overlay.height = h
        overlay.style.width  = w + 'px'
        overlay.style.height = h + 'px'
      }
      resize()

      // ライティング
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

      const mBlade = new THREE.MeshPhongMaterial({
        color: 0xf59e0b, specular: 0xffdd88, shininess: 120, side: THREE.DoubleSide
      })
      const mW = new THREE.MeshBasicMaterial({
        color: 0xfcd34d, wireframe: true, transparent: true, opacity: 0.2
      })

      function nacaY(x: number, t: number) {
        if (x <= 0) x = 1e-4
        return (t / 0.2) * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1015 * x * x * x * x)
      }
      function camberAt(x: number, b1r: number, b2r: number) {
        const N = 30, dx = x / N; let yc = 0
        for (let i = 0; i < N; i++) {
          const a = b1r + (b2r - b1r) * dx * i
          const b = b1r + (b2r - b1r) * dx * (i + 1)
          yc += (Math.sin(a) + Math.sin(b)) / 2 * dx
        }
        return yc
      }

      const CHORD = 0.65

      function buildGeo(b1deg: number, b2deg: number, tcPct: number, spanMm: number): import('three').BufferGeometry {
        const spanM = spanMm / 1000
        const b1r = b1deg * Math.PI / 180, b2r = b2deg * Math.PI / 180
        const nC = 30, nS = 20
        let ycMax = 0
        for (let i = 0; i <= 20; i++) { const y = Math.abs(camberAt(i/20,b1r,b2r)); if (y>ycMax) ycMax=y }
        const cScale = ycMax > 0 ? CHORD * 0.15 / ycMax : 0
        const tScale = CHORD * tcPct / 100
        const upper: number[] = [], lower: number[] = []
        for (let js = 0; js <= nS; js++) {
          const sv = js/nS
          const b1l = b1r - sv*0.08, b2l = b2r - sv*0.05
          // ─ ねじれ ─────────────────────────────────────────────
          // スパン方向(Y軸)を中心に、crown(sv=0)→band(sv=1)へ
          // β1b と β2b の差分ぶん断面を回転させる（Francis羽根特有のねじれ）
          const twist = sv * (b1r - b2r) * 0.9
          const cosT = Math.cos(twist), sinT = Math.sin(twist)
          // スパン: Y軸方向（クラウン=上, バンド=下）
          const py = sv * spanM - spanM/2
          for (let ic = 0; ic <= nC; ic++) {
            const x = ic/nC, yc = camberAt(x,b1l,b2l)*cScale, yt = nacaY(x,1.0)*tScale
            const cx = x*CHORD - CHORD/2  // ローカル弦方向
            // Y軸周りにtwist回転: 翼厚方向がZ軸（奥行き）に配置される
            // upper (負圧面): 翼厚 +yt
            upper.push(
               cx * cosT + (yc + yt) * sinT,  // X
               py,                              // Y (スパン=垂直)
              -cx * sinT + (yc + yt) * cosT    // Z
            )
            // lower (圧力面): 翼厚 -yt
            lower.push(
               cx * cosT + (yc - yt) * sinT,
               py,
              -cx * sinT + (yc - yt) * cosT
            )
          }
        }
        const stride=nC+1, nV=(nS+1)*stride, allPos=upper.concat(lower), idx: number[]=[]
        for (let js=0;js<nS;js++) for (let ic=0;ic<nC;ic++){const b=js*stride+ic,n=b+stride;idx.push(b,n,b+1,n,n+1,b+1)}
        for (let js=0;js<nS;js++) for (let ic=0;ic<nC;ic++){const b=nV+js*stride+ic,n=b+stride;idx.push(b,b+1,n,n,b+1,n+1)}
        for (let js=0;js<nS;js++){const u0=js*stride,u1=(js+1)*stride,l0=nV+js*stride,l1=nV+(js+1)*stride;idx.push(u0,l0,u1,l0,l1,u1)}
        for (let js=0;js<nS;js++){const u0=js*stride+nC,u1=(js+1)*stride+nC,l0=nV+js*stride+nC,l1=nV+(js+1)*stride+nC;idx.push(u0,u1,l0,l0,u1,l1)}
        for (let ic=0;ic<nC;ic++) idx.push(ic,ic+1,nV+ic,nV+ic,ic+1,nV+ic+1)
        for (let ic=0;ic<nC;ic++){const u0=nS*stride+ic,u1=nS*stride+ic+1,l0=nV+nS*stride+ic,l1=nV+nS*stride+ic+1;idx.push(u0,l0,u1,l0,l1,u1)}
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3))
        geo.setIndex(idx); geo.computeVertexNormals()
        return geo
      }

      const bladeGroup = new THREE.Group(); scene.add(bladeGroup)
      const arrowGroup = new THREE.Group(); scene.add(arrowGroup)

      function updateArrows(b1deg: number, b2deg: number) {
        while (arrowGroup.children.length) arrowGroup.remove(arrowGroup.children[0])
        const b1r=b1deg*Math.PI/180, b2r=b2deg*Math.PI/180, sc=0.32
        // スパンがY軸になったので矢印はXZ平面内（Y成分を使わずZ成分で角度を表現）
        const lePos=new THREE.Vector3(-CHORD/2, 0, 0)
        const tePos=new THREE.Vector3( CHORD/2, 0, 0)
        // 入口相対速度 w1（前縁、XZ平面内でβ1b方向）
        arrowGroup.add(new THREE.ArrowHelper(new THREE.Vector3(Math.cos(b1r),0,Math.sin(b1r)),lePos,sc,0x60a5fa,sc*0.22,sc*0.14))
        // 周速 u1（水平X方向）
        arrowGroup.add(new THREE.ArrowHelper(new THREE.Vector3(1,0,0),lePos,sc*0.7,0x34d399,sc*0.22,sc*0.14))
        // 出口相対速度 w2（後縁）
        arrowGroup.add(new THREE.ArrowHelper(new THREE.Vector3(Math.cos(b2r),0,Math.sin(b2r)),tePos,sc,0xc084fc,sc*0.22,sc*0.14))
      }

      // ── 寸法線グループ（デフォルトOFF）──
      const dimGroup = new THREE.Group()
      dimGroup.visible = false
      scene.add(dimGroup)
      dimGroupRef.current = dimGroup

      type DimDef = { p1: import('three').Vector3; p2: import('three').Vector3; label: string; lpos: import('three').Vector3; color: string }
      let dimDefs: DimDef[] = []

      function buildDimLines(spanMm: number) {
        // 既存の寸法線を削除
        while (dimGroup.children.length) dimGroup.remove(dimGroup.children[0])
        dimDefs = []
        const spanM = spanMm / 1000
        const yOff = 0.06  // ブレード上方にオフセット

        // コード長（X方向、前縁〜後縁）
        dimDefs.push({
          p1:    new THREE.Vector3(-CHORD/2, yOff, -spanM/2),
          p2:    new THREE.Vector3( CHORD/2, yOff, -spanM/2),
          label: `コード ${Math.round(CHORD*1000)}mm`,
          lpos:  new THREE.Vector3(0, yOff+0.04, -spanM/2),
          color: '#ffff44',
        })
        // スパン（Z方向）
        dimDefs.push({
          p1:    new THREE.Vector3(-CHORD/2-0.06, yOff, -spanM/2),
          p2:    new THREE.Vector3(-CHORD/2-0.06, yOff,  spanM/2),
          label: `スパン ${spanMm}mm`,
          lpos:  new THREE.Vector3(-CHORD/2-0.14, yOff, 0),
          color: '#44ffff',
        })

        dimDefs.forEach(d => {
          const mat = new THREE.LineBasicMaterial({ color: d.color, depthTest: false })
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([d.p1, d.p2]), mat)
          line.renderOrder = 999; dimGroup.add(line)
          // 端点ティック
          ;[d.p1, d.p2].forEach(p => {
            const dir = new THREE.Vector3().subVectors(d.p2, d.p1).normalize()
            const perp = Math.abs(dir.z) > 0.9
              ? new THREE.Vector3(1,0,0)
              : Math.abs(dir.x) > 0.9
                ? new THREE.Vector3(0,0,1)
                : new THREE.Vector3(1,0,0)
            const half = perp.clone().multiplyScalar(0.015)
            const tl = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints([p.clone().sub(half), p.clone().add(half)]), mat)
            tl.renderOrder = 999; dimGroup.add(tl)
          })
        })
      }

      function toScreen(v3: import('three').Vector3) {
        const v = v3.clone().project(camera)
        const w = overlay?.width ?? 0, h = overlay?.height ?? 0
        return { x: (v.x+1)/2*w, y: (-v.y+1)/2*h }
      }
      function drawLabels() {
        if (!overlay) return
        ctx.clearRect(0, 0, overlay.width, overlay.height)
        if (!dimVisRef.current) return
        dimDefs.forEach(d => {
          const s = toScreen(d.lpos)
          ctx.font = 'bold 12px monospace'
          const tw = ctx.measureText(d.label).width
          ctx.fillStyle = 'rgba(10,8,4,0.75)'
          ctx.fillRect(s.x-tw/2-4, s.y-12, tw+8, 17)
          ctx.fillStyle = d.color
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(d.label, s.x, s.y)
        })
      }

      function rebuild(b1: number, b2: number, tcV: number, spV: number, wire: boolean) {
        while (bladeGroup.children.length) {
          const m = bladeGroup.children[0] as import('three').Mesh
          m.geometry?.dispose(); bladeGroup.remove(m)
        }
        const geo = buildGeo(b1, b2, tcV, spV)
        geoStoreRef.current = [geo]
        const bladeMesh = new THREE.Mesh(geo, mBlade); bladeGroup.add(bladeMesh)
        const wireMesh = new THREE.Mesh(geo, mW)
        wireMesh.visible = wire; wireMesh.name = 'wire'; bladeGroup.add(wireMesh)
        updateArrows(b1, b2)
        buildDimLines(spV)
      }

      sceneRef.current = {
        rebuild,
        toggleWire: (v: boolean) => {
          const wm = bladeGroup.getObjectByName('wire') as import('three').Mesh
          if (wm) wm.visible = v
        },
      }

      rebuild(beta1, beta2, tc, span, showWire)

      // マウス操作
      const onMouseDown = (e: MouseEvent) => { state.isDrag=true; state.px=e.clientX; state.py=e.clientY }
      const onMouseUp   = () => { state.isDrag=false }
      const onMouseMove = (e: MouseEvent) => {
        if (!state.isDrag) return
        camTargetRef.current.thetaY += (e.clientX-state.px)*0.009
        camTargetRef.current.thetaX = Math.max(-1.4, Math.min(1.4,
          camTargetRef.current.thetaX - (e.clientY-state.py)*0.007))
        state.px=e.clientX; state.py=e.clientY
      }
      const onWheel = (e: WheelEvent) => {
        camTargetRef.current.r = Math.max(0.3, Math.min(6,
          camTargetRef.current.r * (1+e.deltaY*0.001)))
        e.preventDefault()
      }
      canvas.addEventListener('mousedown', onMouseDown)
      window.addEventListener('mouseup',   onMouseUp)
      canvas.addEventListener('mousemove', onMouseMove)
      canvas.addEventListener('wheel',     onWheel, { passive: false })

      let animId = 0
      function animate() {
        animId = requestAnimationFrame(animate)
        resize()
        camCur.r      += (camTargetRef.current.r      - camCur.r)      * 0.08
        camCur.thetaY += (camTargetRef.current.thetaY - camCur.thetaY) * 0.08
        camCur.thetaX += (camTargetRef.current.thetaX - camCur.thetaX) * 0.08
        applyCamera()
        bladeGroup.rotation.set(0,0,0); arrowGroup.rotation.set(0,0,0)
        dimGroup.visible = dimVisRef.current
        renderer.render(scene, camera)
        drawLabels()
      }
      animate()

      cleanupFn = () => {
        cancelAnimationFrame(animId)
        canvas.removeEventListener('mousedown', onMouseDown)
        window.removeEventListener('mouseup',   onMouseUp)
        canvas.removeEventListener('mousemove', onMouseMove)
        canvas.removeEventListener('wheel',     onWheel)
        renderer.dispose()
      }
    }

    return () => { cleanupFn?.(); script.remove() }
  }, [])

  useEffect(() => {
    sceneRef.current?.rebuild(beta1, beta2, tc, span, showWire)
  }, [beta1, beta2, tc, span])

  useEffect(() => {
    sceneRef.current?.toggleWire(showWire)
  }, [showWire])

  const handleSetView = (v: 'top'|'front'|'side') => {
    setActiveView(v)
    const t = camTargetRef.current
    if (v==='top')   { t.thetaX= 1.4;  t.thetaY=0;              t.r=1.4 }
    if (v==='front') { t.thetaX= 0.05; t.thetaY=0;              t.r=1.5 }
    if (v==='side')  { t.thetaX= 0.1;  t.thetaY=Math.PI/2;      t.r=1.5 }
  }

  const handleExportSTL = async () => {
    if (!geoStoreRef.current.length) return
    setExporting(true)
    await exportSTL(geoStoreRef.current, `francis_blade_b1-${beta1}_b2-${beta2}_tc${tc}_span${span}mm.stl`)
    setExporting(false)
  }

  const btnBase: React.CSSProperties = {
    fontSize:10, fontFamily:'monospace',
    background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.6)',
    color:'var(--accent)', padding:'4px 10px', cursor:'pointer', borderRadius:3,
    transition:'background 0.15s',
  }
  const btnActive: React.CSSProperties = {
    ...btnBase, background:'rgba(245,158,11,0.4)', color:'#fff', borderColor:'var(--accent)',
  }

  return (
    <div>
      <div
        ref={containerRef}
        style={{ width:'100%', aspectRatio:'16/10', maxHeight:440, position:'relative', borderRadius:6, overflow:'hidden', background:'#1c1408' }}
      >
        <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }} />
        <canvas ref={overlayRef} style={{ position:'absolute', top:0, left:0, pointerEvents:'none' }} />

        {/* 左上: タイトル */}
        <div style={{ position:'absolute', top:10, left:12, fontFamily:'monospace', fontSize:11, color:'var(--accent)', lineHeight:1.8, pointerEvents:'none' }}>
          ランナーベーン単体 3Dビュー<br/>
          <span style={{ fontSize:10, color:'var(--muted)' }}>ドラッグ: 回転　スクロール: ズーム</span>
        </div>

        {/* 右上: パラメータパネル */}
        <div style={{ position:'absolute', top:10, right:12, background:'rgba(10,8,4,0.75)', border:'1px solid rgba(245,158,11,0.35)', borderRadius:7, padding:'8px 13px 9px', fontFamily:'monospace', minWidth:200 }}>
          <div style={{ fontSize:10, color:'var(--accent)', letterSpacing:'0.07em', borderBottom:'1px solid rgba(245,158,11,0.25)', paddingBottom:5, marginBottom:5 }}>
            パラメータ
          </div>
          {([
            ['β1b', beta1, setBeta1, 30,  85,  '°'  ],
            ['β2b', beta2, setBeta2, 10,  50,  '°'  ],
            ['t/c', tc,    setTc,    8,   20,  '%'  ],
            ['スパン', span, setSpan, 100, 600, 'mm' ],
          ] as [string, number, (v:number)=>void, number, number, string][]).map(([label, val, setter, min, max, unit]) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:12 }}>
              <span style={{ color:'#a8a29e', fontSize:11, minWidth:36 }}>{label}</span>
              <input type="range" min={min} max={max} value={val}
                onChange={e => setter(+e.target.value)}
                style={{ width:70, accentColor:'var(--accent)', flexShrink:0 }} />
              <span style={{ color:'#fff', fontWeight:'bold', minWidth:36, textAlign:'right' }}>
                {val}<span style={{ color:'#78716c', fontSize:10, marginLeft:1 }}>{unit}</span>
              </span>
            </div>
          ))}
        </div>

        {/* 下部ボタン群 */}
        <div style={{ position:'absolute', bottom:10, left:12, display:'flex', gap:6, flexWrap:'wrap' }}>
          <button style={showWire ? btnActive : btnBase} onClick={() => setShowWire(v=>!v)}>ワイヤー</button>
          <button style={dimVisible ? btnActive : btnBase} onClick={() => setDimVisible(v=>!v)}>
            寸法線 {dimVisible ? 'OFF' : 'ON'}
          </button>
          {(['top','front','side'] as const).map(v => (
            <button key={v} style={activeView===v ? btnActive : btnBase} onClick={() => handleSetView(v)}>
              {{ top:'上面図', front:'正面図', side:'側面図' }[v]}
            </button>
          ))}
          <button onClick={handleExportSTL} disabled={exporting}
            style={{ ...btnBase, ...(exporting ? { background:'rgba(245,158,11,0.08)', color:'var(--muted)', cursor:'not-allowed' } : {}) }}>
            {exporting ? 'エクスポート中...' : '⬇ STL'}
          </button>
        </div>

        {/* 右下: 速度凡例 */}
        <div style={{ position:'absolute', bottom:10, right:12, fontFamily:'monospace', fontSize:10, color:'var(--muted)', textAlign:'right', lineHeight:1.9, pointerEvents:'none' }}>
          <span style={{ color:'#60a5fa' }}>■</span> w1 入口相対速度<br/>
          <span style={{ color:'#34d399' }}>■</span> u1 周速<br/>
          <span style={{ color:'#c084fc' }}>■</span> w2 出口相対速度
        </div>
      </div>
    </div>
  )
}
