import { useState } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { LoaderCircle, Upload, X } from 'lucide-react';
import { api } from '../../lib/api';
import { User } from '../../lib/types';

interface ComposeModalProps {
  user?: User;
  close: () => void;
  onDone: () => void;
}

export function ComposeModal({ user, close, onDone }: ComposeModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientsRaw, setRecipientsRaw] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(Date.now() + 120000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [loading, setLoading] = useState(false);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const found: string[] = [];
        results.data.forEach((row) => {
          Object.values(row).forEach((val) => {
            if (typeof val === 'string' && val.includes('@')) {
              const matches = val.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
              if (matches) found.push(...matches);
            }
          });
        });
        const clean = [...new Set(found.map((x) => x.trim().toLowerCase()))];
        if (clean.length) {
          setRecipients(clean);
          setRecipientsRaw(clean.join(', '));
          toast.success(`Loaded ${clean.length} recipient email(s) from CSV`);
        } else {
          toast.error('No valid email addresses found in file');
        }
      },
    });
  };

  const parseManualRecipients = (txt: string) => {
    setRecipientsRaw(txt);
    const matches = txt.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    setRecipients([...new Set(matches.map((x) => x.trim().toLowerCase()))]);
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return toast.error('Please enter a subject');
    if (!body.trim()) return toast.error('Please enter an email body');
    if (!recipients.length) return toast.error('Please add at least one recipient email');

    setLoading(true);
    try {
      const payload = {
        subject: subject.trim(),
        body: body.trim(),
        sender: user?.email || 'outbound@reachinbox.ai',
        recipients,
        startTime: new Date(startTime).toISOString(),
        delayMs: Number(delayMs),
        hourlyLimit: Number(hourlyLimit),
      };
      const { data } = await api.post('/emails/schedule', payload);
      toast.success(`Successfully scheduled ${data.data.scheduled} email(s)`);
      onDone();
      close();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to schedule emails');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card compose-card">
        <div className="modal-header">
          <div>
            <h2>Compose Outbound Sequence</h2>
            <p className="subtext">Schedule bulk personalized emails via BullMQ queue</p>
          </div>
          <button className="icon-btn" onClick={close}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSchedule} className="compose-form">
          <div className="form-group">
            <label>Sender Email</label>
            <input type="email" value={user?.email || ''} disabled className="input disabled" />
          </div>

          <div className="form-group">
            <label className="label-with-action">
              Recipients ({recipients.length} detected)
              <label className="upload-label">
                <Upload size={14} /> Upload CSV
                <input type="file" accept=".csv,.txt" onChange={handleCsvUpload} hidden />
              </label>
            </label>
            <textarea
              rows={3}
              placeholder="Enter comma-separated emails or paste list..."
              value={recipientsRaw}
              onChange={(e) => parseManualRecipients(e.target.value)}
              className="textarea"
            />
          </div>

          <div className="form-group">
            <label>Subject</label>
            <input
              type="text"
              placeholder="e.g. Quick question regarding your sales pipeline"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input"
            />
          </div>

          <div className="form-group">
            <label>Body</label>
            <textarea
              rows={5}
              placeholder="Write your email content..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="textarea"
            />
          </div>

          <div className="grid grid-3 gap-3">
            <div className="form-group">
              <label>Start Time</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input"
              />
            </div>
            <div className="form-group">
              <label>Delay (ms)</label>
              <input
                type="number"
                min={0}
                max={60000}
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value))}
                className="input"
              />
            </div>
            <div className="form-group">
              <label>Hourly Limit</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="input"
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading && <LoaderCircle size={16} className="spin" />}
              Schedule Sequence
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
