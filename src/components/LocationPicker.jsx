import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix Leaflet marker icons in Vite
const defaultMarkerIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultMarkerIcon;

const DEFAULT_POSITION = [19.076, 72.8777]; // Mumbai fallback

function isValidLocation(position) {
  return (
    position != null &&
    Number.isFinite(position.latitude) &&
    Number.isFinite(position.longitude) &&
    position.latitude >= -90 &&
    position.latitude <= 90 &&
    position.longitude >= -180 &&
    position.longitude <= 180
  );
}

function MapClickHandler({ onLocationChange }) {
  useMapEvents({
    click(event) {
      onLocationChange({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  return null;
}

function DraggableMarker({
  position,
  onLocationChange,
  shouldCenter,
}) {
  const map = useMap();

  useEffect(() => {
    if (shouldCenter) {
      map.setView(position, 15);
    }
  }, [map, position[0], position[1], shouldCenter]);

  return (
    <Marker
      position={position}
      draggable
      eventHandlers={{
        dragend(event) {
          const location = event.target.getLatLng();

          onLocationChange({
            latitude: location.lat,
            longitude: location.lng,
          });
        },
      }}
    />
  );
}

export default function LocationPicker({
  position = null,
  onLocationChange,
  onConfirm,
}) {
  const hasValidPosition = isValidLocation(position);

  const currentPosition = hasValidPosition
    ? [position.latitude, position.longitude]
    : DEFAULT_POSITION;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">
          Confirm Pickup Location
        </h3>

        <p className="mt-1 text-sm text-slate-400">
          Click the map or drag the marker to select the correct pickup
          location.
        </p>
      </div>

      {!hasValidPosition && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Pickup location is not set. The map is showing Mumbai as a
          reference only. Select your actual pickup location before
          confirming.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10">
        <MapContainer
          center={currentPosition}
          zoom={hasValidPosition ? 15 : 5}
          scrollWheelZoom
          className="h-80 w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClickHandler onLocationChange={onLocationChange} />

          <DraggableMarker
            position={currentPosition}
            onLocationChange={onLocationChange}
            shouldCenter={hasValidPosition}
          />
        </MapContainer>
      </div>

      {hasValidPosition && (
        <div className="rounded-lg border border-white/10 bg-slate-900 p-3">
          <p className="text-sm text-slate-300">
            <span className="font-semibold">Latitude:</span>{" "}
            {position.latitude.toFixed(6)}
          </p>

          <p className="mt-1 text-sm text-slate-300">
            <span className="font-semibold">Longitude:</span>{" "}
            {position.longitude.toFixed(6)}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onConfirm}
        disabled={!hasValidPosition}
        className="w-full rounded-lg bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Confirm Pickup Location
      </button>
    </div>
  );
}