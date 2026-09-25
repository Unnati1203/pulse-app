import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoaderCircle, Search, X } from 'lucide-react';
import { get } from '../../lib/api';
import { Email } from '../../lib/types';
import { StatusBadge } from '../ui/Badge';

interface SearchModalProps {
  close: () => void;
  openDetail: (email: Email) => void;
}

export function SearchModal({ close, openDetail }: SearchModalProps) {
  const [query, setQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: () => get<{ items: Email[]; source: string }>(`emails/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length > 0,
  });

  const results = data?.items || [];
  const source = data?.source || 'elasticsearch';

  return (
    <div className="modal-backdrop">
      <div className="modal-card search-card">
        <div className="search-bar-wrap">
          <Search size={18} className="text-muted" />
          <input
            type="text"
            autoFocus
            placeholder="Search email body, subject, sender, or recipient (Elasticsearch indexed)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input-modal"
          />
          <button className="icon-btn" onClick={close}>
            <X size={18} />
          </button>
        </div>

        {query.trim().length > 0 && (
          <div className="search-meta">
            <span>Powered by: <b>{source}</b></span>
            <span>{results.length} result(s)</span>
          </div>
        )}

        <div className="search-results">
          {isLoading ? (
            <div className="state-box py-8">
              <LoaderCircle size={24} className="spin text-brand" />
              <p>Searching index...</p>
            </div>
          ) : query.trim().length === 0 ? (
            <div className="state-box py-8 text-muted">
              <p>Type keywords to search across recipient, subject, and content.</p>
            </div>
          ) : results.length === 0 ? (
            <div className="state-box py-8 text-muted">
              <p>No matching emails found for "{query}"</p>
            </div>
          ) : (
            results.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  openDetail(item);
                  close();
                }}
                className="search-item"
              >
                <div className="flex-between">
                  <span className="font-bold text-sm">{item.subject}</span>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-xs text-muted mt-1">{item.recipient}</p>
                <p className="text-xs text-secondary truncate mt-1">{item.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
