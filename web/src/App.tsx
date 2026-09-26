import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { get } from './lib/api';
import { Email, User } from './lib/types';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { ComposeModal } from './components/email/ComposeModal';
import { EmailDetailModal } from './components/email/EmailDetailModal';
import { SearchModal } from './components/email/SearchModal';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { ScheduledPage } from './pages/ScheduledPage';
import { SentPage } from './pages/SentPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { QueuePage } from './pages/QueuePage';
import { SettingsPage } from './pages/SettingsPage';

const navLabels: Record<string, string> = {
  '/': 'Overview',
  '/scheduled': 'Scheduled',
  '/sent': 'Sent',
  '/integrations': 'Integrations',
  '/queue': 'Queue Monitor',
  '/settings': 'Settings',
};

export default function App() {
  const loc = useLocation();
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [detailEmail, setDetailEmail] = useState<Email | null>(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);

  const userQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => get<{ user: User | null }>('auth/me'),
  });

  const user = userQuery.data?.user;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setComposeOpen(false);
        setDetailEmail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    setMobileSidebar(false);
  }, [loc]);

  if (userQuery.isLoading) return <AuthPage loading />;
  if (!user) return <AuthPage error={userQuery.error} />;

  const currentLabel = navLabels[loc.pathname] || 'Overview';

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        mobile={mobileSidebar}
        onCloseMobile={() => setMobileSidebar(false)}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenCompose={() => setComposeOpen(true)}
      />

      <main className="main">
        <Header
          user={user}
          currentLabel={currentLabel}
          onOpenSearch={() => setSearchOpen(true)}
          onToggleMobileMenu={() => setMobileSidebar(true)}
        />

        <div className="page">
          <Routes>
            <Route path="/" element={<DashboardPage user={user} onOpenCompose={() => setComposeOpen(true)} />} />
            <Route path="/scheduled" element={<ScheduledPage onOpenDetail={setDetailEmail} />} />
            <Route path="/sent" element={<SentPage onOpenDetail={setDetailEmail} />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/queue" element={<QueuePage />} />
            <Route path="/settings" element={<SettingsPage user={user} />} />
            <Route path="*" element={<DashboardPage user={user} onOpenCompose={() => setComposeOpen(true)} />} />
          </Routes>
        </div>

        <footer className="footer">
          Pulse <span>·</span> Email workspace
        </footer>
      </main>

      {composeOpen && (
        <ComposeModal user={user} close={() => setComposeOpen(false)} onDone={() => userQuery.refetch()} />
      )}
      {searchOpen && <SearchModal close={() => setSearchOpen(false)} openDetail={setDetailEmail} />}
      {detailEmail && <EmailDetailModal email={detailEmail} close={() => setDetailEmail(null)} />}

      <Toaster theme="dark" position="bottom-right" toastOptions={{ className: 'toast' }} />
    </div>
  );
}
