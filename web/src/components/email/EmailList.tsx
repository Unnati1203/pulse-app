import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock3, ExternalLink, Inbox, LoaderCircle, Search, Send } from 'lucide-react';
import { get } from '../../lib/api';
import { Email, EmailStatus } from '../../lib/types';
import { StatusBadge } from '../ui/Badge';

interface EmailListProps {
  type: 'SCHEDULED' | 'SENT';
  onOpenDetail: (email: Email) => void;
}

export function EmailList({ type, onOpenDetail }: EmailListProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const statusFilter = type === 'SCHEDULED' ? 'SCHEDULED' : 'SENT';

  const { data, isLoading } = useQuery({
    queryKey: ['emails', type, page, search],
    queryFn: () =>
      get<{ items: Email[]; total: number; pages: number }>(
        `emails?view=${type}&status=${statusFilter}&page=${page}&limit=15&q=${encodeURIComponent(search)}`
      ),
  });

  const emails = data?.items || [];
  const totalPages = data?.pages || 1;

  return (
    <div className="space-y-4">
      <div className="card-header border-none p-0 flex-between">
        <div>
          <h2>{type === 'SCHEDULED' ? 'Scheduled Outbound Queue' : 'Sent Email History'}</h2>
          <p className="subtext">
            {type === 'SCHEDULED'
              ? 'Emails currently waiting for execution in BullMQ delayed queue'
              : 'Emails successfully delivered via fake Ethereal SMTP server'}
          </p>
        </div>
        <div className="relative search-input-wrap">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Filter by recipient or subject..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input search-input"
          />
        </div>
      </div>

      <div className="card table-card">
        {isLoading ? (
          <div className="state-box">
            <LoaderCircle size={28} className="spin text-brand" />
            <p>Loading {type.toLowerCase()} emails...</p>
          </div>
        ) : emails.length === 0 ? (
          <div className="state-box">
            <Inbox size={40} className="text-muted" />
            <h3>No {type.toLowerCase()} emails found</h3>
            <p className="subtext">
              {type === 'SCHEDULED'
                ? 'Click "Compose" in the sidebar to schedule your first email sequence.'
                : 'Emails will appear here once delivered by the BullMQ worker.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Subject</th>
                  <th>{type === 'SCHEDULED' ? 'Scheduled Time' : 'Sent Time'}</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((item) => (
                  <tr key={item.id} onClick={() => onOpenDetail(item)} className="clickable-row">
                    <td className="font-medium">{item.recipient}</td>
                    <td className="max-w-xs truncate">{item.subject}</td>
                    <td className="text-muted text-sm">
                      {new Date(type === 'SCHEDULED' ? item.scheduledAt : item.sentAt || item.updatedAt).toLocaleString()}
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      {item.previewUrl ? (
                        <a
                          href={item.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="preview-link"
                        >
                          Ethereal Preview <ExternalLink size={13} />
                        </a>
                      ) : (
                        <span className="text-muted text-xs">View detail</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn secondary sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span className="text-sm text-muted">
              Page {page} of {totalPages}
            </span>
            <button className="btn secondary sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
