import { useState } from "react";
import {
  NavLink,
  Navigate,
  Outlet,
  useNavigate,
  useLocation,
  Link,
} from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  FolderHeart,
  Layers3,
  Users,
  ShieldCheck,
  History,
  Settings,
  LogOut,
  Search,
  Menu,
  X,
  ChevronDown,
  ArrowUpRight,
  Leaf,
  HardDrive,
} from "lucide-react";
import { isDemoMode } from "../lib/supabase";
import { useApp } from "../context";
import { Avatar, Badge } from "./common";
import { Button } from "./ui/button";
export function Logo() {
  return (
    <Link to="/" className="logo">
      <span>
        <Layers3 size={24} />
      </span>
      elladria<span className="logo-dot">.</span>
    </Link>
  );
}
export function Layout() {
  const { user, db, signOut, notice, dismiss, run, pending } = useApp();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  const navigation = [
    { path: "/", label: "Overview", icon: LayoutDashboard },
    { path: "/my-department", label: "My department", icon: Building2 },
    { path: "/shared", label: "Shared with me", icon: FolderHeart },
    ...(user.role !== "Department Member"
      ? [{ path: "/departments", label: "All departments", icon: Layers3 }]
      : []),
  ];
  const adminNav = [
    ...(user.role === "Admin"
      ? [
          { path: "/users", label: "Users", icon: Users },
          { path: "/permissions", label: "Permissions", icon: ShieldCheck },
          { path: "/storage", label: "Storage", icon: HardDrive },
        ]
      : []),
    ...(user.role !== "Department Member"
      ? [{ path: "/activity", label: "Activity logs", icon: History }]
      : []),
  ];
  const activeLabel =
    [
      ...navigation,
      ...adminNav,
      { path: "/settings", label: "Settings" },
      { path: "/upload", label: "Upload file" },
      { path: "/search", label: "Search" },
      { path: "/storage", label: "Storage overview" },
    ].find((n) => n.path === location.pathname)?.label ?? "Workspace";
  return (
    <div className="app-shell">
      {open && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-logo">
          <Logo />
          <button
            className="md:hidden"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-icon">E</span>
          <div>
            <strong>Elladria workspace</strong>
            <small>Internal document hub</small>
          </div>
          <span className="text-slate-400">
            <ChevronDown size={15} />
          </span>
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Workspace navigation">
          {navigation.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={19} />
              {label}
              {path === "/shared" && (
                <span className="nav-count">
                  {db.permissions.filter((p) => p.userId === user.id).length}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        {adminNav.length > 0 && (
          <>
            <p className="nav-caption mt-8">ADMINISTRATION</p>
            <nav aria-label="Administration">
              {adminNav.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""}`
                  }
                >
                  <Icon size={19} />
                  {label}
                </NavLink>
              ))}
            </nav>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="workspace-tip">
            <Leaf size={20} />
            <strong>A place for everything.</strong>
            <p>
              Less searching.
              <br />
              More moving forward.
            </p>
            <Link to="/my-department" onClick={() => setOpen(false)}>
              Explore your department <ArrowUpRight size={14} />
            </Link>
          </div>
          <NavLink
            className="nav-item"
            to="/settings"
            onClick={() => setOpen(false)}
          >
            <Settings size={19} />
            Settings
          </NavLink>
          <button className="nav-item w-full" onClick={signOut}>
            <LogOut size={19} />
            Sign out
          </button>
          <div className="sidebar-profile">
            <Avatar initials={user.initials} />
            <div>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
            <span className="status-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <span className="hidden text-slate-400 sm:inline">Workspace</span>
            <span className="hidden text-slate-300 sm:inline">/</span>
            <span className="font-medium">{activeLabel}</span>
          </div>
          <div className="flex items-center gap-4">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/search?q=${encodeURIComponent(search)}`);
              }}
            >
              <Search size={17} />
              <input
                aria-label="Search workspace"
                placeholder="Search anything…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <Badge tone="green">{user.role}</Badge>
            <Link aria-label="Your settings" to="/settings">
              <Avatar initials={user.initials} small />
            </Link>
          </div>
        </header>
        <main>
          {!!db.pendingOperations?.length && <section className="panel mb-5 p-4" aria-label="Pending operations"><h2>Pending cleanup</h2><p className="muted">A previous operation needs another attempt to finish.</p>{db.pendingOperations.map(operation => <div key={operation.id} className="mt-3 flex items-center justify-between gap-3"><span>{operation.name}</span><Button variant="outline" disabled={pending} onClick={() => void run({ kind: "retryOperation", id: operation.id, operation: operation.kind })}>{operation.kind === "upload" ? "Clean up upload" : "Retry deletion"}</Button></div>)}</section>}
          <Outlet />
        </main>
        <footer>
          <span>© 2026 Elladria. A more connected workspace.</span>
          <span>
            <span className="status-dot" />
            {isDemoMode ? "Demo workspace · Local data" : "Private workspace · Supabase"}
          </span>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss notification" onClick={dismiss}>
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
