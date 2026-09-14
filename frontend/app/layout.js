import "./globals.css";

export const metadata = {
  title: "PneumoScan AI | X-ray screening",
  description: "Advanced Pneumonia Detection AI"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className="bg-slate-50 text-slate-900 min-h-screen font-sans antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
