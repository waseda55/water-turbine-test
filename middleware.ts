import { NextResponse, type NextRequest } from 'next/server'

// 認証チェックを一時的に無効化してパフォーマンス計測
export async function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
