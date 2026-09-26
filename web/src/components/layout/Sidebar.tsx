import { NavLink } from 'react-router-dom';
import {
  Activity,
  ChevronDown,
  Clock3,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  Workflow,
  X,
} from 'lucide-react';
import { User } from '../../lib/types';

const navItems = [
  ['Overview', '/', LayoutDashboard],
  ['Scheduled', '/scheduled', Clock3],
  ['Sent', '/sent', Send],
  ['Integrations', '/integrations', Workflow],
  ['Queue Monitor', '/queue', Activity],
] as const;

interface SidebarProps {
  user: User | null | undefined;
  mobile: boolean;
  onCloseMobile: () => void;
  onOpenSearch: () => void;
  onOpenCompose: () => void;
}

export function Sidebar({ user, mobile, onCloseMobile, onOpenSearch, onOpenCompose }: SidebarProps) {
  return (
    <>
      <aside className={`sidebar ${mobile ? 'show' : ''}`}>
        <div className="brand">
          <span className="logo">
            <Activity size={19} />
          </span>
          <span>
            pulse<small>INTELLIGENT EMAIL</small>
          </span>
          <button className="mobile-close" onClick={onCloseMobile}>
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
          {navItems.map(([label, path, Icon]) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
          <button onClick={onOpenSearch} className="nav-link">
            <Search size={17} />
            Search<span className="key-hint">/</span>
          </button>
          <button onClick={onOpenCompose} className="nav-link compose-link">
            <Plus size={17} />
            Compose
          </button>
        </nav>
        <div className="side-bottom">
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Settings size={17} />
            Settings
          </NavLink>
          <div className="profile">
            {user?.avatar ? (
              <img src={user.avatar} />
            ) : (
              <span className="avatar">{user?.name?.[0] || 'P'}</span>
            )}
            <span className="profile-copy">
              <b>{user?.name || 'Welcome to Pulse'}</b>
              <small>{user?.email || 'Connect Google to get started'}</small>
            </span>
            <MoreHorizontal size={18} />
          </div>
          <div className="side-foot">
            BUILT FOR BETTER OUTBOUND <span>v1.0</span>
          </div>
        </div>
      </aside>
      {mobile && <div className="scrim" onClick={onCloseMobile} />}
    </>
  );
}
