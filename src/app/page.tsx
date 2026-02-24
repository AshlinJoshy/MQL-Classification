import LeadCategorizer from '@/components/LeadCategorizer'

export default function Home() {
  return (
    <main className="container mx-auto py-8 px-4 h-full min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">MQL Classification Dashboard</h1>
      <LeadCategorizer />
    </main>
  )
}
