import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Command, LayoutDashboard, MailPlus, PanelLeftClose, PanelLeftOpen, Search, Sparkles, Waypoints, X } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

const navItems = [
  { label: "Overview", to: "/dashboard", icon: LayoutDashboard },
  { label: "Analyze email", to: "/analyze", icon: MailPlus },
  { label: "Model insights", to: "/model-insights", icon: Waypoints },
];

export default function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pageTitle = navItems.find((item) => location.pathname.startsWith(item.to))?.label ?? "Overview";
  const runCommand = (path: string) => {
    setPaletteOpen(false);
    navigate(path);
  };

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`} data-testid="app-shell">
      <aside className="sidebar" data-testid="app-sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden="true"><Sparkles size={17} /></div>
          {!collapsed && <div><div className="brand-name">MailMind <span>AI</span></div><div className="brand-kicker">INTELLIGENCE CONSOLE</div></div>}
        </div>
        <div className="sidebar-section-label">Workspace</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`} data-testid={`nav-${label.toLowerCase().replaceAll(" ", "-")}`} title={collapsed ? label : undefined}>
              <Icon size={17} strokeWidth={1.8} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
        {!collapsed && <div className="sidebar-status" data-testid="model-status-panel">
          <div className="status-heading"><span className="status-dot" /> ML system online</div>
          <div className="status-row"><span>Spam model</span><strong>v1.0</strong></div>
          <div className="status-row"><span>Category model</span><strong>v1.0</strong></div>
          <div className="status-updated">Last updated 2m ago</div>
        </div>}
        <button className="collapse-control" onClick={() => setCollapsed((value) => !value)} data-testid="sidebar-collapse-button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <PanelLeftOpen size={17} /> : <><PanelLeftClose size={17} /><span>Collapse sidebar</span></>}
        </button>
      </aside>

      <div className="workspace">
        <header className="topbar" data-testid="app-topbar">
          <div className="breadcrumb"><span>MailMind AI</span><span className="breadcrumb-slash">/</span><strong>{pageTitle}</strong></div>
        </header>
        <main className="main-content">{children}</main>
      </div>

      {paletteOpen && <div className="palette-backdrop" onClick={() => setPaletteOpen(false)} data-testid="command-palette-backdrop">
        <div className="command-palette" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Command palette" data-testid="command-palette">
          <div className="palette-input"><Search size={17} /><input autoFocus placeholder="Search or jump to..." data-testid="command-palette-input" /><button onClick={() => setPaletteOpen(false)} data-testid="command-palette-close"><X size={16} /></button></div>
          <div className="palette-label">Quick actions</div>
          {[{ label: "Open overview", path: "/dashboard", icon: LayoutDashboard }, { label: "Analyze an email", path: "/analyze", icon: MailPlus }, { label: "Model insights", path: "/model-insights", icon: Waypoints }].map(({ label, path, icon: Icon }) => <button key={path} className="palette-item" onClick={() => runCommand(path)} data-testid={`command-${label.toLowerCase().replaceAll(" ", "-")}`}><Icon size={16} /><span>{label}</span><span className="palette-enter">↵</span></button>)}
          <div className="palette-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Select</span><span><kbd>esc</kbd> Close</span></div>
        </div>
      </div>}
    </div>
  );
}