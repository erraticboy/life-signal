import { Terminal } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import type { UserRole } from "../../types/auth";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { StatusAlert } from "../ui/StatusAlert";

export function DevModeSignInCard() {
  const { isDevAuthAvailable, loginWithDevMode } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("Ashutosh Citizen");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("citizen");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isDevAuthAvailable) {
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await loginWithDevMode({
        full_name: fullName.trim(),
        email: email.trim(),
        role,
      });
      navigate(user.role === "admin" ? "/admin/dashboard" : "/citizen/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Development sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6 border-cyan-300/80 dark:border-cyan-800/70 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-950 dark:text-white">
            Local Development Mode Sign-In
          </h2>
        </div>
        <Badge tone="cyan">DEV ONLY</Badge>
      </div>

      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
        Active only when <code className="font-mono">APP_ENV=development</code>. Issues a signed backend
        JWT and creates a real PostgreSQL user record so you can test Complaint Filing, ReportLab PDFs, and
        SMTP emails before configuring Firebase. Use your real email if testing SMTP receipts.
      </p>

      {error && <StatusAlert variant="error">{error}</StatusAlert>}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="dev-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Full name (printed on PDF receipts)
          </label>
          <input
            id="dev-name"
            type="text"
            required
            minLength={2}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="dev-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Email address
          </label>
          <input
            id="dev-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gmail.com"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Test Role
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["citizen", "admin"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`h-9 rounded-lg border text-xs font-medium capitalize transition-colors cursor-pointer ${
                  role === r
                    ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-cyan-400 dark:bg-cyan-950/60 dark:text-cyan-300"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Starting Dev Session..." : `Continue in Dev Mode (${role})`}
        </Button>
      </form>
    </Card>
  );
}

