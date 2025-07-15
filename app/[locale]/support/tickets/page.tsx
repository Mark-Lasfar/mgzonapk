// /app/[locale]/support/tickets/page.tsx

import { Metadata } from 'next'
import { auth } from '@/auth'
import { getTickets } from '@/lib/actions/support.actions'
// import TicketList from './ticket-list'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { TicketList } from './ticket-list'

export const metadata: Metadata = {
  title: 'Support Tickets',
}

export default async function SupportTickets({
  searchParams,
}: {
  searchParams: { page?: string; status?: string }
}) {
  const session = await auth()
  const page = Number(searchParams.page) || 1
  const { data } = await getTickets(session?.user.id!, {
    page,
    status: searchParams.status,
  })

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <Button asChild>
          <Link href="/support/tickets/create">Create New Ticket</Link>
        </Button>
      </div>
      <TicketList
        tickets={data.tickets}
        totalPages={data.totalPages}
        page={page}
      />
    </div>
  )
}
