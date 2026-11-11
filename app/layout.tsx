import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Skin Minecraft and Mods",
  description: "Komunitas berbagi skin dan mod Minecraft Bedrock."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
