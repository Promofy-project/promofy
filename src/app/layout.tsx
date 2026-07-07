import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Promofy — Cupons e promoções locais",
  description:
    "A plataforma que conecta pessoas a ofertas exclusivas de estabelecimentos perto de você. Protótipo de demonstração.",
  // Favicon: convenção de arquivo do App Router (src/app/icon.png + src/app/favicon.ico).
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
