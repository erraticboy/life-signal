import { motion } from "framer-motion";
import { Crosshair, ImagePlus, MapPin, Send, Trash2 } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { LocationPickerMap } from "../../components/maps/LocationPickerMap";
import { FloatingElement } from "../../components/motion/FloatingElement";
import { ScrollReveal3D } from "../../components/motion/ScrollReveal3D";
import { Tilt3DCard } from "../../components/motion/Tilt3DCard";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { StatusAlert } from "../../components/ui/StatusAlert";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../lib/api";
import { CATEGORY_OPTIONS, type ComplaintCategory } from "../../types/complaint";

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function RegisterComplaintPage() {
  const { profile, getIdToken } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ComplaintCategory>("pothole");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [contactEmail, setContactEmail] = useState(profile?.email ?? "");
  const [reportedAt, setReportedAt] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [latitude, setLatitude] = useState<number>(28.613939);
  const [longitude, setLongitude] = useState<number>(77.209021);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  const [locating, setLocating] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setError("Only JPG, JPEG, and PNG images are allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must not exceed 10 MB.");
      return;
    }

    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
  };

  const handleCaptureGps = () => {
    setError(null);
    setGeoNotice(null);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser. Click on the map or enter coordinates manually.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setLatitude(lat);
        setLongitude(lng);
        setGeoNotice(
          `Captured GPS coordinates (${lat}, ${lng}) with ~${Math.round(position.coords.accuracy)}m accuracy.`
        );
        setLocating(false);
      },
      (geoErr) => {
        setLocating(false);
        setError(
          geoErr.code === geoErr.PERMISSION_DENIED
            ? "Location permission denied. Click directly on the map or enter latitude/longitude manually."
            : "Unable to acquire GPS fix. Click on the map to pin the exact location."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 3) {
      setError("Complaint title must be at least 3 characters.");
      return;
    }
    if (description.trim().length < 10) {
      setError("Please describe the issue in at least 10 characters.");
      return;
    }
    if (address.trim().length < 3) {
      setError("Please enter an address or location landmark.");
      return;
    }
    if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
      setError("Latitude must be between -90 and 90.");
      return;
    }
    if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
      setError("Longitude must be between -180 and 180.");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Authentication session expired. Please sign in again.");
      }

      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("category", category);
      formData.append("latitude", String(latitude));
      formData.append("longitude", String(longitude));
      formData.append("address", address.trim());
      formData.append("contact_email", (contactEmail || profile?.email || "").trim());
      if (reportedAt) {
        formData.append("reported_at", new Date(reportedAt).toISOString());
      }
      if (photoFile) {
        formData.append("photo", photoFile);
      }

      const created = await apiClient.registerComplaint(token, formData);
      navigate(`/citizen/complaints/${created.id}/success`, {
        state: { complaint: created },
        replace: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit complaint.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout mode="citizen">
      <div className="max-w-4xl space-y-6">
        <FloatingElement amplitude={3} duration={6.5}>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
              Register Infrastructure Complaint
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Submit geo-tagged evidence to receive an official ReportLab PDF acknowledgment and tracking ID.
            </p>
          </div>
        </FloatingElement>

        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <StatusAlert variant="error">{error}</StatusAlert>
          </motion.div>
        )}
        {geoNotice && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <StatusAlert variant="success">{geoNotice}</StatusAlert>
          </motion.div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
          <ScrollReveal3D>
            <Tilt3DCard intensity={3} className="p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">Issue Details</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="c-title" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Complaint title *
                </label>
                <input
                  id="c-title"
                  type="text"
                  required
                  minLength={3}
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Large water-filled pothole outside main college gate"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="c-category" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Infrastructure problem category *
                </label>
                <select
                  id="c-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="c-datetime" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Observation date &amp; time *
                </label>
                <input
                  id="c-datetime"
                  type="datetime-local"
                  required
                  value={reportedAt}
                  onChange={(e) => setReportedAt(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="c-desc" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Detailed description *
                </label>
                <textarea
                  id="c-desc"
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe severity, traffic/pedestrian safety impact, and nearby landmarks..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="c-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Contact email *
                </label>
                <input
                  id="c-email"
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Official PDF acknowledgment email is always delivered to your authenticated account email (
                  <span className="font-mono">{profile?.email}</span>).
                </p>
              </div>
            </div>
          </Tilt3DCard>
          </ScrollReveal3D>

          <ScrollReveal3D delay={0.08}>
          <Tilt3DCard intensity={3} className="p-6 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                  Photograph Evidence (JPG, JPEG, PNG)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Embedded directly into your PDF acknowledgment and used by Vision AI.
                </p>
              </div>
              {photoPreviewUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={clearPhoto}>
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                  Remove photo
                </Button>
              )}
            </div>

            {!photoPreviewUrl ? (
              <label className="group flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center transition-all hover:border-blue-500 hover:bg-blue-50/40 cursor-pointer dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-cyan-400 dark:hover:bg-cyan-950/20">
                <FloatingElement amplitude={3} duration={4.5}>
                  <ImagePlus className="h-8 w-8 text-blue-600 dark:text-cyan-400" />
                </FloatingElement>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Click to upload infrastructure photograph
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  JPG, JPEG, or PNG up to 10 MB
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,.jpg,.jpeg,.png"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950"
              >
                <img
                  src={photoPreviewUrl}
                  alt="Complaint evidence preview"
                  className="max-h-72 w-full object-contain mx-auto"
                />
                <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-2 text-xs text-slate-600 dark:text-slate-400 flex justify-between">
                  <span className="font-mono">{photoFile?.name}</span>
                  <span>{photoFile ? `${(photoFile.size / 1024).toFixed(1)} KB` : ""}</span>
                </div>
              </motion.div>
            )}
          </Tilt3DCard>
          </ScrollReveal3D>

          <ScrollReveal3D delay={0.14}>
          <Card className="p-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-white flex items-center gap-2">
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    {locating && (
                      <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                    )}
                    <MapPin className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                  </span>
                  Location &amp; Interactive Map
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Capture GPS or click/drag the blue marker on OpenStreetMap to pinpoint the hazard.
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={handleCaptureGps} disabled={locating}>
                <Crosshair className={`h-4 w-4 ${locating ? "animate-spin" : ""}`} />
                {locating ? "Locating..." : "Use Current GPS"}
              </Button>
            </div>

            <LocationPickerMap
              latitude={latitude}
              longitude={longitude}
              onChange={(lat, lng) => {
                setLatitude(lat);
                setLongitude(lng);
              }}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-3">
                <label htmlFor="c-address" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Address / location name *
                </label>
                <input
                  id="c-address"
                  type="text"
                  required
                  minLength={3}
                  maxLength={320}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g., North Gate Bus Stop, Ring Road Sector 4"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="c-lat" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Latitude *
                </label>
                <input
                  id="c-lat"
                  type="number"
                  step="0.000001"
                  min={-90}
                  max={90}
                  required
                  value={latitude}
                  onChange={(e) => setLatitude(Number(e.target.value))}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="c-lng" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Longitude *
                </label>
                <input
                  id="c-lng"
                  type="number"
                  step="0.000001"
                  min={-180}
                  max={180}
                  required
                  value={longitude}
                  onChange={(e) => setLongitude(Number(e.target.value))}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>
          </Card>
          </ScrollReveal3D>

          <div className="flex justify-end gap-3">
            <Button type="submit" size="lg" disabled={submitting} className="shadow-lg shadow-blue-600/20 transition-transform hover:-translate-y-0.5">
              <Send className="h-4 w-4" />
              {submitting ? "Submitting & Generating PDF..." : "Submit Complaint"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

