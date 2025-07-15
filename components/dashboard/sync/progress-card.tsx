import React from 'react';
import { SyncProgress } from '@/lib/api/types/sync-progress';
import { motion } from 'framer-motion';

interface ProgressCardProps {
  sync: SyncProgress;
  onSelect: () => void;
  onCancel: () => void;
}

export function ProgressCard({ sync, onSelect, onCancel }: ProgressCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'running': return 'bg-blue-500';
      case 'queued': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-md p-4"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-lg">{sync.provider}</h3>
          <p className="text-sm text-gray-500">ID: {sync.syncId}</p>
        </div>
        <span className={`px-2 py-1 rounded text-white text-sm ${getStatusColor(sync.status)}`}>
          {sync.status}
        </span>
      </div>

      <div className="space-y-2">
        <div className="relative pt-1">
          <div className="flex mb-2 items-center justify-between">
            <div>
              <span className="text-xs font-semibold inline-block text-blue-600">
                Progress
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold inline-block text-blue-600">
                {sync.progress.percentage}%
              </span>
            </div>
          </div>
          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${sync.progress.percentage}%` }}
              transition={{ duration: 0.5 }}
              className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${getStatusColor(sync.status)}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <p className="font-semibold">{sync.progress.processed}</p>
            <p className="text-gray-500">Processed</p>
          </div>
          <div>
            <p className="font-semibold text-green-500">{sync.progress.succeeded}</p>
            <p className="text-gray-500">Succeeded</p>
          </div>
          <div>
            <p className="font-semibold text-red-500">{sync.progress.failed}</p>
            <p className="text-gray-500">Failed</p>
          </div>
        </div>

        <div className="flex justify-between items-center mt-4">
          <button
            onClick={onSelect}
            className="text-blue-500 hover:text-blue-700 text-sm"
          >
            View Details
          </button>
          {(sync.status === 'running' || sync.status === 'queued') && (
            <button
              onClick={onCancel}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}