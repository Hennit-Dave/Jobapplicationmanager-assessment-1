import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Application Manager Track",
  description: "Authentication slice for Application Manager Track",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
