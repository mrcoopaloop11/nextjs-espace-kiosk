import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito-sans", // This matches the var() in globals.css
  weight: ["300", "400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Eastside Kiosk",
  description: "Event display for Anaheim Campus",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${nunitoSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}