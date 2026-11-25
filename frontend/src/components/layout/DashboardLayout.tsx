import { motion } from "framer-motion";
import {
  ClipboardList,
  Cpu,
  Download,
  FilePlus2,
  Flame,
  Layers,
  LayoutDashboard,
  LogOut,
  MapPin,
  Moon,
  Settings,
  Shield,
  Sun,
  TrendingUp,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../lib/theme";
import { CyberBackdrop } from "../motion/CyberBackdrop";
import { FloatingElement } from "../motion/FloatingElement";
import { PageTransition } from "../motion/PageTransition";
import { ScrollTelemetryBar } from "../motion/ScrollTelemetryBar";
import { Badge } from "../ui/Badge";
import { BrandLogo } from "../ui/BrandLogo";

interface DashboardLayoutProps {
  children: ReactNode;
  mode: "citizen" | "admin";
}

export function DashboardLayout({ children, mode }: DashboardLayoutProps) {
  const { profile, authMode, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const citizenLinks = [
    { to: "/citizen/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/citizen/complaints/new", label: "Register Complaint", icon: FilePlus2 },
    { to: "/citizen/complaints", label: "My Complaints", icon: ClipboardList },
    { to: "/citizen/settings", label: "Profile & Security", icon: Settings },
  ];

  const adminLinks = [
    { to: "/admin/dashboard", label: "Command Overview", icon: LayoutDashboard },
    { to: "/admin/complaints", label: "All Complaints", icon: ClipboardList },
    { to: "/admin/map", label: "Infrastructure Map", icon: MapPin },
    { to: "/admin/hotspots", label: "Hotspots & Priority", icon: Flame },
    { to: "/admin/maintenance", label: "Predictive Maintenance", icon: TrendingUp },
    { to: "/admin/ai-analysis", label: "AI Analysis & Calibration", icon: Cpu },
    { to: "/admin/duplicates", label: "Duplicate Detection", icon: Layers },
    { to: "/admin/exports", label: "Reports & Exports", icon: Download },
    { to: "/admin/users", label: "Users & RBAC", icon: Users },
    { to: "/admin/settings", label: "Profile & Security", icon: Settings },
  ];

  const links = mode === "admin" ? adminLinks : citizenLinks;

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#040812] flex flex-col lg:flex-row">
      <ScrollTelemetryBar />

      <aside className="w-full border-b border-slate-200/80 glass-panel lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r dark:border-slate-800/90 flex flex-col">
        <div className="flex h-16 items-center justify-between px-5 border-b border-slate-200/80 dark:border-slate-800/80">
          <FloatingElement amplitude={2} duration={6}>
            <Link to="/">
              <BrandLogo />
            </Link>
          </FloatingElement>
          <div className="flex items-center gap-1">
            {authMode === "dev" && <Badge tone="amber">DEV</Badge>}
            <Badge tone={mode === "admin" ? "cyan" : "blue"}>
              {mode === "admin" ? "Admin" : "Citizen"}
            </Badge>
          </div>
        </div>

        <nav className="p-3 space-y-1 flex-1">
          {links.map((item) => {
            const Icon = item.icon;
            const exactMatch =
              item.to === "/citizen/complaints" ||
              item.to === "/citizen/dashboard" ||
              item.to === "/admin/dashboard";
            const isActive = exactMatch
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={exactMatch}
                className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-blue-700 dark:text-cyan-300"
                    : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId={`sidebar-active-pill-${mode}`}
                    transition={{ type: "spring", stiffness: 360, damping: 32 }}
                    className="absolute inset-0 rounded-xl border border-blue-200/80 bg-blue-50/90 dark:border-cyan-500/30 dark:bg-cyan-500/10"
                  />
                )}
                <Icon className="relative z-10 h-4 w-4 shrink-0" />
                <span className="relative z-10">{item.label}</span>
              </NavLink>
            );
          })}

          {profile?.role === "admin" && mode === "citizen" && (
            <Link
              to="/admin/dashboard"
              className="mt-3 flex items-center gap-2.5 rounded-xl border border-cyan-200 bg-cyan-50/70 px-3 py-2.5 text-sm font-medium text-cyan-800 transition-transform hover:-translate-y-0.5 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300"
            >
              <Shield className="h-4 w-4" />
              <span>Switch to Admin Console</span>
            </Link>
          )}
          {profile?.role === "admin" && mode === "admin" && (
            <Link
              to="/citizen/dashboard"
              className="mt-3 flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Citizen View</span>
            </Link>
          )}
        </nav>

        <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            {profile?.profile_image ? (
              <img
                src={profile.profile_image}
                alt={profile.full_name}
                className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-xs font-semibold text-white">
                {(profile?.full_name?.[0] ?? "U").toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                {profile?.full_name}
              </p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{profile?.email}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              <span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="relative flex-1 overflow-hidden px-4 py-6 sm:px-8 lg:py-8">
        <CyberBackdrop subtle />
        <div className="relative z-10 mx-auto max-w-6xl">
          <PageTransition key={location.pathname}>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}
