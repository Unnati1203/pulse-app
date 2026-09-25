import { googleAuthUrl } from '../lib/api';

export function AuthPage({ loading = false, error }: { loading?: boolean; error?: unknown }) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-logo">Pulse</div>
        <p className="auth-kicker">PRODUCTION EMAIL SCHEDULER</p>
        <h1>{loading ? 'Loading your workspace...' : 'Welcome to Pulse'}</h1>
        <p>
          {loading
            ? 'Checking your secure Google OAuth session...'
            : 'Schedule, throttle, and send outbound emails with BullMQ, Redis, and Ethereal fake SMTP.'}
        </p>
        {!loading && Boolean(error) && (
          <p className="auth-error">The API backend could not be reached. Ensure server is running on port 4000.</p>
        )}
        {!loading && (
          <button className="primary-button auth-button" onClick={() => (window.location.href = googleAuthUrl())}>
            Sign in with Google
          </button>
        )}
      </section>
    </main>
  );
}
