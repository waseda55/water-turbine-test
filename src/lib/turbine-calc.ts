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

function selectRatedSpeed(pw: number, head: number, freq: 50 | 60): { n: number; poles: number } {
  let bestN = 100, bestPoles = MIN_POLE, bestDiff = Infinity
  for (let p = MIN_POLE; p <= MAX_POLE; p += 2) {
    const n = 120 * freq / p
    if (n < MIN_NRPM || n > MAX_NRPM) continue
    const ns = n * Math.sqrt(pw) / Math.pow(head, 1.25)
    const diff = Math.abs(ns - NS_BASIS)
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

  const b1r = beta1b * PI / 180, b2r = beta2b * PI / 180
  const tanRatio = Math.tan(b1r / 2) / Math.tan(b2r / 2)
  const lb = tanRatio > 0 && (b2r - b1r) !== 0
    ? (D_outlet - D_inlet) / (b2r - b1r) / 2 * Math.log(tanRatio)
    : null

  // ── ガイドベーン ──
  const kDg1 = 1.2817934656e-5 * Nsp ** 2 - 0.001219602867175  * Nsp + 1.221638424287550
  const Dg1  = kDg1 * D1
  const kDg2 = 8.705950176e-6  * Nsp ** 2 - 0.001045312125451  * Nsp + 1.072765656988970
  const Dg2  = kDg2 * D1
  const Rg   = (Dg2 + (Dg1 - Dg2) * 0.42) / 2
  const Dlx  = Rg - Dg2 / 2
  const Bg1  = B1, Bg2 = B1

  // ── ステーベーン ──
  const kDs1 = 1.9762543999e-5 * Nsp ** 2 - 0.001766979265091 * Nsp + 1.458758687476440
  const Ds1  = kDs1 * D1
  const kDs2 = 1.3200375620e-5 * Nsp ** 2 - 0.001256058280413 * Nsp + 1.258329780057310
  const Ds2  = kDs2 * D1
  const Bs1  = B1, Bs2 = B1

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

  return {
    D1, D5, D6, D2, D7, H2, B1, Vm1, Vm2,
    alpha1, beta1b, beta2b, lb,
    Dg1, Dg2, Rg, Dlx, Bg1, Bg2,
    Ds1, Ds2, Bs1, Bs2,
    Dc, lCa, Vc0,
    stayVaneAngles,
  }
}

// ── メイン計算 ─────────────────────────────────────────────────
export function calculate(inputs: TurbineInputs, forcedType?: TurbineType, nsRanges?: NsRange[]): TurbineResults {
  const { head, flowRate, turbineEff, generatorEff, suctionHead, altitude, frequency,
          powerFactor, operatingHours, capacityFactor, penstock } = inputs
  const etaT = turbineEff / 100
  const etaG = generatorEff / 100

  const turbinePower   = (RHO * G * flowRate * head * etaT) / 1000
  const generatorPower = turbinePower * etaG
  const { n: ratedRpm, poles } = selectRatedSpeed(turbinePower, head, frequency)
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
