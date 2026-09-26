import { Activity, ArrowUpRight, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';
import { User } from '../lib/types';

export function SettingsPage({ user }: { user: User }) {
  return (
    <div className="space-y-6">
      <div className="list-title">
        <div>
          <h1>Settings</h1>
          <p>Account details and workspace configuration</p>
        </div>
      </div>

      <div className="settings-grid">
        <section className="card settings-panel">
          <h2>Signed-in account</h2>
          <p>Your Pulse workspace is connected to this account.</p>
          <div className="settings-account">
            {user.avatar ? (
              <img src={user.avatar} alt="" />
            ) : (
              <span className="settings-avatar">{user.name?.[0] || 'P'}</span>
            )}
            <div>
              <b>{user.name}</b>
              <small>{user.email}</small>
            </div>
          </div>
        </section>

        <section className="card settings-panel">
          <h2>Workspace configuration</h2>
          <p>Manage the connected services and inspect delivery operations.</p>
          <Link className="settings-link" to="/integrations">
            <span>
              <Workflow size={17} />
              <span>
                <b>Integrations</b>
                <small>Manage Slack notifications</small>
              </span>
            </span>
            <ArrowUpRight size={16} />
          </Link>
          <Link className="settings-link" to="/queue">
            <span>
              <Activity size={17} />
              <span>
                <b>Queue and worker</b>
                <small>View Redis status and worker concurrency</small>
              </span>
            </span>
            <ArrowUpRight size={16} />
          </Link>
        </section>
      </div>
    </div>
  );
}