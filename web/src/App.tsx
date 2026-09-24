import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, Routes, Route, useLocation } from "react-router-dom";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  Clock3,
  Command,
  Inbox,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Slack,
  Timer,
  Upload,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Papa from "papaparse";
import { toast, Toaster } from "sonner";
import { api, get, googleAuthUrl } from "./lib/api";
type User = { id: string; name: string; email: string; avatar?: string };
const nav = [
  ["Overview", "/", LayoutDashboard],
  ["Scheduled", "/scheduled", Clock3],
  ["Sent", "/sent", Send],
  ["Integrations", "/integrations", Workflow],
  ["Queue Monitor", "/queue", Activity],
] as const;
function App() {
  const qc = useQueryClient(),
    loc = useLocation();
  const [compose, setCompose] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [query, setQuery] = useState(""),
    [detail, setDetail] = useState<any>(null),
    [mobile, setMobile] = useState(false);
  const userQ = useQuery({
    queryKey: ["me"],
    queryFn: () => get<{ user: User | null }>("auth/me"),
  });
  const user = userQ.data?.user;
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setCompose(false);
        setDetail(null);
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);
  useEffect(() => {
    setMobile(false);
  }, [loc]);
  if (userQ.isLoading) return <AuthScreen loading />;
  if (!user) return <AuthScreen error={userQ.error} />;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "show" : ""}`}>
        <div className="brand">
          <span className="logo">
            <Activity size={19} />
          </span>
          <span>
            pulse<small>INTELLIGENT EMAIL</small>
          </span>
          <button className="mobile-close" onClick={() => setMobile(false)}>
            <X size={18} />
          </button>
        </div>
        <button className="workspace">
          <span className="workspace-icon">P</span>
          <span>
            <b>Personal workspace</b>
            <small>Free plan</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="side-label">WORKSPACE</div>
        <nav>
          {nav.map(([label, path, Icon]) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={17} />
              {label}
              {label === "Scheduled" && (
                <span className="nav-count">{user ? undefined : ""}</span>
              )}
            </NavLink>
          ))}
          <button onClick={() => setSearchOpen(true)} className="nav-link">
            <Search size={17} />
            Search<span className="key-hint">/</span>
          </button>
          <button
            onClick={() => setCompose(true)}
            className="nav-link compose-link"
          >
            <Plus size={17} />
            Compose
          </button>
        </nav>
        <div className="side-bottom">
          <button className="nav-link">
            <Settings size={17} />
            Settings
          </button>
          <div className="profile">
            {user?.avatar ? (
              <img src={user.avatar} />
            ) : (
              <span className="avatar">{user?.name?.[0] || "P"}</span>
            )}
            <span className="profile-copy">
              <b>{user?.name || "Welcome to Pulse"}</b>
              <small>{user?.email || "Connect Google to get started"}</small>
            </span>
            <MoreHorizontal size={18} />
          </div>
          <div className="side-foot">
            BUILT FOR BETTER OUTBOUND <span>v1.0</span>
          </div>
        </div>
      </aside>
      {mobile && <div className="scrim" onClick={() => setMobile(false)} />}
      <main className="main">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobile(true)}>
            <Command size={17} />
          </button>
          <div className="crumb">
            Workspace <span>/</span>{" "}
            <b>{nav.find((n) => n[1] === loc.pathname)?.[0] || "Overview"}</b>
          </div>
          <div className="top-actions">
            <button
              className="search-trigger"
              onClick={() => setSearchOpen(true)}
            >
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
                  .get("/slack/connect")
                  .catch((e) =>
                    toast.error(
                      e.response?.data?.message || "Unable to connect Slack",
                    ),
                  );
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
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <button
                  className="logout"
                  onClick={async () => {
                    await api.post("/auth/logout");
                    await qc.invalidateQueries({ queryKey: ["me"] });
                    toast.success("Signed out");
                  }}
                >
                  <LogOut size={15} />
                </button>
              </>
            ) : (
              <button
                className="google"
                onClick={() => (location.href = googleAuthUrl())}
              >
                Connect Google
              </button>
            )}
          </div>
        </header>
        <div className="page">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  user={user || undefined}
                  compose={() => setCompose(true)}
                />
              }
            />
            <Route
              path="/scheduled"
              element={<EmailList type="SCHEDULED" onOpen={setDetail} />}
            />
            <Route
              path="/sent"
              element={<EmailList type="SENT" onOpen={setDetail} />}
            />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/queue" element={<QueuePage />} />
            <Route
              path="*"
              element={
                <Dashboard
                  user={user || undefined}
                  compose={() => setCompose(true)}
                />
              }
            />
          </Routes>
        </div>
        <footer className="footer">
          Pulse <span>·</span> Email workspace
        </footer>
      </main>
      {compose && (
        <Compose
          close={() => setCompose(false)}
          onDone={() => qc.invalidateQueries()}
        />
      )}
      {searchOpen && (
        <SearchModal close={() => setSearchOpen(false)} open={setDetail} />
      )}
      {detail && <Detail email={detail} close={() => setDetail(null)} />}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{ className: "toast" }}
      />
    </div>
  );
}
function AuthScreen({ loading = false, error }: { loading?: boolean; error?: unknown }) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-logo">OᑎB</div>
        <p className="auth-kicker">EMAIL WORKSPACE</p>
        <h1>{loading ? "Loading your workspace" : "Welcome to Pulse"}</h1>
        <p>
          {loading
            ? "Checking your secure session..."
            : "Schedule, send, and track your outbound email from one calm workspace."}
        </p>
        {!loading && Boolean(error) && (
          <p className="auth-error">The API could not be reached. Start the backend and refresh this page.</p>
        )}
        {!loading && (
          <button className="primary-button auth-button" onClick={() => (location.href = googleAuthUrl())}>
            Continue with Google
          </button>
        )}
      </section>
    </main>
  );
}
function Dashboard({ user, compose }: { user?: User; compose: () => void }) {
  const {
    data: d,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => get<any>("dashboard"),
    refetchInterval: 15000,
  });
  return (
    <>
      <div className="welcome-row">
        <div>
          <div className="eyebrow">
            <span className="live-dot" />
            LIVE OVERVIEW{" "}
            <span className="date-label">
              ·{" "}
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <h1>
            Good{" "}
            {new Date().getHours() < 12
              ? "morning"
              : new Date().getHours() < 18
                ? "afternoon"
                : "evening"}
            {user?.name ? `, ${user.name.split(" ")[0]}` : ""}
            <span className="wave">✳</span>
          </h1>
          <p>Here's what's happening with your outbound email queue.</p>
        </div>
        <button className="primary-button" onClick={compose}>
          <Plus size={16} />
          Create campaign
        </button>
      </div>
      {error && (
        <div className="error-banner">
          Could not load live metrics. Confirm API and database services are
          running.
        </div>
      )}
      <section className="stats-grid">
        {isLoading ? (
          Array.from({ length: 4 }, (_, i) => (
            <div className="stat-card skeleton" key={i} />
          ))
        ) : (
          <>
            <Stat
              label="Scheduled"
              value={d?.scheduled || 0}
              Icon={Clock3}
              hint="In your queue"
              tone="violet"
            />
            <Stat
              label="Sent today"
              value={d?.sentToday || 0}
              Icon={Send}
              hint="Since midnight"
              tone="green"
            />
            <Stat
              label="Queue depth"
              value={d?.queueDepth || 0}
              Icon={Inbox}
              hint={`${d?.queue?.active || 0} currently active`}
              tone="blue"
            />
            <Stat
              label="Hourly usage"
              value={`${d?.usage || 0}`}
              suffix={` / ${d?.limit || 0}`}
              Icon={Zap}
              hint={`${Math.max(0, (d?.limit || 0) - (d?.usage || 0))} sends remaining`}
              tone="amber"
              progress={d?.limit ? Math.min(100, (d.usage / d.limit) * 100) : 0}
            />
          </>
        )}
      </section>
      <section className="dashboard-grid">
        <div className="panel activity-panel">
          <div className="panel-head">
            <div>
              <h2>Email activity</h2>
              <p>Real campaign activity over the last 7 days</p>
            </div>
            <div className="legend">
              <span>
                <i className="legend-sent" />
                Sent
              </span>
              <span>
                <i className="legend-fail" />
                Failed
              </span>
            </div>
          </div>
          {isLoading ? (
            <div className="chart-skeleton" />
          ) : !d?.hasActivity ? (
            <div className="empty-chart">
              <span className="empty-icon">
                <BarChart3 size={21} />
              </span>
              <b>Not enough activity yet</b>
              <p>Once campaigns run, your activity will appear here.</p>
            </div>
          ) : (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.activity}>
                  <defs>
                    <linearGradient id="sentFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#a78bfa"
                        stopOpacity={0.25}
                      />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#252531" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(x) =>
                      new Date(x + "T00:00:00").toLocaleDateString(undefined, {
                        weekday: "short",
                      })
                    }
                    stroke="#626273"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    stroke="#626273"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#16161f",
                      border: "1px solid #30303d",
                      borderRadius: 10,
                      color: "#f5f5f7",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sent"
                    stroke="#a78bfa"
                    fill="url(#sentFill)"
                    strokeWidth={2}
                    activeDot={{ r: 4 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="failed"
                    stroke="#fb7185"
                    fill="transparent"
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="panel health-panel">
          <div className="panel-head">
            <div>
              <h2>Queue health</h2>
              <p>Worker and delivery pipeline</p>
            </div>
            <span className="status-pill">
              <i />
              {d?.worker || "—"}
            </span>
          </div>
          <div className="worker-banner">
            <div className="worker-icon">
              <Workflow size={18} />
            </div>
            <div>
              <b>Email worker</b>
              <small>Concurrency · {d?.concurrency || "—"} workers</small>
            </div>
            <span className="worker-active">
              <i />
              Active
            </span>
          </div>
          <div className="queue-grid">
            {[
              ["Waiting", d?.queue?.waiting],
              ["Delayed", d?.queue?.delayed],
              ["Active", d?.queue?.active],
              ["Completed", d?.queue?.completed],
              ["Failed", d?.queue?.failed],
            ].map(([k, v]) => (
              <div className="queue-metric" key={k as string}>
                <span>{k}</span>
                <b>{v ?? "—"}</b>
              </div>
            ))}
          </div>
          <div className="rate-block">
            <div className="rate-heading">
              <div>
                <span>Rate limit capacity</span>
                <b>
                  {d?.usage || 0}
                  <small> / {d?.limit || 0} per hour</small>
                </b>
              </div>
              <div
                className="ring"
                style={
                  {
                    "--value": `${d?.limit ? Math.min(100, (d.usage / d.limit) * 100) : 0}%`,
                  } as React.CSSProperties
                }
              >
                <span>
                  {Math.round(
                    d?.limit ? Math.min(100, (d.usage / d.limit) * 100) : 0,
                  )}
                  %
                </span>
              </div>
            </div>
            <div className="progress">
              <i
                style={{
                  width: `${d?.limit ? Math.min(100, (d.usage / d.limit) * 100) : 0}%`,
                }}
              />
            </div>
            <div className="rate-foot">
              <span>
                Current sender · <b>{d?.sender || user?.email || "—"}</b>
              </span>
              <span>Resets hourly</span>
            </div>
          </div>
        </div>
      </section>
      <div className="below-grid">
        <div className="panel recent-panel">
          <div className="panel-head">
            <div>
              <h2>Recently scheduled</h2>
              <p>Your latest campaign activity</p>
            </div>
            <NavLink to="/scheduled" className="text-link">
              View all <ArrowUpRight size={14} />
            </NavLink>
          </div>
          <Recent />
        </div>
        <div className="panel quick-panel">
          <span className="quick-glow" />
          <div className="quick-icon">
            <Mail size={20} />
          </div>
          <h2>Ready to reach out?</h2>
          <p>
            Import your leads and let Pulse handle the timing, pacing, and
            delivery.
          </p>
          <button className="secondary-button" onClick={compose}>
            <Plus size={15} />
            Start a campaign
          </button>
        </div>
      </div>
    </>
  );
}
function Stat({
  label,
  value,
  suffix,
  Icon,
  hint,
  tone,
  progress,
}: {
  label: string;
  value: any;
  suffix?: string;
  Icon: any;
  hint: string;
  tone: string;
  progress?: number;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${tone}`}>
          <Icon size={16} />
        </span>
      </div>
      <div className="stat-value">
        {value}
        <small>{suffix}</small>
      </div>
      <div className="stat-hint">
        {progress !== undefined ? (
          <span className="mini-progress">
            <i style={{ width: `${progress}%` }} />
          </span>
        ) : (
          <span className="hint-dot" />
        )}
        {hint}
      </div>
    </div>
  );
}
function Recent() {
  const { data, isLoading } = useQuery({
    queryKey: ["recent"],
    queryFn: () => get<any>("emails?limit=4"),
  });
  if (isLoading) return <div className="rows-skeleton" />;
  if (!data?.items?.length)
    return (
      <div className="recent-empty">
        <Inbox size={18} />
        <span>No campaigns scheduled yet</span>
      </div>
    );
  return (
    <div className="recent-rows">
      {data.items.slice(0, 4).map((e: any) => (
        <div className="recent-row" key={e.id}>
          <span className="mail-avatar">
            <Mail size={15} />
          </span>
          <span className="recent-to">
            <b>{e.recipient}</b>
            <small>{e.subject}</small>
          </span>
          <Status value={e.status} />
          <span className="recent-time">
            {new Date(e.scheduledAt).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={`email-status ${value.toLowerCase()}`}>
      <i />
      {value.charAt(0) + value.slice(1).toLowerCase()}
    </span>
  );
}
function EmailList({
  type,
  onOpen,
}: {
  type: string;
  onOpen: (e: any) => void;
}) {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(type),
    [page, setPage] = useState(1),
    [date, setDate] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["emails", type, query, status, page, date],
    queryFn: () =>
      get<any>(
        `emails?limit=20&page=${page}&status=${status}&q=${encodeURIComponent(query)}&date=${date}&view=${type}`,
      ),
  });
  return (
    <>
      <div className="list-title">
        <div>
          <div className="eyebrow">CAMPAIGNS</div>
          <h1>{type === "SENT" ? "Sent emails" : "Scheduled emails"}</h1>
          <p>
            {type === "SENT"
              ? "A record of every message Pulse has delivered."
              : "Manage messages queued for delivery."}
          </p>
        </div>
        <span className="total-count">{data?.total ?? "—"} total</span>
      </div>
      <div className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={15} />
            <input
              placeholder="Filter by recipient or subject"
              value={query}
              onChange={(e) => {
                setPage(1);
                setQuery(e.target.value);
              }}
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value={type}>
              {type === "SENT" ? "Sent" : "Scheduled"}
            </option>
            <option value="">All statuses</option>
            <option value="FAILED">Failed</option>
            <option value="PROCESSING">Processing</option>
          </select>
          <input
            aria-label="Filter by date"
            className="date-filter"
            type="date"
            value={date}
            onChange={(e) => {
              setPage(1);
              setDate(e.target.value);
            }}
          />
        </div>
        {error ? (
          <div className="table-empty">
            <ShieldCheck size={25} />
            <b>Unable to load emails</b>
            <span>Check that Pulse's API is available.</span>
          </div>
        ) : isLoading ? (
          <div className="table-loading">
            {Array.from({ length: 6 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        ) : !data?.items?.length ? (
          <div className="table-empty">
            <span className="empty-icon">
              <Mail size={22} />
            </span>
            <b>{query ? "No matching emails" : "Nothing here yet"}</b>
            <span>
              {query
                ? "Try a different search or status."
                : type === "SENT"
                  ? "Delivered messages will appear here."
                  : "Schedule a campaign to see your queue."}
            </span>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>RECIPIENT</th>
                  <th>SUBJECT</th>
                  <th>{type === "SENT" ? "SENT AT" : "SCHEDULED"}</th>
                  {type !== "SENT" && <th>DELAY</th>}
                  <th>SENDER</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e: any) => (
                  <tr key={e.id} onClick={() => onOpen(e)}>
                    <td>
                      <div className="recipient-cell">
                        <span className="recipient-avatar">
                          {e.recipient[0]?.toUpperCase()}
                        </span>
                        <b>{e.recipient}</b>
                      </div>
                    </td>
                    <td className="subject-cell">{e.subject}</td>
                    <td>
                      {new Date(
                        type === "SENT"
                          ? e.sentAt || e.scheduledAt
                          : e.scheduledAt,
                      ).toLocaleString()}
                    </td>
                    {type !== "SENT" && (
                      <td>
                        {Math.max(
                          0,
                          Math.round(
                            (new Date(e.scheduledAt).getTime() -
                              new Date(e.createdAt).getTime()) /
                              1000,
                          ),
                        )}
                        s
                      </td>
                    )}
                    <td>{e.sender}</td>
                    <td>
                      <Status value={e.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <span>
            {data
              ? `Showing ${(page - 1) * 20 + 1}–${Math.min(page * 20, data.total)} of ${data.total}`
              : "Loading records"}
          </span>
          <div>
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <button
              disabled={!data || page >= data.pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
function Compose({ close, onDone }: { close: () => void; onDone: () => void }) {
  const [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [sender, setSender] = useState(""),
    [start, setStart] = useState(() =>
      new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    ),
    [delay, setDelay] = useState(2000),
    [limit, setLimit] = useState(100),
    [recipients, setRecipients] = useState<string[]>([]),
    [invalid, setInvalid] = useState(0),
    [filename, setFilename] = useState(""),
    [drag, setDrag] = useState(false),
    [preview, setPreview] = useState("");
  const parse = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Lead files must be 2 MB or smaller");
      return;
    }
    setFilename(file.name);
    Papa.parse(file, {
      complete: (result) => {
        const values = result.data.flatMap((r: any) =>
          Array.isArray(r) ? r : Object.values(r),
        );
        const candidates = values
          .map((x: any) => String(x).trim())
          .filter((x) => x.includes("@"));
        const all = candidates.filter((x) =>
          /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(x),
        );
        const unique = [...new Set(all.map((x) => x.toLowerCase()))];
        setRecipients(unique);
        setInvalid(candidates.length - all.length + all.length - unique.length);
      },
      skipEmptyLines: true,
    });
  };
  const estimate = useMemo(() => {
    if (!recipients.length) return null;
    const perHour = Math.max(1, limit),
      rateMs = 3600000 / perHour;
    const begin = new Date(start).getTime();
    const interval = Math.max(delay, 2000);
    const index = recipients.length - 1;
    const completion =
      begin + index * interval + Math.floor(index / perHour) * 3600000;
    return new Date(completion);
  }, [recipients.length, start, delay, limit]);
  const mutation = useMutationSchedule();
  const submit = async () => {
    mutation.setLoading(true);
    try {
      const result: any = await api.post("/emails/schedule", {
        subject,
        body,
        sender,
        recipients,
        startTime: new Date(start).toISOString(),
        delayMs: Number(delay),
        hourlyLimit: Number(limit),
      });
      toast.success(`${result.data.data.scheduled} emails scheduled`);
      onDone();
      close();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Could not schedule campaign");
    } finally {
      mutation.setLoading(false);
    }
  };
  return (
    <div className="modal-scrim" onClick={close}>
      <section className="compose-modal" onClick={(e) => e.stopPropagation()}>
        <header className="compose-head">
          <div>
            <span className="compose-mark">
              <Send size={16} />
            </span>
            <span>
              <b>Create campaign</b>
              <small>Schedule personalized outbound emails.</small>
            </span>
          </div>
          <button className="close-btn" onClick={close}>
            <X size={18} />
          </button>
        </header>
        <div className="compose-body">
          <div className="compose-left">
            <label>
              SUBJECT
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="A thoughtful subject line"
              />
            </label>
            <label>
              EMAIL BODY
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={"Hi there,\n\nI wanted to reach out about..."}
                rows={7}
              />
              <small className="field-note">
                Plain text email · personalization can be added in the body.
              </small>
            </label>
            <label>
              SENDER EMAIL
              <input
                type="email"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="you@yourdomain.com"
              />
            </label>
            <div className="upload-title">
              <div>
                <b>Lead list</b>
                <small>CSV or text file · up to 2 MB</small>
              </div>
              {recipients.length > 0 && (
                <span className="recipient-total">
                  <Users size={13} />
                  {recipients.length} recipients
                </span>
              )}
            </div>
            <div
              className={`dropzone ${drag ? "dragging" : ""} ${filename ? "has-file" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files[0];
                if (f) parse(f);
              }}
              onClick={() => document.getElementById("lead-file")?.click()}
            >
              <input
                id="lead-file"
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                hidden
                onChange={(e) =>
                  e.target.files?.[0] && parse(e.target.files[0])
                }
              />
              {filename ? (
                <>
                  <span className="upload-done">
                    <Check size={17} />
                  </span>
                  <div>
                    <b>{filename}</b>
                    <small>
                      {recipients.length} unique emails · {invalid} invalid or
                      duplicate
                    </small>
                  </div>
                  <button
                    className="remove-file"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilename("");
                      setRecipients([]);
                    }}
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span className="upload-icon">
                    <Upload size={17} />
                  </span>
                  <div>
                    <b>Drop your lead list here</b>
                    <small>
                      or <u>browse files</u> from your computer
                    </small>
                  </div>
                </>
              )}
            </div>
            {recipients.length > 0 && (
              <div className="csv-preview">
                <div className="csv-head">
                  <span>EMAIL ADDRESS</span>
                  <span>PREVIEW</span>
                </div>
                {recipients.slice(0, 3).map((e) => (
                  <div className="csv-row" key={e}>
                    <span>{e}</span>
                    <Check size={13} />
                  </div>
                ))}
                {recipients.length > 3 && (
                  <div className="csv-more">
                    and {recipients.length - 3} more recipients
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="compose-right">
            <div className="side-section">
              <div className="section-label">SCHEDULE</div>
              <label>
                START TIME
                <input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                DELAY BETWEEN EMAILS
                <div className="input-unit">
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={delay}
                    onChange={(e) => setDelay(+e.target.value)}
                  />
                  <span>ms</span>
                </div>
              </label>
              <label>
                HOURLY CAPACITY
                <div className="input-unit">
                  <input
                    type="number"
                    min="1"
                    value={limit}
                    onChange={(e) => setLimit(+e.target.value)}
                  />
                  <span>emails / hr</span>
                </div>
              </label>
            </div>
            <div className="timeline-card">
              <div className="section-label">DELIVERY PREVIEW</div>
              <div className="timeline">
                <i />
                <div>
                  <small>CAMPAIGN STARTS</small>
                  <b>
                    {new Date(start).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </b>
                </div>
              </div>
              <div className="timeline">
                <i />
                <div>
                  <small>RECIPIENTS</small>
                  <b>
                    {recipients.length} emails ·{" "}
                    {(delay / 1000).toFixed(delay % 1000 ? 1 : 0)}s spacing
                  </b>
                </div>
              </div>
              <div className="timeline last">
                <i />
                <div>
                  <small>ESTIMATED COMPLETION</small>
                  <b>
                    {estimate
                      ? estimate.toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "Upload leads to calculate"}
                  </b>
                </div>
              </div>
              <div className="capacity-note">
                <Zap size={13} />
                At {limit} emails per hour, per sender
              </div>
            </div>
            <div className="privacy-note">
              <ShieldCheck size={14} />
              <span>
                Emails send through your configured SMTP provider. Invalid and
                duplicate addresses are removed.
              </span>
            </div>
          </div>
        </div>
        <footer className="compose-foot">
          <span>
            {recipients.length
              ? `${recipients.length} emails will be scheduled.`
              : "Add a lead list to continue."}
          </span>
          <div>
            <button className="cancel-btn" onClick={close}>
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={
                !subject ||
                !body ||
                !sender ||
                !recipients.length ||
                mutation.loading
              }
              onClick={submit}
            >
              {mutation.loading ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Send size={15} />
              )}
              Schedule emails
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
function useMutationSchedule() {
  const [loading, setLoading] = useState(false);
  return { loading, setLoading };
}
function SearchModal({
  close,
  open,
}: {
  close: () => void;
  open: (e: any) => void;
}) {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["global-search", q],
    queryFn: () => get<any>(`emails/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
  });
  return (
    <div className="modal-scrim search-scrim" onClick={close}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-row">
          <Search size={19} />
          <input
            autoFocus
            placeholder="Search emails..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <kbd>ESC</kbd>
        </div>
        {!q ? (
          <div className="search-prompt">
            <Command size={18} />
            <span>Search recipient, subject, sender, or message body</span>
          </div>
        ) : isLoading ? (
          <div className="search-prompt">
            <LoaderCircle className="spin" size={18} />
            Searching emails…
          </div>
        ) : !data?.items?.length ? (
          <div className="search-prompt">
            <Inbox size={18} />
            No results for “{q}”
          </div>
        ) : (
          <div className="search-results">
            <div className="section-label">
              EMAIL RESULTS · {data.items.length}
            </div>
            {data.items.map((e: any) => (
              <button
                className="search-result"
                key={e.id}
                onClick={() => {
                  open(e);
                  close();
                }}
              >
                <span className="mail-avatar">
                  <Mail size={15} />
                </span>
                <span>
                  <b>{e.recipient}</b>
                  <small>{e.subject}</small>
                </span>
                <Status value={e.status} />
                <span className="search-date">
                  {new Date(e.sentAt || e.scheduledAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="search-bottom">
          <span>
            <kbd>↵</kbd> to open
          </span>
          <span>
            <kbd>ESC</kbd> to close{" "}
            <span className="search-via">Powered by Elasticsearch</span>
          </span>
        </div>
      </div>
    </div>
  );
}
function Detail({ email, close }: { email: any; close: () => void }) {
  return (
    <div className="drawer-scrim" onClick={close}>
      <aside className="detail-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <span className="eyebrow">EMAIL DETAILS</span>
            <h2>Message</h2>
          </div>
          <button className="close-btn" onClick={close}>
            <X size={18} />
          </button>
        </header>
        <div className="detail-status">
          <Status value={email.status} />
          <span>
            {new Date(email.sentAt || email.scheduledAt).toLocaleString()}
          </span>
        </div>
        <div className="detail-fields">
          <div>
            <small>TO</small>
            <b>{email.recipient}</b>
          </div>
          <div>
            <small>FROM</small>
            <b>{email.sender}</b>
          </div>
          <div>
            <small>SUBJECT</small>
            <b>{email.subject}</b>
          </div>
          <div>
            <small>STATUS</small>
            <b>{email.status}</b>
          </div>
          {email.error && (
            <div>
              <small>ERROR</small>
              <b className="error-text">{email.error}</b>
            </div>
          )}
          {email.previewUrl && (
            <a
              href={email.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              Open Ethereal preview <ArrowUpRight size={14} />
            </a>
          )}
        </div>
        <div className="message-preview">
          <div className="section-label">MESSAGE BODY</div>
          <p>{email.body}</p>
        </div>
      </aside>
    </div>
  );
}
function Integrations() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["slack"],
    queryFn: () => get<any>("slack/status"),
  });
  return (
    <>
      <div className="list-title">
        <div>
          <div className="eyebrow">WORKSPACE</div>
          <h1>Integrations</h1>
          <p>Connect the services that power your email workflow.</p>
        </div>
      </div>
      <div className="integration-grid">
        <div className="panel integration-card">
          <div className="integration-icon slack-icon">
            <Slack size={20} />
          </div>
          <div className="integration-copy">
            <h2>Slack</h2>
            <p>
              Get notified when a sender reaches their hourly limit, so you can
              keep an eye on campaign pacing.
            </p>
            {isLoading ? (
              <span className="integration-status">Checking connection…</span>
            ) : data?.connected ? (
              <span className="connected-label">
                <i />
                Connected to {data.connection.teamName}
              </span>
            ) : (
              <span className="integration-status">Not connected</span>
            )}
          </div>
          {data?.connected ? (
            <button
              className="cancel-btn"
              onClick={async () => {
                await api.delete("/slack/disconnect");
                refetch();
                toast.success("Slack disconnected");
              }}
            >
              Disconnect
            </button>
          ) : (
            <button
              className="primary-button"
              onClick={() =>
                (location.href = "http://localhost:4000/api/slack/connect")
              }
            >
              <Slack size={15} />
              Connect Slack
            </button>
          )}
        </div>
        <div className="panel integration-card">
          <div className="integration-icon mail-integration">
            <Mail size={20} />
          </div>
          <div className="integration-copy">
            <h2>Google account</h2>
            <p>
              Sign in securely with Google to save campaigns and view your
              workspace data.
            </p>
            <span className="integration-status">
              {(window as any).__pulseUser
                ? "Connected"
                : "Managed by Google OAuth"}
            </span>
          </div>
          <a
            className="secondary-button"
            href="http://localhost:4000/api/auth/google"
          >
            Connect Google
          </a>
        </div>
      </div>
    </>
  );
}
function QueuePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["queue"],
    queryFn: () => get<any>("queue"),
    refetchInterval: 5000,
  });
  return (
    <>
      <div className="list-title">
        <div>
          <div className="eyebrow">SYSTEM HEALTH</div>
          <h1>Queue monitor</h1>
          <p>Live view of your persistent email delivery pipeline.</p>
        </div>
        <span className="status-pill">
          <i />
          {data?.worker || "CHECKING"}
        </span>
      </div>
      {error ? (
        <div className="error-banner">
          Queue monitor unavailable. Confirm the API and Redis are running.
        </div>
      ) : (
        <>
          <div className="queue-cards">
            {["waiting", "delayed", "active", "completed", "failed"].map(
              (key, i) => (
                <div className="stat-card" key={key}>
                  <div className="stat-top">
                    <span>{key[0].toUpperCase() + key.slice(1)}</span>
                    <span
                      className={`stat-icon ${["violet", "blue", "amber", "green", "rose"][i]}`}
                    >
                      <Activity size={16} />
                    </span>
                  </div>
                  <div className="stat-value">
                    {isLoading ? "—" : (data?.counts?.[key] ?? 0)}
                  </div>
                  <div className="stat-hint">Persistent BullMQ job state</div>
                </div>
              ),
            )}
          </div>
          <div className="panel monitor-panel">
            <div className="panel-head">
              <div>
                <h2>Worker status</h2>
                <p>Concurrency is configured by WORKER_CONCURRENCY.</p>
              </div>
              <span className="status-pill">
                <i />
                {data?.worker || "—"}
              </span>
            </div>
            <div className="worker-banner">
              <div className="worker-icon">
                <Workflow size={18} />
              </div>
              <div>
                <b>emailWorker</b>
                <small>
                  Concurrent processors · {data?.concurrency || "—"}
                </small>
              </div>
              <span className="worker-active">
                <i />
                Listening
              </span>
            </div>
            <p className="monitor-note">
              BullMQ stores delayed jobs in Redis. Restarting the API does not
              clear the schedule.
            </p>
          </div>
        </>
      )}
    </>
  );
}
export default App;
