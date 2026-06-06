/**
 * 水車選定ツール — ローカルエクスポート / インポートユーティリティ
 *
 * 提供機能:
 *   exportJSON   — 入力値＋計算結果を JSON ファイルとしてダウンロード
 *   exportCSV    — 主要パラメータを CSV ファイルとしてダウンロード
 *   exportExcel  — Excel (XLSX) ファイルとしてダウンロード（SheetJS 使用）
 *   importJSON   — JSON ファイルから TurbineInputs を復元
 */

import type { TurbineInputs, TurbineResults } from '@/types'

// ─── 共通ヘルパー ──────────────────────────────────────────────────────────────
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href    = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function timestamp() {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    '_',
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
  ].join('')
}

// ─── JSON エクスポート ─────────────────────────────────────────────────────────
export interface ExportPayload {
  version:    string
  exportedAt: string
  caseName:   string
  inputs:     TurbineInputs
  results:    TurbineResults
}

export function exportJSON(
  inputs:   TurbineInputs,
  results:  TurbineResults,
  caseName: string = '無題'
) {
  const payload: ExportPayload = {
    version:    '1.0',
    exportedAt: new Date().toISOString(),
    caseName,
    inputs,
    results,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const safe = caseName.replace(/[\\/:*?"<>|]/g, '_')
  downloadBlob(blob, `turbine_${safe}_${timestamp()}.json`)
}

// ─── JSON インポート ───────────────────────────────────────────────────────────
export function importJSON(file: File): Promise<ExportPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const payload = JSON.parse(e.target?.result as string) as ExportPayload
        if (!payload.inputs || !payload.results) {
          reject(new Error('このファイルは有効な水車選定データではありません'))
          return
        }
        resolve(payload)
      } catch {
        reject(new Error('JSON の解析に失敗しました'))
      }
    }
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'))
    reader.readAsText(file)
  })
}

// ─── CSV エクスポート ──────────────────────────────────────────────────────────
export function exportCSV(
  inputs:   TurbineInputs,
  results:  TurbineResults,
  caseName: string = '無題'
) {
  const r = results
  const i = inputs
  const d = r.dimensions
  const h = r.hydraulics
  const e = r.electrical

  const rows: unknown[][] = [
    ['ケース名', '—', caseName],
    ['エクスポート日時', '—', new Date().toLocaleString('ja-JP')],
    ['', '', ''],
    ['【入力条件】', '', ''],
    ['有効落差 H', 'm', i.head],
    ['設計流量 Q', 'm³/s', i.flowRate],
    ['水車効率 η_t', '%', i.turbineEff],
    ['発電機効率 η_g', '%', i.generatorEff],
    ['吸出し高さ Hs', 'm', i.suctionHead],
    ['設置標高', 'm', i.altitude],
    ['電源周波数 f', 'Hz', i.frequency],
    ['力率 cosφ', '—', i.powerFactor],
    ['年間稼働時間', 'h/年', i.operatingHours],
    ['設備利用率', '%', i.capacityFactor],
    ['導水管延長', 'm', i.penstock.length],
    ['管種', '—', i.penstock.material],
    ['', '', ''],
    ['【水車仕様】', '', ''],
    ['水車形式', '—', r.turbineType],
    ['比速度 Ns', '—', r.specificSpeed.toFixed(2)],
    ['定格回転速度 n', 'rpm', Math.round(r.ratedRpm)],
    ['極数', '極', r.poles],
    ['無拘束速度 nr', 'rpm', Math.round(r.runawaySpeed)],
    ['', '', ''],
    ['【出力・効率】', '', ''],
    ['水車出力 Pw', 'kW', r.turbinePower.toFixed(2)],
    ['発電機出力 Pe', 'kW', r.generatorPower.toFixed(2)],
    ['', '', ''],
    ['【主要寸法（共通）】', '', ''],
    ['ランナー径 D', 'mm', (d.runnerDiameter * 1000).toFixed(1)],
    ['吸出し管径', 'mm', d.draftTubeDiameter != null ? (d.draftTubeDiameter * 1000).toFixed(1) : '—'],
    ['ケーシング概略径', 'mm', d.casingDiameter != null ? (d.casingDiameter * 1000).toFixed(1) : '—'],
    ['導水管径', 'mm', (d.penstockDiameter * 1000).toFixed(1)],
    ['導水管流速', 'm/s', d.penstockVelocity.toFixed(1)],
    ['', '', ''],
    ...(d.pelton ? [
      ['【ペルトン水車　専用パラメータ】', '', ''],
      ['ジェット数 J',        '本',  String(d.pelton.numJets)],
      ['ジェット径 d',        'mm',  (d.pelton.jetDiameter * 1000).toFixed(1)],
      ['D/d 比',              '—',   d.pelton.dOverD.toFixed(2)],
      ['バケット内幅 B2',     'mm',  (d.pelton.bucketWidth * 1000).toFixed(1)],
      ['D/B 比',              '—',   d.pelton.dOverB.toFixed(2)],
      ['バケット数',           '枚',  String(d.pelton.numBuckets)],
      ['最小流量 Qmin',       'l/s', (d.pelton.minFlow * 1000).toFixed(2)],
    ] : []),
    ...(d.francis ? [
      ['【フランシス水車　専用パラメータ】', '', ''],
      ['アウトレット径 D2e',   'mm',  (d.francis.outletDiameter * 1000).toFixed(1)],
      ['入口径 D01',           'mm',  (d.francis.inletDiameter * 1000).toFixed(1)],
      ['ガイドベーン高さ Bd',  'mm',  (d.francis.guideVaneHeight * 1000).toFixed(1)],
      ['スパイラルケーシング径','mm', (d.francis.spiralCaseInlet * 1000).toFixed(1)],
      ['ランナーブレード数',   '枚',  String(d.francis.numBlades)],
      ['ガイドベーン数',       '枚',  String(d.francis.numGuideVanes)],
      ['最小流量 Qmin',        'l/s', (d.francis.minFlow * 1000).toFixed(1)],
      ['無拘束時流量 Qr',        'l/s', (d.francis.flowAtRunaway * 1000).toFixed(1)],
    ] : []),
    ...(d.francisDetail ? [
      ['', '', ''],
      ['【フランシス詳細設計パラメータ（ランナベーン）】', '', ''],
      ['入口径（クラウン側） D₁', 'mm', (d.francisDetail.D1 * 1000).toFixed(1)],
      ['入口径（バンド側）   D₅', 'mm', (d.francisDetail.D5 * 1000).toFixed(1)],
      ['出口径（クラウン側） D₆', 'mm', (d.francisDetail.D6 * 1000).toFixed(1)],
      ['出口径（バンド側）   D₂', 'mm', (d.francisDetail.D2 * 1000).toFixed(1)],
      ['ボス径               D₇', 'mm', (d.francisDetail.D7 * 1000).toFixed(1)],
      ['出口高さ             H₂', 'mm', (d.francisDetail.H2 * 1000).toFixed(1)],
      ['入口羽根高さ          B₁', 'mm', (d.francisDetail.B1 * 1000).toFixed(1)],
      ['入口子午面速度       Vm₁', 'm/s', d.francisDetail.Vm1.toFixed(3)],
      ['出口子午面速度       Vm₂', 'm/s', d.francisDetail.Vm2.toFixed(3)],
      ['入口絶対角度          α₁', '°',  d.francisDetail.alpha1.toFixed(2)],
      ['入口相対羽根角度     β₁b', '°',  d.francisDetail.beta1b.toFixed(2)],
      ['出口相対羽根角度     β₂b', '°',  d.francisDetail.beta2b.toFixed(2)],
      ['羽根枚数              Zr', '枚',  String(d.francisDetail.Zr)],
      ['入口羽根厚さ           t₁', 'mm', (d.francisDetail.t1 * 1000).toFixed(2)],
      ['出口羽根厚さ           t₂', 'mm', (d.francisDetail.t2 * 1000).toFixed(2)],
      ['羽根長さ               l',  'mm', d.francisDetail.lb != null ? (Math.abs(d.francisDetail.lb) * 1000).toFixed(1) : '—'],
      ['', '', ''],
      ['【フランシス詳細設計パラメータ（ガイドベーン）】', '', ''],
      ['枚数                  Zg', '枚',  String(d.francisDetail.Zg)],
      ['外径                 Dg₁', 'mm', (d.francisDetail.Dg1 * 1000).toFixed(1)],
      ['内径                 Dg₂', 'mm', (d.francisDetail.Dg2 * 1000).toFixed(1)],
      ['ピッチ円半径           Rg', 'mm', (d.francisDetail.Rg * 1000).toFixed(1)],
      ['ピッチ円→出口距離    Dlx', 'mm', (d.francisDetail.Dlx * 1000).toFixed(1)],
      ['入口羽根高さ         Bg₁', 'mm', (d.francisDetail.Bg1 * 1000).toFixed(1)],
      ['出口羽根高さ         Bg₂', 'mm', (d.francisDetail.Bg2 * 1000).toFixed(1)],
      ['入口厚さ             tg₁', 'mm', (d.francisDetail.tg1 * 1000).toFixed(2)],
      ['出口厚さ             tg₂', 'mm', (d.francisDetail.tg2 * 1000).toFixed(2)],
      ['羽根長さ              lg', 'mm', (d.francisDetail.lg * 1000).toFixed(1)],
      ['最大ポート幅          P00', 'mm', (d.francisDetail.P00 * 1000).toFixed(1)],
      ['', '', ''],
      ['【ガイドベーン角度（各開度）】', '', ''],
      ['開度[%]', 'αG1b[°]', 'αG2b[°]'],
      ...d.francisDetail.guideVaneTable.map(gv => [
        String(gv.op), gv.alphaG1b.toFixed(3), gv.alphaG2b.toFixed(3),
      ]),
      ['', '', ''],
      ['【フランシス詳細設計パラメータ（ステーベーン）】', '', ''],
      ['枚数                  Zs', '枚',  String(d.francisDetail.Zs)],
      ['入口径               Ds₁', 'mm', (d.francisDetail.Ds1 * 1000).toFixed(1)],
      ['出口径               Ds₂', 'mm', (d.francisDetail.Ds2 * 1000).toFixed(1)],
      ['入口高さ             Bs₁', 'mm', (d.francisDetail.Bs1 * 1000).toFixed(1)],
      ['出口高さ             Bs₂', 'mm', (d.francisDetail.Bs2 * 1000).toFixed(1)],
      ['入口厚さ             ts₁', 'mm', (d.francisDetail.ts1 * 1000).toFixed(2)],
      ['出口厚さ             ts₂', 'mm', (d.francisDetail.ts2 * 1000).toFixed(2)],
      ['羽根長さ              ls', 'mm', (Math.abs(d.francisDetail.ls) * 1000).toFixed(1)],
      ['入口角度            αS₁b', '°',  d.francisDetail.alphaS1b.toFixed(2)],
      ['出口角度            αS₂b', '°',  d.francisDetail.alphaS2b.toFixed(2)],
      ['', '', ''],
      ['【フランシス詳細設計パラメータ（ケーシング）】', '', ''],
      ['スパイラルケーシング径 Dc', 'mm', (d.francisDetail.Dc * 1000).toFixed(1)],
      ['ケーシング長さ       lCa', 'mm', (d.francisDetail.lCa * 1000).toFixed(1)],
      ['ケーシング入口流速   Vc0', 'm/s', d.francisDetail.Vc0.toFixed(2)],
      ['', '', ''],
      ['【フランシス詳細設計パラメータ（ドラフトチューブ）】', '', ''],
      ['入口円筒部長さ       ldc', 'mm', (d.francisDetail.ldc * 1000).toFixed(1)],
      ['入口円筒入口半径    rdc₁', 'mm', (d.francisDetail.rdc1 * 1000).toFixed(1)],
      ['入口円筒出口半径    rdc₂', 'mm', (d.francisDetail.rdc2 * 1000).toFixed(1)],
      ['曲がり部半径         rdb', 'mm', (d.francisDetail.rdb * 1000).toFixed(1)],
      ['曲がり部出口幅       bdb', 'mm', (d.francisDetail.bdb * 1000).toFixed(1)],
      ['曲がり部出口高さ    hdb₂', 'mm', (d.francisDetail.hdb2 * 1000).toFixed(1)],
      ['ディフューザ長さ     ldd', 'mm', (d.francisDetail.ldd * 1000).toFixed(1)],
      ['ディフューザ出口幅   bdd', 'mm', (d.francisDetail.bdd * 1000).toFixed(1)],
      ['ディフューザ出口高さ  hdd', 'mm', (d.francisDetail.hdd * 1000).toFixed(1)],
      ['', '', ''],
      ['【フランシス詳細設計パラメータ（ランナーシール）】', '', ''],
      ['シール数', '—', String(d.francisDetail.seal)],
      ['ギャップ幅（クラウン）bw₁', 'mm', (d.francisDetail.bw_1 * 1000).toFixed(2)],
      ['ギャップ幅（バンド）  bw₂', 'mm', (d.francisDetail.bw_2 * 1000).toFixed(2)],
      ['シール長さ（クラウン）lw₁', 'mm', (d.francisDetail.lw_1 * 1000).toFixed(0)],
      ['シール長さ（バンド）  lw₂', 'mm', (d.francisDetail.lw_2 * 1000).toFixed(0)],
      ['シール半径（クラウン）rl₁', 'mm', (d.francisDetail.rl_1 * 1000).toFixed(1)],
      ['シール半径（バンド）  rl₂', 'mm', (d.francisDetail.rl_2 * 1000).toFixed(1)],
      ['', '', ''],
      ['【ステーベーン流入角（16断面）】', '', ''],
      ['断面No.', '角度θ[°]', '流入角α[°]'],
      ...d.francisDetail.stayVaneAngles.map(sv => [
        String(sv.no), sv.theta.toFixed(2), sv.alpha.toFixed(2),
      ]),
    ] : []),
    ...(d.kaplan ? [
      ['【カプラン水車　専用パラメータ】', '', ''],
      ['ランナーブレード数',   '枚',  String(d.kaplan.numBlades)],
      ['ガイドベーン数',       '枚',  String(d.kaplan.numGuideVanes)],
      ['ハブ径 Dh',           'mm',  (d.kaplan.hubDiameter * 1000).toFixed(1)],
      ['ハブ比 Dh/D',         '—',   d.kaplan.hubRatio.toFixed(3)],
      ['最小流量 Qmin',        'l/s', (d.kaplan.minFlow * 1000).toFixed(1)],
    ] : []),
    ['', '', ''],
    ['【水理・構造系】', '', ''],
    ['GD²', 'kN·m²', h.gd2.toFixed(3)],
    ['水撃圧上昇値 ΔH', 'm', h.waterHammerHead.toFixed(2)],
    ['水撃圧上昇率', '%', h.waterHammerRise.toFixed(1)],
    ['管路損失 hf', 'm', h.penstock.headLoss.toFixed(3)],
    ['管路損失率', '%', h.penstock.headLossRatio.toFixed(2)],
    ['', '', ''],
    ['【電気系】', '', ''],
    ['発電機容量', 'kVA', e.generatorKva.toFixed(2)],
    ['年間発電量', 'MWh/年', e.annualEnergy.toFixed(2)],
    ['年間発電量', 'GWh/年', e.annualEnergyGwh.toFixed(4)],
    ['', '', ''],
    ['【判定結果】', '', ''],
    ['キャビテーション', '—', r.checks.cavitation.result ?? ''],
    ['キャビテーション 詳細', '—', r.checks.cavitation.message],
    ['比速度の妥当性', '—', r.checks.specificSpeed.result],
    ['比速度 詳細', '—', r.checks.specificSpeed.message],
    ['標高・大気圧', '—', r.checks.altitude.result],
    ['標高 詳細', '—', r.checks.altitude.message],
    ['管路損失', '—', r.checks.headLoss.result],
    ['管路損失 詳細', '—', r.checks.headLoss.message],
    ['水撃圧', '—', r.checks.waterHammer.result],
    ['水撃圧 詳細', '—', r.checks.waterHammer.message],
  ]

  const bom  = '\uFEFF'  // Excel で文字化けしないよう BOM 付き
  const csv  = bom + rows
    .map(([a, b, c]) => [a, b, String(c)].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const safe = caseName.replace(/[\\/:*?"<>|]/g, '_')
  downloadBlob(blob, `turbine_${safe}_${timestamp()}.csv`)
}

// ─── Excel エクスポート（SheetJS / xlsx ライブラリ使用） ──────────────────────
// CDN から動的に SheetJS を読み込んでブラウザ上で XLSX 生成。
// バンドルサイズへの影響を避けるため動的 import を使用。

interface XLSXLib {
  utils: {
    book_new: () => XLSXWorkbook
    aoa_to_sheet: (data: unknown[][]) => XLSXSheet
    book_append_sheet: (wb: XLSXWorkbook, ws: XLSXSheet, name: string) => void
    sheet_add_aoa: (ws: XLSXSheet, data: unknown[][], opts: { origin: string }) => void
  }
  write: (wb: XLSXWorkbook, opts: { bookType: string; type: string }) => Uint8Array
}
interface XLSXWorkbook { SheetNames: string[]; Sheets: Record<string, XLSXSheet> }
interface XLSXSheet { [key: string]: unknown }

async function loadXLSX(): Promise<XLSXLib> {
  // xlsx パッケージを動的 import（Next.js バンドラー対応）
  const mod = await import('xlsx')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (mod.default ?? mod) as unknown as XLSXLib
}

export async function exportExcel(
  inputs:   TurbineInputs,
  results:  TurbineResults,
  caseName: string = '無題'
) {
  const XLSX = await loadXLSX()

  const r  = results
  const i  = inputs
  const d  = r.dimensions
  const h  = r.hydraulics
  const e  = r.electrical

  const fmt = (v: number | null | undefined, dec = 2): string =>
    v == null ? '—' : v.toFixed(dec)

  // ─ シート1: 計算結果サマリー ─
  const summaryData: unknown[][] = [
    ['水車選定ツール — 計算結果レポート'],
    [],
    ['ケース名', caseName],
    ['出力日時', new Date().toLocaleString('ja-JP')],
    [],
    ['【入力条件】'],
    ['項目', '値', '単位'],
    ['有効落差 H', i.head, 'm'],
    ['設計流量 Q', i.flowRate, 'm³/s'],
    ['水車効率 η_t', i.turbineEff, '%'],
    ['発電機効率 η_g', i.generatorEff, '%'],
    ['吸出し高さ Hs', i.suctionHead, 'm'],
    ['設置標高', i.altitude, 'm'],
    ['電源周波数 f', i.frequency, 'Hz'],
    ['力率 cosφ', i.powerFactor, '—'],
    ['年間稼働時間', i.operatingHours, 'h/年'],
    ['設備利用率', i.capacityFactor, '%'],
    ['導水管延長', i.penstock.length, 'm'],
    ['管種', i.penstock.material, '—'],
    [],
    ['【水車仕様・出力】'],
    ['項目', '値', '単位'],
    ['水車形式', r.turbineType, '—'],
    ['比速度 Ns', fmt(r.specificSpeed, 2), '—'],
    ['定格回転速度 n', Math.round(r.ratedRpm), 'rpm'],
    ['極数', r.poles, '極'],
    ['無拘束速度 nr', Math.round(r.runawaySpeed), 'rpm'],
    ['水車出力 Pw', fmt(r.turbinePower, 2), 'kW'],
    ['発電機出力 Pe', fmt(r.generatorPower, 2), 'kW'],
    ['キャビテーション係数 σ', r.cavitationCoef != null ? fmt(r.cavitationCoef, 5) : '—（ペルトン）', '—'],
    ['最大吸出し高さ Hs_max', r.hsMax != null ? fmt(r.hsMax, 2) : '—（ペルトン）', 'm'],
    ['大気圧（補正後）', fmt(r.atmPressure, 3), 'kPa'],
    [],
    ['【主要寸法（共通）】'],
    ['項目', '値', '単位'],
    ['ランナー径 D', fmt(d.runnerDiameter * 1000, 1), 'mm'],
    ['吸出し管径', d.draftTubeDiameter != null ? fmt(d.draftTubeDiameter * 1000, 1) : '—', 'mm'],
    ['ケーシング概略径', d.casingDiameter != null ? fmt(d.casingDiameter * 1000, 1) : '—', 'mm'],
    ['導水管径', fmt(d.penstockDiameter * 1000, 1), 'mm'],
    ['導水管流速', fmt(d.penstockVelocity, 1), 'm/s'],
    [],
    // ペルトン専用
    ...(d.pelton ? [
      ['【ペルトン水車　専用パラメータ】'],
      ['項目', '値', '単位'],
      ['ジェット数 J',         String(d.pelton.numJets),                          '本'],
      ['ジェット径 d',         fmt(d.pelton.jetDiameter * 1000, 1),               'mm'],
      ['D/d 比',               fmt(d.pelton.dOverD, 2),                           '—'],
      ['バケット内幅 B2',      fmt(d.pelton.bucketWidth * 1000, 1),               'mm'],
      ['D/B 比',               fmt(d.pelton.dOverB, 2),                           '—'],
      ['バケット数',            String(d.pelton.numBuckets),                       '枚'],
      ['最小流量 Qmin',        fmt(d.pelton.minFlow * 1000, 2),                   'l/s'],
    ] : []),
    // フランシス専用
    ...(d.francis ? [
      ['【フランシス水車　専用パラメータ】'],
      ['項目', '値', '単位'],
      ['アウトレット径 D2e',    fmt(d.francis.outletDiameter * 1000, 1),           'mm'],
      ['入口径 D01',            fmt(d.francis.inletDiameter * 1000, 1),            'mm'],
      ['ガイドベーン高さ Bd',   fmt(d.francis.guideVaneHeight * 1000, 1),          'mm'],
      ['スパイラルケーシング径', fmt(d.francis.spiralCaseInlet * 1000, 1),         'mm'],
      ['ランナーブレード数',    String(d.francis.numBlades),                       '枚'],
      ['ガイドベーン数',        String(d.francis.numGuideVanes),                   '枚'],
      ['最小流量 Qmin',        fmt(d.francis.minFlow * 1000, 1),                   'l/s'],
      ['無拘束時流量 Qr',        fmt(d.francis.flowAtRunaway * 1000, 1),             'l/s'],
    ] : []),
    ...(d.francisDetail ? [
      [],
      ['【フランシス詳細設計パラメータ（ランナベーン）】'],
      ['項目', '値', '単位'],
      ['入口径（クラウン側） D₁', fmt(d.francisDetail.D1 * 1000, 1), 'mm'],
      ['入口径（バンド側）   D₅', fmt(d.francisDetail.D5 * 1000, 1), 'mm'],
      ['出口径（クラウン側） D₆', fmt(d.francisDetail.D6 * 1000, 1), 'mm'],
      ['出口径（バンド側）   D₂', fmt(d.francisDetail.D2 * 1000, 1), 'mm'],
      ['ボス径               D₇', fmt(d.francisDetail.D7 * 1000, 1), 'mm'],
      ['出口高さ             H₂', fmt(d.francisDetail.H2 * 1000, 1), 'mm'],
      ['入口羽根高さ          B₁', fmt(d.francisDetail.B1 * 1000, 1), 'mm'],
      ['入口子午面速度       Vm₁', fmt(d.francisDetail.Vm1, 3), 'm/s'],
      ['出口子午面速度       Vm₂', fmt(d.francisDetail.Vm2, 3), 'm/s'],
      ['入口絶対角度          α₁', fmt(d.francisDetail.alpha1, 2), '°'],
      ['入口相対羽根角度     β₁b', fmt(d.francisDetail.beta1b, 2), '°'],
      ['出口相対羽根角度     β₂b', fmt(d.francisDetail.beta2b, 2), '°'],
      ['羽根枚数              Zr', d.francisDetail.Zr, '枚'],
      ['入口羽根厚さ           t₁', fmt(d.francisDetail.t1 * 1000, 2), 'mm'],
      ['出口羽根厚さ           t₂', fmt(d.francisDetail.t2 * 1000, 2), 'mm'],
      ['羽根長さ               l',  d.francisDetail.lb != null ? fmt(Math.abs(d.francisDetail.lb) * 1000, 1) : '—', 'mm'],
      [],
      ['【フランシス詳細設計パラメータ（ガイドベーン）】'],
      ['項目', '値', '単位'],
      ['枚数                  Zg', d.francisDetail.Zg, '枚'],
      ['外径                 Dg₁', fmt(d.francisDetail.Dg1 * 1000, 1), 'mm'],
      ['内径                 Dg₂', fmt(d.francisDetail.Dg2 * 1000, 1), 'mm'],
      ['ピッチ円半径           Rg', fmt(d.francisDetail.Rg * 1000, 1), 'mm'],
      ['ピッチ円→出口距離    Dlx', fmt(d.francisDetail.Dlx * 1000, 1), 'mm'],
      ['入口羽根高さ         Bg₁', fmt(d.francisDetail.Bg1 * 1000, 1), 'mm'],
      ['出口羽根高さ         Bg₂', fmt(d.francisDetail.Bg2 * 1000, 1), 'mm'],
      ['入口厚さ             tg₁', fmt(d.francisDetail.tg1 * 1000, 2), 'mm'],
      ['出口厚さ             tg₂', fmt(d.francisDetail.tg2 * 1000, 2), 'mm'],
      ['羽根長さ              lg', fmt(d.francisDetail.lg * 1000, 1), 'mm'],
      ['最大ポート幅          P00', fmt(d.francisDetail.P00 * 1000, 1), 'mm'],
      [],
      ['【ガイドベーン角度テーブル（各開度）】'],
      ['開度[%]', 'ポート幅[mm]', 'αG1b[°]', 'αG2b[°]', 'δ[°]', 'αG02[°]'],
      ...d.francisDetail.guideVaneTable.map(gv => [
        gv.op,
        parseFloat((gv.port * 1000).toFixed(1)),
        parseFloat(gv.alphaG1b.toFixed(3)),
        parseFloat(gv.alphaG2b.toFixed(3)),
        parseFloat(gv.delta.toFixed(3)),
        parseFloat(gv.alphaG02.toFixed(3)),
      ]),
      [],
      ['【フランシス詳細設計パラメータ（ステーベーン）】'],
      ['項目', '値', '単位'],
      ['枚数                  Zs', d.francisDetail.Zs, '枚'],
      ['入口径               Ds₁', fmt(d.francisDetail.Ds1 * 1000, 1), 'mm'],
      ['出口径               Ds₂', fmt(d.francisDetail.Ds2 * 1000, 1), 'mm'],
      ['入口高さ             Bs₁', fmt(d.francisDetail.Bs1 * 1000, 1), 'mm'],
      ['出口高さ             Bs₂', fmt(d.francisDetail.Bs2 * 1000, 1), 'mm'],
      ['入口厚さ             ts₁', fmt(d.francisDetail.ts1 * 1000, 2), 'mm'],
      ['出口厚さ             ts₂', fmt(d.francisDetail.ts2 * 1000, 2), 'mm'],
      ['羽根長さ              ls', fmt(Math.abs(d.francisDetail.ls) * 1000, 1), 'mm'],
      ['入口角度            αS₁b', fmt(d.francisDetail.alphaS1b, 2), '°'],
      ['出口角度            αS₂b', fmt(d.francisDetail.alphaS2b, 2), '°'],
      [],
      ['【フランシス詳細設計パラメータ（ケーシング）】'],
      ['項目', '値', '単位'],
      ['スパイラルケーシング径 Dc', fmt(d.francisDetail.Dc * 1000, 1), 'mm'],
      ['ケーシング長さ       lCa', fmt(d.francisDetail.lCa * 1000, 1), 'mm'],
      ['ケーシング入口流速   Vc0', fmt(d.francisDetail.Vc0, 2), 'm/s'],
      [],
      ['【フランシス詳細設計パラメータ（ドラフトチューブ）】'],
      ['項目', '値', '単位'],
      ['入口円筒部長さ       ldc', fmt(d.francisDetail.ldc * 1000, 1), 'mm'],
      ['入口円筒入口半径    rdc₁', fmt(d.francisDetail.rdc1 * 1000, 1), 'mm'],
      ['入口円筒出口半径    rdc₂', fmt(d.francisDetail.rdc2 * 1000, 1), 'mm'],
      ['曲がり部半径         rdb', fmt(d.francisDetail.rdb * 1000, 1), 'mm'],
      ['曲がり部出口幅       bdb', fmt(d.francisDetail.bdb * 1000, 1), 'mm'],
      ['曲がり部出口高さ    hdb₂', fmt(d.francisDetail.hdb2 * 1000, 1), 'mm'],
      ['ディフューザ長さ     ldd', fmt(d.francisDetail.ldd * 1000, 1), 'mm'],
      ['ディフューザ出口幅   bdd', fmt(d.francisDetail.bdd * 1000, 1), 'mm'],
      ['ディフューザ出口高さ  hdd', fmt(d.francisDetail.hdd * 1000, 1), 'mm'],
      [],
      ['【フランシス詳細設計パラメータ（ランナーシール）】'],
      ['項目', '値', '単位'],
      ['シール数', d.francisDetail.seal, '—'],
      ['ギャップ幅（クラウン）bw₁', fmt(d.francisDetail.bw_1 * 1000, 2), 'mm'],
      ['ギャップ幅（バンド）  bw₂', fmt(d.francisDetail.bw_2 * 1000, 2), 'mm'],
      ['シール長さ（クラウン）lw₁', fmt(d.francisDetail.lw_1 * 1000, 0), 'mm'],
      ['シール長さ（バンド）  lw₂', fmt(d.francisDetail.lw_2 * 1000, 0), 'mm'],
      ['シール半径（クラウン）rl₁', fmt(d.francisDetail.rl_1 * 1000, 1), 'mm'],
      ['シール半径（バンド）  rl₂', fmt(d.francisDetail.rl_2 * 1000, 1), 'mm'],
    ] : []),
    // カプラン専用
    ...(d.kaplan ? [
      ['【カプラン水車　専用パラメータ】'],
      ['項目', '値', '単位'],
      ['ランナーブレード数',    String(d.kaplan.numBlades),                        '枚'],
      ['ガイドベーン数',        String(d.kaplan.numGuideVanes),                    '枚'],
      ['ハブ径 Dh',            fmt(d.kaplan.hubDiameter * 1000, 1),               'mm'],
      ['ハブ比 Dh/D',          fmt(d.kaplan.hubRatio, 3),                          '—'],
      ['最小流量 Qmin',        fmt(d.kaplan.minFlow * 1000, 1),                    'l/s'],
    ] : []),
    [],
    ['【水理・構造系】'],
    ['項目', '値', '単位'],
    ['GD²', fmt(h.gd2, 3), 'kN·m²'],
    ['水撃圧上昇値 ΔH', fmt(h.waterHammerHead, 2), 'm'],
    ['水撃圧上昇率', fmt(h.waterHammerRise, 1), '%'],
    ['管路損失 hf', fmt(h.penstock.headLoss, 3), 'm'],
    ['管路損失率', fmt(h.penstock.headLossRatio, 2), '%'],
    [],
    ['【電気系】'],
    ['項目', '値', '単位'],
    ['発電機容量', fmt(e.generatorKva, 2), 'kVA'],
    ['年間発電量', fmt(e.annualEnergy, 2), 'MWh/年'],
    ['年間発電量', fmt(e.annualEnergyGwh, 4), 'GWh/年'],
    [],
    ['【判定結果】'],
    ['チェック項目', '結果', '詳細'],
    ['キャビテーション', r.checks.cavitation.result ?? '', r.checks.cavitation.message],
    ['比速度の妥当性',   r.checks.specificSpeed.result,    r.checks.specificSpeed.message],
    ['標高・大気圧',     r.checks.altitude.result,         r.checks.altitude.message],
    ['無拘束速度',         'INFO',                           r.checks.runaway.message],
    ['管路損失',         r.checks.headLoss.result,         r.checks.headLoss.message],
    ['水撃圧',           r.checks.waterHammer.result,      r.checks.waterHammer.message],
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(summaryData)

  // 列幅設定
  ws['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 14 }]

  XLSX.utils.book_append_sheet(wb, ws, '計算結果')

  // ─ シート2: 入力値のみ（再インポート用） ─
  const inputData: unknown[][] = [
    ['水車選定ツール — 入力値（再インポート用）'],
    ['このシートは参照用です。JSONファイルをインポート機能でお使いください。'],
    [],
    ['フィールド名', '値'],
    ['head', i.head],
    ['flowRate', i.flowRate],
    ['turbineEff', i.turbineEff],
    ['generatorEff', i.generatorEff],
    ['suctionHead', i.suctionHead],
    ['altitude', i.altitude],
    ['frequency', i.frequency],
    ['powerFactor', i.powerFactor],
    ['operatingHours', i.operatingHours],
    ['capacityFactor', i.capacityFactor],
    ['penstock.length', i.penstock.length],
    ['penstock.material', i.penstock.material],
  ]
  const wsInput = XLSX.utils.aoa_to_sheet(inputData)
  wsInput['!cols'] = [{ wch: 22 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, wsInput, '入力値')

  // ─ シート3: ステーベーン流入角（16断面） ─
  if (r.dimensions.francisDetail?.stayVaneAngles) {
    const svData: unknown[][] = [
      ['ステーベーン流入角（16断面）'],
      [],
      ['断面 No.', '角度 θ [°]', '流量 Qn [m³/s]', 'ケーシング径 Dcn [mm]', '流入角 α [°]'],
      ...r.dimensions.francisDetail.stayVaneAngles.map(sv => [
        sv.no,
        parseFloat(sv.theta.toFixed(2)),
        parseFloat(sv.Qn.toFixed(4)),
        parseFloat((sv.Dcn * 1000).toFixed(1)),
        parseFloat(sv.alpha.toFixed(2)),
      ]),
    ]
    const wsSv = XLSX.utils.aoa_to_sheet(svData)
    wsSv['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, wsSv, 'ステーベーン流入角')
  }

  // ─ シート4: ガイドベーン角度テーブル ─
  if (r.dimensions.francisDetail?.guideVaneTable) {
    const gvData: unknown[][] = [
      ['ガイドベーン角度テーブル'],
      [],
      ['開度 [%]', 'ポート幅 [mm]', 'αG1b [°]', 'αG2b [°]', 'δ [°]', 'αG02 [°]'],
      ...r.dimensions.francisDetail.guideVaneTable.map(gv => [
        gv.op,
        parseFloat((gv.port * 1000).toFixed(1)),
        parseFloat(gv.alphaG1b.toFixed(3)),
        parseFloat(gv.alphaG2b.toFixed(3)),
        parseFloat(gv.delta.toFixed(3)),
        parseFloat(gv.alphaG02.toFixed(3)),
      ]),
    ]
    const wsGv = XLSX.utils.aoa_to_sheet(gvData)
    wsGv['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsGv, 'GVアングル')
  }

  const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as unknown as ArrayBuffer
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const safe = caseName.replace(/[\\/:*?"<>|]/g, '_')
  downloadBlob(blob, `turbine_${safe}_${timestamp()}.xlsx`)
}

// ─── DXF エクスポート ──────────────────────────────────────────────────────────
export async function exportDXF(
  results: TurbineResults,
  caseName: string = '無題',
  inputs?: TurbineInputs
): Promise<void> {
  switch (results.turbineType) {
    case 'フランシス水車': {
      if (!results.dimensions.francis) break
      const { exportFrancisDxf } = await import('./export-dxf')
      await exportFrancisDxf(results, caseName, inputs)
      return
    }
    case 'カプラン水車': {
      if (!results.dimensions.kaplan) break
      const { exportKaplanDxf } = await import('./export-dxf-kaplan')
      await exportKaplanDxf(results, caseName)
      return
    }
    case 'ペルトン水車': {
      if (!results.dimensions.pelton) break
      const { exportPeltonDxf } = await import('./export-dxf-pelton')
      await exportPeltonDxf(results, caseName)
      return
    }
    default:
      console.warn(`DXFエクスポートはフランシス・カプラン・ペルトン水車に対応しています（${results.turbineType} は未対応）`)
  }
}
