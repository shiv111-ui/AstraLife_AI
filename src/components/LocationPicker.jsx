import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";


// Fix Leaflet marker icons in Vite
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

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

function LocationPicker({
  position,
  onLocationChange,
  onConfirm,
}) {
  const defaultPosition = [19.076, 72.8777]; // Mumbai fallback

  const latitude = position?.latitude;
  const longitude = position?.longitude;

  const hasValidPosition =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  const currentPosition = hasValidPosition
    ? [latitude, longitude]
    : defaultPosition;

  function DraggableMarker() {
    const map = useMapEvents({});

    useEffect(() => {
      map.setView(currentPosition, 15);
    }, [map, latitude, longitude]);

    return (
      <Marker
        position={currentPosition}
        draggable={true}
        eventHandlers={{
          dragend(event) {
            const marker = event.target;
            const location = marker.getLatLng();

            onLocationChange({
              latitude: location.lat,
              longitude: location.lng,
            });
          },
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">
          Confirm Pickup Location
        </h3>

        <p className="mt-1 text-sm text-slate-400">
          Click anywhere on the map or drag the marker to select the
          correct pickup location.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <MapContainer
          center={currentPosition}
          zoom={hasValidPosition ? 15 : 5}
          scrollWheelZoom={true}
          className="h-80 w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClickHandler onLocationChange={onLocationChange} />
          <DraggableMarker />
        </MapContainer>
      </div>

      {hasValidPosition && (
        <div className="rounded-lg border border-white/10 bg-slate-900 p-3">
          <p className="text-sm text-slate-300">
            <span className="font-semibold">Latitude:</span>{" "}
            {latitude.toFixed(6)}
          </p>

          <p className="mt-1 text-sm text-slate-300">
            <span className="font-semibold">Longitude:</span>{" "}
            {longitude.toFixed(6)}
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

export default LocationPicker;