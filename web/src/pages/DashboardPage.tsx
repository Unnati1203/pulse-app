import { useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { get } from '../lib/api';
import { DashboardStats, User } from '../lib/types';
import { StatCards } from '../components/dashboard/StatCards';
import { ActivityChart } from '../components/dashboard/ActivityChart';

interface DashboardPageProps {
  user?: User;
  onOpenCompose: () => void;
}

export function DashboardPage({ user: _user, onOpenCompose }: DashboardPageProps) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => get<DashboardStats>('dashboard'),
    refetchInterval: 5000,
  });

  return (
    <div className="space-y-6">
      <div className="flex-between">
        <div>
          <h1>Outbound Delivery Dashboard</h1>
          <p className="subtext">Real-time status of persistent BullMQ queue, rate limits, and SMTP delivery</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn secondary sm">
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} /> Refresh
          </button>
          <button onClick={onOpenCompose} className="btn primary sm">
            <Plus size={14} /> Schedule Emails
          </button>
        </div>
      </div>

      <StatCards stats={data} />

      <ActivityChart activity={data?.activity} />
    </div>
  );
}
