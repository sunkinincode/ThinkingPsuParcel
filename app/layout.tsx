import type { Metadata } from "next";
import "./globals.css"; // บรรทัดนี้คือตัวเรียก CSS ให้ทำงานทั้งเว็บ

export const metadata: Metadata = {
  title: "Smart Parcel Locker",
  description: "ระบบจัดการพัสดุอัจฉริยะ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}