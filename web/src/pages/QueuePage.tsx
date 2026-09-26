import { useQuery } from '@tanstack/react-query';
import { ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { get } from '../lib/api';
import { QueueStats } from '../lib/types';

export function QueuePage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: () => get<QueueStats>('queue'),
    refetchInterval: 3000,
  });

  const counts = data?.counts || { waiting: 0, delayed: 0, active: 0, completed: 0, failed: 0 };
  const adminBoardUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:4000/admin/queues`
    : 'http://localhost:4000/admin/queues';

  return (
    <div className="space-y-6 queue-page">
      <div className="flex-between">
        <div>
          <h1>BullMQ Queue & Worker Monitor</h1>
          <p className="subtext">Persistent delayed job queue powered by Redis & BullMQ</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn secondary sm">
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} /> Refresh
          </button>
          <a href={adminBoardUrl} target="_blank" rel="noreferrer" className="btn primary sm flex items-center gap-1">
            Open Live Bull Board <ExternalLink size={14} />
          </a>
        </div>
      </div>

      <div className="grid grid-4 gap-4">
        <div className="card p-4">
          <span className="text-xs font-bold text-amber-400 block">DELAYED / WAITING</span>
          <div className="text-3xl font-extrabold mt-2">{counts.delayed + counts.waiting}</div>
          <span className="text-xs text-muted mt-1 block">Scheduled for future send</span>
        </div>

        <div className="card p-4">
          <span className="text-xs font-bold text-blue-400 block">ACTIVE JOBS</span>
          <div className="text-3xl font-extrabold mt-2">{counts.active}</div>
          <span className="text-xs text-muted mt-1 block">Currently executing in worker</span>
        </div>

        <div className="card p-4">
          <span className="text-xs font-bold text-emerald-400 block">COMPLETED</span>
          <div className="text-3xl font-extrabold mt-2">{counts.completed}</div>
          <span className="text-xs text-muted mt-1 block">Successfully processed jobs</span>
        </div>

        <div className="card p-4">
          <span className="text-xs font-bold text-red-400 block">FAILED JOBS</span>
          <div className="text-3xl font-extrabold mt-2">{counts.failed}</div>
          <span className="text-xs text-muted mt-1 block">Retried up to max attempts</span>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <ShieldCheck className="text-emerald-400" size={20} /> Worker System Status
        </h3>

        <div className="grid grid-2 gap-4 text-sm">
          <div>
            <span className="text-muted block text-xs">WORKER STATE</span>
            <b className={data?.worker === 'ONLINE' ? 'text-emerald-400' : 'text-amber-400'}>
              {data?.worker || 'CHECKING'}
            </b>
          </div>
          <div>
            <span className="text-muted block text-xs">REDIS STATUS</span>
            <b className="text-slate-200">{data?.redis || 'UNKNOWN'}</b>
          </div>
          <div>
            <span className="text-muted block text-xs">CONCURRENCY LEVEL</span>
            <b className="text-slate-200">{data?.concurrency || 5} concurrent jobs</b>
          </div>
          <div>
            <span className="text-muted block text-xs">PERSISTENCE MODE</span>
            <b className="text-slate-200">BullMQ Redis Delayed Jobs + DB Startup Recovery</b>
          </div>
        </div>
      </div>
    </div>
  );
}
