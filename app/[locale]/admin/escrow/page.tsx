'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

export default function EscrowManagement() {
  const [orders, setOrders] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const response = await fetch('/api/orders?status=pending&escrowStatus=held');
    const { data } = await response.json();
    setOrders(data);
  };

  const handleAction = async (orderId: string, action: 'release' | 'refund') => {
    const response = await fetch(`/api/escrow/${orderId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });

    if (response.ok) {
      toast({ description: `Escrow ${action}ed successfully` });
      fetchOrders();
    } else {
      toast({ description: `Error ${action}ing escrow`, variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Manage Escrow</h1>
      <ul className="space-y-4">
        {orders.map((order: any) => (
          <li key={order._id} className="flex justify-between items-center">
            <span>Order #{order._id} - ${order.itemsPrice}</span>
            <div>
              <Button onClick={() => handleAction(order._id, 'release')} className="mr-2">
                Release
              </Button>
              <Button onClick={() => handleAction(order._id, 'refund')} variant="destructive">
                Refund
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}