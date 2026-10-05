import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ตั้งหลัก — ผู้ช่วยจัดการหนี้",
  description: "เห็นภาระหนี้ วางแผนรายเดือน และค่อย ๆ กลับมาตั้งหลักทางการเงิน",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="antialiased">{children}</body>
    </html>
  );
}
