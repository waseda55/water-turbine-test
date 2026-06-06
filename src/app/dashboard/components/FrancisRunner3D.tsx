'use client'
// ============================================================
// フランシス水車 ランナー全体 3Dビュー（Three.js）
// v8: 寸法線ON/OFF（デフォルトOFF）+ 視点切替ボタン追加
//   - 右上寸法パネルを見やすいデザインに改良
//   - 寸法線（D1/D2/D5/D6/H）を3D上に引出線+2Dラベルで表示
//   - 上面図・正面図・等角図ボタン（スムーズ補間）
//   - STLダウンロード機能は既存のまま維持
// ============================================================
import { useEffect, useRef, useState } from 'react'
import type { TurbineResults } from '@/types'
import { exportSTL } from '@/lib/stl-exporter'

interface Props {
  results: TurbineResults
}

export function FrancisRunner3D({ results }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const overlayRef    = useRef<HTMLCanvasElement>(null)
  const geoStoreRef   = useRef<object[]>([])
  const [exporting, setExporting]   = useState(false)
  const [dimVisible, setDimVisible] = useState(false)
  const [activeView, setActiveView] = useState<'top'|'front'|'iso'|null>(null)

  // カメラターゲットを外から操作するためのref
  const camTargetRef = useRef({ r: 0, thetaY: Math.PI / 4, thetaX: 0.4 })
  const dimVisRef    = useRef(false)

  const stateRef = useRef<{
    animId: number
    autoRot: boolean
    isDrag: boolean
    px: number; py: number
  } | null>(null)

  const fd = results.dimensions.francisDetail
  if (!fd) return null

  const D1    = fd.D1
  const D5    = fd.D5
  const D6    = fd.D6
  const D2    = fd.D2
  const D7    = fd.D7
  const B1    = fd.B1
  const H2    = fd.H2
  const beta1 = fd.beta1b
  const beta2 = fd.beta2b
  const t1    = fd.t1
  const t2    = fd.t2
  const Ns    = results.specificSpeed
  const nBlades = fd.Zr

  // dimVisible が変わったら ref にも反映
  useEffect(() => { dimVisRef.current = dimVisible }, [dimVisible])

  useEffect(() => {
    const container = containerRef.current
    const canvas    = canvasRef.current
    const overlay   = overlayRef.current
    if (!container || !canvas || !overlay) return

    const state = { animId: 0, autoRot: true, isDrag: false, px: 0, py: 0 }
    stateRef.current = state

    camTargetRef.current = { r: D1 * 2.4, thetaY: Math.PI / 4, thetaX: 0.4 }
    const camCur = { r: D1 * 2.4, thetaY: Math.PI / 4, thetaX: 0.4 }

    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
    script.onload  = () => initScene()
    script.onerror = () => console.error('[FrancisRunner3D] Three.js load failed')
    document.head.appendChild(script)

    let cleanupFn: (() => void) | null = null

    function initScene() {
      if (!container || !canvas || !overlay) return
      const THREE = (window as unknown as { THREE: typeof import('three') }).THREE

      // ── レンダラー ──
      const renderer = new THREE.WebGLRenderer({ canvas: canvas as HTMLCanvasElement, antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = true
      renderer.setClearColor(0x1c1408, 1)

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x1c1408)
      scene.fog = new THREE.Fog(0x1c1408, 5, 14)

      const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 50)

      // オーバーレイ（2D寸法ラベル用）
      const ctx = overlay.getContext('2d')!

      function resize() {
        if (!container || !overlay) return
        const w = container.clientWidth, h = container.clientHeight
        if (w === 0 || h === 0) return
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        overlay.width  = w
        overlay.height = h
        overlay.style.width  = w + 'px'
        overlay.style.height = h + 'px'
      }

      function applyCamera() {
        const { r, thetaY, thetaX } = camCur
        camera.position.set(
          r * Math.cos(thetaX) * Math.sin(thetaY),
          r * Math.sin(thetaX) + H2 * 0.5,
          r * Math.cos(thetaX) * Math.cos(thetaY)
        )
        camera.lookAt(0, H2 * 0.5, 0)
      }

      // ── ライティング ──
      scene.add(new THREE.AmbientLight(0xfff8ed, 0.45))
      const key = new THREE.DirectionalLight(0xfef3c7, 1.4)
      key.position.set(D1*3, D1*5, D1*3); key.castShadow = true; scene.add(key)
      const fill = new THREE.DirectionalLight(0xf59e0b, 0.5)
      fill.position.set(-D1*3, -D1*2, -D1*3); scene.add(fill)
      const back = new THREE.DirectionalLight(0xffffff, 0.25)
      back.position.set(0, -D1*3, 0); scene.add(back)
      const rim = new THREE.PointLight(0xfcd34d, 0.8, D1*10)
      rim.position.set(-D1*2, D1*2, -D1*2); scene.add(rim)

      const grid = new THREE.GridHelper(D1*4, 20, 0x7a5220, 0x2a1f0e)
      grid.position.y = -D1*0.2; scene.add(grid)

      // ── マテリアル ──
      const matCrown = new THREE.MeshPhongMaterial({ color:0xb45309, specular:0xffcc66, shininess:60,  side:THREE.DoubleSide, transparent:true, opacity:0.92 })
      const matBand  = new THREE.MeshPhongMaterial({ color:0x92400e, specular:0xffaa44, shininess:40,  side:THREE.DoubleSide, transparent:true, opacity:0.85 })
      const matBlade = new THREE.MeshPhongMaterial({ color:0xf59e0b, specular:0xffdd88, shininess:120, side:THREE.DoubleSide })
      const matBoss  = new THREE.MeshPhongMaterial({ color:0x78350f, specular:0xaa6622, shininess:30 })
      const matShaft = new THREE.MeshPhongMaterial({ color:0x44403c, shininess:20 })

      const runner = new THREE.Group(); scene.add(runner)

      // ── クラウン（Lathe） ──
      const crownPts: import('three').Vector2[] = []
      for (let i = 0; i <= 48; i++) {
        const t = i/48, mt = 1-t
        const r1 = D1/2, r6 = D6/2
        const cp1r = r1*0.5, cp1y = H2*0.15, cp2r = r6+(r1-r6)*0.2, cp2y = H2*0.85
        crownPts.push(new THREE.Vector2(
          mt*mt*mt*r1 + 3*mt*mt*t*cp1r + 3*mt*t*t*cp2r + t*t*t*r6,
          mt*mt*mt*0  + 3*mt*mt*t*cp1y + 3*mt*t*t*cp2y + t*t*t*H2
        ))
      }
      const crownGeo = new THREE.LatheGeometry(crownPts, 64)
      runner.add(new THREE.Mesh(crownGeo, matCrown))

      // ── バンド（Lathe） ──
      const bandPts: import('three').Vector2[] = []
      for (let i = 0; i <= 48; i++) {
        const t = i/48, mt = 1-t
        const r5 = D5/2, r2 = D2/2, y0 = B1
        const cp1r = r5*1.02, cp1y = y0+H2*0.1, cp2r = r2-(r2-r5)*0.15, cp2y = y0+H2*0.85
        bandPts.push(new THREE.Vector2(
          mt*mt*mt*r5 + 3*mt*mt*t*cp1r + 3*mt*t*t*cp2r + t*t*t*r2,
          mt*mt*mt*y0 + 3*mt*mt*t*cp1y + 3*mt*t*t*cp2y + t*t*t*(y0+H2*0.85)
        ))
      }
      const bandGeo = new THREE.LatheGeometry(bandPts, 64)
      runner.add(new THREE.Mesh(bandGeo, matBand))

      // ── ボス・軸 ──
      const bossGeo = new THREE.CylinderGeometry(D7/2, D7/2, H2*0.3, 32)
      const bossMesh = new THREE.Mesh(bossGeo, matBoss)
      bossMesh.position.y = H2 + H2*0.15; runner.add(bossMesh)
      const shaftGeo = new THREE.CylinderGeometry(D7*0.15, D7*0.15, H2*3, 16)
      const shaftMesh = new THREE.Mesh(shaftGeo, matShaft)
      shaftMesh.position.y = H2*0.8; runner.add(shaftMesh)

      // ── ブレード生成 ──
      const b1r = beta1*Math.PI/180, b2r = beta2*Math.PI/180
      const nC = 24, nS = 16

      function makeBezierPts(p0r:number,p0y:number,p1r:number,p1y:number,p2r:number,p2y:number,p3r:number,p3y:number,N:number) {
        const pts: {x:number;y:number}[] = []
        for (let i=0;i<=N;i++) {
          const t=i/N,mt=1-t
          pts.push({ x:mt*mt*mt*p0r+3*mt*mt*t*p1r+3*mt*t*t*p2r+t*t*t*p3r, y:mt*mt*mt*p0y+3*mt*mt*t*p1y+3*mt*t*t*p2y+t*t*t*p3y })
        }
        return pts
      }
      const r1=D1/2,r5=D5/2,r6=D6/2,r2=D2/2
      const cpPts = makeBezierPts(r1,0, r1*0.5,H2*0.15, r6+(r1-r6)*0.2,H2*0.85, r6,H2, 48)
      const bpPts = makeBezierPts(r5,B1, r5*1.02,B1+H2*0.1, r2-(r2-r5)*0.15,B1+H2*0.85, r2,B1+H2*0.85, 48)
      const cIn=cpPts[0], cOut=cpPts[48], bIn=bpPts[0]
      const cvr=cOut.x-cIn.x, cvy=cOut.y-cIn.y
      const cvLen=Math.sqrt(cvr*cvr+cvy*cvy)
      const ecr=cvr/cvLen, ecy=cvy/cvLen, enr=-ecy, eny=ecr
      const svr=bIn.x-cIn.x, svy=bIn.y-cIn.y

      function nacaY2(x:number,t:number) {
        if (x<=0) x=1e-4
        return (t/0.2)*(0.2969*Math.sqrt(x)-0.126*x-0.3516*x*x+0.2843*x*x*x-0.1015*x*x*x*x)
      }
      function camberAt(x:number,b1:number,b2:number) {
        const N=30,dx=x/N; let yc=0
        for (let i=0;i<N;i++) { const a=b1+(b2-b1)*dx*i,bv=b1+(b2-b1)*dx*(i+1); yc+=(Math.sin(a)+Math.sin(bv))/2*dx }
        return yc
      }
      const nacaAt001=0.142
      const tScale1=t1/(2*nacaAt001), tScale2=t2/(2*nacaAt001)
      const bladeGeos: import('three').BufferGeometry[] = []

      for (let bi=0;bi<nBlades;bi++) {
        const angle=(bi/nBlades)*Math.PI*2
        const ca=Math.cos(angle),sa=Math.sin(angle),etx=-sa,etz=ca
        const posUpper:number[]=[],posLower:number[]=[]
        for (let js=0;js<=nS;js++) {
          const sv=js/nS,b1l=b1r-sv*0.08,b2l=b2r-sv*0.05,r0=cIn.x+sv*svr,y0=cIn.y+sv*svy
          for (let ic=0;ic<=nC;ic++) {
            const xc=ic/nC,yc=camberAt(xc,b1l,b2l)*0
            const tScale=tScale1+(tScale2-tScale1)*xc,yt=nacaY2(xc,1.0)*tScale
            const rc=r0+xc*cvLen*ecr+yc*enr,ycp=y0+xc*cvLen*ecy+yc*eny
            posUpper.push(rc*ca-yt*etx, Math.max(0,ycp-yt*Math.abs(eny)), rc*sa-yt*etz)
            posLower.push(rc*ca+yt*etx, Math.max(0,ycp+yt*Math.abs(eny)), rc*sa+yt*etz)
          }
        }
        const stride=nC+1,nV=(nS+1)*stride,allPos=posUpper.concat(posLower),idxArr:number[]=[]
        for (let js=0;js<nS;js++) for (let ic=0;ic<nC;ic++) { const b=js*stride+ic,n=b+stride; idxArr.push(b,n,b+1,n,n+1,b+1) }
        for (let js=0;js<nS;js++) for (let ic=0;ic<nC;ic++) { const b=nV+js*stride+ic,n=b+stride; idxArr.push(b,b+1,n,n,b+1,n+1) }
        for (let js=0;js<nS;js++) { const u0=js*stride,u1=(js+1)*stride,l0=nV+js*stride,l1=nV+(js+1)*stride; idxArr.push(u0,l0,u1,l0,l1,u1) }
        for (let js=0;js<nS;js++) { const u0=js*stride+nC,u1=(js+1)*stride+nC,l0=nV+js*stride+nC,l1=nV+(js+1)*stride+nC; idxArr.push(u0,u1,l0,l0,u1,l1) }
        for (let ic=0;ic<nC;ic++) idxArr.push(ic,ic+1,nV+ic,nV+ic,ic+1,nV+ic+1)
        for (let ic=0;ic<nC;ic++) { const u0=nS*stride+ic,u1=nS*stride+ic+1,l0=nV+nS*stride+ic,l1=nV+nS*stride+ic+1; idxArr.push(u0,l0,u1,l0,l1,u1) }
        const bladeGeo = new THREE.BufferGeometry()
        bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute(allPos,3))
        bladeGeo.setIndex(idxArr); bladeGeo.computeVertexNormals()
        runner.add(new THREE.Mesh(bladeGeo, matBlade))
        bladeGeos.push(bladeGeo)
      }
      geoStoreRef.current = [crownGeo, bandGeo, bossGeo, ...bladeGeos]

      // ── 寸法線（3D線 + 2Dラベル） ──
      type DimLine = {
        p1: import('three').Vector3; p2: import('three').Vector3
        label: string; lpos: import('three').Vector3; color: string
      }
      const dimDefs: DimLine[] = [
        { p1:new THREE.Vector3(-D1/2,H2,0),          p2:new THREE.Vector3(D1/2,H2,0),          label:`D1=${Math.round(D1*1000)}mm`, lpos:new THREE.Vector3(0,H2+0.02,0),         color:'#ffff44' },
        { p1:new THREE.Vector3(-D5/2,B1+H2*0.3,0),   p2:new THREE.Vector3(D5/2,B1+H2*0.3,0),   label:`D5=${Math.round(D5*1000)}mm`, lpos:new THREE.Vector3(0,B1+H2*0.32,0),      color:'#44ffff' },
        { p1:new THREE.Vector3(-D2/2,B1,0),           p2:new THREE.Vector3(D2/2,B1,0),           label:`D2=${Math.round(D2*1000)}mm`, lpos:new THREE.Vector3(0,B1-0.025,0),        color:'#88ffaa' },
        { p1:new THREE.Vector3(-D6/2,H2*0.5,0),      p2:new THREE.Vector3(D6/2,H2*0.5,0),      label:`D6=${Math.round(D6*1000)}mm`, lpos:new THREE.Vector3(0,H2*0.5+0.02,0),     color:'#ff88ff' },
        { p1:new THREE.Vector3(D5/2+0.04,0,0),        p2:new THREE.Vector3(D5/2+0.04,H2,0),     label:`H=${Math.round(H2*1000)}mm`,  lpos:new THREE.Vector3(D5/2+0.09,H2*0.5,0), color:'#ff9944' },
      ]
      const dimGroup = new THREE.Group()
      dimGroup.visible = false  // デフォルトOFF
      scene.add(dimGroup)

      dimDefs.forEach(d => {
        const mat = new THREE.LineBasicMaterial({ color: d.color, depthTest: false })
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([d.p1,d.p2]), mat)
        line.renderOrder = 999; dimGroup.add(line)
        ;[d.p1,d.p2].forEach(p => {
          const dir = new THREE.Vector3().subVectors(d.p2,d.p1).normalize()
          const perp = Math.abs(dir.y)>0.9 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0)
          const half = perp.clone().multiplyScalar(0.012)
          const tl = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p.clone().sub(half),p.clone().add(half)]), mat)
          tl.renderOrder = 999; dimGroup.add(tl)
        })
      })

      function toScreen(v3: import('three').Vector3) {
        const v = v3.clone().project(camera)
        const w = overlay?.width ?? 0, h = overlay?.height ?? 0
        return { x:(v.x+1)/2*w, y:(-v.y+1)/2*h }
      }
      function drawLabels() {
        if (!overlay) return
        ctx.clearRect(0,0,overlay.width,overlay.height)
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

      // dimGroup の visible を dimVisRef と同期させるため animate 内で毎フレーム反映
      // ── マウス操作 ──
      const onMouseDown = (e: MouseEvent) => {
        state.isDrag=true; state.px=e.clientX; state.py=e.clientY; state.autoRot=false
      }
      const onMouseUp   = () => { state.isDrag=false }
      const onMouseMove = (e: MouseEvent) => {
        if (!state.isDrag) return
        camTargetRef.current.thetaY += (e.clientX-state.px)*0.009
        camTargetRef.current.thetaX = Math.max(-1.2, Math.min(1.4, camTargetRef.current.thetaX-(e.clientY-state.py)*0.007))
        state.px=e.clientX; state.py=e.clientY
      }
      const onWheel = (e: WheelEvent) => {
        camTargetRef.current.r = Math.max(D1*0.8, Math.min(D1*8, camTargetRef.current.r*(1+e.deltaY*0.001)))
        e.preventDefault()
      }
      canvas.addEventListener('mousedown', onMouseDown)
      window.addEventListener('mouseup',   onMouseUp)
      canvas.addEventListener('mousemove', onMouseMove)
      canvas.addEventListener('wheel',     onWheel, { passive:false })

      // ── アニメーション ──
      function animate() {
        state.animId = requestAnimationFrame(animate)
        resize()
        if (state.autoRot) camTargetRef.current.thetaY += 0.006
        // スムーズ補間
        camCur.r      += (camTargetRef.current.r      - camCur.r)      * 0.08
        camCur.thetaY += (camTargetRef.current.thetaY - camCur.thetaY) * 0.08
        camCur.thetaX += (camTargetRef.current.thetaX - camCur.thetaX) * 0.08
        applyCamera()
        // 寸法線の visible を同期
        dimGroup.visible = dimVisRef.current
        renderer.render(scene, camera)
        drawLabels()
      }
      resize(); animate()

      cleanupFn = () => {
        cancelAnimationFrame(state.animId)
        canvas.removeEventListener('mousedown', onMouseDown)
        window.removeEventListener('mouseup',   onMouseUp)
        canvas.removeEventListener('mousemove', onMouseMove)
        canvas.removeEventListener('wheel',     onWheel)
        renderer.dispose()
      }
    }

    return () => { cleanupFn?.(); script.remove() }
  }, [D1, D5, D6, D2, D7, B1, H2, beta1, beta2, nBlades])

  // 視点切替
  const handleSetView = (v: 'top'|'front'|'iso') => {
    if (stateRef.current) stateRef.current.autoRot = false
    setActiveView(v)
    const t = camTargetRef.current
    if (v==='top')   { t.thetaX=1.4;  t.thetaY=0;           t.r=D1*2.2 }
    if (v==='front') { t.thetaX=0.05; t.thetaY=0;           t.r=D1*3.0 }
    if (v==='iso')   { t.thetaX=0.4;  t.thetaY=Math.PI/4;   t.r=D1*2.4 }
  }

  const handleExportSTL = async () => {
    if (!geoStoreRef.current.length) return
    setExporting(true)
    const fname = `francis_runner_D${Math.round(D1*1000)}mm_Ns${Math.round(results.specificSpeed)}_${nBlades}blades.stl`
    await exportSTL(geoStoreRef.current, fname)
    setExporting(false)
  }

  // ── スタイル定数 ──
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
        style={{ width:'100%', aspectRatio:'16/10', maxHeight:460, position:'relative', borderRadius:6, overflow:'hidden', background:'#1c1408' }}
      >
        {/* 3D canvas */}
        <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }} />

        {/* 2D 寸法ラベル overlay */}
        <canvas ref={overlayRef} style={{ position:'absolute', top:0, left:0, pointerEvents:'none' }} />

        {/* 左上: タイトル */}
        <div style={{ position:'absolute', top:10, left:12, fontFamily:'monospace', fontSize:11, color:'var(--accent)', lineHeight:1.8, pointerEvents:'none' }}>
          ランナー 3Dビュー<br/>
          <span style={{ fontSize:10, color:'var(--muted)' }}>ドラッグ: 回転　スクロール: ズーム</span>
        </div>

        {/* 右上: 寸法パネル */}
        <div style={{ position:'absolute', top:10, right:12, background:'rgba(10,8,4,0.75)', border:'1px solid rgba(245,158,11,0.35)', borderRadius:7, padding:'8px 13px 9px', fontFamily:'monospace', pointerEvents:'none', minWidth:195 }}>
          <div style={{ fontSize:10, color:'var(--accent)', letterSpacing:'0.07em', borderBottom:'1px solid rgba(245,158,11,0.25)', paddingBottom:5, marginBottom:5 }}>主要寸法</div>
          {[
            { lbl:'クラウン外径', sym:'D1', val:Math.round(D1*1000), unt:'mm' },
            { lbl:'バンド外径',   sym:'D2', val:Math.round(D2*1000), unt:'mm' },
            { lbl:'最大外径',     sym:'D5', val:Math.round(D5*1000), unt:'mm' },
            { lbl:'ハブ内径',     sym:'D6', val:Math.round(D6*1000), unt:'mm' },
            { lbl:'入口角',       sym:'β1b',val:beta1.toFixed(1),    unt:'°'  },
            { lbl:'出口角',       sym:'β2b',val:beta2.toFixed(1),    unt:'°'  },
            { lbl:'ブレード数',   sym:'',   val:nBlades,             unt:'枚' },
          ].map(({ lbl, sym, val, unt }) => (
            <div key={lbl} style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'3px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', fontSize:12 }}>
              <span style={{ color:'#a8a29e', fontSize:11 }}>{lbl}</span>
              <span>
                {sym && <span style={{ color:'#fcd34d', fontWeight:'bold', marginRight:3 }}>{sym}</span>}
                <span style={{ color:'#fff', fontWeight:'bold' }}>{val}</span>
                <span style={{ color:'#78716c', fontSize:10, marginLeft:2 }}>{unt}</span>
              </span>
            </div>
          ))}
        </div>

        {/* 下部ボタン群 */}
        <div style={{ position:'absolute', bottom:10, left:12, display:'flex', gap:6, flexWrap:'wrap' }}>
          {/* 寸法線ON/OFF */}
          <button
            style={dimVisible ? btnActive : btnBase}
            onClick={() => setDimVisible(v => !v)}
          >
            寸法線 {dimVisible ? 'OFF' : 'ON'}
          </button>

          {/* 視点切替 */}
          {(['top','front','iso'] as const).map(v => (
            <button
              key={v}
              style={activeView===v ? btnActive : btnBase}
              onClick={() => handleSetView(v)}
            >
              {{ top:'上面図', front:'正面図', iso:'等角図' }[v]}
            </button>
          ))}

          {/* STLダウンロード */}
          <button
            onClick={handleExportSTL}
            disabled={exporting}
            style={{ ...btnBase, ...(exporting ? { background:'rgba(245,158,11,0.08)', color:'var(--muted)', cursor:'not-allowed' } : {}) }}
          >
            {exporting ? 'エクスポート中...' : `⬇ STL（${nBlades}枚ブレード）`}
          </button>
        </div>
      </div>
    </div>
  )
}
