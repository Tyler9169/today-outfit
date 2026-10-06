import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "今天穿什么 · 我的衣橱",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "今天穿什么", statusBarStyle: "default" },
  description: "收藏衣服照片，整理你的私人衣橱。",
  other: {
    "codex-preview": "development",
  },
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
