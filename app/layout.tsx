import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "BUSINESS360 — One Platform. Complete Business.",
  description: "Simple business management for Indian businesses."
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
