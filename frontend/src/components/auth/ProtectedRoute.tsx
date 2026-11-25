import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import type { UserRole } from "../../types/auth";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { StatusAlert } from "../ui/StatusAlert";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { firebaseUser, profile, authMode, loading, backendSyncError, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span>Verifying session with LIFE SIGNAL...</span>
        </div>
      </div>
    );
  }

  const hasSession = Boolean(firebaseUser) || (authMode === "dev" && Boolean(profile));
  if (!hasSession) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (backendSyncError || !profile) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Card className="p-6 space-y-4">
          <StatusAlert variant="error" title="Backend Verification Unavailable">
            {backendSyncError ||
              "Your session could not be verified with the FastAPI backend."}
          </StatusAlert>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Retry Verification
            </Button>
            <Button variant="ghost" onClick={() => void logout()}>
              Sign Out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (requiredRole && profile.role !== requiredRole) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Card className="p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-950 dark:text-white">Administrator Access Required</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Your verified account role is <span className="font-mono font-semibold">{profile.role}</span>.
            Administrative routes and operations are strictly enforced on the backend.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link to="/citizen/dashboard">
              <Button>Go to Citizen Dashboard</Button>
            </Link>
            <Link to="/">
              <Button variant="secondary">Return Home</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
