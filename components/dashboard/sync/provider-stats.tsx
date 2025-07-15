import React from 'react';
import { SyncProgress } from '@/lib/api/types/sync-progress';
import { Bar } from 'react-chartjs-2';

interface ProviderStatsProps {
  syncs: SyncProgress[];
}

export function ProviderStats({ syncs }: ProviderStatsProps) {
  const providerStats = React.useMemo(() => {
    const stats = new Map<string, {
      total: number;
      succeeded: number;
      failed: number;
      avgDuration: number;
    }>();

    syncs.forEach(sync => {
      const current = stats.get(sync.provider) || {
        total: 0,
        succeeded: 0,
        failed: 0,
        avgDuration: 0,
      };

      current.total++;
      if (sync.status === 'completed') {
        current.succeeded++;
      } else if (sync.status === 'failed') {
        current.failed++;
      }

      if (sync.timestamps.completed) {
        const duration = new Date(sync.timestamps.completed).getTime() -
          new Date(sync.timestamps.started).getTime();
        current.avgDuration = (current.avgDuration * (current.total - 1) + duration) / current.total;
      }

      stats.set(sync.provider, current);
    });

    return stats;
  }, [syncs]);

  const chartData = {
    labels: Array.from(providerStats.keys()),
    datasets: [
      {
        label: 'Succeeded',
        data: Array.from(providerStats.values()).map(s => s.succeeded),
        backgroundColor: 'rgba(34, 197, 94, 0.5)',
      },
      {
        label: 'Failed',
        data: Array.from(providerStats.values()).map(s => s.failed),
        backgroundColor: 'rgba(239, 68, 68, 0.5)',
      },
    ],
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold mb-4">Provider Statistics</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Bar data={chartData} options={{ responsive: true }} />
        </div>
        <div className="space-y-4">
          {Array.from(providerStats.entries()).map(([provider, stats]) => (
            <div key={provider} className="border-b pb-2">
              <h4 className="font-semibold">{provider}</h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-gray-500">Success Rate</p>
                  <p className="font-semibold">
                    {((stats.succeeded / stats.total) * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Avg Duration</p>
                  <p className="font-semibold">
                    {(stats.avgDuration / 1000).toFixed(1)}s
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Total Syncs</p>
                  <p className="font-semibold">{stats.total}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}