import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "柠檬叔的博客",
  description: "柠檬叔的个人文章、菜谱、技术笔记和生活记录",
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="site-shell">
          <header className="site-header">
            <div className="site-header-inner">
              <Link className="brand" href="/">
                🍋 柠檬叔的博客
              </Link>
              <nav className="nav" aria-label="主导航">
                <Link href="/">文章</Link>
                <Link href="/search">搜索</Link>
                <Link href="/admin">后台</Link>
              </nav>
            </div>
          </header>
          {children}
          <footer className="site-footer">
            <div className="site-footer-inner">
              <span>🍋 柠檬叔的博客</span>
              <span>lemonhall.me</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
