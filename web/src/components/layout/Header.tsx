import { Command, LogOut, Search, Slack } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { User } from '../../lib/types';
import { api, googleAuthUrl } from '../../lib/api';

interface HeaderProps {
  user: User | null | undefined;
  currentLabel: string;
  onOpenSearch: () => void;
  onToggleMobileMenu: () => void;
}

export function Header({ user, currentLabel, onOpenSearch, onToggleMobileMenu }: HeaderProps) {
  const qc = useQueryClient();

  return (
    <header className="topbar">
      <button className="menu-button" onClick={onToggleMobileMenu}>
        <Command size={17} />
      </button>
      <div className="crumb">
        Workspace <span>/</span> <b>{currentLabel}</b>
      </div>
      <div className="top-actions">
        <button className="search-trigger" onClick={onOpenSearch}>
          <Search size={15} />
          <span>Search emails...</span>
          <kbd>/</kbd>
        </button>
        <span className="top-divider" />
        <div className="online">
          <i />
          System operational
        </div>
        <button
          className="round-btn"
          onClick={async () => {
            await api
              .get('/slack/connect')
              .catch((e) => toast.error(e.response?.data?.message || 'Unable to connect Slack'));
          }}
          title="Connect Slack"
        >
          <Slack size={16} />
        </button>
        {user ? (
          <>
            <img
              className="top-avatar"
              src={user.avatar || undefined}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <button
              className="logout"
              onClick={async () => {
                await api.post('/auth/logout');
                await qc.invalidateQueries({ queryKey: ['me'] });
                toast.success('Signed out');
              }}
            >
              <LogOut size={15} />
            </button>
          </>
        ) : (
          <button className="google" onClick={() => (window.location.href = googleAuthUrl())}>
            Connect Google
          </button>
        )}
      </div>
    </header>
  );
}
