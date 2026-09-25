import { Activity, Clock3, Send, ShieldCheck, Zap } from 'lucide-react';
import { DashboardStats } from '../../lib/types';

export function StatCards({ stats }: { stats?: DashboardStats }) {
  return (
    <div className="grid metrics-grid">
      <div className="card metric-card">
        <div className="metric-head">
          <span className="metric-title">SCHEDULED QUEUE</span>
          <Clock3 size={17} className="metric-icon gold" />
        </div>
        <div className="metric-val">{stats?.scheduled ?? 0}</div>
        <p className="metric-sub">Emails waiting in delayed BullMQ state</p>
      </div>

      <div className="card metric-card">
        <div className="metric-head">
          <span className="metric-title">DELIVERED TODAY</span>
          <Send size={17} className="metric-icon green" />
        </div>
        <div className="metric-val">{stats?.sentToday ?? 0}</div>
        <p className="metric-sub">Sent successfully through Ethereal SMTP</p>
      </div>

      <div className="card metric-card">
        <div className="metric-head">
          <span className="metric-title">HOURLY RATE LIMIT</span>
          <Zap size={17} className="metric-icon purple" />
        </div>
        <div className="metric-val">
          {stats?.usage ?? 0}
          <small>/ {stats?.limit ?? 100}</small>
        </div>
        <div className="rate-bar">
          <span
            style={{
              width: `${Math.min(100, (((stats?.usage ?? 0) / (stats?.limit || 100)) * 100))}%`,
            }}
          />
        </div>
        <p className="metric-sub">Sender: {stats?.sender || 'Active'}</p>
      </div>

      <div className="card metric-card">
        <div className="metric-head">
          <span className="metric-title">WORKER CONCURRENCY</span>
          <Activity size={17} className="metric-icon blue" />
        </div>
        <div className="metric-val">{stats?.concurrency ?? 5}</div>
        <p className="metric-sub">
          <ShieldCheck size={14} className="inline-icon" /> Parallel execution threads
        </p>
      </div>
    </div>
  );
}
