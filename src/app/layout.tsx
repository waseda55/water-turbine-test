import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '水車選定ツール',
  description: '計算式・パラメータ・判定ロジック — HPP Design 比較検証版',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-bg text-text antialiased">{children}</body>
    </html>
  )
}
