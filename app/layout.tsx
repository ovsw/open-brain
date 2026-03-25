import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Open Brain Tasks",
  description: "Personal task dashboard for Open Brain.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
