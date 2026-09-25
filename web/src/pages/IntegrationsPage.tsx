import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Slack, Trash2 } from 'lucide-react';
import { api, get } from '../lib/api';
import { SlackStatus } from '../lib/types';

export function IntegrationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['slack-status'],
    queryFn: () => get<SlackStatus>('slack/status'),
  });

  const handleDisconnect = async () => {
    try {
      await api.delete('/slack/disconnect');
      await qc.invalidateQueries({ queryKey: ['slack-status'] });
      toast.success('Disconnected Slack integration');
    } catch (e) {
      toast.error('Failed to disconnect Slack');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1>Workspace Integrations</h1>
        <p className="subtext">Connect external services to receive real-time notifications when rate limits are triggered</p>
      </div>

      <div className="card max-w-2xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex gap-4">
            <div className="p-3 bg-slate-800 rounded-xl">
              <Slack size={32} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Slack OAuth Alert Connection</h3>
              <p className="text-sm text-slate-400 mt-1">
                Receive instant Slack messages whenever a sender reaches their configured hourly email limit.
              </p>

              {data?.connected && data.connection && (
                <div className="mt-4 p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-lg flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle2 size={16} />
                  Connected to team: <b>{data.connection.teamName}</b>
                </div>
              )}
            </div>
          </div>

          <div>
            {isLoading ? (
              <span className="text-xs text-muted">Checking status...</span>
            ) : data?.connected ? (
              <button onClick={handleDisconnect} className="btn secondary danger sm flex items-center gap-1">
                <Trash2 size={14} /> Disconnect
              </button>
            ) : (
              <button
                onClick={async () => {
                  await api.get('/slack/connect').catch((e) => toast.error(e.response?.data?.message || 'Slack setup failed'));
                }}
                className="btn primary sm flex items-center gap-2"
              >
                <Slack size={15} /> Connect Slack
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
