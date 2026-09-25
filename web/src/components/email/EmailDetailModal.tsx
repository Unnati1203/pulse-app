import { ExternalLink, X } from 'lucide-react';
import { Email } from '../../lib/types';
import { StatusBadge } from '../ui/Badge';

export function EmailDetailModal({ email, close }: { email: Email; close: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card detail-card">
        <div className="modal-header">
          <div>
            <h2>Email Details</h2>
            <p className="subtext">ID: {email.id}</p>
          </div>
          <button className="icon-btn" onClick={close}>
            <X size={18} />
          </button>
        </div>

        <div className="detail-body space-y-4">
          <div className="flex-between">
            <div>
              <span className="text-xs text-muted block">STATUS</span>
              <StatusBadge status={email.status} />
            </div>
            {email.previewUrl && (
              <a href={email.previewUrl} target="_blank" rel="noreferrer" className="btn secondary sm">
                View in Ethereal <ExternalLink size={13} />
              </a>
            )}
          </div>

          <div className="grid grid-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-muted block">SENDER</span>
              <b>{email.sender}</b>
            </div>
            <div>
              <span className="text-xs text-muted block">RECIPIENT</span>
              <b>{email.recipient}</b>
            </div>
            <div>
              <span className="text-xs text-muted block">SCHEDULED AT</span>
              <span>{new Date(email.scheduledAt).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-xs text-muted block">SENT AT</span>
              <span>{email.sentAt ? new Date(email.sentAt).toLocaleString() : 'N/A'}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-muted block mb-1">SUBJECT</span>
            <div className="subject-box">{email.subject}</div>
          </div>

          <div>
            <span className="text-xs text-muted block mb-1">BODY</span>
            <pre className="body-box">{email.body}</pre>
          </div>

          {email.error && (
            <div className="error-box">
              <span className="text-xs font-bold text-red block mb-1">FAILURE ERROR LOG</span>
              <code>{email.error}</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
