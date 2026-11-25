export type UserRole = "citizen" | "admin";

export interface UserProfile {
  id: string;
  firebase_uid: string;
  full_name: string;
  email: string;
  email_verified: boolean;
  profile_image: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthSessionResponse {
  user: UserProfile;
  is_new_user: boolean;
  sign_in_provider: string | null;
}

export interface DevLoginResponse extends AuthSessionResponse {
  access_token: string;
  token_type: string;
}

export interface SystemConfigStatus {
  app_name: string;
  environment: string;
  firebase_configured: boolean;
  dev_auth_enabled: boolean;
  database_configured: boolean;
  database_connected: boolean;
  postgis_enabled: boolean;
  smtp_configured: boolean;
  ai_demo_fallback_enabled: boolean;
  single_admin_mode?: boolean;
  missing_requirements: string[];
}

export interface CitizenDashboardSummary {
  user: UserProfile;
  total_complaints: number;
  open_complaints: number;
  resolved_complaints: number;
  documents_generated: number;
  phase_notice: string;
}

export interface AuditEventSummary {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AdminOverview {
  total_users: number;
  total_admins: number;
  total_citizens: number;
  total_complaints: number;
  recent_audit_events: AuditEventSummary[];
}

