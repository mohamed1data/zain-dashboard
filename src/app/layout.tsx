import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EMPIRE AI — Dashboard",
  description: "WhatsApp AI Bot Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
