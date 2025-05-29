'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const EarningsReports = () => {
  const [report, setReport] = useState({
    totalEarnings: 0,
    totalCommissions: 0,
  });

  useEffect(() => {
    const fetchReports = async () => {
      const response = await fetch('/api/admin/reports/earnings');
      const data = await response.json();
      setReport(data);
    };

    fetchReports();
  }, []);

  return (
    <Card className="max-w-4xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Earnings and Commissions Report</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Total Earnings: ${report.totalEarnings.toFixed(2)}</p>
        <p>Total Commissions: ${report.totalCommissions.toFixed(2)}</p>
      </CardContent>
    </Card>
  );
};

export default EarningsReports;