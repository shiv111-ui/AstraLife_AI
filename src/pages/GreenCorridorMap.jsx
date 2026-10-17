import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../assets/firebase";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle,
  useMap,
} from "react-leaflet";
import L from "leaflet";

import "leaflet/dist/leaflet.css";
import { getRoute } from "../api/routing.js";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = defaultIcon;

const patientIcon = L.divIcon({
  className: "astralife-patient-marker",
  html: `<div style="width:38px;height:38px;border-radius:50%;background:#dc2626;border:3px solid white;box-shadow:0 0 0 6px rgba(220,38,38,.2);display:flex;align-items:center;justify-content:center;color:white;font-size:19px;font-weight:bold">P</div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

const ambulanceIcon = L.divIcon({
  className: "astralife-ambulance-marker",
  html: `<div style="width:44px;height:44px;border-radius:50%;background:#0891b2;border:3px solid white;box-shadow:0 0 0 6px rgba(8,145,178,.2);display:flex;align-items:center;justify-content:center;font-size:24px">🚑</div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

const hospitalIcon = L.divIcon({
  className: "astralife-hospital-marker",
  html: `<div style="width:38px;height:38px;border-radius:10px;background:#059669;border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:white;font-size:23px;font-weight:bold">+</div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

function validCoordinates(location) {
  if (!location) return false;

  const latitude = Number(location.latitude ?? location.lat ?? location._lat);
  const longitude = Number(location.longitude ?? location.lng ?? location.lon ?? location._long);

  return (
    (location.latitude != null || location.lat != null || location._lat != null) &&
    (location.longitude != null || location.lng != null || location.lon != null || location._long != null) &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function toPosition(location) {
  return [Number(location.latitude ?? location.lat ?? location._lat), Number(location.longitude ?? location.lng ?? location.lon ?? location._long)];
}

function MapViewport({ patient, ambulance, hospital, hospitals }) {
  const map = useMap();

  useEffect(() => {
    const locations = [];

    [patient, ambulance, hospital].forEach((location) => {
      if (validCoordinates(location)) {
        locations.push(toPosition(location));
      }
    });

    hospitals.forEach((item) => {
      const location = item.location || item.coordinates || item;
      if (validCoordinates(location)) {
        locations.push(toPosition(location));
      }
    });

    if (locations.length > 1) {
      map.fitBounds(locations, {
        padding: [40, 40],
        maxZoom: 14,
        animate: true,
      });
    } else if (locations.length === 1) {
      map.setView(locations[0], 14, { animate: true });
    }
  }, [map, patient, ambulance, hospital, hospitals]);

  return null;
}

export default function GreenCorridorMap({
  ambulance = null,
  patient = null,
  hospital = null,
  hospitals = [],
  ambulanceId = null,
  hospitalId = null,
}) {
  const [route, setRoute] = useState(null);
  const [liveAmbulance, setLiveAmbulance] = useState(null);
  const [gpsUpdatedAt, setGpsUpdatedAt] = useState(null);
  const [routeError, setRouteError] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);

  // Subscribe to the same Firestore GPS collection used by the ambulance dashboard.
  // The latest published GPS position takes precedence over any cached/static coordinates.
  useEffect(() => {
    if (!ambulanceId) {
      setLiveAmbulance(null);
      setGpsUpdatedAt(null);
      return undefined;
    }

    const gpsQuery = query(
      collection(db, "Ambulance_Locations"),
      where("ambulanceId", "==", String(ambulanceId))
    );

    return onSnapshot(gpsQuery, (snapshot) => {
      if (snapshot.empty) {
        setLiveAmbulance(null);
        setGpsUpdatedAt(null);
        return;
      }

      const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      records.sort((a, b) => {
        const time = (value) => value?.toMillis?.() ?? (new Date(value || 0).getTime() || 0);
        return time(b.updatedAt || b.timestamp) - time(a.updatedAt || a.timestamp);
      });
      const latest = records[0];
      const location = latest.location || latest.coordinates || latest;
      const coords = {
        latitude: Number(location.latitude ?? location.lat),
        longitude: Number(location.longitude ?? location.lng ?? location.lon),
      };
      if (Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude) && Math.abs(coords.latitude) <= 90 && Math.abs(coords.longitude) <= 180) {
        setLiveAmbulance(coords);
        setGpsUpdatedAt(latest.updatedAt || latest.timestamp || null);
      }
    }, (error) => {
      console.error("Live ambulance GPS map subscription failed:", error);
    });
  }, [ambulanceId]);

  const effectiveAmbulance = liveAmbulance || ambulance;
  const matchedHospital = useMemo(() => {
    if (hospital && validCoordinates(hospital)) return hospital;
    if (!hospitalId) return null;
    return hospitals.find((item) =>
      String(item.id || item.hospitalId || "") === String(hospitalId) ||
      String(item.name || item.hospitalName || "").toLowerCase() === String(hospitalId).toLowerCase()
    ) || null;
  }, [hospital, hospitalId, hospitals]);
  const resolvedHospital = matchedHospital?.location || matchedHospital?.coordinates || matchedHospital;

  const patientLat = patient?.latitude;
  const patientLng = patient?.longitude;
  const ambulanceLat = effectiveAmbulance?.latitude ?? effectiveAmbulance?.lat;
  const ambulanceLng = effectiveAmbulance?.longitude ?? effectiveAmbulance?.lng;

  const patientValid = validCoordinates({
    latitude: patientLat,
    longitude: patientLng,
  });

  const ambulanceValid = validCoordinates({
    latitude: ambulanceLat,
    longitude: ambulanceLng,
  });

  const hospitalValid = validCoordinates(resolvedHospital);
  const destination = hospitalValid ? resolvedHospital : patient;
  const destinationValid = validCoordinates(destination);
  const destinationLat = destination?.latitude ?? destination?.lat;
  const destinationLng = destination?.longitude ?? destination?.lng ?? destination?.lon;

  useEffect(() => {
    let cancelled = false;

    async function loadRoute() {
      if (!destinationValid || !ambulanceValid) {
        setRoute(null);
        setRouteError("");
        setRouteLoading(false);
        return;
      }

      setRouteLoading(true);

      try {
        const result = await getRoute(
          Number(ambulanceLat),
          Number(ambulanceLng),
          Number(destinationLat),
          Number(destinationLng)
        );

        if (!cancelled) {
          setRoute(result);
          setRouteError("");
        }
      } catch (error) {
        if (!cancelled) {
          setRoute(null);
          setRouteError(
            error.message || "Unable to calculate the road route."
          );
        }
      } finally {
        if (!cancelled) setRouteLoading(false);
      }
    }

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [
    patientValid,
    ambulanceValid,
    patientLat,
    patientLng,
    ambulanceLat,
    ambulanceLng,
    destinationValid,
    destinationLat,
    destinationLng,
    hospitalId,
  ]);

  const initialCenter = patientValid
    ? toPosition({ latitude: patientLat, longitude: patientLng })
    : ambulanceValid
      ? toPosition({ latitude: ambulanceLat, longitude: ambulanceLng })
      : hospitalValid
        ? toPosition(resolvedHospital)
        : [19.0946, 74.7384];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-xl">
      <div className="border-b border-slate-800 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white sm:text-xl">
              Live Emergency Tracking
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Patient, ambulance and hospital locations
            </p>
          </div>

          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
            Live Map
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-xs text-slate-500">Road Distance</p>
            <p className="mt-1 text-xl font-bold text-cyan-300">
              {route ? `${route.distanceKm} km` : "--"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-xs text-slate-500">Estimated Travel Time</p>
            <p className="mt-1 text-xl font-bold text-emerald-300">
              {route ? `${route.durationMinutes} min` : "--"}
            </p>
          </div>
        </div>

        {routeLoading && (
          <p className="mt-3 text-sm text-cyan-300">
            Calculating road route...
          </p>
        )}

        {routeError && (
          <p className="mt-3 text-sm text-amber-300">{routeError}</p>
        )}

        {!patientValid && !hospitalValid && (
          <p className="mt-3 text-sm text-amber-300">Waiting for patient or assigned hospital coordinates.</p>
        )}

        {!ambulanceValid && (
          <p className="mt-3 text-sm text-slate-400">Waiting for ambulance GPS coordinates.</p>
        )}

        {route && <p className="mt-3 text-xs text-slate-400">Road route: {hospitalValid ? "ambulance → assigned hospital" : "ambulance → emergency location"}</p>}
      </div>

      <MapContainer
        center={initialCenter}
        zoom={13}
        scrollWheelZoom
        style={{ height: "430px", width: "100%", background: "#0f172a" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapViewport
          patient={patientValid ? patient : null}
          ambulance={ambulanceValid ? effectiveAmbulance : null}
          hospital={hospitalValid ? resolvedHospital : null}
          hospitals={hospitals}
        />

        {patientValid && (
          <>
            <Circle
              center={toPosition(patient)}
              radius={40}
              pathOptions={{
                color: "#ef4444",
                fillColor: "#ef4444",
                fillOpacity: 0.12,
                weight: 1,
              }}
            />

            <Marker position={toPosition(patient)} icon={patientIcon}>
              <Popup>
                <strong>Emergency Location</strong>
                <br />
                Patient GPS position
              </Popup>
            </Marker>
          </>
        )}

        {ambulanceValid && (
          <Marker position={toPosition(effectiveAmbulance)} icon={ambulanceIcon}>
            <Popup>
              <strong>Assigned Ambulance</strong>
              <br />
              {liveAmbulance ? "Live Firestore GPS position" : "Last available ambulance position"}
              {gpsUpdatedAt && <><br />Updated: {gpsUpdatedAt?.toDate?.()?.toLocaleTimeString?.() || "recently"}</>}
            </Popup>
          </Marker>
        )}

        {hospitals
          .filter((item) => validCoordinates(item.location || item.coordinates || item))
          .map((item) => (
            <Marker
              key={item.id || item.hospitalId}
              position={toPosition(item.location || item.coordinates || item)}
              icon={hospitalIcon}
            >
              <Popup>
                <strong>
                  {item.name || item.hospitalName || item.hospital_name || "Hospital"}
                </strong>
                <br />
                {item.address || "Ahilyanagar"}
                <br />
                <span style={{ color: "#b45309", fontWeight: 600 }}>
                  {item.isDemoLocation ||
                  item.location?.isDemo ||
                  item.locationSource === "DEMO_GENERATED"
                    ? "DEMO LOCATION — not verified for real dispatch"
                    : "Hospital location"}
                </span>
              </Popup>
            </Marker>
          ))}

        {hospitalValid && (
          <Marker position={toPosition(resolvedHospital)} icon={hospitalIcon}>
            <Popup>
              <strong>{matchedHospital?.name || matchedHospital?.hospitalName || "Assigned Hospital"}</strong>
              <br />
              Destination
              {(matchedHospital?.isDemoLocation || matchedHospital?.locationSource === "DEMO_GENERATED" || matchedHospital?.location?.isDemo) && <><br /><strong style={{ color: "#b45309" }}>Demo location — not verified</strong></>}
            </Popup>
          </Marker>
        )}

        {route?.coordinates?.length > 1 && (
          <>
            <Polyline
              positions={route.coordinates}
              pathOptions={{
                color: "#ffffff",
                weight: 9,
                opacity: 0.75,
              }}
            />
            <Polyline
              positions={route.coordinates}
              pathOptions={{
                color: "#16a34a",
                weight: 6,
                opacity: 1,
              }}
            />
          </>
        )}
      </MapContainer>

      <div className="flex flex-wrap gap-x-5 gap-y-3 border-t border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
            P
          </span>
          Patient
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="text-lg">🚑</span>
          Ambulance
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-600 font-bold text-white">
            +
          </span>
          Hospital
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="h-1 w-6 rounded bg-green-500" />
          Road Route
        </div>
      </div>
    </section>
  );
}