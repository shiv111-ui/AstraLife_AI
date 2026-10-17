import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Activity,
  Ambulance,
  AlertCircle,
  Clock3,
  Hospital,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  Radio,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { auth, db } from "../assets/firebase";
import { getRoute } from "../api/routing.js";
import { completeEmergency, updateEmergencyStatus } from "../api/dispatch.js";

const STATUS_STYLES = {
  Pending: "bg-slate-800 text-slate-300",
  Assigned: "bg-amber-100 text-amber-800",
  Accepted: "bg-sky-100 text-sky-800",
  "En Route": "bg-cyan-100 text-cyan-800",
  "At Scene": "bg-violet-100 text-violet-800",
  Transporting: "bg-indigo-100 text-indigo-800",
  "Patient Onboard": "bg-indigo-100 text-indigo-800",
  "At Hospital": "bg-emerald-100 text-emerald-800",
  Completed: "bg-emerald-100 text-emerald-800",
  Rejected: "bg-rose-100 text-rose-800",
};

const panel = "rounded-2xl border border-slate-800 bg-slate-900/80 shadow-sm";

function createMarkerIcon(color) {
  return L.divIcon({
    className: "astralife-map-marker",
    html: `<div style="width:18px;height:18px;border:3px solid white;border-radius:50%;background:${color};box-shadow:0 2px 10px #0f172a55"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const ambulanceIcon = createMarkerIcon("#0891b2");
const patientIcon = createMarkerIcon("#dc2626");
const hospitalIcon = createMarkerIcon("#16a34a");

function MapAutoFit({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points, { padding: [36, 36], maxZoom: 15 });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [map, points]);
  return null;
}

function getCoordinates(value) {
  if (!value) return null;
  const latitude = Number(value.latitude ?? value.lat);
  const longitude = Number(value.longitude ?? value.lng ?? value.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return [latitude, longitude];
}

function formatTimestamp(value) {
  const date = value?.toDate?.() ?? (value instanceof Date ? value : null);
  if (!date) return "Waiting for first update";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Field({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 gap-3">
      <span className="mt-0.5 rounded-lg bg-slate-800 p-2 text-slate-400"><Icon size={17} /></span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-slate-100">{value || "Not provided"}</p>
      </div>
    </div>
  );
}

export default function AmbulanceDashboard() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [ambulance, setAmbulance] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [missions, setMissions] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [gps, setGps] = useState(null);
  const [gpsError, setGpsError] = useState("");
  const [gpsSharing, setGpsSharing] = useState(false);
  const [gpsPublishStatus, setGpsPublishStatus] = useState("");
  const [missionRoadRoute, setMissionRoadRoute] = useState(null);
  const [missionRouteStatus, setMissionRouteStatus] = useState("");
  const [dataError, setDataError] = useState("");
  const [loadingMissions, setLoadingMissions] = useState(true);

  // Declare the selected mission before effects that reference it.
  const selectedMission = useMemo(() => missions.find((item) => item.id === selectedId) || null, [missions, selectedId]);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return;
      setAuthError("");
      if (!user) {
        setStaff(null);
        setAuthError("Please sign in with an authorized ambulance account.");
        setAuthLoading(false);
        return;
      }
      setAuthLoading(true);
      try {
        const snap = await getDoc(doc(db, "Staff", user.uid));
        if (!snap.exists()) throw new Error("Your Staff profile was not found.");
        const data = snap.data();
        if (data.role !== "ambulance" || data.active !== true) {
          throw new Error("This account is not an active ambulance account.");
        }
        if (!data.ambulanceId) throw new Error("No ambulance ID is linked to this account.");
        if (!cancelled) setStaff({ uid: user.uid, ...data, ambulanceId: String(data.ambulanceId).trim() });
      } catch (error) {
        console.error("Ambulance profile load failed:", error);
        if (!cancelled) setAuthError(error.message || "Could not load ambulance profile.");
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!staff?.ambulanceId) return undefined;
    setLoadingMissions(true);
    setDataError("");
    const ownVehicle = query(
      collection(db, "Ambulances"),
      where("ambulance_id", "==", staff.ambulanceId)
    );
    const stopVehicle = onSnapshot(
      ownVehicle,
      (snapshot) => setAmbulance(snapshot.docs[0]?.data() || null),
      (error) => console.error("Ambulance record read failed:", error)
    );
    const assigned = query(
      collection(db, "Emergency_Cases"),
      where("ambulanceId", "==", staff.ambulanceId)
    );
    const stopMissions = onSnapshot(assigned, (snapshot) => {
      const records = snapshot.docs.map((item) => {
        const data = item.data();
        const patientLocation = getCoordinates(data.location ?? data.patientLocation);
        const created = data.createdAt?.toDate?.();
        return {
          id: item.id,
          patient: data.patientName || data.PatientName || "Emergency patient",
          phone: data.phone || data.patientPhone || data.contactNumber || "",
          emergencyType: data.EmergencyType || data.emergencyType || data.type || "Medical emergency",
          severity: data.Priority || data.severity || data.Severity || "Not specified",
          status: data.Status || "Assigned",
          address: data.address || data.locationAddress || data.incidentAddress || data.location?.address || "Location shared by GPS",
          patientLocation,
          hospitalId: data.hospitalId || null,
          description: data.description || data.Description || "No additional details provided.",
          createdAt: created,
          createdLabel: formatTimestamp(data.createdAt),
        };
      });
      records.sort((a, b) => {
        const activeA = !["Completed", "Rejected"].includes(a.status);
        const activeB = !["Completed", "Rejected"].includes(b.status);
        return Number(activeB) - Number(activeA) || (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0);
      });
      setMissions(records);
      setSelectedId((current) => records.some((item) => item.id === current) ? current : (records.find((item) => !["Completed", "Rejected"].includes(item.status))?.id || records[0]?.id || ""));
      setLoadingMissions(false);
      setDataError("");
    }, (error) => {
      console.error("Assigned emergency subscription failed:", error);
      setDataError(error.code === "permission-denied"
        ? "Firestore denied access to assigned emergencies. Check the Emergency_Cases read rule for active ambulance staff."
        : "Could not load assigned emergencies. Please refresh and try again.");
      setLoadingMissions(false);
    });
    return () => { stopVehicle(); stopMissions(); };
  }, [staff?.ambulanceId]);

  // Read hospital locations for map context. Demo-generated locations are labeled in each popup.
  useEffect(() => {
    const stopHospitals = onSnapshot(collection(db, "Hospitals"), (snapshot) => {
      const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      setHospitals(items);
    }, (error) => {
      console.error("Hospital locations subscription failed:", error);
    });
    return () => stopHospitals();
  }, []);

  // Friend 2 publishes GPS records to Ambulance_Locations. This dashboard only reads them.
  useEffect(() => {
    if (!staff?.ambulanceId) return undefined;
    setGps(null);
    setGpsError("");
    const gpsQuery = query(
      collection(db, "Ambulance_Locations"),
      where("ambulanceId", "==", staff.ambulanceId)
    );
    const stopGps = onSnapshot(gpsQuery, (snapshot) => {
      if (snapshot.empty) {
        setGps(null);
        return;
      }
      const latest = snapshot.docs
        .map((item) => ({ ...item.data(), _id: item.id }))
        .sort((a, b) => {
          const aTime = a.updatedAt?.toMillis?.() ?? 0;
          const bTime = b.updatedAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        })[0];
      const coords = getCoordinates(latest.location ?? latest.coordinates ?? latest);
      setGps(coords ? { coords, updatedAt: latest.updatedAt || null, raw: latest } : null);
    }, (error) => {
      console.error("Ambulance GPS subscription failed:", error);
      setGpsError(error.code === "permission-denied"
        ? "Location sharing is not readable under the current Firestore rules."
        : "Live location is not available yet.");
    });
    return () => stopGps();
  }, [staff?.ambulanceId]);

  // Publish this device's physical GPS to the same collection consumed by all dashboards.
  useEffect(() => {
    if (!gpsSharing || !staff?.ambulanceId) return undefined;
    if (!navigator.geolocation) {
      setGpsPublishStatus("This browser does not support GPS.");
      setGpsSharing(false);
      return undefined;
    }

    let active = true;
    const watchId = navigator.geolocation.watchPosition(async (position) => {
      if (!active) return;
      const { latitude, longitude, accuracy, speed, heading } = position.coords;
      const payload = {
        ambulanceId: String(staff.ambulanceId),
        latitude,
        longitude,
        location: { latitude, longitude, accuracy: Math.round(accuracy || 0) },
        coordinates: { latitude, longitude },
        accuracy: Math.round(accuracy || 0),
        speed: Number.isFinite(speed) ? Math.round(speed * 3.6) : 0,
        heading: Number.isFinite(heading) ? heading : 0,
        status: selectedMission?.status || "Available",
        updatedAt: serverTimestamp(),
        timestamp: serverTimestamp(),
        source: "ambulance-dashboard-device-gps",
      };
      try {
        // Stable document ID plus ambulanceId field supports both direct and query listeners.
        await setDoc(doc(db, "Ambulance_Locations", String(staff.ambulanceId)), payload, { merge: true });
        if (active) setGpsPublishStatus(`GPS sharing active · ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      } catch (error) {
        console.error("Ambulance GPS publish failed:", error);
        if (active) setGpsPublishStatus(error.code === "permission-denied"
          ? "GPS captured, but Firestore rules denied publishing."
          : "GPS captured, but could not sync to Firestore.");
      }
    }, (error) => {
      if (active) setGpsPublishStatus(`GPS error: ${error.message}`);
    }, { enableHighAccuracy: true, maximumAge: 1500, timeout: 15000 });

    setGpsPublishStatus("Requesting device GPS permission…");
    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [gpsSharing, staff?.ambulanceId, selectedMission?.status]);


  // Calculate a real road-following route from the ambulance's latest GPS to the selected victim.
  useEffect(() => {
    let cancelled = false;
    const origin = gps?.coords;
    const destination = selectedMission?.patientLocation;
    if (!origin || !destination) {
      setMissionRoadRoute(null);
      setMissionRouteStatus("Waiting for ambulance and victim GPS to calculate the road route.");
      return undefined;
    }
    setMissionRouteStatus("Calculating road route to victim…");
    getRoute(origin[0], origin[1], destination[0], destination[1])
      .then((result) => {
        if (!cancelled) {
          setMissionRoadRoute(result);
          setMissionRouteStatus(`Road route: ${result.distanceKm} km · approximately ${result.durationMinutes} min`);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMissionRoadRoute(null);
          setMissionRouteStatus(error.message || "Road route is temporarily unavailable.");
        }
      });
    return () => { cancelled = true; };
  }, [gps?.coords?.[0], gps?.coords?.[1], selectedMission?.patientLocation?.[0], selectedMission?.patientLocation?.[1]]);
  const activeMissions = missions.filter((item) => !["Completed", "Rejected"].includes(item.status));
  const routeUrl = selectedMission?.patientLocation
    ? `https://www.google.com/maps/dir/?api=1${gps?.coords ? `&origin=${gps.coords[0]},${gps.coords[1]}` : ""}&destination=${selectedMission.patientLocation[0]},${selectedMission.patientLocation[1]}&travelmode=driving`
    : null;
  const hospitalMapPoints = hospitals
    .map((hospital) => getCoordinates(hospital.location ?? hospital.coordinates ?? hospital))
    .filter(Boolean);
  const mapPoints = [gps?.coords, selectedMission?.patientLocation, ...hospitalMapPoints].filter(Boolean);

  const handleLogout = async () => {
    try { await signOut(auth); navigate("/login", { replace: true }); }
    catch (error) { console.error("Logout failed:", error); }
  };

  const updateMissionStatus = async (mission, nextStatus) => {
    if (!mission || !staff?.ambulanceId) return;
    try {
      if (nextStatus === "Completed") {
        const result = await completeEmergency(mission.id, staff.ambulanceId);
        if (!result.success) throw new Error(result.message || "Could not complete this mission.");
        setDataError("");
        return;
      }
      const result = await updateEmergencyStatus(mission.id, staff.ambulanceId, nextStatus);
      if (!result.success) throw new Error(result.message || "Could not update this mission status.");
      setDataError("");
    } catch (error) {
      console.error("Mission status update failed:", error);
      setDataError(error.code === "permission-denied" ? "Firestore rules denied this status update. Only the assigned ambulance account should be allowed to update this mission." : error.message || "Could not update mission status.");
    }
  };

  if (authLoading) return <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-400"><div className="flex items-center gap-3"><RefreshCw className="animate-spin" /> Loading ambulance dashboard…</div></div>;
  if (authError) return <main className="grid min-h-screen place-items-center bg-slate-950 p-6"><section className={`${panel} max-w-lg p-8 text-center`}><AlertCircle className="mx-auto text-red-600" size={38} /><h1 className="mt-4 text-xl font-bold text-slate-100">Ambulance access unavailable</h1><p className="mt-2 text-sm text-slate-400">{authError}</p><button onClick={() => navigate("/login")} className="mt-6 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white">Back to login</button></section></main>;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-700 p-3 text-white"><Ambulance size={24} /></div>
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Astralife AI</p><h1 className="text-xl font-bold sm:text-2xl">Ambulance Dashboard</h1><p className="text-sm text-slate-400">Emergency mission and live location</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-xl bg-emerald-50 px-3 py-2 text-right sm:block"><p className="text-xs text-emerald-700">Signed in as</p><p className="text-sm font-bold text-emerald-900">{staff.ambulanceId}</p></div>
            <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"><LogOut size={16} /><span className="hidden sm:inline">Logout</span></button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {(dataError || gpsError) && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertCircle className="mt-0.5 shrink-0" size={18} /><div>{dataError || gpsError}</div></div>}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className={`${panel} p-5`}><div className="flex items-center justify-between"><p className="text-sm text-slate-400">Active assignments</p><Activity className="text-cyan-700" /></div><p className="mt-3 text-3xl font-bold">{activeMissions.length}</p><p className="mt-1 text-xs text-slate-400">Assigned to this ambulance</p></div>
          <div className={`${panel} p-5`}><div className="flex items-center justify-between"><p className="text-sm text-slate-400">Ambulance ID</p><Ambulance className="text-cyan-700" /></div><p className="mt-3 text-2xl font-bold">{staff.ambulanceId}</p><p className="mt-1 text-xs text-slate-400">Verified staff assignment</p></div>
          <div className={`${panel} p-5`}><div className="flex items-center justify-between"><p className="text-sm text-slate-400">GPS sharing</p>{gpsSharing ? <Wifi className="text-emerald-600" /> : <WifiOff className="text-amber-600" />}</div><p className="mt-3 text-xl font-bold">{gpsSharing ? "Sharing device GPS" : gps ? "Location received" : "Waiting for GPS"}</p><p className="mt-1 text-xs text-slate-400">{gps ? `Latest received ${formatTimestamp(gps.updatedAt)}` : "Enable GPS to publish this ambulance's location"}</p><button type="button" onClick={() => setGpsSharing((value) => !value)} className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-bold text-white ${gpsSharing ? "bg-rose-700 hover:bg-rose-800" : "bg-cyan-700 hover:bg-cyan-800"}`}>{gpsSharing ? "Stop GPS sharing" : "Start GPS sharing"}</button>{gpsPublishStatus && <p className="mt-2 text-xs text-slate-400">{gpsPublishStatus}</p>}</div>
          <div className={`${panel} p-5`}><div className="flex items-center justify-between"><p className="text-sm text-slate-400">Current mission</p><ShieldCheck className="text-cyan-700" /></div><p className="mt-3 text-xl font-bold">{selectedMission?.status || "No assignment"}</p><p className="mt-1 text-xs text-slate-400">Automatically follows assignment data</p></div>
        </section>

        <section className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className={`${panel} overflow-hidden`}>
            <div className="border-b border-slate-800 p-5"><h2 className="text-lg font-bold">Assigned victims</h2><p className="mt-1 text-sm text-slate-400">Assignments appear automatically when the control room assigns this ambulance.</p></div>
            {loadingMissions ? <div className="p-8 text-center text-sm text-slate-400"><RefreshCw className="mx-auto mb-3 animate-spin" />Loading assignments…</div> : missions.length === 0 ? <div className="p-8 text-center"><Ambulance className="mx-auto text-slate-300" size={34} /><p className="mt-3 font-semibold">No assigned emergencies</p><p className="mt-1 text-sm text-slate-400">This panel will update automatically when a case is assigned.</p></div> : <div className="divide-y divide-slate-800">{missions.map((mission) => <button key={mission.id} onClick={() => setSelectedId(mission.id)} className={`block w-full p-5 text-left transition hover:bg-slate-950 ${selectedId === mission.id ? "border-l-4 border-cyan-700 bg-cyan-50/70" : "border-l-4 border-transparent"}`}><div className="flex items-start justify-between gap-2"><p className="font-bold text-slate-100">{mission.patient}</p><span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${STATUS_STYLES[mission.status] || STATUS_STYLES.Assigned}`}>{mission.status}</span></div><p className="mt-1 text-sm text-slate-400">{mission.emergencyType}</p><p className="mt-3 flex items-center gap-2 text-xs text-slate-400"><MapPin size={14} />{mission.patientLocation ? "Location available" : "Location unavailable"}</p><p className="mt-1 flex items-center gap-2 text-xs text-slate-400"><Clock3 size={14} />{mission.createdLabel}</p></button>)}</div>}
          </aside>

          <div className="space-y-6">
            {selectedMission ? <>
              <section className={`${panel} p-5 sm:p-6`}>
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Mission details</p><h2 className="mt-1 text-2xl font-bold">{selectedMission.patient}</h2><p className="mt-1 text-sm text-slate-400">Emergency ID: {selectedMission.id}</p></div><span className={`rounded-full px-3 py-1.5 text-sm font-bold ${STATUS_STYLES[selectedMission.status] || STATUS_STYLES.Assigned}`}>{selectedMission.status}</span></div>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  <Field icon={Activity} label="Emergency type" value={selectedMission.emergencyType} />
                  <Field icon={AlertCircle} label="Severity / priority" value={selectedMission.severity} />
                  <Field icon={Clock3} label="Reported" value={selectedMission.createdLabel} />
                  <Field icon={Phone} label="Patient contact" value={selectedMission.phone || "Not provided"} />
                  <Field icon={MapPin} label="Incident location" value={selectedMission.address} />
                  <Field icon={Hospital} label="Assigned hospital" value={selectedMission.hospitalId || "Awaiting assignment"} />
                </div>
                <div className="mt-5 flex flex-wrap gap-2" aria-label="Emergency status actions">
                  {["Accepted", "En Route", "At Scene", "Transporting", "At Hospital", "Completed"].map((status) => (
                    <button key={status} type="button" disabled={selectedMission.status === status || ["Completed", "Rejected", "Cancelled", "Canceled"].includes(selectedMission.status)} onClick={() => updateMissionStatus(selectedMission, status)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">{status}</button>
                  ))}
                </div>
                {selectedMission.description && <div className="mt-5 rounded-xl bg-slate-950 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Additional details</p><p className="mt-2 text-sm leading-6 text-slate-300">{selectedMission.description}</p></div>}
              </section>

              <section className={`${panel} overflow-hidden`}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-5"><div><h2 className="flex items-center gap-2 text-lg font-bold"><MapPin className="text-red-600" /> Victim location & route</h2><p className="mt-1 text-sm text-slate-400">Map uses the incident coordinates stored with the emergency.</p></div>{routeUrl && <a href={routeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-800"><Navigation size={17} />Open best route</a>}</div>
                {mapPoints.length ? <div className="h-[340px] w-full sm:h-[430px]"><MapContainer center={mapPoints[0]} zoom={13} scrollWheelZoom className="h-full w-full"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{selectedMission.patientLocation && <Marker position={selectedMission.patientLocation} icon={patientIcon}><Popup>Emergency location</Popup></Marker>}{gps?.coords && <Marker position={gps.coords} icon={ambulanceIcon}><Popup>Ambulance {staff.ambulanceId}</Popup></Marker>}{missionRoadRoute?.coordinates?.length > 1 && <Polyline positions={missionRoadRoute.coordinates} pathOptions={{ color: "#16a34a", weight: 5, opacity: 0.9 }} />} {hospitals.map((hospital) => { const coords = getCoordinates(hospital.location ?? hospital.coordinates ?? hospital); if (!coords) return null; const isDemo = hospital.isDemoLocation === true || hospital.locationSource === "DEMO_GENERATED" || hospital.location?.isDemo === true; return <Marker key={hospital.id} position={coords} icon={hospitalIcon}><Popup><div className="min-w-40"><strong>{hospital.name || hospital.hospitalName || hospital.id}</strong><br />{hospital.address || hospital.location?.address || "Address not provided"}{isDemo && <><br /><span style={{ color: "#b45309", fontWeight: 700 }}>Demo location — not verified</span></>}</div></Popup></Marker>; })}<MapAutoFit points={mapPoints} /></MapContainer></div> : <div className="grid min-h-[260px] place-items-center bg-slate-950 p-8 text-center"><div><MapPin className="mx-auto text-slate-300" size={38} /><p className="mt-3 font-semibold text-slate-800">Coordinates are not available</p><p className="mt-1 max-w-md text-sm text-slate-400">The emergency record needs latitude and longitude in its `location` or `patientLocation` field before the map can mark the victim.</p></div></div>}
                <div className="border-t border-slate-800 px-5 pt-4 text-sm text-emerald-300">{missionRouteStatus}</div>
                <div className="grid gap-4 border-t border-slate-800 p-5 sm:grid-cols-2"><div className="flex items-start gap-3"><span className="mt-1 h-3 w-3 rounded-full bg-red-600" /><div><p className="text-sm font-bold">Victim / incident</p><p className="mt-1 text-xs text-slate-400">{selectedMission.patientLocation ? `${selectedMission.patientLocation[0].toFixed(5)}, ${selectedMission.patientLocation[1].toFixed(5)}` : "No coordinates"}</p></div></div><div className="flex items-start gap-3"><span className="mt-1 h-3 w-3 rounded-full bg-cyan-600" /><div><p className="text-sm font-bold">Ambulance live location</p><p className="mt-1 text-xs text-slate-400">{gps?.coords ? `${gps.coords[0].toFixed(5)}, ${gps.coords[1].toFixed(5)} · ${formatTimestamp(gps.updatedAt)}` : "Waiting for Friend 2's GPS publisher"}</p></div></div></div>
              </section>
            </> : <section className={`${panel} grid min-h-72 place-items-center p-8 text-center`}><div><Ambulance className="mx-auto text-slate-300" size={42} /><h2 className="mt-3 text-xl font-bold">No mission selected</h2><p className="mt-2 max-w-md text-sm text-slate-400">When Friend 1's assignment logic assigns an emergency to this ambulance ID, the victim details will appear here automatically.</p></div></section>}

            <section className={`${panel} p-5 sm:p-6`}>
              <div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-50 p-3 text-cyan-800"><Ambulance size={23} /></div><div><h2 className="text-lg font-bold">Ambulance details</h2><p className="text-sm text-slate-400">Vehicle profile from Firestore</p></div></div>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Field icon={Ambulance} label="Ambulance ID" value={staff.ambulanceId} />
                <Field icon={ShieldCheck} label="Staff role" value={staff.role} />
                <Field icon={Activity} label="Account status" value={staff.active ? "Active" : "Inactive"} />
                <Field icon={Radio} label="Vehicle status" value={ambulance?.status || ambulance?.Status || ambulance?.availability || "Not provided"} />
                <Field icon={UserRound} label="Driver / staff" value={staff.name || staff.fullName || staff.username || staff.email || staff.uid} />
                <Field icon={MapPin} label="Last GPS update" value={gps ? formatTimestamp(gps.updatedAt) : "No GPS update received"} />
                <Field icon={Ambulance} label="Registration" value={ambulance?.registrationNumber || ambulance?.vehicleNumber || ambulance?.registration || ambulance?.plateNumber} />
                <Field icon={Phone} label="Contact" value={ambulance?.phone || ambulance?.contactNumber || staff.phone} />
                <Field icon={Wifi} label="Location sharing" value={gps ? "Receiving location updates" : "Waiting for GPS integration"} />
              </div>
              <p className="mt-5 flex items-start gap-2 rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-400"><ShieldCheck className="mt-0.5 shrink-0" size={15} />Mission updates verify that this ambulance is still the assigned resource before writing.</p>
            </section>
          </div>
        </section>

        <footer className="flex flex-col justify-between gap-2 border-t border-slate-800 py-4 text-xs text-slate-400 sm:flex-row"><span>Astralife AI · Emergency response coordination</span><span className="flex items-center gap-2"><Radio size={14} /> Live subscriptions enabled when permitted by Firestore Rules</span></footer>
      </div>
    </main>
  );
}
