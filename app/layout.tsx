import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL('https://focus-room-training.social-dell-7370.chatgpt.site'),
  title: '专注训练室 · Focus Room',
  icons: { icon: '/favicon.svg' },
  description:
    '舒尔特方格、色卡冲突、序列记忆与动态追踪。多档难度，按自己的节奏练习。',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark">
      <body>{children}</body>
    </html>
  );
}
