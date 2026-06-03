'use client'
// ============================================================
// フランシス水車 ランナー全体 3Dビュー（Three.js）
// 修正版: 立体的なブレード・クラウン・バンド表示
//   - ブレードを子午面座標から正確に生成（前縁・後縁・端面キャップ付き）
//   - computeVertexNormals() で正しい法線を自動計算
//   - Three.js を動的ロードして黒画面問題を解消
//   - 自動回転 + ドラッグ操作対応
// ============================================================
import { useEffect, useRef, useState } from 'react'
import type { TurbineResults } from '@/types'
import { exportSTL } from '@/lib/stl-exporter'

interface Props {
  results: TurbineResults
}

export function FrancisRunner3D({ results }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const geoStoreRef  = useRef<object[]>([])
  const [exporting, setExporting] = useState(false)
  const stateRef = useRef<{
    animId: number
    rotY: number
    rotX: number
    autoRot: boolean
    isDrag: boolean
    px: number
    py: number
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
  const t1    = fd.t1   // 入口羽根厚さ [m]
  const t2    = fd.t2   // 出口羽根厚さ [m]
  const Ns    = results.specificSpeed
  const nBlades = Math.round(Math.max(9, Math.min(19, 6 + Ns / 30)))

  useEffect(() => {
    const container = containerRef.current
    const canvas    = canvasRef.current
    if (!container || !canvas) return

    const state = {
      animId: 0, rotY: 0, rotX: 0.3,
      autoRot: true, isDrag: false, px: 0, py: 0,
    }
    stateRef.current = state

    // ── Three.js 動的ロード ──
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
    script.onload = () => initScene()
    script.onerror = () => console.error('[FrancisRunner3D] Three.js load failed')
    document.head.appendChild(script)

    let cleanupFn: (() => void) | null = null

    function initScene() {
      if (!container || !canvas) return
      const THREE = (window as unknown as { THREE: typeof import('three') }).THREE

      const renderer = new THREE.WebGLRenderer({ canvas: canvas as HTMLCanvasElement, antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = true

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x1c1408)
      scene.fog = new THREE.Fog(0x1c1408, 5, 14)

      const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 50)
      camera.position.set(D1 * 2.4, D1 * 1.8, D1 * 2.4)
      camera.lookAt(0, H2 * 0.5, 0)

      function resize() {
        if (!container) return
        const w = container.clientWidth, h = container.clientHeight
        if (w === 0 || h === 0) return
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }

      // ── 多方向ライティング ──
      scene.add(new THREE.AmbientLight(0xfff8ed, 0.45))
      const key = new THREE.DirectionalLight(0xfef3c7, 1.4)
      key.position.set(D1 * 3, D1 * 5, D1 * 3)
      key.castShadow = true
      scene.add(key)
      const fill = new THREE.DirectionalLight(0xf59e0b, 0.5)
      fill.position.set(-D1 * 3, -D1 * 2, -D1 * 3)
      scene.add(fill)
      const back = new THREE.DirectionalLight(0xffffff, 0.25)
      back.position.set(0, -D1 * 3, 0)
      scene.add(back)
      const rim = new THREE.PointLight(0xfcd34d, 0.8, D1 * 10)
      rim.position.set(-D1 * 2, D1 * 2, -D1 * 2)
      scene.add(rim)

      const grid = new THREE.GridHelper(D1 * 4, 20, 0x7a5220, 0x2a1f0e)
      grid.position.y = -D1 * 0.2
      scene.add(grid)

      // ── マテリアル ──
      const matCrown = new THREE.MeshPhongMaterial({
        color: 0xb45309, specular: 0xffcc66, shininess: 60,
        side: THREE.DoubleSide, transparent: true, opacity: 0.92
      })
      const matBand = new THREE.MeshPhongMaterial({
        color: 0x92400e, specular: 0xffaa44, shininess: 40,
        side: THREE.DoubleSide, transparent: true, opacity: 0.85
      })
      const matBlade = new THREE.MeshPhongMaterial({
        color: 0xf59e0b, specular: 0xffdd88, shininess: 120,
        side: THREE.DoubleSide
      })
      const matBoss  = new THREE.MeshPhongMaterial({ color: 0x78350f, specular: 0xaa6622, shininess: 30 })
      const matShaft = new THREE.MeshPhongMaterial({ color: 0x44403c, shininess: 20 })

      const runner = new THREE.Group()
      scene.add(runner)

      // ── クラウン（Lathe） ──
      const crownPts: import('three').Vector2[] = []
      for (let i = 0; i <= 48; i++) {
        const t = i / 48
        const r1 = D1 / 2, r6 = D6 / 2
        const cp1r = r1 * 0.5,  cp1y = H2 * 0.15
        const cp2r = r6 + (r1 - r6) * 0.2, cp2y = H2 * 0.85
        const mt = 1 - t
        const r = mt*mt*mt*r1 + 3*mt*mt*t*cp1r + 3*mt*t*t*cp2r + t*t*t*r6
        const y = mt*mt*mt*0  + 3*mt*mt*t*cp1y + 3*mt*t*t*cp2y + t*t*t*H2
        crownPts.push(new THREE.Vector2(r, y))
      }
      const crownGeo = new THREE.LatheGeometry(crownPts, 64)
      runner.add(new THREE.Mesh(crownGeo, matCrown))

      // ── バンド（Lathe） ──
      const bandPts: import('three').Vector2[] = []
      for (let i = 0; i <= 48; i++) {
        const t = i / 48
        const r5 = D5 / 2, r2 = D2 / 2
        const y0 = B1
        const cp1r = r5 * 1.02, cp1y = y0 + H2 * 0.1
        const cp2r = r2 - (r2 - r5) * 0.15, cp2y = y0 + H2 * 0.85
        const mt = 1 - t
        const r = mt*mt*mt*r5 + 3*mt*mt*t*cp1r + 3*mt*t*t*cp2r + t*t*t*r2
        const y = mt*mt*mt*y0 + 3*mt*mt*t*cp1y + 3*mt*t*t*cp2y + t*t*t*(y0 + H2 * 0.85)
        bandPts.push(new THREE.Vector2(r, y))
      }
      const bandGeo = new THREE.LatheGeometry(bandPts, 64)
      runner.add(new THREE.Mesh(bandGeo, matBand))

      // ── ボス ──
      const bossGeo = new THREE.CylinderGeometry(D7 / 2, D7 / 2, H2 * 0.3, 32)
      const bossMesh = new THREE.Mesh(bossGeo, matBoss)
      bossMesh.position.y = H2 + H2 * 0.15
      runner.add(bossMesh)

      // ── 回転軸 ──
      const shaftGeo = new THREE.CylinderGeometry(D7 * 0.15, D7 * 0.15, H2 * 3, 16)
      const shaftMesh = new THREE.Mesh(shaftGeo, matShaft)
      shaftMesh.position.y = H2 * 0.8
      runner.add(shaftMesh)

      // ── ブレード生成（子午面座標から正確に）──
      const b1r = beta1 * Math.PI / 180
      const b2r = beta2 * Math.PI / 180
      const nC = 24, nS = 16

      // ベジェ曲線でラス曲線の点列を生成
      function makeBezierPts(
        p0r: number, p0y: number, p1r: number, p1y: number,
        p2r: number, p2y: number, p3r: number, p3y: number, N: number
      ) {
        const pts: { x: number; y: number }[] = []
        for (let i = 0; i <= N; i++) {
          const t = i / N, mt = 1 - t
          pts.push({
            x: mt*mt*mt*p0r + 3*mt*mt*t*p1r + 3*mt*t*t*p2r + t*t*t*p3r,
            y: mt*mt*mt*p0y + 3*mt*mt*t*p1y + 3*mt*t*t*p2y + t*t*t*p3y
          })
        }
        return pts
      }

      const r1 = D1/2, r5 = D5/2, r6 = D6/2, r2 = D2/2
      // クラウン/バンドのLathePtsと完全に同じベジェ係数でブレード基準線を定義
      const cpPts = makeBezierPts(r1, 0,  r1*0.5, H2*0.15,  r6+(r1-r6)*0.2, H2*0.85, r6, H2, 48)
      const bpPts = makeBezierPts(r5, B1, r5*1.02, B1+H2*0.1, r2-(r2-r5)*0.15, B1+H2*0.85, r2, B1+H2*0.85, 48)
      const cIn = cpPts[0], cOut = cpPts[48], bIn = bpPts[0]

      // 弦ベクトル（子午面内）
      const cvr = cOut.x - cIn.x, cvy = cOut.y - cIn.y
      const cvLen = Math.sqrt(cvr*cvr + cvy*cvy)
      const ecr = cvr/cvLen, ecy = cvy/cvLen
      const enr = -ecy, eny = ecr
      const svr = bIn.x - cIn.x, svy = bIn.y - cIn.y

      // NACA翼厚（正規化）
      function nacaY2(x: number, t: number) {
        if (x <= 0) x = 1e-4
        return (t/0.2)*(0.2969*Math.sqrt(x)-0.126*x-0.3516*x*x+0.2843*x*x*x-0.1015*x*x*x*x)
      }
      // キャンバー（sin積分）
      function camberAt(x: number, b1: number, b2: number) {
        const N = 30, dx = x / N; let yc = 0
        for (let i = 0; i < N; i++) {
          const a = b1 + (b2-b1)*dx*i, b_val = b1 + (b2-b1)*dx*(i+1)
          yc += (Math.sin(a) + Math.sin(b_val)) / 2 * dx
        }
        return yc
      }
      let ycMax = 0
      for (let i = 0; i <= 20; i++) {
        const yct = Math.abs(camberAt(i/20, b1r, b2r))
        if (yct > ycMax) ycMax = yct
      }
      // キャンバーは無効化（eny方向への飛び出し防止）
      const camberScale = 0
      // 翼厚: xc=0.01での全厚がt1(入口)・t2(出口)になるよう設定
      // nacaY2(0.01) ≈ 0.142, 半厚 = nacaY2*tScale なので tScale = t1/(2*nacaY2(0.01))
      const nacaAt001 = 0.142
      const tScale1   = t1 / (2 * nacaAt001)
      const tScale2   = t2 / (2 * nacaAt001)

      const bladeGeos: import('three').BufferGeometry[] = []

      for (let bi = 0; bi < nBlades; bi++) {
        const angle = (bi / nBlades) * Math.PI * 2
        const ca = Math.cos(angle), sa = Math.sin(angle)
        const etx = -sa, etz = ca  // 円周方向

        const posUpper: number[] = [], posLower: number[] = []

        for (let js = 0; js <= nS; js++) {
          const sv = js / nS
          const b1l = b1r - sv*0.08, b2l = b2r - sv*0.05
          const r0 = cIn.x + sv*svr, y0 = cIn.y + sv*svy
          for (let ic = 0; ic <= nC; ic++) {
            const xc = ic / nC
            const yc = camberAt(xc, b1l, b2l) * camberScale
            const tScale = tScale1 + (tScale2 - tScale1) * xc
            const yt = nacaY2(xc, 1.0) * tScale
            const rc = r0 + xc*cvLen*ecr + yc*enr
            const ycp = y0 + xc*cvLen*ecy + yc*eny
            // 上面（外側） ※y座標が境界外に出ないようクランプ
            posUpper.push(rc*ca - yt*etx, Math.max(0, ycp - yt*Math.abs(eny)), rc*sa - yt*etz)
            // 下面（内側）
            posLower.push(rc*ca + yt*etx, Math.max(0, ycp + yt*Math.abs(eny)), rc*sa + yt*etz)
          }
        }

        const stride = nC + 1
        const nV = (nS + 1) * stride
        const allPos = posUpper.concat(posLower)
        const idxArr: number[] = []

        // 上面ポリゴン
        for (let js = 0; js < nS; js++) {
          for (let ic = 0; ic < nC; ic++) {
            const b = js*stride + ic, n = b + stride
            idxArr.push(b, n, b+1, n, n+1, b+1)
          }
        }
        // 下面ポリゴン（法線反転）
        for (let js = 0; js < nS; js++) {
          for (let ic = 0; ic < nC; ic++) {
            const b = nV + js*stride + ic, n = b + stride
            idxArr.push(b, b+1, n, n, b+1, n+1)
          }
        }
        // 前縁キャップ（ic=0）
        for (let js = 0; js < nS; js++) {
          const u0 = js*stride, u1 = (js+1)*stride
          const l0 = nV + js*stride, l1 = nV + (js+1)*stride
          idxArr.push(u0, l0, u1, l0, l1, u1)
        }
        // 後縁キャップ（ic=nC）
        for (let js = 0; js < nS; js++) {
          const u0 = js*stride + nC, u1 = (js+1)*stride + nC
          const l0 = nV + js*stride + nC, l1 = nV + (js+1)*stride + nC
          idxArr.push(u0, u1, l0, l0, u1, l1)
        }
        // クラウン側キャップ（js=0）
        for (let ic = 0; ic < nC; ic++) {
          idxArr.push(ic, ic+1, nV+ic, nV+ic, ic+1, nV+ic+1)
        }
        // バンド側キャップ（js=nS）
        for (let ic = 0; ic < nC; ic++) {
          const u0 = nS*stride+ic, u1 = nS*stride+ic+1
          const l0 = nV+nS*stride+ic, l1 = nV+nS*stride+ic+1
          idxArr.push(u0, l0, u1, l0, l1, u1)
        }

        const bladeGeo = new THREE.BufferGeometry()
        bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3))
        bladeGeo.setIndex(idxArr)
        bladeGeo.computeVertexNormals()
        runner.add(new THREE.Mesh(bladeGeo, matBlade))
        bladeGeos.push(bladeGeo)
      }

      // STL用: 全ブレード + クラウン + バンド + ボス
      geoStoreRef.current = [crownGeo, bandGeo, bossGeo, ...bladeGeos]

      // ── マウス操作 ──
      const onMouseDown = (e: MouseEvent) => {
        state.isDrag = true; state.px = e.clientX; state.py = e.clientY; state.autoRot = false
      }
      const onMouseUp   = () => { state.isDrag = false }
      const onMouseMove = (e: MouseEvent) => {
        if (!state.isDrag) return
        state.rotY += (e.clientX - state.px) * 0.009
        state.rotX += (e.clientY - state.py) * 0.007
        state.rotX = Math.max(-1.2, Math.min(1.2, state.rotX))
        state.px = e.clientX; state.py = e.clientY
      }
      const onWheel = (e: WheelEvent) => {
        camera.position.multiplyScalar(1 + e.deltaY * 0.001)
        camera.position.clampLength(D1 * 0.8, D1 * 8)
        e.preventDefault()
      }
      canvas.addEventListener('mousedown', onMouseDown)
      window.addEventListener('mouseup', onMouseUp)
      canvas.addEventListener('mousemove', onMouseMove)
      canvas.addEventListener('wheel', onWheel, { passive: false })

      // ── アニメーション ──
      function animate() {
        state.animId = requestAnimationFrame(animate)
        resize()
        if (state.autoRot) state.rotY += 0.006
        runner.rotation.y = state.rotY
        runner.rotation.x = state.rotX * 0.3
        renderer.render(scene, camera)
      }
      resize()
      animate()

      cleanupFn = () => {
        cancelAnimationFrame(state.animId)
        canvas.removeEventListener('mousedown', onMouseDown)
        window.removeEventListener('mouseup', onMouseUp)
        canvas.removeEventListener('mousemove', onMouseMove)
        canvas.removeEventListener('wheel', onWheel)
        renderer.dispose()
      }
    }

    return () => {
      cleanupFn?.()
      script.remove()
    }
  }, [D1, D5, D6, D2, D7, B1, H2, beta1, beta2, Ns, nBlades])

  const handleExportSTL = async () => {
    if (!geoStoreRef.current.length) return
    setExporting(true)
    const fname = `francis_runner_D${Math.round(D1*1000)}mm_Ns${Math.round(results.specificSpeed)}_${nBlades}blades.stl`
    await exportSTL(geoStoreRef.current, fname)
    setExporting(false)
  }

  return (
    <div>
      <div
        ref={containerRef}
        style={{ width: '100%', aspectRatio: '16/10', maxHeight: 460, position: 'relative', borderRadius: 6, overflow: 'hidden', background: '#1c1408' }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        <div style={{ position: 'absolute', top: 10, left: 12, fontFamily: 'monospace', fontSize: 11, color: 'var(--accent)', lineHeight: 1.8, pointerEvents: 'none' }}>
          ランナー 3Dビュー<br/>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>ドラッグ: 回転　スクロール: ズーム</span>
        </div>
        <div style={{ position: 'absolute', top: 10, right: 12, fontFamily: 'monospace', fontSize: 10, color: 'var(--muted)', textAlign: 'right', lineHeight: 2, pointerEvents: 'none' }}>
          D1={( D1*1000).toFixed(0)}mm　D5={( D5*1000).toFixed(0)}mm<br/>
          D6={( D6*1000).toFixed(0)}mm　D2={( D2*1000).toFixed(0)}mm<br/>
          β1b={beta1.toFixed(1)}°　β2b={beta2.toFixed(1)}°<br/>
          ブレード数 {nBlades}枚
        </div>
        <div style={{ position: 'absolute', bottom: 10, left: 12, display: 'flex', gap: 8 }}>
          <button
            onClick={handleExportSTL}
            disabled={exporting}
            style={{ fontSize: 10, fontFamily: 'monospace', background: exporting ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.18)', border: '1px solid var(--accent)', color: exporting ? 'var(--muted)' : 'var(--accent)', padding: '3px 12px', cursor: exporting ? 'not-allowed' : 'pointer', borderRadius: 3, transition: 'all 0.2s' }}
          >
            {exporting ? 'エクスポート中...' : `⬇ STLダウンロード（クラウン・バンド・${nBlades}枚ブレード）`}
          </button>
        </div>
      </div>
    </div>
  )
}
