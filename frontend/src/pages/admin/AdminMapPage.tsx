import { motion } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Filter, Layers, MapPin, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { AnimatedCounter } from "../../components/motion/AnimatedCounter";
import { FloatingElement } from "../../components/motion/FloatingElement";
import { ScrollReveal3D } from "../../components/motion/ScrollReveal3D";
import { Tilt3DCard } from "../../components/motion/Tilt3DCard";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { StatusAlert } from "../../components/ui/StatusAlert";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../lib/api";
import {
  CATEGORY_LABEL_MAP,
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  type GeospatialMapData,
  type PriorityLevel,
} from "../../types/complaint";

function priorityColor(level: PriorityLevel | null): string {
  switch (level) {
    case "critical":
      return "#DC2626";
    case "high":
      return "#EA580C";
    case "medium":
      return "#2563EB";
    case "low":
      return "#10B981";
    default:
      return "#06B6D4";
  }
}

function makeMarkerIcon(level: PriorityLevel | null) {
  const color = priorityColor(level);
  return L.divIcon({
    className: "life-signal-cluster-pin",
    html: `<div style="width:18px;height:18px;border-radius:9999px;background:${color};border:2.5px solid #ffffff;box-shadow:0 2px 8px rgba(15,23,42,0.4);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export function AdminMapPage() {
  const { getIdToken } = useAuth();
  const [data, setData] = useState<GeospatialMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [epsMeters, setEpsMeters] = useState(250);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showDuplicates, setShowDuplicates] = useState(true);

  const loadMap = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await apiClient.getGeospatialMapData(token, {
        category: category || undefined,
        status: status || undefined,
        priority_level: priority || undefined,
        location_query: locationQuery.trim() || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : undefined,
        eps_meters: epsMeters,
      });
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load geospatial map data.");
    } finally {
      setLoading(false);
    }
  }, [getIdToken, category, status, priority, locationQuery, startDate, endDate, epsMeters]);

  useEffect(() => {
    void loadMap();
  }, [loadMap]);

  const defaultCenter: [number, number] =
    data && data.complaints.length > 0
      ? [data.complaints[0].latitude, data.complaints[0].longitude]
      : [28.613939, 77.209021];

  return (
    <DashboardLayout mode="admin">
      <div className="space-y-6">
        <FloatingElement amplitude={3} duration={6.5}>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                Interactive Infrastructure Map
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                PostGIS coordinates, DBSCAN hotspot zones, duplicate candidate links, and priority markers.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="blue">
                <MapPin className="h-3 w-3" />
                <AnimatedCounter value={data?.total_points ?? 0} /> Points
              </Badge>
              <Badge tone="cyan">
                <Layers className="h-3 w-3" />
                <AnimatedCounter value={data?.hotspot_count ?? 0} /> DBSCAN Hotspots
              </Badge>
              <Button size="sm" variant="secondary" onClick={() => void loadMap()} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </FloatingElement>

        {/* Filters */}
        <ScrollReveal3D>
          <Tilt3DCard intensity={3} className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            Geospatial &amp; Attribute Filters
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">All priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <input
              type="text"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              placeholder="Location / road..."
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Start date"
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="End date"
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-600 dark:text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showHotspots}
                onChange={(e) => setShowHotspots(e.target.checked)}
              />
              Show DBSCAN Hotspot Zones
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showDuplicates}
                onChange={(e) => setShowDuplicates(e.target.checked)}
              />
              Show Duplicate Links
            </label>
            <label className="flex items-center gap-2">
              <span>DBSCAN Radius (m):</span>
              <input
                type="number"
                min={50}
                max={3000}
                step={50}
                value={epsMeters}
                onChange={(e) => setEpsMeters(Number(e.target.value) || 250)}
                className="h-7 w-20 rounded border border-slate-200 bg-white px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
          </div>
          </Tilt3DCard>
        </ScrollReveal3D>

        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <StatusAlert variant="error">{error}</StatusAlert>
          </motion.div>
        )}

        <ScrollReveal3D delay={0.08}>
          <Card className="overflow-hidden glass-panel">
          <div className="h-[540px] w-full">
            <MapContainer
              key={`${defaultCenter[0]}-${defaultCenter[1]}-${data?.total_points ?? 0}`}
              center={defaultCenter}
              zoom={13}
              className="h-full w-full z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {showHotspots &&
                data?.hotspots.map((hs) => (
                  <Circle
                    key={`hs-${hs.cluster_id}`}
                    center={[hs.centroid_latitude, hs.centroid_longitude]}
                    radius={hs.radius_meters}
                    pathOptions={{
                      color: "#06B6D4",
                      fillColor: "#06B6D4",
                      fillOpacity: 0.16,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="text-xs space-y-1">
                        <div className="font-bold">DBSCAN Hotspot #{hs.cluster_id + 1}</div>
                        <div>Reports: {hs.complaint_count}</div>
                        <div>Dominant: {hs.dominant_category.replace(/_/g, " ")}</div>
                        {hs.avg_priority_score !== null && (
                          <div>Avg Priority: {hs.avg_priority_score}/100</div>
                        )}
                      </div>
                    </Popup>
                  </Circle>
                ))}

              {showDuplicates &&
                data?.duplicate_links.map((lnk) => (
                  <Polyline
                    key={lnk.group_id}
                    positions={[lnk.from_coords, lnk.to_coords]}
                    pathOptions={{
                      color: lnk.review_status === "confirmed_duplicate" ? "#F59E0B" : "#94A3B8",
                      dashArray: "6 6",
                      weight: 2.5,
                    }}
                  >
                    <Popup>
                      <div className="text-xs space-y-1">
                        <div className="font-bold">
                          Duplicate Link ({(lnk.similarity_score * 100).toFixed(0)}%)
                        </div>
                        <div>
                          {lnk.primary_number} ↔ {lnk.related_number}
                        </div>
                        <div>Status: {lnk.review_status.replace(/_/g, " ")}</div>
                      </div>
                    </Popup>
                  </Polyline>
                ))}

              {data?.complaints.map((pt) => (
                <Marker
                  key={pt.id}
                  position={[pt.latitude, pt.longitude]}
                  icon={makeMarkerIcon(pt.priority_level)}
                >
                  <Popup>
                    <div className="text-xs space-y-1.5 min-w-[180px]">
                      <div className="font-mono font-bold text-blue-600">{pt.complaint_number}</div>
                      <div className="font-semibold text-slate-900">{pt.title}</div>
                      <div className="text-slate-600">{CATEGORY_LABEL_MAP[pt.category]}</div>
                      <div className="text-slate-500">{pt.address}</div>
                      <div>
                        Status: <strong>{pt.status.replace(/_/g, " ")}</strong>
                      </div>
                      {pt.priority_score !== null && (
                        <div>
                          Priority:{" "}
                          <strong className="uppercase">
                            {pt.priority_level} ({pt.priority_score})
                          </strong>
                        </div>
                      )}
                      <Link
                        to={`/citizen/complaints/${pt.id}`}
                        className="inline-block text-blue-600 font-medium hover:underline pt-1"
                      >
                        Open Record →
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300 flex flex-wrap gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Critical
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-600" /> High
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Medium
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Low
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border border-cyan-500 bg-cyan-400/30" /> DBSCAN Hotspot
            </span>
          </div>
          </Card>
        </ScrollReveal3D>
      </div>
    </DashboardLayout>
  );
}

