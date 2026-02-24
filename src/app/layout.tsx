import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'MQL Classification Dashboard',
  description: 'Categorize Leads by UTM Campaign',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        {children}
      </body>
    </html>
  )
}
