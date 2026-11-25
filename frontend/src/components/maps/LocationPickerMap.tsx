import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

const pinIcon = L.divIcon({
  className: "life-signal-map-pin",
  html: `<div style="width:26px;height:26px;border-radius:9999px;background:#2563EB;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(15,23,42,0.35);"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function MapViewportSync({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

interface LocationPickerMapProps {
  latitude: number;
  longitude: number;
  onChange?: (lat: number, lng: number) => void;
  interactive?: boolean;
  heightClass?: string;
}

export function LocationPickerMap({
  latitude,
  longitude,
  onChange,
  interactive = true,
  heightClass = "h-72",
}: LocationPickerMapProps) {
  return (
    <div className={`w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 ${heightClass}`}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={15}
        scrollWheelZoom={interactive}
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewportSync lat={latitude} lng={longitude} />
        {interactive && onChange && <ClickHandler onChange={onChange} />}
        <Marker
          position={[latitude, longitude]}
          icon={pinIcon}
          draggable={interactive && Boolean(onChange)}
          eventHandlers={
            interactive && onChange
              ? {
                  dragend(e) {
                    const pos = e.target.getLatLng();
                    onChange(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
                  },
                }
              : undefined
          }
        />
      </MapContainer>
    </div>
  );
}

