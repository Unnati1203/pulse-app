import { Email } from '../lib/types';
import { EmailList } from '../components/email/EmailList';

export function ScheduledPage({ onOpenDetail }: { onOpenDetail: (email: Email) => void }) {
  return <EmailList type="SCHEDULED" onOpenDetail={onOpenDetail} />;
}
