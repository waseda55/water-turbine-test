// ============================================================
// フランシス水車 Q-η曲線 1D損失計算モジュール
// 1d_loss_ver2.py の完全TypeScript移植版
// 設計回転数固定、GVO=20〜110%で流量を変化させてη(Q)を計算
// ============================================================

import type { TurbineResults } from '@/types'
import { DEFAULT_ROUGHNESS, type RoughnessParams } from '@/lib/hill-chart-calc'

export { DEFAULT_ROUGHNESS, type RoughnessParams }

// ── 定数 ──
const PI  = 3.14159
const G   = 9.80663
const RHO = 998.2
const MU  = 0.001004

// ── 出力データ型 ──
export interface QEtaPoint {
  GVO:    number
  Q:      number
  eta:    number   // 総合効率 [%]
  etaH:   number   // 水力効率 [%]
  etaL:   number   // 容積効率 [%]
  etaM:   number   // 機械効率 [%]
  P:      number   // 出力 [kW]
  Hth:    number   // 理論揚程 [m]
  // 損失内訳 [% of H0]
  thetaC:  number  // ケーシング
  thetaS:  number  // ステーベーン合計
  thetaG:  number  // ガイドベーン合計
  thetaR:  number  // ランナ合計
  thetaD:  number  // ドラフトチューブ合計
}

// ── 1. 面積・形状系 ──
function areaCircle(r: number)                          { return PI * r * r }
function areaCylinder(r: number, b: number, eps: number){ return eps * 2*PI*r*b }
function areaCone(b: number, eps: number, D1: number, D2: number){ return eps * PI * b * (D1+D2)*0.5 }
function areaDt(h: number, w: number)                   { return h === w ? PI*(h/2)**2 : h*w }
function lengthCsg(rc: number)                          { return 2*PI*rc }
function mCsg(dC1: number)                              { return (PI*(dC1/2)**2)/(PI*dC1) }
function mCascades(z: number, rm1: number, b1: number, r2: number, b2: number) {
  return (2*PI*rm1*b1/(2*z*(b1+2*PI*rm1/z)) + 2*PI*r2*b2/(2*z*(b2+2*PI*r2/z)))/2
}
function epsilon(z: number, t: number, r: number)       { return (2*PI*r - z*t)/(2*PI*r) }
function radiusRms(D1: number, D2: number)              { return Math.sqrt((D1**2+D2**2)/2)/2*2 /* =sqrt((r1^2+r2^2)/2)*2/2 */ }
// ★ Python calc_radius_rms(D1,D5) → sqrt((D1²+D5²)/2)/2 … いや実装確認
function calcRm1(D1: number, D5: number)               { return Math.sqrt((D1**2+D5**2)/2)/2 }
function heightB2(h2: number, D6: number, D2: number)  { return Math.sqrt(h2**2 + ((D2-D6)**2)/4) }
function mRv(zR: number, rm1: number, B1: number, D2: number, D6: number, b2: number) {
  const fmR = PI*(D2+D6)
  return (b2*fmR/(2*zR*(2*b2+fmR/zR)) + 2*PI*rm1*B1/(2*zR*(B1+2*PI*rm1/zR)))/2
}
function lengthDt(lDC: number, rDB: number, lDD: number) { return lDC + 2*rDB*PI/4 + lDD }
function mDt(rDC1: number, hDD: number, bDD: number) {
  return ((PI*rDC1**2)/(2*PI*rDC1) + (hDD*bDD)/(2*(hDD+bDD)))/2
}

// ── 2. 速度系 ──
function calcW(vm: number, betaDeg: number)    { return vm / Math.sin(PI*betaDeg/180) }
function calcV(vm: number, deg: number)        { return vm / Math.tan(PI*deg/180) }
function velAvg(vm1: number, vm2: number, a1: number, a2: number) {
  return (vm1/Math.sin(PI*a1/180) + vm2/Math.sin(PI*a2/180))/2
}
function calcU(r: number, omega: number)       { return r * omega }
function omega(N: number)                      { return 2*PI*N/60 }
function vu1(vm1: number, alphaG02: number)    { return vm1/Math.tan(PI*alphaG02/180) }
function beta01(vm1: number, vu1v: number, u1: number): number {
  if (u1 > vu1v) return Math.atan(vm1/(u1-vu1v))*180/PI
  if (vu1v === 0) return 90
  return 180 - Math.atan(vm1/(vu1v-u1))*180/PI
}
function slipFactor(beta2b: number, zR: number, D1: number, D2: number) {
  const ek = 1/Math.exp(8.16*Math.sin(PI*beta2b/180)/zR)
  let Fk = Math.sin(PI*beta2b/180)**0.5 / zR**0.7
  if (ek < D2/D1) Fk = 1-(1-Fk)*(1-((D2/D1-ek)**3)/(1-ek)**3)
  return Fk*0.2
}
function vu2(k: number, u2v: number, vm2v: number, beta2b: number) {
  return (1+k)*u2v - vm2v/Math.tan(PI*beta2b/180)
}
function beta02(vm2v: number, vu2v: number, u2v: number) { return Math.atan(vm2v/(u2v-vu2v))*180/PI }
function alpha02(vm2v: number, vu2v: number): number {
  if (vu2v > 0) return Math.atan(vm2v/vu2v)*180/PI
  if (vu2v === 0) return 90
  return (PI - Math.atan(vm2v/Math.abs(vu2v)))*180/PI
}
function hth(u2v: number, vu2v: number, u1v: number, vu1v: number) {
  return (1/G)*(u1v*vu1v - u2v*vu2v)
}

// ── 3. 損失系 ──
function reynolds(w: number, m: number) { return w*4*m/(MU/RHO) }
function frictionFactor(Re: number, rr: number): number {
  if (Re < 2000) return 64/Re
  if (Re > 4000) {
    let f = 0.02
    for (let i=0;i<200;i++) {
      const ff = 1/Math.sqrt(f) + 2*Math.log10(rr/3.71 + 2.51/Re/Math.sqrt(f))
      const df = -0.5*f**-1.5 - 2.51/(Re*Math.log(10))*f**-1.5/(rr/3.71+2.51/Re/Math.sqrt(f))
      const fn = f - ff/df
      if (Math.abs(fn-f)<1e-6) return fn
      f = fn
    }
    return f
  }
  return 0
}
function zetaFriction(l: number, m: number, Re: number, rr: number) { return frictionFactor(Re,rr)*l/(4*m) }
function lossFriction(zf: number, v1: number, v2: number)  { return zf*(v1**2+v2**2)/(2*G)/2 }
function lossFrictionCsg(zf: number, vm: number)            { return zf*vm**2/(2*G) }
function lossShockSv(vus1: number)                          { return 0.5*(vus1-vus1)**2/(2*G) }  // =0 (symmetric)
function lossShockGv(rs2: number, rg1: number, vus2: number, vug0: number) {
  return 0.5*((rs2/rg1)*vus2 - vug0)**2/(2*G)
}
function lossShockRv(rg2: number, rm1v: number, vug2: number, vvu1: number) {
  return 1.0*((rg2/rm1v)*vug2 - vvu1)**2/(2*G)
}
function vAbsRv2(vm2v: number, b02: number) { return Math.sqrt(vm2v**2*(1+(1/Math.tan(PI*b02/180))**2)) }
function lossMixing(eps2: number, va2: number) { return 0.5*((va2/eps2)**2 - va2**2)/(2*G) }
function lossRecircRv(Q: number, Qopt: number, u1v: number) {
  return Q < Qopt ? 0.2*(u1v**2/(2*G))*(1-Q/Qopt)**2 : 0
}
function mPortGv(P0: number, BG1: number) { return P0*BG1*0.5/(P0+BG1) }
function zetaGrossGv(mGp: number, D1: number) { return 119.6*(mGp/D1)**2 - 9.5*(mGp/D1) + 0.2 }
function coefAGv(P0: number, P00: number) {
  const r = P0/P00
  return 1.9307*r**3 - 4.8902*r**2 + 4.0267*r - 0.276
}
function lossGrossGv(Q: number, zG: number, P0: number, P00: number, BG1: number, D1: number) {
  const mGp = mPortGv(P0, BG1)
  return coefAGv(P0,P00)*zetaGrossGv(mGp,D1)/(2*G)*(Q/(zG*P0*BG1))**2
}
function lossExpDt(vmd1: number) { return 0.1*vmd1**2/(2*G) }
function lossSwirlDt(u2v: number, w2v: number, b02: number) {
  return 1.1*(u2v - w2v*Math.cos(PI*b02/180))**2/(2*G)
}
function zetaBendDt(rdc2: number, bdb: number, rdb: number) {
  const adb = (rdc2+bdb/2)/2
  return 0.131 + 1.847*(adb/rdb)**3.5
}
function lossBendDt(zDB: number, vmdb: number) { return zDB*vmdb**2/(2*G) }

// ── 4. 漏れ・機械損失 ──
function headDiffSeal(H0: number, dHC: number, dHS: number, dHG: number, dHD: number, u1v: number, uw: number) {
  return H0 - (dHS+dHC+dHG+dHD) - (u1v**2-uw**2)/(8*G)
}
function areaSeal(bw: number, rw: number) { return PI*((bw+rw)**2-rw**2) }
function coefLeakage(lw: number, bw: number, lambdaw: number) { return 1/(lambdaw*lw/(2*bw)+1.5)**0.5 }
function leakageFlow(CwAw: number, dH: number, Q: number) {
  if (dH < 0) return NaN
  return CwAw*Math.sqrt(2*G*dH) + Q*0.01
}
function dragCoefDisc(D1: number, u1v: number) {
  return 0.0465 / (D1*u1v/2/(MU/RHO))**0.2
}
function discFrictionLoss(Cf: number, D1: number, u1v: number, om: number) {
  const dN = 2/102*Cf*(RHO/G)*(D1/2)**5*om**3
  return { deltax: G*dN/(D1*u1v**3), deltaN: dN }
}
function effMechanical(xm: number, dx: number) { return (xm-dx)/xm }

// ── メイン計算 ──
export function calcQEtaCurve(
  results: TurbineResults,
  inputs: { head: number; flowRate: number; rotationalSpeed: number; turbineEff: number },
  rp: RoughnessParams = DEFAULT_ROUGHNESS,
): QEtaPoint[] {
  const fd = results.dimensions.francisDetail
  if (!fd) return []

  const H0  = inputs.head
  const Qcr = inputs.flowRate
  const N   = inputs.rotationalSpeed
  const om  = omega(N)

  // ── 設計パラメータ ──
  const D1=fd.D1, D5=fd.D5, D6=fd.D6, D2=fd.D2, D7=fd.D7
  const B1=fd.B1, h2=fd.H2, beta1b=fd.beta1b, beta2b=fd.beta2b
  const t1=fd.t1, t2=fd.t2, l=fd.lb??0.252
  const zR=fd.Zr, zS=fd.Zs, zG=fd.Zg
  const dC1=fd.Dc, lCa=fd.lCa
  const dS1=fd.Ds1, dS2=fd.Ds2, BS1=fd.Bs1, BS2=fd.Bs2
  const tS1=fd.ts1, tS2=fd.ts2, lS=fd.ls
  const alphaS1b=fd.alphaS1b, alphaS2b=fd.alphaS2b
  const tG1=fd.tg1, tG2=fd.tg2, lG=fd.lg, rG=fd.Rg, lx=fd.Dlx
  const BG1=B1, BG2=B1, P00=fd.P00
  const alphaG1bi=fd.guideVaneTable.map(r=>r.alphaG1b)
  const alphaG2bi=fd.guideVaneTable.map(r=>r.alphaG2b)
  const alphaG02i=fd.guideVaneTable.map(r=>r.alphaG02)
  const lDC=fd.ldc, rDC1=fd.rdc1, rDC2=fd.rdc2
  const rDB=fd.rdb, bDB=fd.bdb, hDB2=fd.hdb2
  const lDD=fd.ldd, bDD=fd.bdd, hDD=fd.hdd
  const seal=fd.seal
  const bwt=[fd.bw_1,fd.bw_2], lwt=[fd.lw_1,fd.lw_2], rwt=[fd.rl_1,fd.rl_2]

  // ── 初期面積・形状計算 ──
  const AC  = areaCircle(dC1/2)
  const lC  = lengthCsg((dC1+dS1)*0.5) + lCa
  const mC  = mCsg(dC1)
  const rS1=dS1/2, rS2=dS2/2
  const epsS1=epsilon(zS,tS1,rS1), epsS2=epsilon(zS,tS2,rS2)
  const AS1=areaCylinder(rS1,BS1,epsS1), AS2=areaCylinder(rS2,BS2,epsS2)
  const mS=mCascades(zS,rS1,BS1,rS2,BS2)
  const lD=lengthDt(lDC,rDB,lDD), mD=mDt(rDC1,hDD,bDD)
  const AD1=areaCircle(rDC1), ADB1=areaCircle(rDC2)
  const ADB2=areaDt(bDB,hDB2), AD2=areaDt(hDD,bDD)
  const rm1=calcRm1(D1,D5), rm2=(D2+D6)/4
  const b2=heightB2(h2,D6,D2)
  const epsR1=epsilon(zR,t1,rm1), epsR2=epsilon(zR,t2,rm2)
  const AR1=areaCone(B1,epsR1,D1,D5)
  const AR2=(PI*(D2/2)**2 - PI*(D7/2)**2)*epsR2
  const mR=mRv(zR,rm1,B1,D2,D6,b2)
  const zetaDB=zetaBendDt(rDC2,bDB,rDB)

  const GVOi = [20,30,40,50,60,70,80,90,100,110]
  const output: QEtaPoint[] = []

  let Q_guess = Qcr
  let Qmax = Qcr*1.5

  for (let ii=9; ii>=0; ii--) {
    const GVO = GVOi[ii]
    const alphaG02_raw = alphaG02i[ii]
    const alphaG02 = alphaG02_raw * (0.0057*GVO + 0.242)
    const P0 = P00 * 0.01 * GVO

    if (!alphaG2bi[ii]) continue

    const { rG1, rG2 } = (() => {
      const a = Math.abs(0.5-(lG-lx)/lG)
      return { rG1: rG+(a*rG)/2, rG2: rG-(a*rG)/5 }
    })()

    const epsG1=epsilon(zG,tG1,rG1), epsG2=epsilon(zG,tG2,rG2)
    const AG1=areaCylinder(rG1,BG1,epsG1), AG2=areaCylinder(rG2,BG2,epsG2)
    const mG=mCascades(zG,rG1,BG1,rG2,BG2)

    let Q = Q_guess
    let QQ=0, HH=0, H=0
    let deltaQ=0.00001, etal=1, etam=1, QR=Q
    let Hth=0, b01=0, b02v=0
    let w1=0, w2=0, vm1v=0, vm2v=0, u1v=0, u2v=0, vu1v=0, vu2v=0
    let HCf=0, HSf=0, HSs=0, HGf=0, HGs=0, HGm=0
    let HRf=0, HRs=0, HRm=0, HRn=0
    let HDf=0, HDe=0, HDu=0, HDB=0
    let dHC=0, dHS=0, dHG=0, dHR=0, dHD=0
    let vmG2v=0, vuG2v=0
    let converged=false

    for (let jj=0; jj<100000; jj++) {
      u1v = calcU(rm1,om); u2v = calcU(rm2,om)
      const k = slipFactor(beta2b,zR,2*rm1,2*rm2)

      // ケーシング
      const vmC = Q/AC
      HCf = lossFrictionCsg(zetaFriction(lC,mC,reynolds(vmC,mC),rp.rrC), vmC)
      dHC = HCf

      // ステーベーン
      const vmS1=Q/AS1, vmS2=Q/AS2
      const wvS=velAvg(vmS1,vmS2,alphaS1b,alphaS2b)
      const zetaSf=zetaFriction(lS,mS,reynolds(wvS,mS),rp.rrS)
      const vaS1=Math.sqrt(vmS1**2*(1+(1/Math.tan(PI*alphaS1b/180))**2))
      const vaS2=Math.sqrt(vmS2**2*(1+(1/Math.tan(PI*alphaS2b/180))**2))
      HSf = lossFriction(zetaSf,vaS1,vaS2)
      HSs = 0  // lossShockSv: symmetric = 0
      const vaS2m = vAbsRv2(vmS2,alphaS2b)
      const HSmv = lossMixing(epsS2,vaS2m)
      dHS = HSf + HSs + HSmv

      // ガイドベーン
      const vmG1=Q/AG1, vmG2v2=Q/AG2
      vmG2v=vmG2v2; vuG2v=calcV(vmG2v2,alphaG02)
      const wvG=velAvg(vmG1,vmG2v2,alphaG1bi[ii],alphaG02)
      const zetaGf=zetaFriction(lG,mG,reynolds(wvG,mG),rp.rrG)
      const vag0=Q/(P0*zG*BG2)
      HGf = zetaGf*vag0**2/(2*G)
      const vuS2=calcV(vmS2*(AS2/AG1),alphaS2b)
      HGs = lossShockGv(rS2,rG1,vuS2,calcV(vag0,alphaG1bi[ii]))
      const vaG2=Math.sqrt((Q/(2*PI*rG2*BG2))**2*(1+(1/Math.tan(PI*alphaG02/180))**2))
      HGm = lossMixing(epsG2,vaG2)
      dHG = lossGrossGv(Q,zG,P0,P00,BG1,D1)

      // ドラフトチューブ
      const vmD1=Q/AD1, vmD2=Q/AD2
      const ReDt=reynolds(0.5*(vmD1+vmD2),mD)
      HDf = lossFriction(zetaFriction(lD,mD,ReDt,rp.rrD),vmD1,vmD2)
      HDe = lossExpDt(vmD1)
      const vmDB=Q/((ADB1+ADB2)/2)
      HDB = lossBendDt(zetaDB,vmDB)

      let PdQ=deltaQ, CwAw=0, uwv=0
      for (let kk=0; kk<100000; kk++) {
        PdQ=deltaQ; QR=Q-deltaQ
        vm1v=QR/AR1; vm2v=QR/AR2
        vu1v=vu1(vm1v,alphaG02); b01=beta01(vm1v,vu1v,u1v)
        vu2v=vu2(slipFactor(beta2b,zR,2*rm1,2*rm2),u2v,vm2v,beta2b)
        b02v=beta02(vm2v,vu2v,u2v)
        w1=calcW(vm1v,b01); w2=calcW(vm2v,b02v)
        Hth=hth(u2v,vu2v,u1v,vu1v)

        const wvR=velAvg(vm1v,vm2v,b01,b02v)
        HRf = lossFriction(2*zetaFriction(l,mR,reynolds(wvR,mR),rp.rrR),w1,w2)
        const vvu1=u1v-calcV(vm1v,beta1b)
        HRs = lossShockRv(rG2,rm1,vuG2v,vvu1)
        const vaR2=vAbsRv2(vm2v,b02v)
        HRm = lossMixing(epsR2,vaR2)
        HRn = lossRecircRv(Q,0.8*Qmax,u1v)
        dHR = HRf+HRs+HRm+HRn
        HDu = lossSwirlDt(u2v,w2,b02v)
        dHD = HDf+HDe+HDu+HDB

        // 漏れ
        CwAw=0; uwv=0
        let sumInv2=0
        for (let ll=0;ll<seal;ll++) {
          const bw=bwt[ll],rw=rwt[ll],lw=lwt[ll]
          if (bw*rw*lw<1e-10) continue
          uwv=calcU(rw,om)
          const vr=uwv, Rew=2*bw*vr/(MU/RHO)
          const lmw=frictionFactor(Rew,0.005)
          const Aw=areaSeal(bw,rw), Cw=coefLeakage(lw,bw,lmw)
          sumInv2+=1/(Cw*Aw)**2
        }
        if (sumInv2>0) CwAw=1/Math.sqrt(sumInv2)

        const dH=headDiffSeal(H0,dHC,dHS,dHG,dHD,u1v,uwv)
        deltaQ=leakageFlow(CwAw,dH,Q)
        if (isNaN(deltaQ)) break
        etal=(Q-deltaQ)/Q
        H=Hth+dHR+dHS+dHC+dHG+dHD
        if (Math.abs(deltaQ-PdQ)<0.00005) break
      }

      if (Math.abs(H0-H)<0.00001||isNaN(Q)){converged=true;break}
      if (jj===0){ const tmp=Q; Q=Q+0.0006*(H0-H); QQ=tmp; HH=H }
      else {
        const tmp=Q, denom=(H0-H)-(H0-HH)
        if (denom!==0){ Q=Q-0.8*(H0-H)*(Q-QQ)/denom; if(Q<=0)Q=0.1 }
        QQ=tmp; HH=H
      }
    }

    if (!converged||isNaN(Q)||Math.abs(H0-H)>0.1) continue
    Q_guess=Q
    if (ii===9) Qmax=Q

    const Cf=dragCoefDisc(D1,u1v)
    const {deltax}=discFrictionLoss(Cf,D1,u1v,om)
    const xm=G*(RHO*G*QR*Hth/1000)/(D1**2*u1v**3)
    etam=effMechanical(xm,deltax)
    const etaH=Hth/H0
    const eta=etaH*etal*etam
    const P=eta*RHO*G*Q*H0/1000

    output.push({
      GVO, Q, eta:eta*100, etaH:etaH*100, etaL:etal*100, etaM:etam*100, P, Hth,
      thetaC:  (dHC/H0)*100,
      thetaS:  (dHS/H0)*100,
      thetaG:  (dHG/H0)*100,
      thetaR:  (dHR/H0)*100,
      thetaD:  (dHD/H0)*100,
    })
  }

  return output.reverse()  // Q昇順に並べ直し
}
