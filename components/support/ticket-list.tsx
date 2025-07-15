'use client';

import { useState, useEffect } from 'react';
// import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable } from '../ui/data-table';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'closed' | 'pending';
  priority: 'low' | 'medium' | 'high';
  category: string;
  assignee?: string;
  createdAt: string;
  updatedAt: string;
  comments: Array<{
    id: string;
    content: string;
    author: string;
    createdAt: string;
  }>;
}

export function TicketList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await fetch('/api/v1/support/tickets');
      const data = await response.json();
      setTickets(data);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedTicket || !newComment.trim()) return;

    try {
      const response = await fetch(`/api/v1/support/tickets/${selectedTicket.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newComment }),
      });

      if (response.ok) {
        const updatedTicket = await response.json();
        setSelectedTicket(updatedTicket);
        setNewComment('');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleUpdateStatus = async (ticketId: string, status: Ticket['status']) => {
    try {
      const response = await fetch(`/api/v1/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        setTickets(tickets.map(ticket => 
          ticket.id === ticketId ? { ...ticket, status } : ticket
        ));
      }
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  };

  const columns = [
    { 
      accessorKey: 'id', 
      header: 'ID',
    },
    { 
      accessorKey: 'title', 
      header: 'Title',
    },
    { 
      accessorKey: 'status', 
      header: 'Status',
      cell: ({ row }: { row: { original: Ticket } }) => (
        <Badge variant={
          row.original.status === 'open' ? 'default' :
          row.original.status === 'pending' ? 'outline' : 'secondary'
        }>
          {row.original.status}
        </Badge>
      ),
    },
    { 
      accessorKey: 'priority', 
      header: 'Priority',
      cell: ({ row }: { row: { original: Ticket } }) => (
        <Badge variant={
          row.original.priority === 'high' ? 'destructive' :
          row.original.priority === 'medium' ? 'outline' : 'default'
        }>
          {row.original.priority}
        </Badge>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
    },
    {
      accessorKey: 'assignee',
      header: 'Assignee',
    },
    { 
      accessorKey: 'createdAt', 
      header: 'Created',
      cell: ({ row }: { row: { original: Ticket } }) => format(new Date(row.original.createdAt), 'PPp'),
    },
    {
      accessorKey: 'actions',
      header: 'Actions',
      cell: ({ row }: { row: { original: Ticket } }) => (
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedTicket(row.original)}
          >
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleUpdateStatus(
              row.original.id,
              row.original.status === 'open' ? 'closed' : 'open'
            )}
          >
            {row.original.status === 'open' ? 'Close' : 'Reopen'}
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return <div>Loading tickets...</div>;
  }

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns} 
        data={tickets}
        searchKey="title"
      />

      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTicket?.title}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm">
              <p className="font-medium">Description:</p>
              <p>{selectedTicket?.description}</p>
            </div>

            <div className="space-y-2">
              <p className="font-medium">Comments:</p>
              {selectedTicket?.comments.map(comment => (
                <div key={comment.id} className="border p-2 rounded">
                  <p className="text-sm">{comment.content}</p>
                  <p className="text-xs text-gray-500">
                    {comment.author} - {format(new Date(comment.createdAt), 'PPp')}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <Button onClick={handleAddComment}>Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
