import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NotificationBell } from "./NotificationBell";
import { SpitarLogoMark } from "./SpitarLogoMark";
import { LogOut, Menu, X, User, ChevronRight, Sparkles, MessageCircle, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }>;
  onClick?: () => void;
  active?: boolean;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  navItems: NavItem[];
  title?: string;
  headerActions?: React.ReactNode;
}

const ROLE_GRAD: Record<string, string> = {
  patient:  "linear-gradient(135deg, #2563eb, #06b6d4)",
  doctor:   "linear-gradient(135deg, #7c3aed, #2563eb)",
  lab:      "linear-gradient(135deg, #0891b2, #16a34a)",
  hospital: "linear-gradient(135deg, #0d9488, #16a34a)",
  admin:    "linear-gradient(135deg, #dc2626, #ea580c)",
};

export function DashboardLayout({ children, navItems, title, headerActions }: DashboardLayoutProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const grad = ROLE_GRAD[user?.role ?? "patient"];
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex" }}>

      {/* ── SIDEBAR ── */}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 flex flex-col transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:relative lg:translate-x-0",
        )}
        style={{ width: 260, flexShrink: 0, background: "#0f172a" }}
      >
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Link to="/" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #2563eb, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <SpitarLogoMark size={20} />
            </div>
            <div>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: -0.3 }}>SPITAR</span>
              <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 6, padding: "1px 6px", borderRadius: 5, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>CLD</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden ms-auto" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
              <X size={18} />
            </button>
          </div>
          </Link>
        </div>

        {/* User Card */}
        <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", margin: "0 12px", marginTop: 12, background: "rgba(255,255,255,0.04)", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: grad, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>{initials}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.firstName} {user?.lastName}
              </p>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, margin: "2px 0 0", textTransform: "capitalize" }}>
                {user?.role}
              </p>
            </div>
          </div>
          {user?.spitarId && (
            <div style={{ marginTop: 10, padding: "5px 10px", background: "rgba(255,255,255,0.07)", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Sparkles size={10} style={{ color: "rgba(255,255,255,0.4)" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.04em" }}>{user.spitarId}</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 10px 8px", margin: 0 }}>
            Navigation
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.active !== undefined ? item.active : location.pathname === item.href;
            return (
              <div
                key={item.label}
                onClick={() => { setSidebarOpen(false); item.onClick?.(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 11, cursor: "pointer",
                  background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                  transition: "all 0.15s",
                  position: "relative",
                  textDecoration: "none",
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {/* Active left accent */}
                {isActive && (
                  <div style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: 3, borderRadius: 3, background: grad }} />
                )}
                <div style={{ width: 32, height: 32, borderRadius: 9, background: isActive ? grad : "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                  <Icon size={15} style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.5)" }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? "#fff" : "rgba(255,255,255,0.6)", flex: 1, transition: "color 0.15s" }}>
                  {item.label}
                </span>
                {isActive && <ChevronRight size={13} style={{ color: "rgba(255,255,255,0.3)" }} />}
              </div>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <Link to="/profile" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 11, cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User size={15} style={{ color: "rgba(255,255,255,0.5)" }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>{t("nav.profile")}</span>
            </div>
          </Link>
          <button onClick={() => logout()} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 11, cursor: "pointer", background: "none", border: "none", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.12)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LogOut size={15} style={{ color: "#f87171" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#f87171" }}>{t("nav.logout")}</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }} className="lg:hidden" />
      )}

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Top header */}
        <header style={{
          height: 60, borderBottom: "1px solid #e2e8f0", background: "#fff",
          display: "flex", alignItems: "center", gap: 12, padding: "0 24px",
          position: "sticky", top: 0, zIndex: 30,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden" style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }}>
            <Menu size={22} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: grad, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>{initials}</span>
            </div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>{title ?? t("nav.dashboard")}</h1>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {headerActions}
            <NotificationBell />
            <LanguageSwitcher />
          </div>
        </header>

        <main style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
