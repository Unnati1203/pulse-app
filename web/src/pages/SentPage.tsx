import { Email } from '../lib/types';
import { EmailList } from '../components/email/EmailList';

export function SentPage({ onOpenDetail }: { onOpenDetail: (email: Email) => void }) {
  return <EmailList type="SENT" onOpenDetail={onOpenDetail} />;
}
