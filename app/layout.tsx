import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RaccoonTech — Soluções digitais sob medida",
  description:
    "Agents de IA, automação, CRM e produtos digitais sob medida para negócios reais.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
