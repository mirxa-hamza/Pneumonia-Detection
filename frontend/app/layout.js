import "./globals.css";

export const metadata = {
  title: "PneumoScan | X-ray screening",
  description: "Local pneumonia X-ray classification demo"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
