import type { TurbineInputs, TurbineResults, TurbineType, VelocityTriangle, NsRange } from '@/types'

const RHO = 1000
const G   = 9.81
const PV  = 2.34
const PI  = Math.PI

const MAX_POLE = 24		// 80 -> 24
const MIN_POLE = 4		// 2 -> 4
const NS_BASIS = 160		// 150 -> 160
const MAX_NRPM = 1800		// 1500 -> 1800
const MIN_NRPM = 250		// 100 -> 250

function selectRatedSpeed(pw: number, head: number, freq: 50 | 60, targetNs: number): { n: number; poles: number } {
  let bestN = 100, bestPoles = MIN_POLE, bestDiff = Infinity
  for (let p = MIN_POLE; p <= MAX_POLE; p += 2) {
    const n = 120 * freq / p
    if (n < MIN_NRPM || n > MAX_NRPM) continue
    const ns = n * Math.sqrt(pw) / Math.pow(head, 1.25)
    const diff = Math.abs(ns - targetNs)
    if (diff < bestDiff) { bestDiff = diff; bestN = n; bestPoles = p }
  }
  return { n: bestN, poles: bestPoles }
}

const MANNING_N: Record<string, number> = { steel: 0.012, ductile: 0.013, frp: 0.010 }
function penstockHeadLoss(q: number, d: number, L: number, material: string): number {
  if (d <= 0 || L <= 0) return 0
  const v = q / (PI * d * d / 4)
  const n = MANNING_N[material] ?? 0.012
  const R = d / 4
  return (n * n * v * v * L) / Math.pow(R, 4 / 3)
}

// ── ペルトン専用 ───────────────────────────────────────────────
function calcPeltonDimensions(ns: number, head: number, flowRate: number, runnerDiameter: number) {
  const numJets = ns < 70 ? 1 : ns < 120 ? 2 : ns < 180 ? 4 : 6
  const Cv = 0.97
  const jetArea = flowRate / (numJets * Cv * Math.sqrt(2 * G * head))
  const jetDiameter = Math.sqrt(4 * jetArea / PI)
  const dOverD = runnerDiameter / jetDiameter
  const bucketWidth = 3.2 * jetDiameter
  const dOverB = runnerDiameter / bucketWidth
  const numBuckets = Math.min(40, Math.max(17, Math.round(runnerDiameter / (2 * jetDiameter) + 15)))
  const minFlow = 0.05 * flowRate
  return { numJets, jetDiameter, dOverD, bucketWidth, dOverB, numBuckets, minFlow }
}

// ── フランシス専用 ─────────────────────────────────────────────
function calcFrancisDimensions(ns: number, flowRate: number, runnerDiameter: number) {
  const outletDiameter = runnerDiameter
  const inletDiameter = outletDiameter * (0.97 + 0.04 * (ns / 200))
  const guideVaneHeight = outletDiameter * 0.18 * Math.pow(ns / 100, 0.45)
  const spiralCaseInlet = Math.sqrt(4 * flowRate / (PI * 6.0))
  let numBlades: number
  if (ns < 100) numBlades = 15
  else if (ns < 150) numBlades = 13
  else if (ns < 200) numBlades = 11
  else if (ns < 250) numBlades = 9
  else numBlades = 7
  const gcdFn = (a: number, b: number): number => b === 0 ? a : gcdFn(b, a % b)
  const numGuideVanes = [16,18,20,22,24].find(z => gcdFn(z, numBlades) === 1) ?? 20
  const minFlow = 0.10 * flowRate
  const flowAtRunaway = 0.55 * flowRate
  return { outletDiameter, inletDiameter, guideVaneHeight, spiralCaseInlet, numBlades, numGuideVanes, minFlow, flowAtRunaway }
}

// ── カプラン専用 ───────────────────────────────────────────────
function calcKaplanDimensions(ns: number, flowRate: number, runnerDiameter: number) {
  const numBlades = ns < 400 ? 6 : ns < 550 ? 5 : 4
  const hubRatio = Math.min(0.55, 0.30 + 0.10 * (ns / 400))
  const hubDiameter = runnerDiameter * hubRatio
  const gcdFn = (a: number, b: number): number => b === 0 ? a : gcdFn(b, a % b)
  const numGuideVanes = [12,14,16,18,20,24].find(z => gcdFn(z, numBlades) === 1) ?? 16
  const minFlow = 0.20 * flowRate
  return { numBlades, hubDiameter, hubRatio, numGuideVanes, minFlow }
}

// ── クロスフロー専用（Banki-Michell型） ───────────────────────
// 参考：Mockmore & Merryfield (1949), Durgin & Fay (1984)
function calcCrossflowDimensions(head: number, flowRate: number, runnerDiameter: number) {
  // ランナー幅 B: 流量と流速水頭から算出
  // Q = B × D × K × √(2gH)　K≈0.98（流量係数）
  const K = 0.98
  const runnerWidth = flowRate / (runnerDiameter * K * Math.sqrt(2 * G * head))
  const aspectRatio = runnerWidth / runnerDiameter   // B/D 比（通常0.5〜3）
  const numBlades = 24  // Banki型の標準ブレード数（18〜30枚）
  const attackAngle = 16  // 標準入射角 [deg]（14〜20°）
  const minFlow = 0.15 * flowRate  // 最小流量（15%）
  return { runnerWidth, aspectRatio, numBlades, attackAngle, minFlow }
}

// ── チューブラ専用（水平軸・貫流型） ──────────────────────────
// 参考：IEC 60193, Voith / Andritz チューブラ水車設計指針
function calcTubularDimensions(ns: number, flowRate: number, runnerDiameter: number) {
  // ブレード数：低Nsほど多い（カプランより少なめ）
  const numBlades = ns < 400 ? 5 : ns < 600 ? 4 : 3
  // ハブ比：チューブラはカプランよりやや小さい
  const hubRatio = Math.min(0.45, 0.25 + 0.08 * (ns / 400))
  const hubDiameter = runnerDiameter * hubRatio
  const gcdFn = (a: number, b: number): number => b === 0 ? a : gcdFn(b, a % b)
  const numGuideVanes = [10,12,14,16].find(z => gcdFn(z, numBlades) === 1) ?? 12
  const coneAngle = 10  // ドラフトチューブコーン半角 [deg]（直管型は小さい）
  const minFlow = 0.25 * flowRate  // 最小流量（25%）
  return { numBlades, hubDiameter, hubRatio, numGuideVanes, coneAngle, minFlow }
}

// ── 自動形式選択 ───────────────────────────────────────────────
// ※ クロスフロー水車は自動選定対象外（手動選択のみ）
// ※ nsRanges が渡された場合はDB値を使用。なければフォールバック値で動作。
// ※ turbine_types.is_active = false の形式は選定対象から除外される。
function autoSelectType(
  head: number,
  flowRate: number,
  specificSpeed: number,
  nsRanges?: NsRange[],
): TurbineType {
  // is_active な形式のみを対象にする
  const isActive = (name: TurbineType) =>
    nsRanges === undefined ||
    nsRanges.some(r => r.turbineType.name === name && r.turbineType.isActive)

  const nsOf = (name: TurbineType) => nsRanges?.find(r => r.turbineType.name === name)

  const pelton  = nsOf('ペルトン水車')
  const francis = nsOf('フランシス水車')
  const tubular = nsOf('チューブラ水車')

  // 各形式のNs閾値（DBになければフォールバック値を使用）
  const peltonNsMax  = pelton?.nsMax  ?? 100
  const francisNsMax = francis?.nsMax ?? 400
  const tubularNsMin = tubular?.nsMin ?? 300

  // チューブラ：超低落差（H≦20m）かつ大流量・高比速度（is_active な場合のみ）
  if (isActive('チューブラ水車') && head <= 20 && flowRate >= 1.0 && specificSpeed >= tubularNsMin) return 'チューブラ水車'
  // ペルトン：高落差（H>200m）または比速度がペルトン上限以下（is_active な場合のみ）
  if (isActive('ペルトン水車') && (head > 200 || specificSpeed < peltonNsMax)) return 'ペルトン水車'
  // フランシス：比速度がフランシス上限以下（is_active な場合のみ）
  if (isActive('フランシス水車') && specificSpeed <= francisNsMax) return 'フランシス水車'
  // カプラン：それ以外（is_active な場合のみ）
  if (isActive('カプラン水車')) return 'カプラン水車'
  // すべてのアクティブ候補が外れた場合、is_active な最初の形式を返す
  const fallback = nsRanges?.find(r => r.turbineType.isActive)
  return (fallback?.turbineType.name ?? 'フランシス水車') as TurbineType
}

// ── 速度三角形ヘルパー ────────────────────────────────────────
function makeTriangle(u: number, cu: number, cm: number): VelocityTriangle {
  const c     = Math.sqrt(cu * cu + cm * cm)
  const wu    = cu - u
  const w     = Math.sqrt(wu * wu + cm * cm)
  const alpha = Math.atan2(cm, cu) * 180 / PI
  const beta  = Math.atan2(cm, wu) * 180 / PI
  return { u, c, w, alpha, beta, cu, cm, wu }
}

function calcPeltonVelocityTriangles(head: number, ratedRpm: number, runnerDiameter: number) {
  const Cv = 0.97
  const c1 = Cv * Math.sqrt(2 * G * head)
  const u  = (PI * runnerDiameter * ratedRpm) / 60
  const inlet = makeTriangle(u, c1, 0)
  const beta2Rad = (180 - 165) * PI / 180
  const k = 0.90
  const w2 = k * Math.abs(inlet.wu)
  const outletCu = u + (-w2 * Math.cos(beta2Rad))
  const outletCm =  w2 * Math.sin(beta2Rad)
  const outlet = makeTriangle(u, outletCu, outletCm)
  return { inlet, outlet }
}

function calcFrancisVelocityTriangles(
  head: number, flowRate: number, specificSpeed: number,
  ratedRpm: number, runnerDiameter: number,
) {
  const u1  = (PI * runnerDiameter * ratedRpm) / 60
  const b1  = runnerDiameter * 0.18 * Math.pow(specificSpeed / 100, 0.45)
  const cm1 = flowRate / (PI * runnerDiameter * b1)
  const beta1_rad = (55 + 30 * (specificSpeed - 80) / 220) * PI / 180
  const cu1 = u1 - cm1 / Math.tan(beta1_rad)
  const inlet = makeTriangle(u1, cu1, cm1)
  const u2    = (PI * runnerDiameter * 0.72 * ratedRpm) / 60
  const draftD = Math.sqrt(4 * flowRate / (PI * 4.0))
  const cm2    = flowRate / (PI * (draftD / 2) ** 2)
  const outlet = makeTriangle(u2, 0, cm2)
  return { inlet, outlet }
}

function calcAxialVelocityTriangles(
  head: number, flowRate: number, specificSpeed: number,
  ratedRpm: number, runnerDiameter: number, hubRatio: number,
) {
  const rTip  = runnerDiameter / 2
  const rMean = (rTip + rTip * hubRatio) / 2
  const u1    = (PI * 2 * rMean * ratedRpm) / 60
  const cm1   = flowRate / (PI * (rTip ** 2 - (rTip * hubRatio) ** 2))
  const cu1   = (G * head) / u1
  const inlet  = makeTriangle(u1, cu1, cm1)
  const outlet = makeTriangle(u1, 0, cm1)
  return { inlet, outlet }
}

function calcCrossflowVelocityTriangles(
  head: number, flowRate: number,
  ratedRpm: number, runnerDiameter: number, runnerWidth: number,
) {
  const u    = (PI * runnerDiameter * ratedRpm) / 60
  const c1   = 0.98 * Math.sqrt(2 * G * head)
  const alpha1_rad = 16 * PI / 180
  const inlet  = makeTriangle(u, c1 * Math.cos(alpha1_rad), c1 * Math.sin(alpha1_rad))
  const outlet = makeTriangle(u * 0.66, 0, inlet.cm * 1.1)
  return { inlet, outlet }
}

// ── フランシス詳細設計パラメータ（Pythonロジック移植） ──────────
const N11_FRANCIS = 62   // 単位速度

function calcStayVaneAngle(Ds1: number, Bs1: number, th0: number, theta: number, Dcn: number): number {
  const rs1  = Ds1 / 2
  const rc   = Dcn / 2 + rs1
  const rout = rc + Dcn / 2

  const a = -1.0, b = 2.0 * rc, c = (Dcn / 2.0) ** 2 - rc ** 2

  const dr = (rout - rs1) / 400.0
  let q = 0.0
  for (let j = 1; j <= 400; j++) {
    const r1 = rs1 + dr * (j - 1)
    const r2 = rs1 + dr * j
    const p1 = Math.sqrt(Math.abs(a * r1 ** 2 + b * r1 + c)) / r1
    const p2 = Math.sqrt(Math.abs(a * r2 ** 2 + b * r2 + c)) / r2
    q += (p1 + p2) / 2.0 * dr
  }

  const qq0 = -1.0 / 360.0 * (theta + th0) + 1.0
  const ccc = theta > 180.0 ? 1.0 : (180.0 - theta) / 180.0 * 0.1 + 1.0

  const pp = 2.0 * q / (2.0 * PI * Bs1 * qq0) * ccc
  return Math.atan(pp) * 180 / PI
}

function calcFrancisDetailedParams(
  head: number, flowRate: number, etaT: number,
  ratedRpm: number, specificSpeed: number,
) {
  const Nsp = specificSpeed
  const N   = ratedRpm
  const H   = head
  const Q   = flowRate

  // ── ランナベーン ──
  const D1  = Math.sqrt(H) * N11_FRANCIS / N
  const kD5 = 1.03182133046507e-5 * Nsp ** 2 - 0.00149034059141648 * Nsp + 1.05255248826807
  const D5  = kD5 * D1
  const D6  = 0.35 * D1
  const kD2 = 3.27551062332804e-6 * Nsp ** 2 + 0.00306199513110902 * Nsp + 0.446611642813065
  const D2  = kD2 * D1
  const kD7 = -0.0004 * Nsp + 0.2513
  const D7  = kD7 * D1
  const kH2 = 0.000619426917040336 * Nsp + 0.0900487814835914
  const H2  = kH2 * D1

  const kcm1 = -1.99107329477917e-6 * Nsp ** 2 + 0.00147702607133364 * Nsp + 0.0365204129271132
  const Vm1  = kcm1 * Math.sqrt(2 * G * H)
  const B1   = Q / (PI * D1 * Vm1)

  const Hth    = etaT * H
  const U1     = PI * D1 * N / 60
  const Vu1    = G * Hth / U1
  const alpha1 = Math.atan2(Vm1, Vu1) * 180 / PI

  const D_inlet  = Math.sqrt(D1 ** 2 + D5 ** 2) / 2
  const U_inlet  = PI * D_inlet * N / 60
  const Vu_inlet = G * Hth / U_inlet
  const beta1b   = Math.atan2(Vm1, U_inlet - Vu_inlet) * 180 / PI

  const D_outlet = Math.sqrt(D6 ** 2 + D7 ** 2) / 2
  const U_outlet = PI * D_outlet * N / 60
  const Vm2      = 4 * Q / (PI * (D2 ** 2 - D7 ** 2))
  const beta2b   = Math.atan2(Vm2, U_outlet) * 180 / PI

  // lb は後でbeta2b_correctを使って再計算

  // ── ガイドベーン ──
  const kDg1 = 1.2817934656e-5 * Nsp ** 2 - 0.001219602867175  * Nsp + 1.221638424287550
  const Dg1  = kDg1 * D1
  const kDg2 = 8.705950176e-6  * Nsp ** 2 - 0.001045312125451  * Nsp + 1.072765656988970
  const Dg2  = kDg2 * D1
  const Rg   = (Dg2 + (Dg1 - Dg2) * 0.42) / 2
  const Dlx  = Rg - Dg2 / 2
  const Bg1  = B1, Bg2 = B1

  // ── ステーベーン（基本。詳細は後で計算） ──
  const kDs1_pre = 1.9762543999e-5 * Nsp ** 2 - 0.001766979265091 * Nsp + 1.458758687476440
  const Ds1 = kDs1_pre * D1
  const kDs2_pre = 1.3200375620e-5 * Nsp ** 2 - 0.001256058280413 * Nsp + 1.258329780057310
  const Ds2 = kDs2_pre * D1
  const Bs1 = B1, Bs2 = B1

  // ── ケーシング ──
  const kDc = 1.8311424841e-5 * Nsp ** 2 + 0.003334501174619 * Nsp + 0.130205609439768
  const Dc  = kDc * D1
  const lCa = 1.666191 * Dc
  const Vc0 = 4 * Q / (PI * Dc ** 2)

  // ── ステーベーン流入角（16断面） ──
  const th0 = 21.03
  const stayVaneAngles = Array.from({ length: 16 }, (_, i) => {
    const no    = i + 1
    const theta = no * 360 / 16
    const Qn    = Q * (16 - no) / 16
    const Dcn   = Math.sqrt(4.0 * Qn / (Vc0 * PI))
    const alpha = calcStayVaneAngle(Ds1, Bs1, th0, theta, Dcn)
    return { no, theta, Qn, Dcn, alpha }
  })


  // ── ランナベーン追加 ──
  // 羽根枚数
  let Zr: number
  if (Nsp < 90 || Nsp >= 188) Zr = 14
  else if (Nsp < 113 || Nsp >= 138) Zr = 16
  else Zr = 18

  // 実際のD_outletはPythonに合わせてD6とD7を使う（既存コードのD7修正）
  const D_outlet_correct = Math.sqrt((D6 ** 2 + D7 ** 2) / 2)
  const U_outlet_correct  = PI * D_outlet_correct * N / 60
  const Vm2_correct       = 4 * Q / (PI * (D2 ** 2 - D7 ** 2))
  const beta2b_correct    = Math.atan2(Vm2_correct, U_outlet_correct) * 180 / PI

  // lb（正しいbeta2bを使って再計算）
  const b1r2 = beta1b * PI / 180, b2r2 = beta2b_correct * PI / 180
  const tanRatio2 = Math.tan(b1r2 / 2) / Math.tan(b2r2 / 2)
  const lb_correct = tanRatio2 > 0 && (b2r2 - b1r2) !== 0
    ? (D_outlet_correct - D_inlet) / (b2r2 - b1r2) / 2 * Math.log(tanRatio2)
    : null

  // ガイドベーン翼型厚み（NACAから）
  function naca_thickness(x: number, chord: number) {
    return 5 * 0.12 * chord * (
      0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1015 * x ** 4
    ) * 2
  }

  // ガイドベーン枚数
  let Zg: number
  if (Dg2 < 0.750) Zg = 12
  else if (Dg2 < 1.250) Zg = 16
  else if (Dg2 < 2.250) Zg = 20
  else if (Dg2 < 3.750) Zg = 24
  else Zg = 28

  const pitch = PI * Dg2 / Zg
  const lg    = pitch * 1.2
  const tg1   = naca_thickness(0.01, lg)
  const tg2   = naca_thickness(0.96, lg)
  const t1    = tg1 * 2
  const t2    = tg2 * 2

  // ガイドベーン角度テーブル
  const design_opening = 80
  const design_outlet_angle = alpha1
  const openings = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110]
  const P00 = pitch
  const port_design = P00 * design_opening / 100
  const K  = design_outlet_angle / port_design
  const m  = 0.65
  const theta_g = 10
  const guideVaneTable = openings.map(op => {
    const port     = P00 * op / 100
    const alphaG2b = K * port
    const alphaG1b = alphaG2b + 10
    const delta    = m * Math.sqrt(pitch / lg) * theta_g
    const alphaG02 = alphaG2b + delta
    return { op, port, alphaG1b, alphaG2b, delta, alphaG02 }
  })

  // ステーベーン
  const Zs  = Zg
  const ts1 = tg1
  const ts2 = tg2
  const kDs1 = 1.9762543999e-5 * Nsp ** 2 - 0.001766979265091 * Nsp + 1.458758687476440
  const Ds1n  = kDs1 * D1
  const kDs2 = 1.3200375620e-5 * Nsp ** 2 - 0.001256058280413 * Nsp + 1.258329780057310
  const Ds2n  = kDs2 * D1

  // ステーベーン出口角
  const alphaS2b = design_outlet_angle / port_design * P00 * 80 / 100 + 10

  // ステーベーン流入角（平均）
  const alphaS1b = stayVaneAngles.reduce((s, r) => s + r.alpha, 0) / stayVaneAngles.length

  // ステーベーン羽根長さ
  const dS1r = alphaS1b * PI / 180, dS2r = alphaS2b * PI / 180
  const tanS = Math.tan(dS1r / 2) / Math.tan(dS2r / 2)
  const ls = tanS > 0 && (dS2r - dS1r) !== 0
    ? (Ds1n - Ds2n) / (dS2r - dS1r) / 2 * Math.log(tanS)
    : (Ds1n - Ds2n) / 2

  // ドラフトチューブ
  const ldc  = 0.742604857 * D2
  const rdc1 = D2
  const rdc2 = D2
  const rdb  = 5.460485651 * D2
  const bdb  = 2 * D2
  const hdb2 = 2 * D2
  const ldd  = 11.7580574 * D2
  const bdd  = 3.644591611 * D2
  const hdd  = 3.644591611 * D2

  // シール
  const seal = 2
  const bw_1 = 0.002 * D1
  const bw_2 = 0.002 * D1
  const lw_1 = 0.01
  const lw_2 = 0.01
  const rl_1 = 0.61155 * D1 / 2
  const rl_2 = 0.965424 * D1 / 2

  return {
    D1, D5, D6, D2, D7, H2, B1, Vm1,
    Vm2: Vm2_correct,
    alpha1,
    beta1b,
    beta2b: beta2b_correct,
    lb: lb_correct,
    Zr, t1, t2,
    Dg1, Dg2, Rg, Dlx, Bg1, Bg2,
    Zg, tg1, tg2, lg, P00,
    guideVaneTable,
    Ds1: Ds1n, Ds2: Ds2n, Bs1, Bs2,
    Zs, ts1, ts2, ls, alphaS1b, alphaS2b,
    Dc, lCa, Vc0,
    ldc, rdc1, rdc2, rdb, bdb, hdb2, ldd, bdd, hdd,
    seal, bw_1, bw_2, lw_1, lw_2, rl_1, rl_2,
    stayVaneAngles,
  }
}

// ── メイン計算 ─────────────────────────────────────────────────
export function calculate(inputs: TurbineInputs, forcedType?: TurbineType, nsRanges?: NsRange[]): TurbineResults {
  const { head, flowRate, turbineEff, generatorEff, suctionHead, altitude, frequency,
          powerFactor, operatingHours, capacityFactor, penstock, targetNs } = inputs
  const etaT = turbineEff / 100
  const etaG = generatorEff / 100

  const turbinePower   = (RHO * G * flowRate * head * etaT) / 1000
  const generatorPower = turbinePower * etaG
  const { n: ratedRpm, poles } = selectRatedSpeed(turbinePower, head, frequency, targetNs ?? 160)
  const specificSpeed = ratedRpm * Math.sqrt(turbinePower) / Math.pow(head, 1.25)

  // ── 形式選択 ──
  let turbineType: TurbineType
  let runawayCoeff: number

  if (forcedType) {
    turbineType = forcedType
    runawayCoeff = (forcedType === 'カプラン水車' || forcedType === 'チューブラ水車') ? 2.5
      : forcedType === 'クロスフロー水車' ? 1.7
      : 1.8
  } else {
    turbineType = autoSelectType(head, flowRate, specificSpeed, nsRanges)
    runawayCoeff = (turbineType === 'カプラン水車' || turbineType === 'チューブラ水車') ? 2.5
      : turbineType === 'クロスフロー水車' ? 1.7
      : 1.8
  }

  const runawaySpeed = Math.round(ratedRpm * runawayCoeff)
  const atmPressure  = 101.325 * Math.exp(-altitude / 8500)

  // ── キャビテーション（反動式のみ） ──
  const isImpulse = turbineType === 'ペルトン水車' || turbineType === 'クロスフロー水車'
  let cavitationCoef: number | null = null
  let hsMax: number | null = null

  if (!isImpulse) {
    if (turbineType === 'フランシス水車') {
      cavitationCoef = 6.55e-6 * Math.pow(specificSpeed, 1.46)
    } else {
      // カプラン・チューブラ（軸流型）
      cavitationCoef = 3.5e-5 * Math.pow(specificSpeed, 1.20)
    }
    hsMax = (atmPressure - PV) / (RHO * G / 1000) - cavitationCoef * head
  }
  const cavOk = isImpulse ? null : suctionHead <= (hsMax ?? Infinity)

  // ── ランナー径 ──
  let runnerDiameter: number
  if (turbineType === 'ペルトン水車') {
    const Vu = 0.46 * Math.sqrt(2 * G * head)
    runnerDiameter = (60 * Vu) / (PI * ratedRpm)
  } else if (turbineType === 'フランシス水車') {
    runnerDiameter = 84.6 * Math.sqrt(flowRate) / (Math.pow(specificSpeed, 0.5) * Math.pow(ratedRpm, 0.5)) * 1.2
  } else if (turbineType === 'クロスフロー水車') {
    // Banki型：ランナー周速比 φ≈0.46 ×√(2gH)
    const u = 0.46 * Math.sqrt(2 * G * head)
    runnerDiameter = (60 * u) / (PI * ratedRpm)
  } else {
    // カプラン・チューブラ（軸流型）
    runnerDiameter = 84.6 * Math.sqrt(flowRate) / (Math.pow(specificSpeed, 0.3) * Math.pow(ratedRpm, 0.5)) * 0.9
  }

  // ── 共通寸法 ──
  const hasRunner = turbineType !== 'ペルトン水車' && turbineType !== 'クロスフロー水車'
  const draftTubeDiameter = hasRunner ? Math.sqrt(4 * flowRate / (PI * 4.0)) : null
  const casingDiameter    = hasRunner ? runnerDiameter * 1.4 : null
  const penstockDiameter  = Math.sqrt(4 * flowRate / (PI * 2.0))
  const penstockVelocity  = 2.0

  // ── 形式別専用寸法 ──
  const peltonDim      = turbineType === 'ペルトン水車'     ? calcPeltonDimensions(specificSpeed, head, flowRate, runnerDiameter)   : null
  const francisDim     = turbineType === 'フランシス水車'   ? calcFrancisDimensions(specificSpeed, flowRate, runnerDiameter)        : null
  const francisDetail  = turbineType === 'フランシス水車'   ? calcFrancisDetailedParams(head, flowRate, etaT, ratedRpm, specificSpeed) : null
  const kaplanDim      = turbineType === 'カプラン水車'     ? calcKaplanDimensions(specificSpeed, flowRate, runnerDiameter)         : null
  const crossflowDim   = turbineType === 'クロスフロー水車' ? calcCrossflowDimensions(head, flowRate, runnerDiameter)              : null
  const tubularDim     = turbineType === 'チューブラ水車'   ? calcTubularDimensions(specificSpeed, flowRate, runnerDiameter)       : null

  // ── 水理・構造 ──
  const Ta  = 8.0
  const gd2 = (375 * turbinePower) / (ratedRpm * ratedRpm * Ta) * 1000
  const waveSpeed: Record<string, number> = { steel: 1200, ductile: 1000, frp: 700 }
  const a = waveSpeed[penstock.material] ?? 1000
  const vPen = flowRate / (PI * penstockDiameter * penstockDiameter / 4)
  const waterHammerHead = (a * vPen) / G
  const waterHammerRise = (waterHammerHead / head) * 100
  const headLoss = penstockHeadLoss(flowRate, penstockDiameter, penstock.length, penstock.material)
  const headLossRatio = (headLoss / head) * 100

  // ── 電気 ──
  const generatorKva    = generatorPower / powerFactor
  const annualEnergy    = generatorPower * operatingHours * (capacityFactor / 100) / 1000
  const annualEnergyGwh = annualEnergy / 1000

  // ── 判定 ──
  const checks: TurbineResults['checks'] = {
    cavitation: isImpulse
      ? { result: 'N/A', message: `${turbineType === 'クロスフロー水車' ? 'クロスフロー' : 'ペルトン'}水車は衝動式のためキャビテーション非該当` }
      : { result: cavOk ? 'OK' : 'NG',
          message: `Hs=${suctionHead.toFixed(1)}m ≤ Hs_max=${hsMax!.toFixed(2)}m${!cavOk ? '　→ 設置位置を下流側に変更してください' : ''}` },
    specificSpeed: (() => {
      const r = nsRanges?.find(r => r.turbineType.name === turbineType)
      const lo = r?.nsMin ?? null
      const hi = r?.nsMax ?? null
      const ok = lo !== null && hi !== null
        ? specificSpeed >= lo && specificSpeed <= hi
        : null
      return {
        result: ok === null ? 'N/A' : ok ? 'OK' : '注意',
        message: lo !== null && hi !== null
          ? `Ns=${specificSpeed.toFixed(1)}（${turbineType}の適正範囲 ${lo}〜${hi}）${!ok ? '　→ 形式見直しまたは機数分割を検討' : ''}`
          : `Ns=${specificSpeed.toFixed(1)}（${turbineType}の適正範囲データなし）`,
      }
    })(),
    altitude: {
      result: altitude <= 1500 ? 'OK' : '注意',
      message: `標高 ${altitude}m　大気圧 ${atmPressure.toFixed(2)} kPa${altitude > 1500 ? '　→ キャビテーション余裕を再確認' : ''}`,
    },
    runaway: {
      message: `暴走速度 ${runawaySpeed} rpm（係数×${runawayCoeff}）　発電機・軸系の許容回転数と比較してください`,
    },
    headLoss: {
      result: headLossRatio <= 5 ? 'OK' : headLossRatio <= 10 ? '注意' : 'NG',
      message: `管路損失 hf=${headLoss.toFixed(2)}m（${headLossRatio.toFixed(1)}%）${headLossRatio > 10 ? '　→ 管径拡大または管路短縮を検討' : headLossRatio > 5 ? '　→ 管路損失がやや大きめです' : ''}`,
    },
    waterHammer: {
      result: waterHammerRise <= 20 ? 'OK' : waterHammerRise <= 40 ? '注意' : 'NG',
      message: `ΔH=${waterHammerHead.toFixed(1)}m（+${waterHammerRise.toFixed(1)}%）　遮断弁の閉鎖時間で緩和可能`,
    },
  }

  // ── 速度三角形 ──
  let velocityTriangles: TurbineResults['velocityTriangles'] = null
  if (turbineType === 'ペルトン水車') {
    velocityTriangles = calcPeltonVelocityTriangles(head, ratedRpm, runnerDiameter)
  } else if (turbineType === 'フランシス水車') {
    velocityTriangles = calcFrancisVelocityTriangles(head, flowRate, specificSpeed, ratedRpm, runnerDiameter)
  } else if (turbineType === 'カプラン水車') {
    velocityTriangles = calcAxialVelocityTriangles(head, flowRate, specificSpeed, ratedRpm, runnerDiameter, kaplanDim!.hubRatio)
  } else if (turbineType === 'チューブラ水車') {
    velocityTriangles = calcAxialVelocityTriangles(head, flowRate, specificSpeed, ratedRpm, runnerDiameter, tubularDim!.hubRatio)
  } else if (turbineType === 'クロスフロー水車') {
    velocityTriangles = calcCrossflowVelocityTriangles(head, flowRate, ratedRpm, runnerDiameter, crossflowDim!.runnerWidth)
  }

  return {
    turbineType, turbinePower, generatorPower, specificSpeed,
    ratedRpm, poles, runawaySpeed, cavitationCoef, hsMax,
    atmPressure, runawayCoeff,
    dimensions: {
      runnerDiameter, draftTubeDiameter, casingDiameter,
      penstockDiameter, penstockVelocity,
      pelton:        peltonDim,
      francis:       francisDim,
      francisDetail: francisDetail,
      kaplan:        kaplanDim,
      crossflow:     crossflowDim,
      tubular:       tubularDim,
    },
    velocityTriangles,
    hydraulics: { gd2, waterHammerRise, waterHammerHead, penstock: { headLoss, headLossRatio } },
    electrical: { generatorKva, annualEnergy, annualEnergyGwh },
    checks,
  }
}

export function getEfficiencyCurve(turbineType: TurbineType, etaT: number) {
  const configs: Record<TurbineType, { k: number; qPeak: number }> = {
    'ペルトン水車':     { k: 2.5, qPeak: 0.85 },
    'フランシス水車':   { k: 3.0, qPeak: 0.80 },
    'カプラン水車':     { k: 4.0, qPeak: 0.75 },
    'クロスフロー水車': { k: 2.0, qPeak: 0.75 },  // 広い部分負荷特性
    'チューブラ水車':   { k: 3.5, qPeak: 0.78 },
  }
  return Array.from({ length: 81 }, (_, i) => {
    const q = 0.2 + i * 0.01
    const result: Record<string, number> = { q: Math.round(q * 100) }
    for (const [name, cfg] of Object.entries(configs)) {
      const eta = etaT * (1 - cfg.k * Math.pow(q - cfg.qPeak, 2))
      result[name] = Math.max(0, Math.min(100, eta * 100))
    }
    return result
  })
}

// ── ヒルチャート（N11-Q11-η 性能曲線）データ生成 ──────────────
// フランシス水車の単位速度・単位流量・効率の典型的な関係を
// 経験式で生成する。実測データがある場合はそちらを優先すること。
export function getHillChartData(turbineType: TurbineType, etaTDesign: number) {
  if (turbineType !== 'フランシス水車') return null

  // フランシス水車の設計点（単位速度N11d, 単位流量Q11d）
  const N11d = 62
  const Q11d = 0.25

  // N11の範囲（設計点の±30%）
  const n11Min = N11d * 0.70
  const n11Max = N11d * 1.30
  const q11Min = Q11d * 0.50
  const q11Max = Q11d * 1.70

  const points: Array<{ N11: number; Q11: number; eta: number }> = []

  // N11方向に20点、Q11方向に20点のグリッド
  const nSteps = 20
  const qSteps = 20

  for (let ni = 0; ni <= nSteps; ni++) {
    const N11 = n11Min + (n11Max - n11Min) * ni / nSteps
    for (let qi = 0; qi <= qSteps; qi++) {
      const Q11 = q11Min + (q11Max - q11Min) * qi / qSteps

      // 正規化した座標
      const dN = (N11 - N11d) / (N11d * 0.15)
      const dQ = (Q11 - Q11d) / (Q11d * 0.20)

      // 効率分布（ガウス型の変形）
      const eta = etaTDesign * Math.exp(
        -0.5 * (dN ** 2 + dQ ** 2 + 0.4 * dN * dQ)
      )

      if (eta > 0.3 * etaTDesign) {
        points.push({
          N11: parseFloat(N11.toFixed(2)),
          Q11: parseFloat(Q11.toFixed(4)),
          eta: parseFloat((eta * 100).toFixed(2)),
        })
      }
    }
  }

  return {
    points,
    designPoint: { N11: N11d, Q11: Q11d, eta: etaTDesign * 100 },
    axes: { N11: { min: n11Min, max: n11Max }, Q11: { min: q11Min, max: q11Max } },
  }
}
