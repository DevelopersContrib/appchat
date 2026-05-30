import './globals.css';

export const metadata = {
  title: 'AppChat — Professional Team Communication',
  description: 'Secure chat, video calls, and AI agents for your organization.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
