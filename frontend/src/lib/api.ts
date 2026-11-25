import type {
  AdminOverview,
  AuthSessionResponse,
  CitizenDashboardSummary,
  DevLoginResponse,
  SystemConfigStatus,
  UserProfile,
  UserRole,
} from "../types/auth";
import type {
  AdminAIAnalysisItem,
  AdminComplaintItem,
  CalibrationSummary,
  ComplaintDetail,
  ComplaintDocument,
  ComplaintItem,
  ComplaintStatus,
  DuplicateGroupItem,
  DuplicateReviewStatus,
  DuplicateScanResult,
  GeospatialMapData,
  MaintenanceAnalytics,
  PriorityLevel,
  PriorityQueueItem,
} from "../types/complaint";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:8000").replace(
  /\/$/,
  ""
);

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(
      0,
      `Cannot reach backend API at ${API_BASE_URL}. Start FastAPI with 'uvicorn app.main:app --reload'.`
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    if (data && typeof data === "object" && "detail" in data) {
      detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    }
    throw new ApiError(response.status, detail);
  }

  return data as T;
}

async function requestBlob(path: string, token: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Download failed with status ${response.status}`);
  }
  return response.blob();
}

export const apiClient = {
  getConfigStatus(): Promise<SystemConfigStatus> {
    return requestJson<SystemConfigStatus>("/api/v1/config/status");
  },

  devLogin(payload: { full_name: string; email: string; role: UserRole }): Promise<DevLoginResponse> {
    return requestJson<DevLoginResponse>("/api/v1/auth/dev-login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  syncAuthSession(token: string, fullName?: string): Promise<AuthSessionResponse> {
    return requestJson<AuthSessionResponse>(
      "/api/v1/auth/session",
      {
        method: "POST",
        body: JSON.stringify(fullName ? { full_name: fullName } : {}),
      },
      token
    );
  },

  getMyProfile(token: string): Promise<UserProfile> {
    return requestJson<UserProfile>("/api/v1/auth/me", { method: "GET" }, token);
  },

  updateMyProfile(token: string, fullName: string): Promise<UserProfile> {
    return requestJson<UserProfile>(
      "/api/v1/auth/me",
      {
        method: "PATCH",
        body: JSON.stringify({ full_name: fullName }),
      },
      token
    );
  },

  logoutSession(token: string, revokeAllDevices = false): Promise<{ status: string }> {
    return requestJson<{ status: string }>(
      `/api/v1/auth/logout?revoke_all_devices=${revokeAllDevices ? "true" : "false"}`,
      { method: "POST" },
      token
    );
  },

  getCitizenDashboard(token: string): Promise<CitizenDashboardSummary> {
    return requestJson<CitizenDashboardSummary>("/api/v1/citizen/dashboard", { method: "GET" }, token);
  },

  registerComplaint(token: string, formData: FormData): Promise<ComplaintItem> {
    return requestJson<ComplaintItem>(
      "/api/v1/complaints",
      {
        method: "POST",
        body: formData,
      },
      token
    );
  },

  listMyComplaints(
    token: string,
    filters?: { status?: string; category?: string; q?: string }
  ): Promise<ComplaintItem[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.category) params.set("category", filters.category);
    if (filters?.q) params.set("q", filters.q);
    const qs = params.toString();
    return requestJson<ComplaintItem[]>(`/api/v1/complaints${qs ? `?${qs}` : ""}`, { method: "GET" }, token);
  },

  getComplaintDetails(token: string, complaintId: string): Promise<ComplaintDetail> {
    return requestJson<ComplaintDetail>(`/api/v1/complaints/${complaintId}`, { method: "GET" }, token);
  },

  async downloadComplaintPdf(
    token: string,
    complaintId: string,
    complaintNumber?: string
  ): Promise<void> {
    const blob = await requestBlob(`/api/v1/complaints/${complaintId}/pdf`, token);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${complaintNumber || complaintId}-acknowledgment.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  async fetchComplaintImageUrl(token: string, complaintId: string): Promise<string> {
    const blob = await requestBlob(`/api/v1/complaints/${complaintId}/image`, token);
    return URL.createObjectURL(blob);
  },

  resendComplaintEmail(token: string, complaintId: string): Promise<ComplaintDocument> {
    return requestJson<ComplaintDocument>(
      `/api/v1/complaints/${complaintId}/resend-email`,
      { method: "POST" },
      token
    );
  },

  getAdminOverview(token: string): Promise<AdminOverview> {
    return requestJson<AdminOverview>("/api/v1/admin/overview", { method: "GET" }, token);
  },

  listAdminUsers(token: string, roleFilter?: UserRole | "all"): Promise<UserProfile[]> {
    const query = roleFilter && roleFilter !== "all" ? `?role=${roleFilter}` : "";
    return requestJson<UserProfile[]>(`/api/v1/admin/users${query}`, { method: "GET" }, token);
  },

  updateUserRole(
    token: string,
    userId: string,
    payload: { role: UserRole; is_active?: boolean }
  ): Promise<UserProfile> {
    return requestJson<UserProfile>(
      `/api/v1/admin/users/${userId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      token
    );
  },

  listAdminComplaints(
    token: string,
    filters?: { status?: string; category?: string; q?: string }
  ): Promise<AdminComplaintItem[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.category) params.set("category", filters.category);
    if (filters?.q) params.set("q", filters.q);
    const qs = params.toString();
    return requestJson<AdminComplaintItem[]>(
      `/api/v1/admin/complaints${qs ? `?${qs}` : ""}`,
      { method: "GET" },
      token
    );
  },

  updateAdminComplaintStatus(
    token: string,
    complaintId: string,
    payload: { status: ComplaintStatus; notes?: string }
  ): Promise<ComplaintItem> {
    return requestJson<ComplaintItem>(
      `/api/v1/admin/complaints/${complaintId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      token
    );
  },

  listAdminAIAnalyses(token: string, needsVerification?: boolean): Promise<AdminAIAnalysisItem[]> {
    const query =
      needsVerification === undefined ? "" : `?needs_verification=${needsVerification ? "true" : "false"}`;
    return requestJson<AdminAIAnalysisItem[]>(`/api/v1/admin/ai/analyses${query}`, { method: "GET" }, token);
  },

  analyzePendingWithAI(
    token: string
  ): Promise<{ processed_count: number; skipped_model_unavailable: number; analyses: AdminAIAnalysisItem[] }> {
    return requestJson(
      "/api/v1/admin/ai/analyze-pending",
      { method: "POST" },
      token
    );
  },

  analyzeSingleComplaintWithAI(
    token: string,
    complaintId: string
  ): Promise<{ status: string; detail: string }> {
    return requestJson(
      `/api/v1/admin/ai/analyze/${complaintId}`,
      { method: "POST" },
      token
    );
  },

  verifyAIPrediction(
    token: string,
    analysisId: string,
    payload: { verified_category: string; notes?: string }
  ): Promise<AdminAIAnalysisItem> {
    return requestJson<AdminAIAnalysisItem>(
      `/api/v1/admin/ai/analyses/${analysisId}/verify`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      token
    );
  },

  getCalibrationSummary(token: string): Promise<CalibrationSummary> {
    return requestJson<CalibrationSummary>("/api/v1/admin/ai/calibration-summary", { method: "GET" }, token);
  },

  listAdminDuplicates(token: string, reviewStatus?: DuplicateReviewStatus | ""): Promise<DuplicateGroupItem[]> {
    const query = reviewStatus ? `?review_status=${reviewStatus}` : "";
    return requestJson<DuplicateGroupItem[]>(`/api/v1/admin/duplicates${query}`, { method: "GET" }, token);
  },

  scanAdminDuplicates(token: string, threshold?: number): Promise<DuplicateScanResult> {
    return requestJson<DuplicateScanResult>(
      "/api/v1/admin/duplicates/scan",
      {
        method: "POST",
        body: JSON.stringify(threshold !== undefined ? { threshold } : {}),
      },
      token
    );
  },

  reviewDuplicateGroup(
    token: string,
    groupId: string,
    reviewStatus: DuplicateReviewStatus
  ): Promise<DuplicateGroupItem> {
    return requestJson<DuplicateGroupItem>(
      `/api/v1/admin/duplicates/${groupId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ review_status: reviewStatus }),
      },
      token
    );
  },

  getGeospatialMapData(
    token: string,
    params?: {
      start_date?: string;
      end_date?: string;
      category?: string;
      status?: string;
      priority_level?: string;
      location_query?: string;
      eps_meters?: number;
      min_samples?: number;
    }
  ): Promise<GeospatialMapData> {
    const qs = new URLSearchParams();
    if (params?.start_date) qs.set("start_date", params.start_date);
    if (params?.end_date) qs.set("end_date", params.end_date);
    if (params?.category) qs.set("category", params.category);
    if (params?.status) qs.set("status", params.status);
    if (params?.priority_level) qs.set("priority_level", params.priority_level);
    if (params?.location_query) qs.set("location_query", params.location_query);
    if (params?.eps_meters !== undefined) qs.set("eps_meters", String(params.eps_meters));
    if (params?.min_samples !== undefined) qs.set("min_samples", String(params.min_samples));
    const suffix = qs.toString();
    return requestJson<GeospatialMapData>(
      `/api/v1/admin/geospatial/map${suffix ? `?${suffix}` : ""}`,
      { method: "GET" },
      token
    );
  },

  getPriorityQueue(token: string): Promise<PriorityQueueItem[]> {
    return requestJson<PriorityQueueItem[]>("/api/v1/admin/priority/queue", { method: "GET" }, token);
  },

  recomputePriorities(
    token: string
  ): Promise<{ updated_count: number; queue: PriorityQueueItem[] }> {
    return requestJson("/api/v1/admin/priority/recompute", { method: "POST" }, token);
  },

  overrideComplaintPriority(
    token: string,
    complaintId: string,
    payload: { priority_score: number; priority_level: PriorityLevel; rationale: string }
  ): Promise<PriorityQueueItem> {
    return requestJson<PriorityQueueItem>(
      `/api/v1/admin/complaints/${complaintId}/priority`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      token
    );
  },

  getMaintenanceAnalytics(token: string): Promise<MaintenanceAnalytics> {
    return requestJson<MaintenanceAnalytics>("/api/v1/admin/maintenance/analytics", { method: "GET" }, token);
  },

  async downloadAdminExport(
    token: string,
    format: "csv" | "json" | "pdf",
    filters?: { status?: string; category?: string }
  ): Promise<void> {
    const qs = new URLSearchParams();
    if (filters?.status) qs.set("status", filters.status);
    if (filters?.category) qs.set("category", filters.category);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const endpoint =
      format === "csv"
        ? `/api/v1/admin/exports/complaints.csv${suffix}`
        : format === "json"
          ? `/api/v1/admin/exports/complaints.json${suffix}`
          : `/api/v1/admin/exports/summary.pdf`;
    const filename =
      format === "csv"
        ? "life-signal-complaints.csv"
        : format === "json"
          ? "life-signal-complaints.json"
          : "life-signal-executive-report.pdf";
    const blob = await requestBlob(endpoint, token);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
