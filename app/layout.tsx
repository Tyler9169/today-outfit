import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "今天穿什么 · 我的衣橱",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "今天穿什么", statusBarStyle: "default" },
  description: "批量整理衣服照片，生成搭配、局部替换与收藏，支持包含照片的备份迁移。",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-180.png",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#405a35" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
