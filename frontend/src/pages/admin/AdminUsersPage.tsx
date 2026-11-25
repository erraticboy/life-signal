import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { AnimatedCounter } from "../../components/motion/AnimatedCounter";
import { FloatingElement } from "../../components/motion/FloatingElement";
import { ScrollReveal3D } from "../../components/motion/ScrollReveal3D";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { StatusAlert } from "../../components/ui/StatusAlert";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../lib/api";
import type { UserProfile, UserRole } from "../../types/auth";

export function AdminUsersPage() {
  const { profile, getIdToken } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [singleAdminMode, setSingleAdminMode] = useState(false);
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const [list, cfg] = await Promise.all([
        apiClient.listAdminUsers(token, roleFilter),
        apiClient.getConfigStatus().catch(() => null),
      ]);
      setUsers(list);
      setSingleAdminMode(Boolean(cfg?.single_admin_mode));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [getIdToken, roleFilter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleToggleRole = async (target: UserProfile) => {
    setError(null);
    setNotice(null);
    setUpdatingId(target.id);
    const nextRole: UserRole = target.role === "admin" ? "citizen" : "admin";
    try {
      const token = await getIdToken();
      if (!token) return;
      const updated = await apiClient.updateUserRole(token, target.id, { role: nextRole });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setNotice(`Updated ${updated.email} role to ${updated.role} (audit logged).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role update failed.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <DashboardLayout mode="admin">
      <div className="space-y-6">
        <FloatingElement amplitude={3} duration={6.5}>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                  User &amp; Role Management
                </h1>
                <Badge tone="cyan">
                  <AnimatedCounter value={users.length} /> Accounts
                </Badge>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Authorized administrators can inspect accounts and assign roles with audit logging.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(["all", "citizen", "admin"] as const).map((filter) => (
                <Button
                  key={filter}
                  size="sm"
                  variant={roleFilter === filter ? "primary" : "secondary"}
                  onClick={() => setRoleFilter(filter)}
                  className="transition-transform hover:-translate-y-0.5"
                >
                  {filter === "all" ? "All" : filter === "admin" ? "Admins" : "Citizens"}
                </Button>
              ))}
            </div>
          </div>
        </FloatingElement>

        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <StatusAlert variant="error">{error}</StatusAlert>
          </motion.div>
        )}
        {notice && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <StatusAlert variant="success">{notice}</StatusAlert>
          </motion.div>
        )}
        {singleAdminMode && (
          <StatusAlert variant="info" title="Single-Admin Startup Lock Active">
            Only the designated founder account can hold Administrator privileges. Promoting additional citizens to Admin is disabled.
          </StatusAlert>
        )}

        <ScrollReveal3D delay={0.08}>
          <Card className="overflow-hidden glass-panel">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Verification</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        Loading users...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No matching user records found.
                      </td>
                    </tr>
                  ) : (
                    users.map((u, idx) => (
                      <motion.tr
                        key={u.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.25 }}
                        className="transition-colors hover:bg-blue-50/40 dark:hover:bg-cyan-500/5"
                      >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">{u.full_name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={u.email_verified ? "emerald" : "amber"}>
                          {u.email_verified ? "Verified" : "Pending"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={u.role === "admin" ? "cyan" : "blue"}>{u.role}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={u.is_active ? "neutral" : "rose"}>
                          {u.is_active ? "Active" : "Suspended"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={
                            updatingId === u.id ||
                            u.id === profile?.id ||
                            (singleAdminMode && u.role !== "admin")
                          }
                          onClick={() => void handleToggleRole(u)}
                        >
                          {u.id === profile?.id
                            ? "Current Account"
                            : u.role === "admin"
                              ? "Demote to Citizen"
                              : singleAdminMode
                                ? "Locked (Single Admin)"
                                : "Promote to Admin"}
                        </Button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </Card>
        </ScrollReveal3D>
      </div>
    </DashboardLayout>
  );
}

