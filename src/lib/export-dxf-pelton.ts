/**
 * ペルトン水車 DXF エクスポート（正面図）
 *
 * レイヤー構成:
 *   CENTER     中心線（一点鎖線）
 *   OUTLINE    ランナーリム・ハブ（実線）
 *   BUCKET     バケット（実線）
 *   NOZZLE     ノズル・水流（実線）
 *   SPOKES     スポーク（実線）
 *   DIM        寸法線・引出線
 *   TEXT       寸法テキスト
 *   TITLE      表題欄
 *
 * 座標系: mm単位、ランナー中心が原点
 */

import type { TurbineResults } from '@/types'

export async function exportPeltonDxf(
  results: TurbineResults,
  caseName: string = 'pelton'
): Promise<void> {
  const dxfStr = buildPeltonDxf(results)
  const blob = new Blob([dxfStr], { type: 'application/dxf' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${caseName}_ペルトン水車正面図.dxf`
  a.click()
  URL.revokeObjectURL(url)
}

export function buildPeltonDxf(results: TurbineResults): string {
  const p  = results.dimensions.pelton!
  const D  = results.dimensions.runnerDiameter * 1000   // ランナーピッチ径 mm
  const d  = p.jetDiameter                    * 1000   // ジェット径 mm
  const B2 = p.bucketWidth                    * 1000   // バケット内幅 mm
  const numJets    = p.numJets
  const numBuckets = p.numBuckets

  const R    = D  / 2           // ランナー半径
  const djet = d                // ジェット径
  const bW   = B2               // バケット内幅
  const bH   = bW * 0.72        // バケット長さ（高さ方向）
  const hubR = R * 0.12         // ハブ半径

  const lines: string[] = []

  // ─── ヘッダー ──────────────────────────────────────────────
  lines.push(
    '  0\nSECTION', '  2\nHEADER',
    '  9\n$ACADVER', '  1\nAC1015',
    '  9\n$INSUNITS', ' 70\n4',
    '  0\nENDSEC',
  )

  // ─── TABLES ────────────────────────────────────────────────
  lines.push('  0\nSECTION', '  2\nTABLES')
  lines.push(
    '  0\nTABLE', '  2\nLTYPE', ' 70\n3',
    '  0\nLTYPE', '  2\nCONTINUOUS', ' 70\n0', '  3\nSolid line', ' 72\n65', ' 73\n0', ' 40\n0.0',
    '  0\nLTYPE', '  2\nDASHED',     ' 70\n0', '  3\nDashed',     ' 72\n65', ' 73\n2', ' 40\n12.0',
    ' 49\n8.0', ' 74\n0', ' 49\n-4.0', ' 74\n0',
    '  0\nLTYPE', '  2\nCENTER',     ' 70\n0', '  3\nCenter line', ' 72\n65', ' 73\n4', ' 40\n40.0',
    ' 49\n25.0', ' 74\n0', ' 49\n-5.0', ' 74\n0', ' 49\n5.0', ' 74\n0', ' 49\n-5.0', ' 74\n0',
    '  0\nENDTAB',
  )

  const layerDefs = [
    { name: 'CENTER', color: 8,  ltype: 'CENTER'     },
    { name: 'OUTLINE', color: 7,  ltype: 'CONTINUOUS' },
    { name: 'BUCKET',  color: 2,  ltype: 'CONTINUOUS' },
    { name: 'NOZZLE',  color: 5,  ltype: 'CONTINUOUS' },
    { name: 'SPOKES',  color: 8,  ltype: 'CONTINUOUS' },
    { name: 'DIM',     color: 8,  ltype: 'CONTINUOUS' },
    { name: 'TEXT',    color: 7,  ltype: 'CONTINUOUS' },
    { name: 'TITLE',   color: 7,  ltype: 'CONTINUOUS' },
  ]
  lines.push('  0\nTABLE', '  2\nLAYER', ` 70\n${layerDefs.length}`)
  for (const l of layerDefs) {
    lines.push('  0\nLAYER', `  2\n${l.name}`, ' 70\n0', ' 62\n' + l.color, `  6\n${l.ltype}`)
  }
  lines.push('  0\nENDTAB', '  0\nENDSEC')

  // ─── ENTITIES ──────────────────────────────────────────────
  lines.push('  0\nSECTION', '  2\nENTITIES')

  function ln(x1: number, y1: number, x2: number, y2: number, layer: string) {
    lines.push('  0\nLINE', `  8\n${layer}`,
      ` 10\n${x1.toFixed(3)}`, ` 20\n${y1.toFixed(3)}`, ' 30\n0.0',
      ` 11\n${x2.toFixed(3)}`, ` 21\n${y2.toFixed(3)}`, ' 31\n0.0')
  }
  function circ(cx: number, cy: number, r: number, layer: string) {
    lines.push('  0\nCIRCLE', `  8\n${layer}`,
      ` 10\n${cx.toFixed(3)}`, ` 20\n${cy.toFixed(3)}`, ' 30\n0.0',
      ` 40\n${r.toFixed(3)}`)
  }
  function arc(cx: number, cy: number, r: number, startDeg: number, endDeg: number, layer: string) {
    lines.push('  0\nARC', `  8\n${layer}`,
      ` 10\n${cx.toFixed(3)}`, ` 20\n${cy.toFixed(3)}`, ' 30\n0.0',
      ` 40\n${r.toFixed(3)}`,
      ` 50\n${startDeg.toFixed(3)}`, ` 51\n${endDeg.toFixed(3)}`)
  }
  function txt(x: number, y: number, h: number, str: string, layer: string) {
    lines.push('  0\nTEXT', `  8\n${layer}`,
      ` 10\n${x.toFixed(3)}`, ` 20\n${y.toFixed(3)}`, ' 30\n0.0',
      ` 40\n${h.toFixed(3)}`, `  1\n${str}`, ' 72\n1')
  }

  // 中心線
  const clExt = R * 1.35
  ln(-clExt, 0, clExt, 0, 'CENTER')
  ln(0, -clExt, 0, clExt, 'CENTER')

  // ランナーリム
  circ(0, 0, R, 'OUTLINE')

  // ハブ
  circ(0, 0, hubR, 'OUTLINE')

  // スポーク（6本）
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    ln(hubR * Math.cos(a), hubR * Math.sin(a),
       R * 0.78 * Math.cos(a), R * 0.78 * Math.sin(a), 'SPOKES')
  }

  // ── バケット（放射配置）────────────────────────────────────
  for (let i = 0; i < numBuckets; i++) {
    const angle = (i / numBuckets) * 2 * Math.PI
    const bCx   = R * Math.cos(angle)
    const bCy   = R * Math.sin(angle)

    // バケット方向ベクトル（接線方向に垂直 = 半径方向）
    const radX  = Math.cos(angle)
    const radY  = Math.sin(angle)
    const tanX  = -Math.sin(angle)
    const tanY  =  Math.cos(angle)

    // バケット外形（4頂点の台形）
    // radial方向: bH/2、tangential方向: bW/2
    const halfH = bH / 2
    const halfW = bW / 2
    const v = [
      [bCx + radX * halfH + tanX * halfW, bCy + radY * halfH + tanY * halfW],
      [bCx + radX * halfH - tanX * halfW, bCy + radY * halfH - tanY * halfW],
      [bCx - radX * halfH * 0.6 - tanX * halfW * 0.7, bCy - radY * halfH * 0.6 - tanY * halfW * 0.7],
      [bCx - radX * halfH * 0.6 + tanX * halfW * 0.7, bCy - radY * halfH * 0.6 + tanY * halfW * 0.7],
    ]
    ln(v[0][0], v[0][1], v[1][0], v[1][1], 'BUCKET')
    ln(v[1][0], v[1][1], v[2][0], v[2][1], 'BUCKET')
    ln(v[2][0], v[2][1], v[3][0], v[3][1], 'BUCKET')
    ln(v[3][0], v[3][1], v[0][0], v[0][1], 'BUCKET')
    // 中央分割線（バケット中心溝）
    ln(bCx + radX * halfH, bCy + radY * halfH,
       bCx - radX * halfH * 0.6, bCy - radY * halfH * 0.6, 'BUCKET')
  }

  // ── ノズル（numJets本、等分配置）─────────────────────────
  for (let j = 0; j < numJets; j++) {
    const ja = (j / numJets) * 2 * Math.PI - Math.PI / 2
    const nozzleLen = R * 0.55
    const hw = djet / 2

    // ノズル先端位置（リムに接する）
    const tipX = (R + djet * 0.5) * Math.cos(ja)
    const tipY = (R + djet * 0.5) * Math.sin(ja)

    // ノズル後端位置
    const nozX = (R + nozzleLen) * Math.cos(ja)
    const nozY = (R + nozzleLen) * Math.sin(ja)

    // ノズル幅方向ベクトル（軸に垂直）
    const perpX = -Math.sin(ja)
    const perpY =  Math.cos(ja)

    // ノズル外形（台形）
    ln(nozX + perpX * hw,         nozY + perpY * hw,
       tipX + perpX * djet * 0.4, tipY + perpY * djet * 0.4, 'NOZZLE')
    ln(nozX - perpX * hw,         nozY - perpY * hw,
       tipX - perpX * djet * 0.4, tipY - perpY * djet * 0.4, 'NOZZLE')
    ln(nozX + perpX * hw,         nozY + perpY * hw,
       nozX - perpX * hw,         nozY - perpY * hw,         'NOZZLE')
    ln(tipX + perpX * djet * 0.4, tipY + perpY * djet * 0.4,
       tipX - perpX * djet * 0.4, tipY - perpY * djet * 0.4, 'NOZZLE')

    // ノズル中心線（CENTER層）
    ln(nozX, nozY, tipX, tipY, 'CENTER')

    // ジェット流（ノズル先端からリムまで）
    const impX = R * Math.cos(ja)
    const impY = R * Math.sin(ja)
    ln(tipX, tipY, impX, impY, 'NOZZLE')
  }

  // ── 寸法線 ──────────────────────────────────────────────────
  const sz = R * 0.022
  const dimGap = R * 0.15

  // D（ランナー径）
  const dDimY = -(R + dimGap)
  ln(-R, dDimY, R, dDimY, 'DIM')
  ln(-R, 0, -R, dDimY - sz, 'DIM')
  ln( R, 0,  R, dDimY - sz, 'DIM')
  ln(-R, dDimY, -R + sz * 2, dDimY + sz, 'DIM')
  ln(-R, dDimY, -R + sz * 2, dDimY - sz, 'DIM')
  ln( R, dDimY,  R - sz * 2, dDimY + sz, 'DIM')
  ln( R, dDimY,  R - sz * 2, dDimY - sz, 'DIM')
  txt(0, dDimY - sz * 3.5, R * 0.042, `D = ${D.toFixed(1)} mm`, 'TEXT')

  // d（ジェット径）の注記（最初のノズル位置に引出し）
  const ja0 = -Math.PI / 2
  const annX = (R + R * 0.42) * Math.cos(ja0) + R * 0.05
  const annY = (R + R * 0.42) * Math.sin(ja0) - R * 0.05
  ln(annX, annY, annX + R * 0.25, annY - R * 0.12, 'DIM')
  txt(annX + R * 0.26, annY - R * 0.18, R * 0.038, `d = ${d.toFixed(1)} mm`, 'TEXT')

  // D/d比
  txt(R + 15, -R * 0.2, R * 0.038, `D/d = ${p.dOverD.toFixed(1)}`, 'TEXT')

  // バケット幅
  txt(-R - 10, R * 0.5, R * 0.038, `B = ${B2.toFixed(1)} mm`, 'TEXT')

  // ── 表題欄 ──────────────────────────────────────────────────
  const tw = R * 3.2, th = R * 0.45
  const tx = R * 1.6
  const tyBase = -(R + dimGap * 2.5 + th + R * 0.1)
  ln(tx - tw / 2, tyBase,      tx + tw / 2, tyBase,      'TITLE')
  ln(tx - tw / 2, tyBase + th, tx + tw / 2, tyBase + th, 'TITLE')
  ln(tx - tw / 2, tyBase,      tx - tw / 2, tyBase + th, 'TITLE')
  ln(tx + tw / 2, tyBase,      tx + tw / 2, tyBase + th, 'TITLE')
  ln(tx - tw / 2, tyBase + th * 0.5, tx + tw / 2, tyBase + th * 0.5, 'TITLE')
  txt(tx, tyBase + th * 0.75, R * 0.05, 'ペルトン水車　正面概略図', 'TITLE')
  txt(tx - tw * 0.2, tyBase + th * 0.25, R * 0.038,
    `D=${D.toFixed(1)}  d=${d.toFixed(1)}  B=${B2.toFixed(1)}  [mm]`, 'TITLE')
  txt(tx + tw * 0.22, tyBase + th * 0.25, R * 0.038,
    `ジェット:${numJets}本  バケット:${numBuckets}枚`, 'TITLE')

  lines.push('  0\nENDSEC', '  0\nEOF')
  return lines.join('\n')
}
