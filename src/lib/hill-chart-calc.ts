// ============================================================
// フランシス水車 1D損失計算モジュール
// 1d_loss_Nchange.py の完全TypeScript移植版
// 入力: TurbineResults（turbine-calc.tsの出力）+ 粗さパラメータ
// 出力: N11, Q11, eta(%) のヒルチャート用データ
// ============================================================

import type { TurbineResults } from '@/types'

// ==========================================
// 定数
// ==========================================
const PI  = 3.14159
const G   = 9.80663
const RHO = 998.2
const MU  = 0.001004

// ==========================================
// 粗さパラメータ（input2.txt デフォルト値）
// ==========================================
export interface RoughnessParams {
  rrC: number   // ケーシング相対粗さ
  rrS: number   // ステーベーン相対粗さ
  rrG: number   // ガイドベーン相対粗さ
  rrR: number   // ランナ相対粗さ
  rrD: number   // ドラフトチューブ相対粗さ
  rrW: number   // シール相対粗さ（固定）
}

export const DEFAULT_ROUGHNESS: RoughnessParams = {
  rrC: 0.00001,
  rrS: 0.00008,
  rrG: 0.00008,
  rrR: 0.00003,
  rrD: 0.000006,
  rrW: 0.005,
}

// ==========================================
// ヒルチャートデータ点
// ==========================================
export interface HillChartPoint {
  N_ratio: number
  GVO:     number
  N11:     number
  Q11:     number
  eta:     number   // %
  etaH:    number   // 水力効率 %
  etaL:    number   // 容積効率 %
  etaM:    number   // 機械効率 %
  N:       number
  Q:       number
  H:       number
  Hth:     number
  P:       number
  Ns:      number
}

// ==========================================
// 1. 面積・形状系
// ==========================================
function calcAreaCylinder(r: number, b: number, epsilon: number) {
  return epsilon * 2 * PI * r * b
}
function calcAreaCone(b: number, epsilon: number, D1: number, D2: number) {
  return epsilon * PI * b * ((D1 + D2) * 0.5)
}
function calcAreaDt(hdd: number, bdd: number) {
  return hdd === bdd ? PI * (hdd / 2) ** 2 : hdd * bdd
}
function calcAreaCircle(r: number) {
  return PI * r ** 2
}
function calcLengthCsg(rc: number) {
  return 2 * PI * rc
}
function calcMCsg(dC1: number) {
  return (PI * (dC1 / 2) ** 2) / (PI * dC1)
}
function calcMCascades(z: number, rm1: number, b1: number, r2: number, b2: number) {
  const v1 = 2 * PI * rm1 * b1 / (2 * z * (b1 + (2 * PI * rm1 / z)))
  const v2 = 2 * PI * r2  * b2 / (2 * z * (b2 + (2 * PI * r2  / z)))
  return (v1 + v2) / 2
}
function calcEpsilon(z: number, t: number, r: number) {
  return (2 * PI * r - z * t) / (2 * PI * r)
}
function calcAlpha02CorrectedGv(alphaG02: number, GVO: number) {
  return alphaG02 * (0.0057 * GVO + 0.242)
}
function calcRadiiGv(lG: number, lx: number, rG: number) {
  const a = Math.abs(0.5 - (lG - lx) / lG)
  const rG1 = rG + (a * rG) / 2
  const rG2 = rG - (a * rG) / 5
  return { rG1, rG2 }
}
function calcRadiusRms(D1: number, D2: number) {
  return (((D1 / 2) ** 2 + (D2 / 2) ** 2) / 2) ** 0.5
}
function calcHeightB2(h2: number, D6: number, D2: number) {
  return (h2 ** 2 + ((D2 - D6) ** 2) / 4) ** 0.5
}
function calcMRv(zR: number, rm1: number, B1: number, D2: number, D6: number, B2: number) {
  const fmR = PI * (D2 + D6)
  const v1 = B2 * fmR / (2 * zR * (2 * B2 + fmR / zR))
  const v2 = 2 * PI * rm1 * B1 / (2 * zR * (B1 + 2 * PI * rm1 / zR))
  return (v1 + v2) / 2
}
function calcLengthDt(lDC: number, rDB: number, lDD: number) {
  return lDC + (2 * rDB * PI) / 4 + lDD
}
function calcMDt(rDC1: number, hDD: number, bDD: number) {
  const v1 = (PI * rDC1 ** 2) / (2 * PI * rDC1)
  const v2 = (hDD * bDD) / (2 * (hDD + bDD))
  return (v1 + v2) / 2
}

// ==========================================
// 2. 速度三角形・オイラー系
// ==========================================
function calcW(vm: number, beta0deg: number) {
  return vm / Math.sin(PI * beta0deg / 180)
}
function calcV(vm: number, deg: number) {
  return vm / Math.tan(PI * deg / 180)
}
function calcVelAverage(vm1: number, vm2: number, deg01: number, deg02: number) {
  return (vm1 / Math.sin(PI * deg01 / 180) + vm2 / Math.sin(PI * deg02 / 180)) / 2
}
function calcU(r: number, omega: number) { return r * omega }
function calcOmega(N: number) { return 2 * PI * N / 60 }
function calcVu1(vm1: number, alphaG02: number) {
  return vm1 * (1 / Math.tan(PI * alphaG02 / 180))
}
function calcBeta01(vm1: number, vu1: number, u1: number): number {
  if (u1 > vu1) return Math.atan(vm1 / (u1 - vu1)) * 180 / PI
  if (vu1 === 0) return 90
  return PI * 180 / PI - Math.atan(vm1 / (vu1 - u1)) * 180 / PI
}
function calcSlipFactor(beta2b: number, zR: number, D1: number, D2: number) {
  const a  = 0.2
  const ek = 1 / Math.exp(8.16 * Math.sin(PI * beta2b / 180) / zR)
  let Fk   = Math.sin(PI * beta2b / 180) ** 0.5 / zR ** 0.7
  if (ek < D2 / D1) {
    Fk = 1 - (1 - Fk) * (1 - ((D2 / D1 - ek) ** 3) / (1 - ek) ** 3)
  }
  return Fk * a
}
function calcVu2(k: number, u2: number, vm2: number, beta2b: number) {
  return (1 + k) * u2 - vm2 / Math.tan(PI * beta2b / 180)
}
function calcBeta02(vm2: number, vu2: number, u2: number) {
  return Math.atan(vm2 / (u2 - vu2)) * 180 / PI
}
function calcAlpha02(vm2: number, vu2: number): number {
  if (vu2 > 0) return Math.atan(vm2 / vu2) * 180 / PI
  if (vu2 === 0) return 90
  return (PI - Math.atan(vm2 / Math.abs(vu2))) * 180 / PI
}
function calcHth(u2: number, vu2: number, u1: number, vu1: number) {
  return (1 / G) * (u1 * vu1 - u2 * vu2)
}

// ==========================================
// 3. 損失計算系
// ==========================================
function calcReynolds(w: number, m: number) {
  return w * 4 * m / (MU / RHO)
}
function calcFrictionFactor(Re: number, rr: number): number {
  if (Re < 2000) return 64 / Re
  if (Re > 4000) {
    let Pl = 0.001
    for (let i = 0; i < 20000; i++) {
      const f  = 1 / Math.sqrt(Pl) + 2 * Math.log10(rr / 3.71 + 2.51 / Re / Math.sqrt(Pl))
      const df = -0.5 * Pl ** -1.5 - 2.51 / (Re * Math.log(10)) * Pl ** -1.5 / (rr / 3.71 + 2.51 / Re / Math.sqrt(Pl))
      const nl = Pl - f / df
      if (Math.abs(nl - Pl) < 0.000001) return nl
      Pl = nl
    }
    return Pl
  }
  return 0
}
function calcZetaFriction(l: number, m: number, Re: number, rr: number) {
  return calcFrictionFactor(Re, rr) * l / (4 * m)
}
function calcLossFriction(zetaf: number, v1: number, v2: number) {
  return zetaf * (v1 ** 2 + v2 ** 2) / (2 * G) / 2
}
function calcLossFrictionCsg(zetaCf: number, vmc: number) {
  return zetaCf * vmc ** 2 / (2 * G)
}
function calcVAbs1(vmS1: number, alphaS1b: number) {
  return (vmS1 ** 2 * (1 + (1 / Math.tan(PI * alphaS1b / 180)) ** 2)) ** 0.5
}
function calcVAbs2(vmS2: number, alphaS2b: number) {
  return (vmS2 ** 2 * (1 + (1 / Math.tan(PI * alphaS2b / 180)) ** 2)) ** 0.5
}
function calcVelComponentsGv(Q: number, P0: number, zg: number, Bg2: number, vmg1: number, alphaS2b: number, vmg2: number, alphaG02: number) {
  const vag0  = Q / (P0 * zg * Bg2)
  const vvag1 = (vmg1 ** 2 * (1 + (1 / Math.tan(PI * alphaS2b / 180)) ** 2)) ** 0.5
  const vvag2 = (vmg2 ** 2 * (1 + (1 / Math.tan(PI * alphaG02 / 180)) ** 2)) ** 0.5
  return { vag0, vvag1, vvag2 }
}
function calcLossFrictionGv(zetaGf: number, vag0: number) {
  return zetaGf * vag0 ** 2 / (2 * G)
}
function calcLossShockSv(vus1: number, vvus1: number) {
  return 0.5 * (vus1 - vvus1) ** 2 / (2 * G)
}
function calcLossShockGv(rs2: number, rg1: number, vus2: number, vug0: number) {
  return 0.5 * ((rs2 / rg1) * vus2 - vug0) ** 2 / (2 * G)
}
function calcLossShockRv(rg2: number, rm1: number, vug2: number, vvu1: number) {
  return 1.0 * ((rg2 / rm1) * vug2 - vvu1) ** 2 / (2 * G)
}
function calcVAbsGv2(Q: number, rg2: number, Bg2: number, alphaG02: number) {
  return ((Q / (2 * PI * rg2 * Bg2)) ** 2 * (1 + (1 / Math.tan(PI * alphaG02 / 180)) ** 2)) ** 0.5
}
function calcVAbsRv2(vm2: number, beta02: number) {
  return (vm2 ** 2 * (1 + (1 / Math.tan(PI * beta02 / 180)) ** 2)) ** 0.5
}
function calcLossMixing(epsilon2: number, va2: number) {
  return 0.5 * ((va2 / epsilon2) ** 2 - va2 ** 2) / (2 * G)
}
function calcLossRecirculationRv(Q: number, Qopt: number, u1: number, Krec = 0.2) {
  if (Q < Qopt) return Krec * (u1 ** 2 / (2 * G)) * (1 - Q / Qopt) ** 2
  return 0
}
function calcMPortGv(P0: number, BG1: number) {
  return P0 * BG1 * 0.5 / (P0 + BG1)
}
function calcZetaGrossGv(mGp: number, D1: number) {
  return 119.6 * (mGp / D1) ** 2 - 9.5 * (mGp / D1) + 0.2
}
function calcCoefAGv(P0: number, P00: number) {
  const r = P0 / P00
  return 1.9307 * r ** 3 - 4.8902 * r ** 2 + 4.0267 * r - 0.276
}
function calcLossGrossGv(Q: number, ZG: number, P0: number, P00: number, BG1: number, D1: number) {
  const mGp  = calcMPortGv(P0, BG1)
  const zetaG = calcZetaGrossGv(mGp, D1)
  const a    = calcCoefAGv(P0, P00)
  return (a * zetaG / (2 * G)) * (Q / (ZG * P0 * BG1)) ** 2
}
function calcLossExpansionDt(vmd1: number) {
  return 0.1 * vmd1 ** 2 / (2 * G)
}
function calcLossSwirlDt(u2: number, w2: number, beta02: number) {
  return 1.1 * (u2 - w2 * Math.cos(PI * beta02 / 180)) ** 2 / (2 * G)
}
function calcZetaBendDt(rdc2: number, bdb: number, _hdb2: number, rdb: number) {
  const adb = (rdc2 + bdb / 2) / 2
  return 0.131 + 1.847 * (adb / rdb) ** 3.5
}
function calcLossBendDt(zetaDB: number, vmdb: number) {
  return zetaDB * vmdb ** 2 / (2 * G)
}

// ==========================================
// 4. 漏れ・機械損失系
// ==========================================
function calcVRelativeSeal(uw: number) {
  return uw  // vz=0固定
}
function calcHeadDiffSeal(H0: number, dHC: number, dHS: number, dHG: number, dHD: number, u1: number, uw: number) {
  return H0 - (dHS + dHC + dHG + dHD) - (u1 ** 2 - uw ** 2) / (8 * G)
}
function calcAreaSeal(bw: number, rw: number) {
  return PI * ((bw + rw) ** 2 - rw ** 2)
}
function calcCoefLeakage(lambdaw: number, lw: number, bw: number) {
  return 1 / (lambdaw * lw / (2 * bw) + 1.5) ** 0.5
}
function calcLeakageFlow(CwAw: number, deltaH: number, Q: number) {
  if (deltaH < 0) return NaN
  return CwAw * (2 * G * deltaH) ** 0.5 + Q * 0.01
}
function calcEffVolumetric(Q: number, deltaQ: number) {
  return (Q - deltaQ) / Q
}
function calcDragCoefDisc(D1: number, u1: number) {
  const Rem = D1 * u1 / (2 * (MU / RHO))
  return 0.0465 / Rem ** 0.2
}
function calcDiscFrictionLoss(Cf: number, D1: number, u1: number, omega: number) {
  const deltaN = 2 / 102 * Cf * (RHO / G) * (D1 / 2) ** 5 * omega ** 3
  const deltax = G * deltaN / (D1 * u1 ** 3)
  return { deltax, deltaN }
}
function calcMechanicalPower(D1: number, u1: number, QR: number, Hth: number) {
  const Nm = RHO * G * QR * Hth / 1000
  const xm = G * Nm / (D1 ** 2 * u1 ** 3)
  return { Nm, xm }
}
function calcEffMechanical(xm: number, deltax: number) {
  return (xm - deltax) / xm
}

// ==========================================
// 5. 無次元評価系
// ==========================================
function calcUnitParameters(N: number, N11: number, cn1: number, D1: number, H0: number, Q: number) {
  if (cn1 === 0) {
    const N11_new = N * D1 / H0 ** 0.5
    const Q11    = Q / (D1 ** 2 * H0 ** 0.5)
    return { N: N, N11: N11_new, Q11 }
  } else {
    const N_new = H0 ** 0.5 * N11 / D1
    const Q11   = Q / (D1 ** 2 * H0 ** 0.5)
    return { N: N_new, N11, Q11 }
  }
}
function calcSpecificSpeed(Q: number, H0: number, eta: number, N: number) {
  const P  = eta * RHO * G * Q * H0 / 1000
  const Ns = N * P ** 0.5 / H0 ** 1.25
  return { P, Ns }
}

// ==========================================
// メイン計算関数
// ==========================================
export interface HillChartInputs {
  head:            number   // 有効落差 H [m]
  flowRate:        number   // 設計流量 Q [m³/s]
  rotationalSpeed: number   // 定格回転数 N [rpm]
  turbineEff:      number   // 水車効率 η_t（0〜1）
  N11:             number   // 単位回転速度（設計点）
}

export function calcHillChart(
  results:  TurbineResults,
  inputs:   HillChartInputs,
  rp:       RoughnessParams = DEFAULT_ROUGHNESS,
): HillChartPoint[] {
  const fd = results.dimensions.francisDetail
  if (!fd) return []

  // ── 設計パラメータ（turbine_selection.txtに相当） ──
  const cn1      = 0
  const H0       = inputs.head
  const Qcr      = inputs.flowRate
  const N_base   = inputs.rotationalSpeed
  const N11_base = inputs.N11

  // ランナ
  const zR     = fd.Zr
  const t1     = fd.t1
  const t2     = fd.t2
  const l      = fd.lb ?? 0.252
  const D1     = fd.D1
  const D5     = fd.D5
  const D6     = fd.D6
  const D2     = fd.D2
  const D7     = fd.D7
  const h2     = fd.H2
  const B1     = fd.B1
  const beta1b = fd.beta1b
  const beta2b = fd.beta2b

  // ステーベーン
  const zS      = fd.Zs
  const tS1     = fd.ts1
  const tS2     = fd.ts2
  const lS      = fd.ls
  const dS1     = fd.Ds1
  const dS2     = fd.Ds2
  const BS1     = fd.Bs1
  const BS2     = fd.Bs2
  const alphaS1b = fd.alphaS1b
  const alphaS2b = fd.alphaS2b

  // ガイドベーン
  const zG  = fd.Zg
  const tG1 = fd.tg1
  const tG2 = fd.tg2
  const lG  = fd.lg
  const rG  = fd.Rg
  const lx  = fd.Dlx
  const BG1 = fd.B1
  const BG2 = fd.B1
  const P00 = fd.P00

  const alphaG1bi = fd.guideVaneTable.map(r => r.alphaG1b)
  const alphaG2bi = fd.guideVaneTable.map(r => r.alphaG2b)
  const alphaG02i = fd.guideVaneTable.map(r => r.alphaG02)

  const GVOi = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110]

  // ケーシング
  const dC1 = fd.Dc
  const lCa = fd.lCa

  // ドラフトチューブ
  const lDC  = fd.ldc
  const rDC1 = fd.rdc1
  const rDC2 = fd.rdc2
  const rDB  = fd.rdb
  const bDB  = fd.bdb
  const hDB2 = fd.hdb2
  const lDD  = fd.ldd
  const bDD  = fd.bdd
  const hDD  = fd.hdd

  // シール
  const seal = fd.seal
  const bwt  = [fd.bw_1, fd.bw_2]
  const lwt  = [fd.lw_1, fd.lw_2]
  const rwt  = [fd.rl_1, fd.rl_2]

  // ── 初期面積・形状計算 ──
  const AC  = calcAreaCircle(dC1 / 2)
  const lC  = calcLengthCsg((dC1 + dS1) * 0.5) + lCa
  const mC  = calcMCsg(dC1)
  const rS1 = dS1 / 2, rS2 = dS2 / 2
  const epsilonS1 = calcEpsilon(zS, tS1, rS1)
  const epsilonS2 = calcEpsilon(zS, tS2, rS2)
  const AS1 = calcAreaCylinder(rS1, BS1, epsilonS1)
  const AS2 = calcAreaCylinder(rS2, BS2, epsilonS2)
  const mS  = calcMCascades(zS, rS1, BS1, rS2, BS2)
  const lD  = calcLengthDt(lDC, rDB, lDD)
  const mD  = calcMDt(rDC1, hDD, bDD)
  const AD1 = calcAreaCircle(rDC1)
  const ADB1 = calcAreaCircle(rDC2)
  const ADB2 = calcAreaDt(bDB, hDB2)
  const AD2 = calcAreaDt(hDD, bDD)
  const rm1 = calcRadiusRms(D1, D5)
  const rm2 = (D2 + D6) / 2 / 2
  const b2  = calcHeightB2(h2, D6, D2)
  const epsilonR1 = calcEpsilon(zR, t1, rm1)
  const epsilonR2 = calcEpsilon(zR, t2, rm2)
  const AR1 = calcAreaCone(B1, epsilonR1, D1, D5)
  const AR2 = (Math.PI * (D2 / 2) ** 2 - Math.PI * (D7 / 2) ** 2) * epsilonR2
  const mR  = calcMRv(zR, rm1, B1, D2, D6, b2)

  const output: HillChartPoint[] = []
  const n_ratios = [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4]

  // ── 回転数ループ ──
  for (const n_ratio of n_ratios) {
    const N   = N_base * n_ratio
    const N11 = N11_base * n_ratio
    const Qmax_init = Qcr * 1.5
    let Q_guess = Qcr
    let Qmax = Qmax_init

    // ── 開度ループ（逆順）──
    for (let ii = 9; ii >= 0; ii--) {
      const GVO = GVOi[ii]
      const { rG1, rG2 } = calcRadiiGv(lG, lx, rG)
      const alphaG1b = alphaG1bi[ii]
      const alphaG01 = alphaG1b
      const alphaG02_input = alphaG02i[ii]
      const alphaG02 = calcAlpha02CorrectedGv(alphaG02_input, GVO)
      const P0 = P00 * 0.01 * GVO

      if (GVO === 0 || alphaG2bi[ii] === 0) continue

      const mG = calcMCascades(zG, rG1, BG1, rG2, BG2)
      const epsilonG1 = calcEpsilon(zG, tG1, rG1)
      const epsilonG2 = calcEpsilon(zG, tG2, rG2)
      const AG1 = calcAreaCylinder(rG1, BG1, epsilonG1)
      const AG2 = calcAreaCylinder(rG2, BG2, epsilonG2)

      let Q  = Q_guess
      let QQ = 0, HH = 0
      let H  = 0
      let deltaQ    = 0.00001
      let etal      = 1
      let etam      = 1
      let QR        = Q
      let Hth       = 0
      let beta01    = 0
      let beta02    = 0
      let alpha02   = 0
      let w1 = 0, w2 = 0
      let vm1 = 0, vm2 = 0
      let u1  = 0, u2  = 0
      let vu1 = 0, vu2 = 0
      let HCf = 0, HSf = 0, HSs = 0, HSm = 0
      let HGf = 0, HGs = 0, HGm = 0
      let HRf = 0, HRs = 0, HRm = 0, HRn = 0
      let HDf = 0, HDe = 0, HDu = 0, HDB = 0
      let deltaHC = 0, deltaHS = 0, deltaHG = 0, deltaHR = 0, deltaHD = 0
      let vmC = 0, vmG1 = 0, vmG2 = 0, vuG2 = 0
      let converged = false

      // ── 流量収束ループ ──
      for (let jj = 0; jj < 100000; jj++) {
        const up = calcUnitParameters(N, N11, cn1, D1, H0, Q)
        const omega = calcOmega(up.N)
        u1 = calcU(rm1, omega)
        u2 = calcU(rm2, omega)
        const k = calcSlipFactor(beta2b, zR, 2 * rm1, 2 * rm2)

        // ケーシング損失
        vmC = Q / AC
        const ReC = calcReynolds(vmC, mC)
        const zetaCf = calcZetaFriction(lC, mC, ReC, rp.rrC)
        HCf = calcLossFrictionCsg(zetaCf, vmC)
        deltaHC = HCf

        // ステーベーン損失
        const vmS1 = Q / AS1
        const vmS2 = Q / AS2
        const waveS = calcVelAverage(vmS1, vmS2, alphaS1b, alphaS2b)
        const ReS   = calcReynolds(waveS, mS)
        const zetaSf = calcZetaFriction(lS, mS, ReS, rp.rrS)
        const vvaS1 = calcVAbs1(vmS1, alphaS1b)
        const vvaS2 = calcVAbs2(vmS2, alphaS2b)
        HSf = calcLossFriction(zetaSf, vvaS1, vvaS2)
        const vuS1 = calcV(vmS1, alphaS1b)
        HSs = calcLossShockSv(vuS1, vuS1)
        const vaS2 = calcVAbsRv2(vmS2, alphaS2b)
        HSm = calcLossMixing(epsilonS2, vaS2)
        deltaHS = HSf + HSs + HSm

        // ガイドベーン損失
        vmG1 = Q / AG1
        vmG2 = Q / AG2
        vuG2 = calcV(vmG2, alphaG02)
        const waveG  = calcVelAverage(vmG1, vmG2, alphaG01, alphaG02)
        const ReG    = calcReynolds(waveG, mG)
        const zetaGf = calcZetaFriction(lG, mG, ReG, rp.rrG)
        const { vag0 } = calcVelComponentsGv(Q, P0, zG, BG2, vmG1, alphaS2b, vmG2, alphaG02)
        HGf = calcLossFrictionGv(zetaGf, vag0)
        const vuS2 = calcV(vmS2 * (AS2 / AG1), alphaS2b)
        const vuG0 = calcV(vag0, alphaG01)
        HGs = calcLossShockGv(rS2, rG1, vuS2, vuG0)
        const vaG2 = calcVAbsGv2(Q, rG2, BG2, alphaG02)
        HGm = calcLossMixing(epsilonG2, vaG2)
        deltaHG = calcLossGrossGv(Q, zG, P0, P00, BG1, D1)

        // ドラフトチューブ損失
        const vmD1 = Q / AD1
        const vmD2 = Q / AD2
        const ReD  = calcReynolds(0.5 * (vmD1 + vmD2), mD)
        const zetaDf = calcZetaFriction(lD, mD, ReD, rp.rrD)
        HDf = calcLossFriction(zetaDf, vmD1, vmD2)
        HDe = calcLossExpansionDt(vmD1)
        const vmDB  = Q / ((ADB1 + ADB2) / 2)
        const zetaDB = calcZetaBendDt(rDC2, bDB, hDB2, rDB)
        HDB = calcLossBendDt(zetaDB, vmDB)

        deltaQ = 0.00001
        let PdeltaQ = 0

        // ── 漏れ収束ループ ──
        for (let kk = 0; kk < 100000; kk++) {
          PdeltaQ = deltaQ
          QR = Q - deltaQ
          vm1 = QR / AR1
          vm2 = QR / AR2
          vu1 = calcVu1(vm1, alphaG02)
          beta01 = calcBeta01(vm1, vu1, u1)
          vu2  = calcVu2(k, u2, vm2, beta2b)
          beta02 = calcBeta02(vm2, vu2, u2)
          alpha02 = calcAlpha02(vm2, vu2)
          w1 = calcW(vm1, beta01)
          w2 = calcW(vm2, beta02)
          Hth = calcHth(u2, vu2, u1, vu1)

          const waveR = calcVelAverage(vm1, vm2, beta01, beta02)
          const ReR   = calcReynolds(waveR, mR)
          const zetaRf = 2 * calcZetaFriction(l, mR, ReR, rp.rrR)
          HRf = calcLossFriction(zetaRf, w1, w2)

          const vvu1 = u1 - calcV(vm1, beta1b)
          HRs = calcLossShockRv(rG2, rm1, vuG2, vvu1)
          const va2 = calcVAbsRv2(vm2, beta02)
          HRm = calcLossMixing(epsilonR2, va2)

          const Qopt = 0.8 * Qmax
          HRn = calcLossRecirculationRv(Q, Qopt, u1)
          deltaHR = HRf + HRs + HRm + HRn

          HDu = calcLossSwirlDt(u2, w2, beta02)
          deltaHD = HDf + HDe + HDu + HDB

          // 漏れ
          let CwAw = 0, uw = 0
          for (let ll = 0; ll < seal; ll++) {
            const bw = bwt[ll], rw = rwt[ll], lw = lwt[ll]
            if (bw * rw * lw < 1e-10) continue
            uw = calcU(rw, omega)
            const vr = calcVRelativeSeal(uw)
            const Rew = 2 * bw * vr / (MU / RHO)
            const lambdaw = calcFrictionFactor(Rew, rp.rrW)
            const Aw = calcAreaSeal(bw, rw)
            const Cw = calcCoefLeakage(lambdaw, lw, bw)
            CwAw += (Cw * Aw) ** -2
          }
          if (CwAw > 0) CwAw = (1 / CwAw) ** 0.5

          const deltaH_val = calcHeadDiffSeal(H0, deltaHC, deltaHS, deltaHG, deltaHD, u1, uw)
          deltaQ = calcLeakageFlow(CwAw, deltaH_val, Q)
          if (isNaN(deltaQ)) break

          etal = calcEffVolumetric(Q, deltaQ)
          H    = Hth + deltaHR + deltaHS + deltaHC + deltaHG + deltaHD
          if (Math.abs(deltaQ - PdeltaQ) < 0.00005) break
        }

        if (Math.abs(H0 - H) < 0.00001 || isNaN(Q)) { converged = true; break }

        if (jj === 0) {
          const Qdammy = Q
          Q  = Q + 0.0006 * (H0 - H)
          QQ = Qdammy; HH = H
        } else {
          const Qdammy = Q
          const denom  = (H0 - H) - (H0 - HH)
          if (denom !== 0) {
            Q = Q - 0.8 * (H0 - H) * (Q - QQ) / denom
            if (Q <= 0) Q = 0.1
          }
          QQ = Qdammy; HH = H
        }
      }

      if (!converged) continue
      if (isNaN(Q) || Math.abs(H0 - H) > 0.1) continue

      Q_guess = Q

      // 最終評価
      const Cf = calcDragCoefDisc(D1, u1)
      const omega_f = calcOmega(N)
      const { deltax } = calcDiscFrictionLoss(Cf, D1, u1, omega_f)
      const { xm }    = calcMechanicalPower(D1, u1, QR, Hth)
      etam = calcEffMechanical(xm, deltax)

      const etaH = Hth / H0
      const eta  = etaH * etal * etam

      const up2 = calcUnitParameters(N, N11, cn1, D1, H0, Q)
      const { P, Ns } = calcSpecificSpeed(Q, H0, eta, up2.N)

      if (ii === 9) Qmax = Q

      output.push({
        N_ratio: n_ratio,
        GVO,
        N11:  up2.N11,
        Q11:  up2.Q11,
        eta:  eta  * 100,
        etaH: etaH * 100,
        etaL: etal * 100,
        etaM: etam * 100,
        N:    up2.N,
        Q,
        H,
        Hth,
        P,
        Ns,
      })
    }
  }

  return output
}
