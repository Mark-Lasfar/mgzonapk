'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const AdminReports = () => {
  const [reports, setReports] = useState({
    totalEarnings: 0,
    totalCommissions: 0,
    totalWithdrawals: 0,
    pendingWithdrawals: 0,
  });

  useEffect(() => {
    // Fetch report data from the API
    const fetchReports = async () => {
      const response = await fetch('/api/admin/reports');
      const data = await response.json();
      setReports(data);
    };

    fetchReports();
  }, []);

  return (
    <Card className="max-w-4xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Platform Reports</CardTitle>
      </CardHeader>
      <CardContent>
        <ul>
          <li>Total Earnings: ${reports.totalEarnings.toFixed(2)}</li>
          <li>Total Commissions: ${reports.totalCommissions.toFixed(2)}</li>
          <li>Completed Withdrawals: ${reports.totalWithdrawals.toFixed(2)}</li>
          <li>Pending Withdrawals: ${reports.pendingWithdrawals.toFixed(2)}</li>
        </ul>
      </CardContent>
    </Card>
  );
};

export default AdminReports;