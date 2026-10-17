import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Link } from "react-router-dom";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { calculateETA } from "../api/eta";

import {
  Activity,
  BedDouble,
  Building2,
  Clock,
  Hospital,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  ShieldCheck,
  Siren,
  Truck,
} from "lucide-react";

import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { auth, db } from "../assets/firebase";

const DEFAULT_CENTER = [19.076, 72.8777];

const ACTIVE_STATUSES = [
  "Pending",
  "Assigned",
  "Accepted",
  "En Route",
  "At Scene",
  "Transporting",
];

const ambulanceIcon = new L.DivIcon({
  className: "",
  html: `
    <div style="
      width:38px;height:38px;border-radius:50%;
      background:#0891b2;border:3px solid white;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 0 16px #0891b288;color:white;font-size:19px;
    ">🚑</div>
  `,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

const hospitalIcon = new L.DivIcon({
  className: "",
  html: `
    <div style="
      width:36px;height:36px;border-radius:50%;
      background:#059669;border:3px solid white;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 0 12px #05966988;color:white;font-weight:bold;font-size:20px;
    ">+</div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function getCoordinates(value) {
  if (!value) return null;

  if (Array.isArray(value) && value.length >= 2) {
    const latitude = Number(value[0]);
    const longitude = Number(value[1]);

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    ) {
      return [latitude, longitude];
    }
  }

  if (typeof value !== "object") return null;

  const latitude = Number(
    value.latitude ?? value.lat ?? value._lat
  );

  const longitude = Number(
    value.longitude ?? value.lng ?? value.lon ?? value._long
  );

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  ) {
    return [latitude, longitude];
  }

  return null;
}

function findCoordinates(...values) {
  for (const value of values) {
    const coordinates = getCoordinates(value);

    if (coordinates) return coordinates;
  }

  return null;
}

function formatDate(value) {
  if (!value) return "Time unavailable";

  let date;

  if (typeof value?.toDate === "function") {
    date = value.toDate();
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  } else if (value instanceof Date) {
    date = value;
  }

  if (!date || Number.isNaN(date.getTime())) {
    return "Time unavailable";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNumber(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      const number = Number(value);

      if (Number.isFinite(number) && number >= 0) {
        return number;
      }
    }
  }

  return null;
}

function StatCard({ title, value, subtitle, icon: Icon, accent }) {
  const accentClasses = {
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    red: "border-red-500/20 bg-red-500/10 text-red-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0c1929] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{title}</p>

          <p className="mt-3 text-3xl font-bold text-white">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            {subtitle}
          </p>
        </div>

        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
            accentClasses[accent] || accentClasses.cyan
          }`}
        >
          <Icon size={22} />
        </span>
      </div>
    </div>
  );
}

function VacancyCard({ title, available, total, icon: Icon }) {
  const known = available !== null && total !== null;
  const percentage =
    known && total > 0
      ? Math.min(100, Math.round((available / total) * 100))
      : 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0c1929] p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
          <Icon size={22} />
        </span>

        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-xs text-slate-500">
            Bed availability
          </p>
        </div>
      </div>

      {known ? (
        <>
          <div className="mt-5 flex items-end justify-between">
            <p className="text-3xl font-bold text-white">
              {available}
              <span className="text-sm font-normal text-slate-500">
                {" "}/ {total}
              </span>
            </p>

            <span
              className={`text-sm font-medium ${
                available > 0 ? "text-emerald-300" : "text-red-300"
              }`}
            >
              {available > 0 ? "Available" : "Full"}
            </span>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-slate-500">
            {percentage}% of total beds available
          </p>
        </>
      ) : (
        <p className="mt-5 text-sm text-amber-300">
          Vacancy data unavailable
        </p>
      )}
    </div>
  );
}

function MapUpdater({ coordinates }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates) {
      map.flyTo(coordinates, 14, { duration: 0.8 });
    }
  }, [coordinates, map]);

  return null;
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
        <Icon size={21} />
      </span>

      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {subtitle && (
          <p className="text-sm text-slate-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export default function HospitalDashboard() {
  const [user, setUser] = useState(null);
  const [staff, setStaff] = useState(null);
  const [hospital, setHospital] = useState(null);
  const [ambulance, setAmbulance] = useState(null);
  const [ambulanceLocation, setAmbulanceLocation] = useState(null);
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [eta, setEta] = useState(null);

  useEffect(() => {
    let unsubscribeStaff = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setStaff(null);
      setError("");

      if (unsubscribeStaff) {
        unsubscribeStaff();
        unsubscribeStaff = null;
      }

      if (!currentUser) {
        setLoading(false);
        return;
      }

      unsubscribeStaff = onSnapshot(
        doc(db, "Staff", currentUser.uid),
        (snapshot) => {
          if (!snapshot.exists()) {
            setStaff(null);
            setError("Your staff profile was not found.");
            setLoading(false);
            return;
          }

          const staffData = {
            id: snapshot.id,
            ...snapshot.data(),
          };

          if (
            staffData.role !== "hospital" ||
            staffData.active !== true
          ) {
            setStaff(null);
            setError("Your account is not an active hospital account.");
            setLoading(false);
            return;
          }

          setStaff(staffData);
          setError("");
          setLoading(false);
        },
        (listenerError) => {
          console.error("Staff listener failed:", listenerError);
          setError("Unable to load your staff profile.");
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();

      if (unsubscribeStaff) {
        unsubscribeStaff();
      }
    };
  }, []);

  const hospitalId =
    staff?.hospitalId ||
    staff?.hospitalID ||
    staff?.assignedHospitalId ||
    null;

  useEffect(() => {
    if (!hospitalId) {
      setHospital(null);
      return;
    }

    return onSnapshot(
      doc(db, "Hospitals", hospitalId),
      (snapshot) => {
        if (snapshot.exists()) {
          setHospital({
            id: snapshot.id,
            ...snapshot.data(),
          });
          setError("");
        } else {
          setHospital(null);
        }
      },
      (listenerError) => {
        console.error("Hospital listener failed:", listenerError);
        setError(
          listenerError?.code === "permission-denied"
            ? "Firestore denied access to this hospital. Check Firestore rules and Staff/{uid}.hospitalId."
            : "Unable to load hospital details. Verify the hospital document ID and Firestore connection."
        );
      }
    );
  }, [hospitalId]);

  useEffect(() => {
    if (!hospitalId) {
      setEmergencies([]);
      return;
    }

    const emergencyQuery = query(
      collection(db, "Emergency_Cases"),
      where("hospitalId", "==", hospitalId)
    );

    return onSnapshot(
      emergencyQuery,
      (snapshot) => {
        const records = snapshot.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
          }))
          .filter((item) => {
            const status = String(
              item.Status ?? item.status ?? ""
            ).toLowerCase();

            return (
              ACTIVE_STATUSES.some(
                (activeStatus) =>
                  activeStatus.toLowerCase() === status
              ) ||
              status === ""
            );
          })
          .sort((a, b) => {
            const aTime =
              a.createdAt?.toMillis?.() ??
              new Date(a.createdAt || 0).getTime();

            const bTime =
              b.createdAt?.toMillis?.() ??
              new Date(b.createdAt || 0).getTime();

            return bTime - aTime;
          });

        setEmergencies(records);
      },
      (listenerError) => {
        console.error("Emergency listener failed:", listenerError);
        setError(
          "Unable to load emergencies. Check Firestore permissions and hospitalId."
        );
      }
    );
  }, [hospitalId]);

  const selectedEmergency = useMemo(() => {
    return emergencies.find(
      (item) =>
        item.ambulanceId ||
        item.ambulanceID
    ) || emergencies[0] || null;
  }, [emergencies]);

  const ambulanceId =
    selectedEmergency?.ambulanceId ||
    selectedEmergency?.ambulanceID ||
    null;

  useEffect(() => {
    if (!ambulanceId) {
      setAmbulance(null);
      setAmbulanceLocation(null);
      return;
    }

    return onSnapshot(
      doc(db, "Ambulances", ambulanceId),
      (snapshot) => {
        if (snapshot.exists()) {
          setAmbulance({
            id: snapshot.id,
            ...snapshot.data(),
          });
        } else {
          setAmbulance({
            id: ambulanceId,
          });
        }
      },
      (listenerError) => {
        console.error("Ambulance listener failed:", listenerError);
      }
    );
  }, [ambulanceId]);

  useEffect(() => {
    if (!ambulanceId) {
      setAmbulanceLocation(null);
      return;
    }

    const locationQuery = query(
      collection(db, "Ambulance_Locations"),
      where("ambulanceId", "==", ambulanceId)
    );

    return onSnapshot(
      locationQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setAmbulanceLocation(null);
          return;
        }

        const records = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        records.sort((a, b) => {
          const aTime =
            a.updatedAt?.toMillis?.() ??
            new Date(a.updatedAt || 0).getTime();

          const bTime =
            b.updatedAt?.toMillis?.() ??
            new Date(b.updatedAt || 0).getTime();

          return bTime - aTime;
        });

        const latest = records[0];

        const coordinates = findCoordinates(
          latest.location,
          latest.coordinates,
          latest
        );

        setAmbulanceLocation(
          coordinates
            ? {
                coordinates,
                updatedAt: latest.updatedAt || null,
                trackingStatus: latest.trackingStatus || "Unknown",
              }
            : null
        );
      },
      (listenerError) => {
        console.error("Ambulance location listener failed:", listenerError);
      }
    );
  }, [ambulanceId]);

  const hospitalCoordinates = findCoordinates(
    hospital?.location,
    hospital?.coordinates,
    hospital?.addressLocation,
    hospital
  );

  const ambulanceCoordinates =
    ambulanceLocation?.coordinates || null;

  const mapCenter =
    ambulanceCoordinates ||
    hospitalCoordinates ||
    DEFAULT_CENTER;

  // Calculate ETA from ambulance to hospital when both coordinates are available
  useEffect(() => {
    if (!ambulanceCoordinates || !hospitalCoordinates) {
      setEta(null);
      return;
    }
    let cancelled = false;
    const gpsDate = ambulanceLocation?.updatedAt
      ? (ambulanceLocation.updatedAt.toDate?.() || new Date(ambulanceLocation.updatedAt))
      : null;
    calculateETA(
      ambulanceCoordinates[0],
      ambulanceCoordinates[1],
      hospitalCoordinates[0],
      hospitalCoordinates[1],
      gpsDate
    ).then((result) => {
      if (!cancelled) setEta(result);
    }).catch((err) => {
      console.warn("Hospital ETA calc failed:", err);
    });
    return () => { cancelled = true; };
  }, [
    ambulanceCoordinates?.[0],
    ambulanceCoordinates?.[1],
    hospitalCoordinates?.[0],
    hospitalCoordinates?.[1],
  ]);

  const vacancy = hospital?.vacancy || hospital?.beds || {};

  const generalAvailable = getNumber(
    vacancy.generalAvailable,
    vacancy.generalWardAvailable,
    vacancy.generalWard?.available,
    hospital?.generalWardAvailable,
    hospital?.generalWardVacancy,
    hospital?.availableGeneralBeds
  );

  const generalTotal = getNumber(
    vacancy.generalTotal,
    vacancy.generalWardTotal,
    vacancy.generalWard?.total,
    hospital?.generalWardTotal,
    hospital?.totalGeneralBeds
  );

  const icuAvailable = getNumber(
    vacancy.icuAvailable,
    vacancy.icu?.available,
    hospital?.icuAvailable,
    hospital?.icuVacancy,
    hospital?.availableICUBeds
  );

  const icuTotal = getNumber(
    vacancy.icuTotal,
    vacancy.icu?.total,
    hospital?.icuTotal,
    hospital?.totalICUBeds
  );

  const emergencyAvailable = getNumber(
    vacancy.emergencyAvailable,
    vacancy.emergencyWardAvailable,
    vacancy.emergencyWard?.available,
    hospital?.emergencyWardAvailable,
    hospital?.emergencyWardVacancy,
    hospital?.availableEmergencyBeds
  );

  const emergencyTotal = getNumber(
    vacancy.emergencyTotal,
    vacancy.emergencyWardTotal,
    vacancy.emergencyWard?.total,
    hospital?.emergencyWardTotal,
    hospital?.totalEmergencyBeds
  );

  const hospitalName =
    hospital?.name ||
    hospital?.hospitalName ||
    staff?.hospitalName ||
    "Hospital";

  const reportedTime =
    selectedEmergency?.createdAt ||
    selectedEmergency?.reportedAt ||
    selectedEmergency?.timestamp;

  const routeUrl =
    ambulanceCoordinates && hospitalCoordinates
      ? `https://www.google.com/maps/dir/${ambulanceCoordinates[0]},${ambulanceCoordinates[1]}/${hospitalCoordinates[0]},${hospitalCoordinates[1]}`
      : ambulanceCoordinates
      ? `https://www.google.com/maps?q=${ambulanceCoordinates[0]},${ambulanceCoordinates[1]}`
      : null;

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await signOut(auth);
    } catch (logoutError) {
      console.error("Logout failed:", logoutError);
      setError("Unable to log out. Please try again.");
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07111f] text-cyan-300">
        <RefreshCw className="mr-3 animate-spin" size={22} />
        Loading hospital dashboard...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07111f] px-4 text-white">
        <div className="max-w-md rounded-2xl border border-slate-800 bg-[#0c1929] p-8 text-center">
          <ShieldCheck className="mx-auto mb-4 text-cyan-300" size={40} />
          <h1 className="text-xl font-bold">Authentication Required</h1>
          <p className="mt-3 text-sm text-slate-400">
            Please log in using your hospital staff account.
          </p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07111f] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
              <Hospital size={26} />
            </span>

            <div>
              <h1 className="text-xl font-bold">
                Astralife <span className="text-cyan-400">AI</span>
              </h1>
              <p className="text-sm text-slate-500">
                Hospital Response Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 sm:flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Live Monitoring
            </span>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
            >
              <LogOut size={17} />
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        {/* Hospital identity */}
        <section className="mb-6 rounded-2xl border border-slate-800 bg-[#0c1929] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                <Building2 size={29} />
              </span>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                  Hospital Control
                </p>

                <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
                  {hospitalName}
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  {hospital?.address ||
                    hospital?.location?.address ||
                    hospital?.city ||
                    "Hospital address unavailable"}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3">
              <p className="text-xs text-slate-500">Hospital ID</p>
              <p className="mt-1 font-mono text-sm text-cyan-300">
                {hospitalId || "Not configured"}
              </p>
            </div>
          </div>
        </section>

        {/* Overview cards */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Active Emergencies"
            value={emergencies.length}
            subtitle="Assigned to this hospital"
            icon={Siren}
            accent="red"
          />

          <StatCard
            title="Ambulance Tracking"
            value={ambulanceCoordinates ? "LIVE" : "Waiting"}
            subtitle={
              ambulanceLocation?.updatedAt
                ? `Updated ${formatDate(ambulanceLocation.updatedAt)}`
                : "Awaiting GPS coordinates"
            }
            icon={Navigation}
            accent="cyan"
          />

          <StatCard
            title="Emergency Reported"
            value={
              reportedTime
                ? formatDate(reportedTime)
                : "No active case"
            }
            subtitle="Selected emergency"
            icon={Clock}
            accent="amber"
          />

          <StatCard
            title="Hospital Status"
            value={hospital?.active === false ? "Inactive" : "Available"}
            subtitle="Hospital profile status"
            icon={Activity}
            accent="emerald"
          />
        </section>

        {/* Bed availability */}
        <section className="mb-8">
          <SectionTitle
            icon={BedDouble}
            title="Hospital Bed Availability"
            subtitle="Current capacity information from Firestore"
          />

          <div className="grid gap-4 md:grid-cols-3">
            <VacancyCard
              title="General Ward"
              available={generalAvailable}
              total={generalTotal}
              icon={BedDouble}
            />

            <VacancyCard
              title="Intensive Care Unit"
              available={icuAvailable}
              total={icuTotal}
              icon={Activity}
            />

            <VacancyCard
              title="Emergency Ward"
              available={emergencyAvailable}
              total={emergencyTotal}
              icon={Siren}
            />
          </div>
        </section>

        {/* Live map */}
        <section className="mb-8">
          <SectionTitle
            icon={MapPin}
            title="Live Ambulance Location"
            subtitle="Ambulance GPS updates and hospital location"
          />

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0c1929]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-cyan-400" />
                  Ambulance
                </span>

                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  Hospital
                </span>
              </div>

              {routeUrl && (
                <a
                  href={routeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
                >
                  <Navigation size={15} />
                  Open Route
                </a>
              )}
            </div>

            <div className="h-[400px] w-full">
              <MapContainer
                center={mapCenter}
                zoom={12}
                scrollWheelZoom
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapUpdater coordinates={ambulanceCoordinates} />

                {ambulanceCoordinates && (
                  <Marker
                    position={ambulanceCoordinates}
                    icon={ambulanceIcon}
                  >
                    <Popup>
                      <strong>Ambulance</strong>
                      <br />
                      {ambulance?.vehicleNumber ||
                        ambulance?.registrationNumber ||
                        ambulance?.id ||
                        ambulanceId}
                    </Popup>
                  </Marker>
                )}

                {hospitalCoordinates && (
                  <Marker
                    position={hospitalCoordinates}
                    icon={hospitalIcon}
                  >
                    <Popup>
                      <strong>{hospitalName}</strong>
                      <br />
                      Hospital location
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>

            {!ambulanceCoordinates && (
              <div className="border-t border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
                <MapPin size={17} className="mr-2 inline" />
                Ambulance GPS coordinates are not available yet. The map
                will update when the location publisher writes coordinates
                for the assigned ambulance.
              </div>
            )}
          </div>
        </section>

        {/* ETA Panel */}
        {(ambulanceCoordinates || eta) && (
          <section className="mb-8 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
                <Clock size={21} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-white">Ambulance ETA to Hospital</h2>
                <p className="text-sm text-slate-500">Time for ambulance to reach this hospital</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-[#0c1929] p-4">
                <p className="text-xs text-slate-500">ETA</p>
                <p className="mt-2 text-2xl font-bold text-emerald-300">
                  {eta ? `${eta.durationMinutes} min` : ambulanceCoordinates ? "Calculating…" : "--"}
                </p>
                {eta?.isStale && (
                  <p className="mt-1 text-xs text-amber-400">⚠ GPS data may be stale</p>
                )}
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#0c1929] p-4">
                <p className="text-xs text-slate-500">Distance</p>
                <p className="mt-2 text-2xl font-bold text-cyan-300">
                  {eta ? `${eta.distanceKm} km` : "--"}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {eta?.source === "osrm" ? "Road route" : eta?.source === "haversine-fallback" ? "Approximate" : ""}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#0c1929] p-4">
                <p className="text-xs text-slate-500">Est. Arrival</p>
                <p className="mt-2 text-xl font-bold text-white">
                  {eta?.arrivalTime
                    ? eta.arrivalTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                    : "--"}
                </p>
                {ambulanceLocation?.updatedAt && (
                  <p className="mt-1 text-xs text-slate-500">
                    GPS: {formatDate(ambulanceLocation.updatedAt)}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Emergency and ambulance details */}
        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-[#0c1929] p-5 sm:p-6">
            <SectionTitle
              icon={Siren}
              title="Emergency Details"
              subtitle="Latest emergency assigned to this hospital"
            />

            {selectedEmergency ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                  <p className="text-xs text-slate-500">
                    Emergency Reference
                  </p>
                  <p className="mt-1 break-all font-mono text-sm text-cyan-300">
                    {selectedEmergency.id}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <span className="text-sm text-slate-400">
                    Emergency Type
                  </span>
                  <span className="text-right text-sm text-white">
                    {selectedEmergency.emergencyType ||
                      selectedEmergency.type ||
                      "SOS Emergency"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <span className="text-sm text-slate-400">
                    Reported At
                  </span>
                  <span className="text-right text-sm text-white">
                    {formatDate(reportedTime)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <span className="text-sm text-slate-400">
                    Status
                  </span>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                    {selectedEmergency.Status ||
                      selectedEmergency.status ||
                      "Unknown"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-400">
                    Ambulance ID
                  </span>
                  <span className="break-all text-right font-mono text-sm text-white">
                    {ambulanceId || "Not assigned"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center">
                <Siren
                  className="mx-auto mb-3 text-slate-600"
                  size={30}
                />
                <p className="text-sm text-slate-300">
                  No active emergency assigned to this hospital.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0c1929] p-5 sm:p-6">
            <SectionTitle
              icon={Truck}
              title="Ambulance Details"
              subtitle="Information about the assigned vehicle"
            />

            {ambulance ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                  <p className="text-xs text-slate-500">
                    Ambulance Identifier
                  </p>
                  <p className="mt-1 break-all font-mono text-sm text-cyan-300">
                    {ambulance.id}
                  </p>
                </div>

                {[
                  [
                    "Vehicle Number",
                    ambulance.vehicleNumber ||
                      ambulance.registrationNumber ||
                      ambulance.numberPlate,
                  ],
                  [
                    "Driver Name",
                    ambulance.driverName || ambulance.name,
                  ],
                  [
                    "Driver Contact",
                    ambulance.driverPhone ||
                      ambulance.phone ||
                      ambulance.contact,
                  ],
                  [
                    "Vehicle Type",
                    ambulance.vehicleType || ambulance.type,
                  ],
                  [
                    "Vehicle Status",
                    ambulance.status ||
                      ambulance.Status ||
                      ambulance.trackingStatus,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3 last:border-0"
                  >
                    <span className="text-sm text-slate-400">
                      {label}
                    </span>
                    <span className="break-words text-right text-sm text-white">
                      {value || "Not available"}
                    </span>
                  </div>
                ))}

                {ambulance.driverPhone || ambulance.phone ? (
                  <a
                    href={`tel:${
                      ambulance.driverPhone || ambulance.phone
                    }`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20"
                  >
                    <Phone size={17} />
                    Contact Ambulance
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center">
                <Truck
                  className="mx-auto mb-3 text-slate-600"
                  size={30}
                />
                <p className="text-sm text-slate-300">
                  {ambulanceId
                    ? "Loading ambulance information..."
                    : "No ambulance assigned to the selected emergency."}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Hospital details */}
        <section className="mb-8 rounded-2xl border border-slate-800 bg-[#0c1929] p-5 sm:p-6">
          <SectionTitle
            icon={Building2}
            title="Hospital Details"
            subtitle="Registered hospital information"
          />

          {hospital ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                [
                  "Hospital Name",
                  hospital.name || hospital.hospitalName,
                ],
                ["Address", hospital.address || hospital.city],
                [
                  "Contact Number",
                  hospital.phone ||
                    hospital.contact ||
                    hospital.contactNumber,
                ],
                ["Email", hospital.email],
                ["Hospital ID", hospital.id],
                [
                  "Registration Number",
                  hospital.registrationNumber ||
                    hospital.registrationId,
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
                >
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-2 break-words text-sm font-medium text-white">
                    {value || "Not available"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-amber-300">
              Hospital details are unavailable. Check that the logged-in
              staff document contains a valid hospitalId.
            </p>
          )}
        </section>

        {/* Other active emergencies */}
        <section className="mb-8">
          <SectionTitle
            icon={Activity}
            title="Assigned Emergencies"
            subtitle="Emergency cases currently associated with this hospital"
          />

          {emergencies.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0c1929]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="border-b border-slate-800 bg-slate-900/60 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Emergency ID</th>
                      <th className="px-5 py-4">Reported</th>
                      <th className="px-5 py-4">Ambulance</th>
                      <th className="px-5 py-4">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-800">
                    {emergencies.map((item) => (
                      <tr
                        key={item.id}
                        className="transition hover:bg-slate-800/30"
                      >
                        <td className="px-5 py-4 font-mono text-xs text-cyan-300">
                          {item.id}
                        </td>

                        <td className="px-5 py-4 text-slate-300">
                          {formatDate(
                            item.createdAt ||
                              item.reportedAt ||
                              item.timestamp
                          )}
                        </td>

                        <td className="px-5 py-4 text-slate-300">
                          {item.ambulanceId ||
                            item.ambulanceID ||
                            "Not assigned"}
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
                            {item.Status || item.status || "Unknown"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-[#0c1929] p-8 text-center">
              <p className="text-sm text-slate-400">
                No emergency cases are currently assigned to this hospital.
              </p>
            </div>
          )}
        </section>

        <footer className="border-t border-slate-800 py-5 text-center text-xs text-slate-600">
          Astralife AI · Hospital Emergency Coordination
        </footer>
      </div>
    </div>
  );
}