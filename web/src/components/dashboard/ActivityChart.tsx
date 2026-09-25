import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ActivityDay } from '../../lib/types';

export function ActivityChart({ activity }: { activity?: ActivityDay[] }) {
  const data = activity || [];

  return (
    <div className="card chart-card">
      <div className="card-header">
        <div>
          <h2>Outbound Delivery Volume</h2>
          <p className="subtext">7-day aggregate email sending & scheduling activity</p>
        </div>
      </div>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorScheduled" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} />
            <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                borderColor: '#334155',
                borderRadius: '8px',
                color: '#f8fafc',
              }}
            />
            <Area type="monotone" dataKey="sent" stroke="#10b981" fillOpacity={1} fill="url(#colorSent)" name="Sent" />
            <Area type="monotone" dataKey="scheduled" stroke="#6366f1" fillOpacity={1} fill="url(#colorScheduled)" name="Scheduled" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
