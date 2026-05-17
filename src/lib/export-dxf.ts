/**
 * フランシス水車 DXF エクスポート — Phase 4
 *
 * Phase 4 追加要素:
 *   ① 断面ハッチング（HATCH エンティティ、ANSI31 パターン）
 *   ② 表面粗さ記号（▽ テキスト + 引出線）
 *   ③ 一般公差注記（JIS B 0405 準拠）
 *   ④ 部品表（Materials List）付き拡充表題欄
 *   ⑤ 水理・構造諸元の仕様欄
 *
 * レイヤー:
 *   CENTER / OUTLINE / GUIDE / RUNNER / CASING / DRAFTTUBE
 *   HATCH / ROUGHNESS / TOLERANCE / DIM / TEXT / TITLE / PARTLIST / SPECBOX
 *
 * 座標系: mm単位、ランナー中心が原点
 */

import type { TurbineResults, TurbineInputs } from '@/types'

export async function exportFrancisDxf(
  results: TurbineResults,
  caseName: string = 'francis',
  inputs?: TurbineInputs
): Promise<void> {
  const dxfStr = buildFrancisDxf(results, inputs)
  const blob = new Blob([dxfStr], { type: 'application/dxf' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${caseName}_フランシス水車図面P4.dxf`
  a.click()
  URL.revokeObjectURL(url)
}

export function buildFrancisDxf(results: TurbineResults, inputs?: TurbineInputs): string {
  const f   = results.dimensions.francis!
  const D2e = results.dimensions.runnerDiameter * 1000
  const D01 = f.inletDiameter                  * 1000
  const Bd  = f.guideVaneHeight                * 1000
  const Dsc = f.spiralCaseInlet                * 1000
  const numBlades = f.numBlades
  const numGV     = f.numGuideVanes

  const r2e = D2e / 2
  const r01 = D01 / 2
  const rsc = Dsc / 2
  const hubR = r2e * 0.15
  const gvR  = (r2e + r01) / 2

  const dtTopY  =  r2e * 0.30
  const dtBotY  =  r2e * 0.30 + r2e * 1.40
  const dtTopHW =  r2e * 0.85
  const dtBotHW =  r2e * 1.25
  const scCx    =  r01 * 0.55
  const scCy    = -r01 * 0.05

  const TH  = r2e * 0.042
  const THS = r2e * 0.034
  const THT = r2e * 0.052

  // 仕様欄・部品表の座標（図面右側）
  const specX = r01 + rsc + r2e * 0.45
  const specY = -r2e * 1.1
  const plX   = specX
  const plY   = r2e * 1.0

  const ls: string[] = []

  // ── ヘッダー
  ls.push(
    '  0\nSECTION','  2\nHEADER',
    '  9\n$ACADVER','  1\nAC1015',
    '  9\n$INSUNITS',' 70\n4',
    '  0\nENDSEC',
  )

  // ── TABLES
  ls.push('  0\nSECTION','  2\nTABLES')
  ls.push(
    '  0\nTABLE','  2\nLTYPE',' 70\n3',
    '  0\nLTYPE','  2\nCONTINUOUS',' 70\n0','  3\nSolid line',' 72\n65',' 73\n0',' 40\n0.0',
    '  0\nLTYPE','  2\nDASHED',' 70\n0','  3\nDashed',' 72\n65',' 73\n2',' 40\n12.0',
    ' 49\n8.0',' 74\n0',' 49\n-4.0',' 74\n0',
    '  0\nLTYPE','  2\nCENTER',' 70\n0','  3\nCenter line',' 72\n65',' 73\n4',' 40\n40.0',
    ' 49\n25.0',' 74\n0',' 49\n-5.0',' 74\n0',' 49\n5.0',' 74\n0',' 49\n-5.0',' 74\n0',
    '  0\nENDTAB',
  )
  const layerDefs = [
    {name:'CENTER',   color:8, ltype:'CENTER'    },
    {name:'OUTLINE',  color:7, ltype:'CONTINUOUS'},
    {name:'GUIDE',    color:3, ltype:'CONTINUOUS'},
    {name:'RUNNER',   color:2, ltype:'CONTINUOUS'},
    {name:'CASING',   color:5, ltype:'CONTINUOUS'},
    {name:'DRAFTTUBE',color:4, ltype:'DASHED'    },
    {name:'HATCH',    color:9, ltype:'CONTINUOUS'},
    {name:'ROUGHNESS',color:6, ltype:'CONTINUOUS'},
    {name:'TOLERANCE',color:3, ltype:'CONTINUOUS'},
    {name:'DIM',      color:8, ltype:'CONTINUOUS'},
    {name:'TEXT',     color:7, ltype:'CONTINUOUS'},
    {name:'TITLE',    color:7, ltype:'CONTINUOUS'},
    {name:'PARTLIST', color:7, ltype:'CONTINUOUS'},
    {name:'SPECBOX',  color:4, ltype:'CONTINUOUS'},
  ]
  ls.push('  0\nTABLE','  2\nLAYER',` 70\n${layerDefs.length}`)
  for (const l of layerDefs)
    ls.push('  0\nLAYER',`  2\n${l.name}`,' 70\n0',' 62\n'+l.color,`  6\n${l.ltype}`)
  ls.push('  0\nENDTAB','  0\nENDSEC')

  // ── ENTITIES
  ls.push('  0\nSECTION','  2\nENTITIES')

  function ln(x1:number,y1:number,x2:number,y2:number,layer:string){
    ls.push('  0\nLINE',`  8\n${layer}`,
      ` 10\n${x1.toFixed(3)}`,' 20\n'+y1.toFixed(3),' 30\n0.0',
      ` 11\n${x2.toFixed(3)}`,' 21\n'+y2.toFixed(3),' 31\n0.0')
  }
  function circ(cx:number,cy:number,r:number,layer:string){
    ls.push('  0\nCIRCLE',`  8\n${layer}`,
      ` 10\n${cx.toFixed(3)}`,' 20\n'+cy.toFixed(3),' 30\n0.0',
      ` 40\n${r.toFixed(3)}`)
  }
  function txt(x:number,y:number,h:number,str:string,layer:string,ha=1){
    ls.push('  0\nTEXT',`  8\n${layer}`,
      ` 10\n${x.toFixed(3)}`,' 20\n'+y.toFixed(3),' 30\n0.0',
      ` 40\n${h.toFixed(3)}`,`  1\n${str}`,` 72\n${ha}`)
  }

  // ① ハッチング（ANSI31、ケーシング壁断面）
  function hatch(bx:number,by:number,bw:number,bh:number,ang:number,sc:number){
    ls.push(
      '  0\nHATCH','  8\nHATCH',
      ' 10\n0.0',' 20\n0.0',' 30\n0.0',
      '210\n0.0','220\n0.0','230\n1.0',
      '  2\nANSI31',' 70\n0',' 71\n0',
      ' 91\n1',' 92\n1',' 93\n4',
      ` 10\n${bx.toFixed(2)}`,' 20\n'+by.toFixed(2),
      ` 10\n${(bx+bw).toFixed(2)}`,' 20\n'+by.toFixed(2),
      ` 10\n${(bx+bw).toFixed(2)}`,' 20\n'+(by+bh).toFixed(2),
      ` 10\n${bx.toFixed(2)}`,' 20\n'+(by+bh).toFixed(2),
      ' 97\n0',' 75\n1',' 76\n1',
      ` 52\n${ang.toFixed(1)}`,' 41\n'+sc.toFixed(2),
      ' 77\n0',' 78\n1',
      ` 53\n${ang.toFixed(1)}`,' 43\n0.0',' 44\n0.0',
      ` 45\n${(-Math.sin(ang*Math.PI/180)*sc).toFixed(3)}`,
      ` 46\n${(Math.cos(ang*Math.PI/180)*sc).toFixed(3)}`,
      ' 79\n0',
    )
  }
  const hsc = r2e * 0.03
  const hw  = rsc * 0.22
  hatch(scCx - rsc - hw, -scCy - rsc - hw, hw * 2.5, hw, 45, hsc)
  hatch(-r01 - hw * 1.5, -r2e * 0.12, hw, r2e * 0.24, 45, hsc)
  hatch( r01 + hw * 0.5, -r2e * 0.12, hw, r2e * 0.24, 45, hsc)

  // 中心線
  const clExt = r01 * 1.3
  ln(-clExt,0,clExt,0,'CENTER')
  ln(0,-clExt,0,dtBotY+r2e*0.2,'CENTER')

  // 吸出し管
  ln(-dtTopHW,dtTopY,-dtBotHW,dtBotY,'DRAFTTUBE')
  ln( dtTopHW,dtTopY, dtBotHW,dtBotY,'DRAFTTUBE')
  ln(-dtBotHW,dtBotY, dtBotHW,dtBotY,'DRAFTTUBE')
  txt(0,dtBotY-TH*1.5,THS,'吸出し管','TEXT')

  // スパイラルケーシング
  circ(scCx,-scCy,rsc,'CASING')

  // ガイドベーン
  circ(0,0,gvR+Bd/2,'GUIDE')
  circ(0,0,gvR-Bd/2,'GUIDE')
  for(let i=0;i<numGV;i++){
    const a=(i/numGV)*2*Math.PI, lean=0.18
    ln((gvR+Bd/2)*Math.cos(a),(gvR+Bd/2)*Math.sin(a),
       (gvR-Bd/2)*Math.cos(a+lean),(gvR-Bd/2)*Math.sin(a+lean),'GUIDE')
  }

  // ランナーブレード
  for(let i=0;i<numBlades;i++){
    const a=(i/numBlades)*2*Math.PI, sw=0.45
    ln(r2e*0.95*Math.cos(a),r2e*0.95*Math.sin(a),
       r2e*0.35*Math.cos(a+sw),r2e*0.35*Math.sin(a+sw),'RUNNER')
  }
  circ(0,0,r2e,'OUTLINE')
  circ(0,0,r01,'OUTLINE')
  circ(0,0,hubR,'OUTLINE')

  // 寸法線
  const dg=r2e*0.15, sz=r2e*0.022
  function dimH(x1:number,x2:number,dimY:number,label:string){
    const mx=(x1+x2)/2
    ln(x1,0,x1,dimY,'DIM'); ln(x2,0,x2,dimY,'DIM')
    ln(x1,dimY,x2,dimY,'DIM')
    ln(x1,dimY,x1+sz*2,dimY+sz,'DIM'); ln(x1,dimY,x1+sz*2,dimY-sz,'DIM')
    ln(x2,dimY,x2-sz*2,dimY+sz,'DIM'); ln(x2,dimY,x2-sz*2,dimY-sz,'DIM')
    txt(mx,dimY+sz*1.8,TH,label,'TEXT')
  }
  dimH(-r2e,r2e,-r2e-dg,`D2e = ${D2e.toFixed(1)}`)
  dimH(-r01,r01,-(r01+dg*2.5),`D01 = ${D01.toFixed(1)}`)
  const bdX=gvR+r2e*0.18
  ln(bdX,-Bd/2,bdX,Bd/2,'DIM')
  ln(gvR-Bd/2,Bd/2,bdX,Bd/2,'DIM'); ln(gvR-Bd/2,-Bd/2,bdX,-Bd/2,'DIM')
  txt(bdX+TH*0.5,0,TH,`Bd=${Bd.toFixed(1)}`,'TEXT')
  txt(scCx,-scCy-rsc-TH*2,TH,`Dsc=${Dsc.toFixed(1)}`,'TEXT')

  // ② 表面粗さ記号
  const rsSz=TH*1.2
  function roughnessMark(bx:number,by:number,ox:number,oy:number,ra:number){
    ln(bx,by,bx+ox,by+oy,'ROUGHNESS')
    ln(bx+ox,by+oy,bx+ox+rsSz*3.5,by+oy,'ROUGHNESS')
    const vx=bx+ox+rsSz*0.5, vy=by+oy+rsSz*0.1
    ln(vx-rsSz*0.55,vy+rsSz,vx,vy,'ROUGHNESS')
    ln(vx,vy,vx+rsSz*0.55,vy+rsSz,'ROUGHNESS')
    ln(vx-rsSz*0.55,vy+rsSz,vx+rsSz*0.55,vy+rsSz,'ROUGHNESS')
    txt(vx+rsSz*0.7,vy+rsSz*0.15,THS,`Ra${ra}`,'ROUGHNESS',0)
  }
  const ra=Math.PI/4
  roughnessMark(r2e*Math.cos(ra),r2e*Math.sin(ra),rsSz*2,rsSz*2.5,3.2)
  const ga=-Math.PI/3
  roughnessMark((gvR+Bd/2)*Math.cos(ga),(gvR+Bd/2)*Math.sin(ga),-rsSz*2.5,-rsSz*2,6.3)
  roughnessMark(scCx-rsc,(-scCy),-rsSz*2.5,rsSz*2,12.5)

  // ③ 一般公差注記
  const tolX=-r2e-dg*2.2, tolY=r2e*0.85
  const tolW=r2e*1.25, tolRH=TH*1.1
  const tolLines=[
    '一般公差: JIS B 0405-m',
    '  長さ寸法: ±0.1 mm',
    '  角度寸法: ±0°30\'',
    '溶接部: JIS Z 3001 準拠',
    '表面処理: 防錆塗装 (未指示部)',
    '材質未指示部: SS400相当',
  ]
  const tolTH=tolRH*tolLines.length+tolRH*0.4
  ln(tolX,tolY,tolX+tolW,tolY,'TOLERANCE')
  ln(tolX,tolY-tolTH,tolX+tolW,tolY-tolTH,'TOLERANCE')
  ln(tolX,tolY,tolX,tolY-tolTH,'TOLERANCE')
  ln(tolX+tolW,tolY,tolX+tolW,tolY-tolTH,'TOLERANCE')
  ln(tolX,tolY-tolRH,tolX+tolW,tolY-tolRH,'TOLERANCE')
  txt(tolX+tolW/2,tolY-tolRH*0.82,TH,'注 記','TOLERANCE')
  tolLines.forEach((t,i)=>txt(tolX+tolW*0.04,tolY-tolRH*(i+1.88),THS,t,'TOLERANCE',0))

  // ④ 仕様欄
  const specW=r2e*1.55, specRH=TH*1.25
  const specItems:[string,string][]=[
    ['■ 設計諸元',''],
    ['有効落差 H',  inputs?`${inputs.head.toFixed(1)} m`:'─'],
    ['設計流量 Q',  inputs?`${inputs.flowRate.toFixed(3)} m³/s`:'─'],
    ['水車出力 Pw', `${results.turbinePower.toFixed(1)} kW`],
    ['発電機出力 Pe',`${results.generatorPower.toFixed(1)} kW`],
    ['定格回転速度 n',`${results.ratedRpm.toFixed(0)} rpm`],
    ['極数',        `${results.poles} P`],
    ['比速度 Ns',   `${results.specificSpeed.toFixed(1)}`],
    ['暴走速度 nr', `${results.runawaySpeed.toFixed(0)} rpm`],
    ['■ キャビテーション',''],
    ['σ係数', results.cavitationCoef!=null?results.cavitationCoef.toFixed(4):'─'],
    ['Hs max', results.hsMax!=null?`${results.hsMax.toFixed(2)} m`:'─'],
    ['判定', results.checks.cavitation.result],
    ['■ 水撃圧',''],
    ['水撃圧上昇率',`${(results.hydraulics.waterHammerRise*100).toFixed(1)} %`],
    ['水撃圧ヘッド',`${results.hydraulics.waterHammerHead.toFixed(1)} m`],
    ['判定', results.checks.waterHammer.result],
    ['■ 主要寸法 [mm]',''],
    ['D2e', D2e.toFixed(1)],
    ['D01', D01.toFixed(1)],
    ['Bd',  Bd.toFixed(1)],
    ['Dsc', Dsc.toFixed(1)],
    ['Dp', `${(results.dimensions.penstockDiameter*1000).toFixed(1)}`],
  ]
  const specTH=specRH*specItems.length+specRH*0.3
  ln(specX,specY,specX+specW,specY,'SPECBOX')
  ln(specX,specY-specTH,specX+specW,specY-specTH,'SPECBOX')
  ln(specX,specY,specX,specY-specTH,'SPECBOX')
  ln(specX+specW,specY,specX+specW,specY-specTH,'SPECBOX')
  ln(specX,specY-specRH,specX+specW,specY-specRH,'SPECBOX')
  txt(specX+specW/2,specY-specRH*0.82,TH,'設 計 仕 様 書','SPECBOX')
  const colDiv=specX+specW*0.62
  specItems.forEach(([label,val],i)=>{
    const ry=specY-specRH*(i+1.85)
    const isH=label.startsWith('■')
    ln(specX,ry+specRH*0.85,specX+specW,ry+specRH*0.85,'SPECBOX')
    if(isH){
      txt(specX+specW*0.05,ry+specRH*0.1,THS,label,'SPECBOX',0)
    } else {
      ln(colDiv,ry,colDiv,ry+specRH*0.85,'SPECBOX')
      txt(specX+specW*0.03,ry+specRH*0.1,THS,label,'SPECBOX',0)
      txt(specX+specW*0.65,ry+specRH*0.1,THS,val,'SPECBOX',0)
    }
  })

  // ⑤ 部品表
  const plW=r2e*1.55, plRH=TH*1.25
  const parts:[string,string,string,string][]=[
    ['1','ランナー',            'SCS6 (13Cr鋼)',`ブレード${numBlades}枚`],
    ['2','ガイドベーン',        'SCS6',         `${numGV}枚`],
    ['3','スパイラルケーシング','SS400',         '溶接構造'],
    ['4','ステーリング',        'SS400',         '溶接構造'],
    ['5','上カバー',            'SS400',         ''],
    ['6','下カバー',            'SS400',         ''],
    ['7','吸出し管',            'SS400',         '溶接構造'],
    ['8','主軸',                'S45C',          ''],
    ['9','主軸継手',            'SS400',         ''],
  ]
  const plCols=[0.06,0.30,0.60,0.82]
  const plHeaders=['No.','品名','材質（参考）','備考']
  const plTH=plRH*(parts.length+2)
  ln(plX,plY,plX+plW,plY,'PARTLIST')
  ln(plX,plY+plTH,plX+plW,plY+plTH,'PARTLIST')
  ln(plX,plY,plX,plY+plTH,'PARTLIST')
  ln(plX+plW,plY,plX+plW,plY+plTH,'PARTLIST')
  ln(plX,plY+plRH,plX+plW,plY+plRH,'PARTLIST')
  txt(plX+plW/2,plY+plRH*0.18,TH,'部 品 表  (Materials List)','PARTLIST')
  ln(plX,plY+plRH*2,plX+plW,plY+plRH*2,'PARTLIST')
  plCols.forEach((c,ci)=>{
    const hx=plX+plW*c
    if(ci>0) ln(hx,plY+plRH,hx,plY+plTH,'PARTLIST')
    txt(hx+plW*0.03,plY+plRH*1.18,THS,plHeaders[ci],'PARTLIST',0)
  })
  parts.forEach((row,ri)=>{
    const ry=plY+plRH*(ri+2)
    ln(plX,ry+plRH,plX+plW,ry+plRH,'PARTLIST')
    row.forEach((cell,ci)=>txt(plX+plW*plCols[ci]+plW*0.015,ry+plRH*0.18,THS,cell,'PARTLIST',0))
  })

  // ⑥ 拡充表題欄
  const ttw=r01*4.2, tth=r2e*0.65
  const ttx=r01*1.8
  const tty=-(r2e+dg*2.5+tth+r2e*0.15)
  ln(ttx-ttw/2,tty,ttx+ttw/2,tty,'TITLE')
  ln(ttx-ttw/2,tty+tth,ttx+ttw/2,tty+tth,'TITLE')
  ln(ttx-ttw/2,tty,ttx-ttw/2,tty+tth,'TITLE')
  ln(ttx+ttw/2,tty,ttx+ttw/2,tty+tth,'TITLE')
  ln(ttx-ttw/2,tty+tth*0.55,ttx+ttw/2,tty+tth*0.55,'TITLE')
  ln(ttx-ttw/2,tty+tth*0.28,ttx+ttw/2,tty+tth*0.28,'TITLE')
  ln(ttx-ttw*0.05,tty,ttx-ttw*0.05,tty+tth*0.28,'TITLE')
  ln(ttx+ttw*0.15,tty,ttx+ttw*0.15,tty+tth*0.28,'TITLE')
  ln(ttx+ttw*0.35,tty,ttx+ttw*0.35,tty+tth*0.28,'TITLE')
  txt(ttx,tty+tth*0.78,THT,'フランシス水車　縦断面概略図','TITLE')
  txt(ttx-ttw*0.35,tty+tth*0.41,TH,'図番: WT-FR-001','TITLE')
  txt(ttx+ttw*0.05,tty+tth*0.41,TH,'縮尺: N.T.S','TITLE')
  txt(ttx+ttw*0.32,tty+tth*0.41,TH,'単位: mm','TITLE')
  txt(ttx-ttw/2+4,tty+tth*0.14,THS,'Rev','TITLE',0)
  txt(ttx-ttw*0.05+4,tty+tth*0.14,THS,'作図','TITLE',0)
  txt(ttx+ttw*0.15+4,tty+tth*0.14,THS,'照合','TITLE',0)
  txt(ttx+ttw*0.35+4,tty+tth*0.14,THS,'承認','TITLE',0)
  txt(ttx-ttw/2+4,tty+tth*0.02,THS,'A','TITLE',0)

  ls.push('  0\nENDSEC','  0\nEOF')
  return ls.join('\n')
}
