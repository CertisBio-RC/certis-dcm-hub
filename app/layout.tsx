import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CERTIS DCM Hub",
  description: "CERTIS Biologicals Demand Creation Hub - Row Crops",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}