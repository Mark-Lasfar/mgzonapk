'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const AdminWithdrawalsDashboard = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchWithdrawals = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/admin/withdrawals');
        const result = await response.json();
        if (result.success) {
          setWithdrawals(result.data || []); // Ensure data is an array
        } else {
          console.error('Failed to fetch withdrawals:', result.message);
          setWithdrawals([]);
        }
      } catch (error) {
        console.error('Error fetching withdrawals:', error);
        setWithdrawals([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWithdrawals();
  }, []);

  const handleAction = async (id, action) => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: action }),
      });

      const result = await response.json();
      if (result.success) {
        alert(`Withdrawal request ${action} successfully!`);
        setWithdrawals((prev) =>
          prev.filter((withdrawal) => withdrawal._id !== id)
        );
      } else {
        alert(result.message || 'Something went wrong.');
      }
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      alert('Error processing withdrawal request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-4xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Withdrawal Management</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Loading withdrawals...</p>
        ) : withdrawals.length === 0 ? (
          <p>No withdrawal requests found.</p>
        ) : (
          <ul className="space-y-4">
            {withdrawals.map((withdrawal) => (
              <li
                key={withdrawal._id}
                className="border p-4 rounded flex justify-between items-center"
              >
                <div>
                  <p>
                    Seller: {withdrawal.sellerId?.businessName || 'Unknown'} (
                    {withdrawal.sellerId?.email || 'N/A'})
                  </p>
                  <p>Amount: ${withdrawal.amount.toFixed(2)}</p>
                  <p>Status: {withdrawal.status}</p>
                </div>
                <div className="space-x-2">
                  <Button
                    onClick={() => handleAction(withdrawal._id, 'approved')}
                    disabled={loading || withdrawal.status !== 'pending'}
                  >
                    Approve
                  </Button>
                  <Button
                    onClick={() => handleAction(withdrawal._id, 'rejected')}
                    disabled={loading || withdrawal.status !== 'pending'}
                    variant="destructive"
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminWithdrawalsDashboard;