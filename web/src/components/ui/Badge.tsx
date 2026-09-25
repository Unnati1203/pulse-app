import { EmailStatus } from '../../lib/types';

export function StatusBadge({ status }: { status: EmailStatus }) {
  const styles: Record<EmailStatus, string> = {
    SCHEDULED: 'badge-scheduled',
    PROCESSING: 'badge-processing',
    SENT: 'badge-sent',
    FAILED: 'badge-failed',
  };

  const labels: Record<EmailStatus, string> = {
    SCHEDULED: 'Scheduled',
    PROCESSING: 'Sending...',
    SENT: 'Sent',
    FAILED: 'Failed',
  };

  return <span className={`badge ${styles[status]}`}>{labels[status]}</span>;
}
