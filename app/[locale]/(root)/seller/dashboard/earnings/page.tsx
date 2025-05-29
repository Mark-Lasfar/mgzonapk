'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const SellerEarningsDashboard = () => {
  const [balance, setBalance] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch balance, earnings, and transactions from the API
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/seller/earnings');
        const data = await response.json();
        if (response.ok) {
          setBalance(data.balance);
          setEarnings(data.totalEarnings);
          setTransactions(data.transactions);
        } else {
          console.error('Failed to fetch data:', data.message);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchDashboardData();
  }, []);

  const handleWithdrawRequest = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert('Please enter a valid withdrawal amount.');
      return;
    }

    if (parseFloat(withdrawAmount) > balance) {
      alert('Withdrawal amount exceeds available balance.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/withdrawals/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(withdrawAmount) }),
      });

      const result = await response.json();
      if (result.success) {
        alert('Withdrawal request submitted successfully!');
        setWithdrawAmount('');
        setBalance((prev) => prev - parseFloat(withdrawAmount));
      } else {
        alert(result.message || 'Something went wrong.');
      }
    } catch (error) {
      alert('Error submitting withdrawal request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-4xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Seller Earnings Dashboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p>Total Earnings: <strong>${earnings.toFixed(2)}</strong></p>
            <p>Available Balance: <strong>${balance.toFixed(2)}</strong></p>
          </div>

          <div>
            <h3>Request Withdrawal</h3>
            <Input
              type="number"
              placeholder="Enter withdrawal amount"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="mb-4"
            />
            <Button
              onClick={handleWithdrawRequest}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Submitting...' : 'Request Withdrawal'}
            </Button>
          </div>

          <div>
            <h3>Transaction History</h3>
            <ul className="space-y-2">
              {transactions.length > 0 ? (
                transactions.map((txn, index) => (
                  <li key={index} className="border p-2 rounded">
                    <p>{txn.description}</p>
                    <p>Amount: ${txn.amount.toFixed(2)}</p>
                    <p>Date: {new Date(txn.date).toLocaleDateString()}</p>
                  </li>
                ))
              ) : (
                <p>No transactions available.</p>
              )}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SellerEarningsDashboard;