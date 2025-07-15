import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { SyncProgress, SyncStatus } from '@/lib/api/types/sync-progress';
import { ProgressCard } from './progress-card';
import { ErrorsList } from './errors-list';
import { ProviderStats } from './provider-stats';
import { usePusher } from '@/hooks/use-pusher';
import { toast } from 'react-hot-toast';

interface SyncProgressBoardProps {
  initialSyncs?: SyncProgress[];
}

export function SyncProgressBoard({ initialSyncs = [] }: SyncProgressBoardProps) {
  const router = useRouter();
  const [syncs, setSyncs] = useState<SyncProgress[]>(initialSyncs);
  const [selectedSync, setSelectedSync] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Subscribe to real-time updates
  usePusher((pusher) => {
    syncs.forEach(sync => {
      const channel = pusher.subscribe(`sync-${sync.syncId}`);
      
      channel.bind('progress-update', (data: SyncProgress) => {
        setSyncs(current => 
          current.map(s => 
            s.syncId === data.syncId ? data : s
          )
        );

        // Show toast for completed or failed syncs
        if (data.status === 'completed') {
          toast.success(`Sync ${data.syncId} completed successfully`);
        } else if (data.status === 'failed') {
          toast.error(`Sync ${data.syncId} failed`);
        }
      });

      return () => {
        channel.unbind_all();
        pusher.unsubscribe(`sync-${sync.syncId}`);
      };
    });
  });

  // Load active syncs
  const loadActiveSyncs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/inventory/sync/progress');
      const data = await response.json();
      if (data.success) {
        setSyncs(data.data.syncs);
      }
    } catch (error) {
      toast.error('Failed to load sync progress');
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel sync
  const handleCancelSync = async (syncId: string) => {
    try {
      const response = await fetch(
        `/api/v1/inventory/sync/progress?syncId=${syncId}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (data.success) {
        toast.success('Sync cancelled successfully');
        loadActiveSyncs();
      }
    } catch (error) {
      toast.error('Failed to cancel sync');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Inventory Sync Progress</h2>
        <button
          onClick={loadActiveSyncs}
          disabled={isLoading}
          className="btn btn-primary"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <h3>Active Syncs</h3>
          <p className="text-2xl">
            {syncs.filter(s => 
              s.status === 'running' || s.status === 'queued'
            ).length}
          </p>
        </div>
        <div className="stat-card">
          <h3>Completed Today</h3>
          <p className="text-2xl">
            {syncs.filter(s => 
              s.status === 'completed' && 
              new Date(s.timestamps.completed!).toDateString() === new Date().toDateString()
            ).length}
          </p>
        </div>
        <div className="stat-card">
          <h3>Failed Today</h3>
          <p className="text-2xl text-red-500">
            {syncs.filter(s => 
              s.status === 'failed' &&
              new Date(s.timestamps.completed!).toDateString() === new Date().toDateString()
            ).length}
          </p>
        </div>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {syncs.map(sync => (
          <ProgressCard
            key={sync.syncId}
            sync={sync}
            onSelect={() => setSelectedSync(sync.syncId)}
            onCancel={() => handleCancelSync(sync.syncId)}
          />
        ))}
      </div>

      {/* Provider Stats */}
      <ProviderStats syncs={syncs} />

      {/* Errors List */}
      {selectedSync && (
        <ErrorsList
          sync={syncs.find(s => s.syncId === selectedSync)!}
          onClose={() => setSelectedSync(null)}
        />
      )}
    </div>
  );
}