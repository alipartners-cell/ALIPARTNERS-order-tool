import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "発注推奨システム | Order Recommender",
  description: "SKU別の発注推奨数を自動計算するMVPツール",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
