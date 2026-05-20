import type { TurbineInputs, TurbineResults, TurbineType, VelocityTriangle } from '@/types'

const RHO = 1000
const G   = 9.81
const PV  = 2.34
const PI  = Math.PI

const MAX_POLE = 24		// 80 -> 24
const MIN_POLE = 4		// 2 -> 4
const NS_BASIS = 160		// 150 -> 160

function selectRatedSpeed(pw: number, head: number, freq: 50 | 60): { n: number; poles: number } {
  let bestN = 100, bestPoles = MIN_POLE, bestDiff = Infinity
  for (let p = MIN_POLE; p <= MAX_POLE; p += 2) {
    const n = 120 * freq / p
    if (n < 100 || n > 1500) continue
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
function autoSelectType(head: number, flowRate: number, specificSpeed: number): TurbineType {
  // チューブラ：超低落差（H≦20m）かつ大流量・高比速度
  if (head <= 20 && flowRate >= 1.0 && specificSpeed >= 300) return 'チューブラ水車'
  // ペルトン：高落差（H>200m）または低比速度
  if (head > 200 || specificSpeed < 80) return 'ペルトン水車'
  // フランシス：中落差・中比速度
  if (specificSpeed < 300) return 'フランシス水車'
  // カプラン：低落差・高比速度
  return 'カプラン水車'
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

// ── メイン計算 ─────────────────────────────────────────────────
export function calculate(inputs: TurbineInputs, forcedType?: TurbineType): TurbineResults {
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
    turbineType = autoSelectType(head, flowRate, specificSpeed)
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
  const peltonDim    = turbineType === 'ペルトン水車'     ? calcPeltonDimensions(specificSpeed, head, flowRate, runnerDiameter)   : null
  const francisDim   = turbineType === 'フランシス水車'   ? calcFrancisDimensions(specificSpeed, flowRate, runnerDiameter)        : null
  const kaplanDim    = turbineType === 'カプラン水車'     ? calcKaplanDimensions(specificSpeed, flowRate, runnerDiameter)         : null
  const crossflowDim = turbineType === 'クロスフロー水車' ? calcCrossflowDimensions(head, flowRate, runnerDiameter)              : null
  const tubularDim   = turbineType === 'チューブラ水車'   ? calcTubularDimensions(specificSpeed, flowRate, runnerDiameter)       : null

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
      const ranges: Record<TurbineType, [number, number]> = {
        'ペルトン水車':   [10, 150],
        'フランシス水車': [80, 300],
        'カプラン水車':   [250, 800],
        'クロスフロー水車': [50, 250],
        'チューブラ水車': [300, 800],
      }
      const [lo, hi] = ranges[turbineType]
      const ok = specificSpeed >= lo && specificSpeed <= hi
      return {
        result: ok ? 'OK' : '注意',
        message: `Ns=${specificSpeed.toFixed(1)}（${turbineType}の適正範囲 ${lo}〜${hi}）${!ok ? '　→ 形式見直しまたは機数分割を検討' : ''}`,
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
      pelton:    peltonDim,
      francis:   francisDim,
      kaplan:    kaplanDim,
      crossflow: crossflowDim,
      tubular:   tubularDim,
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
