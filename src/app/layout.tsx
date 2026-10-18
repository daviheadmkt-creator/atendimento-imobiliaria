import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Atendimento Imobiliário",
  description: "Plataforma de atendimento comercial imobiliário.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
