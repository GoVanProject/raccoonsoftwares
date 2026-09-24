import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./styles/tokens.css";
import "./globals.css";
import "./styles/workspace.css";
import "./styles/landing.css";
import "./styles/workspace-overrides.css";
import "./styles/tailwind.css";
import "./styles/workspace-v2.css";
import "leaflet/dist/leaflet.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "IA e automação para negócios de serviços | RaccoonSoftwares",
  description:
    "A RaccoonSoftwares cria agents de IA, automações e sistemas sob medida para negócios de serviços reduzirem tarefas manuais e controlarem melhor a operação.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "IA e automação para negócios de serviços | RaccoonSoftwares",
    description:
      "Agents de IA, automações e sistemas sob medida para negócios de serviços operarem com mais clareza.",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "/raccoon-mascot.webp",
        width: 900,
        height: 844,
        alt: "Guaxinim da RaccoonSoftwares",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IA e automação para negócios de serviços | RaccoonSoftwares",
    description:
      "Automação e sistemas sob medida para reduzir trabalho manual e dar mais controle à operação.",
    images: ["/raccoon-mascot.webp"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <body className={GeistSans.variable}><Providers>{children}</Providers></body>
    </html>
  );
}
