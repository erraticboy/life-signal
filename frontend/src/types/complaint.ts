export type ComplaintCategory =
  | "pothole"
  | "road_crack"
  | "garbage_accumulation"
  | "broken_streetlight"
  | "water_leakage"
  | "damaged_public_infrastructure"
  | "open_or_damaged_manhole";

export type ComplaintStatus =
  | "submitted"
  | "under_review"
  | "verified"
  | "in_progress"
  | "resolved"
  | "rejected";

export type PriorityLevel = "low" | "medium" | "high" | "critical";

export type EmailDeliveryStatus = "pending" | "sent" | "failed" | "not_configured";

export type DuplicateReviewStatus = "pending" | "confirmed_duplicate" | "dismissed";

export interface BoundingBoxItem {
  label: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface AIAnalysisItem {
  id: string;
  complaint_id: string;
  predicted_category: string;
  confidence: number;
  uncertainty_score: number;
  calibrated_confidence: number | null;
  requires_human_verification: boolean;
  bounding_boxes: BoundingBoxItem[] | null;
  is_demo_mode: boolean;
  model_version: string;
  processing_time: number;
  analyzed_at: string;
}

export interface AdminAIAnalysisItem extends AIAnalysisItem {
  complaint_number: string;
  complaint_title: string;
  citizen_category: string;
  has_image: boolean;
}

export interface ReliabilityBinItem {
  bin_index: number;
  bin_lower: number;
  bin_upper: number;
  count: number;
  avg_confidence: number;
  accuracy: number;
  gap: number;
}

export interface CalibrationSummary {
  available: boolean;
  detail: string;
  ece: number | null;
  mce: number | null;
  brier_score: number | null;
  sample_count: number;
  bins: ReliabilityBinItem[];
}

export interface DuplicateComplaintPreview {
  id: string;
  complaint_number: string;
  title: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  status: string;
  has_image: boolean;
  created_at: string;
}

export interface DuplicateGroupItem {
  id: string;
  similarity_score: number;
  image_similarity: number | null;
  text_similarity: number | null;
  distance_meters: number | null;
  time_diff_hours: number | null;
  review_status: DuplicateReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  primary_complaint: DuplicateComplaintPreview;
  related_complaint: DuplicateComplaintPreview;
}

export interface DuplicateScanResult {
  candidates_found: number;
  text_backend: string;
  image_backend: string;
  groups: DuplicateGroupItem[];
}

export interface ComplaintDocument {
  id: string;
  complaint_id: string;
  tracking_url: string;
  email_delivery_status: EmailDeliveryStatus;
  email_recipient: string;
  email_error: string | null;
  generated_at: string;
  sent_at: string | null;
}

export interface ComplaintHistoryItem {
  id: string;
  previous_status: ComplaintStatus | null;
  new_status: ComplaintStatus;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface ComplaintItem {
  id: string;
  complaint_number: string;
  user_id: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  has_image: boolean;
  latitude: number;
  longitude: number;
  address: string;
  contact_email: string;
  reported_at: string;
  status: ComplaintStatus;
  priority_score: number | null;
  priority_level: PriorityLevel | null;
  created_at: string;
  updated_at: string;
  document: ComplaintDocument | null;
}

export interface ComplaintDetail extends ComplaintItem {
  reporter_name: string;
  reporter_email: string;
  history: ComplaintHistoryItem[];
  ai_analysis: AIAnalysisItem | null;
}

export interface AdminComplaintItem extends ComplaintItem {
  reporter_name: string;
  reporter_email: string;
}

export const CATEGORY_OPTIONS: Array<{ value: ComplaintCategory; label: string }> = [
  { value: "pothole", label: "Road Pothole" },
  { value: "road_crack", label: "Road Crack" },
  { value: "garbage_accumulation", label: "Garbage Accumulation" },
  { value: "broken_streetlight", label: "Broken Streetlight" },
  { value: "water_leakage", label: "Water Leakage" },
  { value: "damaged_public_infrastructure", label: "Damaged Public Infrastructure" },
  { value: "open_or_damaged_manhole", label: "Open or Damaged Manhole" },
];

export const CATEGORY_LABEL_MAP: Record<ComplaintCategory, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((opt) => [opt.value, opt.label])
) as Record<ComplaintCategory, string>;

export const STATUS_OPTIONS: Array<{ value: ComplaintStatus; label: string }> = [
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "verified", label: "Verified" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
];

export const STATUS_TONE_MAP: Record<
  ComplaintStatus,
  "blue" | "cyan" | "amber" | "emerald" | "rose" | "neutral"
> = {
  submitted: "blue",
  under_review: "amber",
  verified: "cyan",
  in_progress: "amber",
  resolved: "emerald",
  rejected: "rose",
};

export interface MapComplaintPoint {
  id: string;
  complaint_number: string;
  title: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  priority_score: number | null;
  priority_level: PriorityLevel | null;
  latitude: number;
  longitude: number;
  address: string;
  reported_at: string;
  cluster_id: number;
  ai_predicted_category: string | null;
  ai_requires_verification: boolean | null;
}

export interface HotspotClusterItem {
  cluster_id: number;
  centroid_latitude: number;
  centroid_longitude: number;
  radius_meters: number;
  complaint_count: number;
  dominant_category: string;
  avg_priority_score: number | null;
  complaint_numbers: string[];
  complaint_ids: string[];
}

export interface MapDuplicateLink {
  group_id: string;
  review_status: string;
  similarity_score: number;
  from_coords: [number, number];
  to_coords: [number, number];
  primary_number: string;
  related_number: string;
}

export interface GeospatialMapData {
  total_points: number;
  hotspot_count: number;
  complaints: MapComplaintPoint[];
  hotspots: HotspotClusterItem[];
  duplicate_links: MapDuplicateLink[];
}

export interface PriorityFactor {
  factor: string;
  contribution: number;
  max_points: number;
  rationale: string;
}

export interface PriorityExplanation {
  summary: string;
  verification_caveat: string | null;
  factors: PriorityFactor[];
  overridden_by_admin: boolean;
}

export interface PriorityQueueItem {
  id: string;
  complaint_number: string;
  title: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  address: string;
  priority_score: number | null;
  priority_level: PriorityLevel | null;
  priority_explanation: PriorityExplanation | null;
  reported_at: string;
}

export interface MaintenanceAnalytics {
  total_complaints: number;
  category_distribution: Array<{ category: string; raw_category: string; count: number }>;
  status_distribution: Array<{ status: string; raw_status: string; count: number }>;
  priority_distribution: Array<{ priority: string; count: number }>;
  recurring_locations: Array<{
    address: string;
    report_count: number;
    dominant_category: string;
    latest_reported_at: string;
  }>;
  historical_weekly_series: Array<{
    period_start: string;
    actual_complaints: number;
    is_forecast: boolean;
  }>;
  avg_resolution_hours: number | null;
  forecast_available: boolean;
  forecast_detail: string;
  model_name: string | null;
  cv_mae: number | null;
  cv_rmse: number | null;
  forecast_horizon_weeks: Array<{
    period_start: string;
    predicted_complaints: number;
    is_forecast: boolean;
  }>;
}

