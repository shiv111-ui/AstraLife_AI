import { useEffect, useMemo, useState } from "react";
import GreenCorridorMap from "./GreenCorridorMap";
import { signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { assignResources, completeEmergency, dispatch as autoDispatch } from "../api/dispatch";
import { useNavigate } from "react-router-dom";

import { auth, db } from "../assets/firebase";

import {
  Activity,
  AlertTriangle,
  Ambulance,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Command,
  FileText,
  Filter,
  Hospital,
  Info,
  LogOut,
  MapPin,
  Menu,
  Navigation,
  Radio,
  RefreshCw,
  Route,
  ShieldCheck,
  Siren,
  TrafficCone,
  Users,
  X,
} from "lucide-react";

/* -------------------------------------------------------
   CONSTANTS
------------------------------------------------------- */

const INCIDENT_STATUSES = [
  "Pending",
  "Reported",
  "Verified",
  "Awaiting Ambulance",
  "Assigning",
  "Ambulance Assigned",
  "Assigned",
  "Accepted",
  "Ambulance En Route",
  "En Route",
  "At Scene",
  "Patient Picked Up",
  "Transporting",
  "Hospital En Route",
  "At Hospital",
  "Completed",
  "Cancelled",
  "Rejected",
  "Assignment Failed",
];

const SEVERITY_STYLE = {
  Critical: "border-red-500/30 bg-red-500/10 text-red-300",
  High: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  Moderate: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

const STATUS_STYLE = {
  Pending: "border-red-500/30 bg-red-500/10 text-red-300",
  Reported: "border-red-500/30 bg-red-500/10 text-red-300",
  Verified: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  "Awaiting Ambulance": "border-amber-500/30 bg-amber-500/10 text-amber-300",
  Assigning: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  "Ambulance Assigned": "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  Assigned: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  Accepted: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  "Ambulance En Route": "border-sky-500/30 bg-sky-500/10 text-sky-300",
  "En Route": "border-sky-500/30 bg-sky-500/10 text-sky-300",
  "At Scene": "border-violet-500/30 bg-violet-500/10 text-violet-300",
  "Patient Picked Up": "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
  Transporting: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
  "Hospital En Route": "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
  "At Hospital": "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  Completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  Cancelled: "border-slate-500/30 bg-slate-500/10 text-slate-400",
  Rejected: "border-red-500/30 bg-red-500/10 text-red-300",
  "Assignment Failed": "border-red-500/30 bg-red-500/10 text-red-300",
};

const PANEL =
  "rounded-2xl border border-slate-800 bg-slate-900/80 shadow-lg shadow-black/10";

const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40";

const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40";

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

function getCoordinates(data) {
  if (!data) return null;

  if (Array.isArray(data) && data.length >= 2) {
    const lat = Number(data[0]);
    const lng = Number(data[1]);

    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    ) {
      return { latitude: lat, longitude: lng };
    }
  }

  if (typeof data !== "object") return null;

  const latitude = Number(
    data.latitude ??
      data.lat ??
      data._lat ??
      data.coordinates?.latitude ??
      data.coordinates?.lat
  );

  const longitude = Number(
    data.longitude ??
      data.lng ??
      data.lon ??
      data._long ??
      data.coordinates?.longitude ??
      data.coordinates?.lng
  );

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  ) {
    return { latitude, longitude };
  }

  return null;
}

function getEmergencyCoordinates(data) {
  return (
    getCoordinates(data?.location) ||
    getCoordinates(data?.patientLocation) ||
    getCoordinates(data?.coordinates) ||
    null
  );
}

function getAmbulanceCoordinates(data) {
  return (
    getCoordinates(data?.location?.coordinates) ||
    getCoordinates(data?.location) ||
    getCoordinates(data?.coordinates) ||
    getCoordinates(data) ||
    null
  );
}

function getTimestamp(value) {
  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value) {
  const timestamp = getTimestamp(value);

  if (!timestamp) return "Time unavailable";

  return new Date(timestamp).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getIncidentStatus(data) {
  const status = data?.Status ?? data?.status ?? "Pending";

  if (status === "Reported") return "Reported";

  return status;
}

function getSeverity(data) {
  const priority = data?.Priority ?? data?.severity ?? "Moderate";

  const normalized = String(priority).toLowerCase();

  if (normalized === "critical") return "Critical";
  if (normalized === "high") return "High";

  return "Moderate";
}

function getHospitalName(hospital) {
  return (
    hospital?.name ||
    hospital?.hospitalName ||
    hospital?.hospital_name ||
    hospital?.id ||
    "Unknown hospital"
  );
}

function getAmbulanceStatus(data) {
  return data?.current_status ?? data?.status ?? data?.Status ?? "Unknown";
}

function getAmbulanceId(data, documentId) {
  return data?.ambulance_id || data?.ambulanceId || documentId;
}

/* -------------------------------------------------------
   REUSABLE COMPONENTS
------------------------------------------------------- */

function Heading({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-cyan-300">
          <Icon size={19} />
        </div>

        <div>
          <h2 className="font-semibold text-white">{title}</h2>

          {subtitle && (
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>

      {action}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, description, color }) {
  const colors = {
    red: "border-red-500/20 bg-red-500/10 text-red-300",
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  };

  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-bold text-white">{value}</p>
        </div>

        <div className={`rounded-xl border p-3 ${colors[color]}`}>
          <Icon size={21} />
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function Badge({ children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function SeverityBadge({ severity }) {
  return (
    <Badge
      className={
        SEVERITY_STYLE[severity] || SEVERITY_STYLE.Moderate
      }
    >
      {severity}
    </Badge>
  );
}

function StatusBadge({ status }) {
  return (
    <Badge
      className={
        STATUS_STYLE[status] || STATUS_STYLE.Reported
      }
    >
      {status}
    </Badge>
  );
}

/* -------------------------------------------------------
   MAIN DASHBOARD
------------------------------------------------------- */

export default function ControlRoomDashboard() {
  const navigate = useNavigate();

  const [incidents, setIncidents] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [incidentsError, setIncidentsError] = useState("");

  const [ambulances, setAmbulances] = useState([]);
  const [ambulancesLoading, setAmbulancesLoading] = useState(true);
  const [ambulancesError, setAmbulancesError] = useState("");

  const [hospitals, setHospitals] = useState([]);

  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("All");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notification, setNotification] = useState("");
  const [saving, setSaving] = useState(false);

  const [assignmentAmbulance, setAssignmentAmbulance] = useState("");
  const [assignmentHospital, setAssignmentHospital] = useState("");
  const [dispatchBusy, setDispatchBusy] = useState(false);

  const [corridorStatus, setCorridorStatus] = useState("Not Requested");
  const [corridorIncidentId, setCorridorIncidentId] = useState("");

  /* -----------------------------------------------------
     NOTIFICATIONS
  ----------------------------------------------------- */

  function notify(message) {
    setNotification(message);

    window.setTimeout(() => {
      setNotification((current) =>
        current === message ? "" : current
      );
    }, 3500);
  }

  /* -----------------------------------------------------
     FIRESTORE: EMERGENCY CASES
  ----------------------------------------------------- */

  useEffect(() => {
    const incidentsQuery = query(
      collection(db, "Emergency_Cases"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      incidentsQuery,
      (snapshot) => {
        const firestoreIncidents = snapshot.docs.map((document) => {
          const data = document.data();

          const coordinates = getEmergencyCoordinates(data);

          const createdAt = data.createdAt || data.reportedAt || null;

          return {
            id: document.id,
            emergency:
              data.EmergencyType ||
              data.emergencyType ||
              data.type ||
              "Unknown emergency",

            severity: getSeverity(data),
            status: getIncidentStatus(data),

            location: coordinates
              ? `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`
              : "Location unavailable",

            latitude: coordinates?.latitude ?? null,
            longitude: coordinates?.longitude ?? null,

            createdAt,
            reportedAt: formatDate(createdAt),

            victims: data.victimCount ?? data.victims ?? 1,

            ambulance:
              data.ambulanceId ||
              data.ambulanceID ||
              "Unassigned",


            hospital:
              data.hospitalId ||
              data.hospitalID ||
              "Not assigned",

            notes:
              data.description ||
              data.notes ||
              "No additional details provided.",

            patientName: data.patientName || null,
            phone: data.phone || null,
          };
        });

        setIncidents(firestoreIncidents);
        setIncidentsLoading(false);
        setIncidentsError("");

        setSelectedId((currentId) => {
          if (
            currentId &&
            firestoreIncidents.some((item) => item.id === currentId)
          ) {
            return currentId;
          }

          return firestoreIncidents[0]?.id || "";
        });
      },
      (error) => {
        console.error("Emergency listener failed:", error);

        setIncidentsError(
          error.code === "permission-denied"
            ? "Permission denied while reading emergency cases."
            : "Unable to load emergency cases from Firebase."
        );

        setIncidentsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /* -----------------------------------------------------
     FIRESTORE: AMBULANCES
  ----------------------------------------------------- */

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "Ambulances"),
      (snapshot) => {
        const firebaseAmbulances = snapshot.docs.map((document) => {
          const data = document.data();

          const coordinates = getAmbulanceCoordinates(data);

          return {
            id: getAmbulanceId(data, document.id),
            documentId: document.id,
            type: data.type || data.vehicleType || "Ambulance",
            status: getAmbulanceStatus(data),

            latitude: coordinates?.latitude ?? null,
            longitude: coordinates?.longitude ?? null,

            baseArea:
              data.location?.base_area ||
              data.baseArea ||
              "Unknown",

            vehicleNumber:
              data.vehicleNumber ||
              data.registrationNumber ||
              data.ambulance_id ||
              document.id,
          };
        });

        setAmbulances(firebaseAmbulances);
        setAmbulancesLoading(false);
        setAmbulancesError("");
      },
      (error) => {
        console.error("Ambulance listener failed:", error);

        setAmbulancesError(
          error.code === "permission-denied"
            ? "Permission denied while reading ambulances."
            : "Unable to load ambulances."
        );

        setAmbulancesLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /* -----------------------------------------------------
     FIRESTORE: HOSPITALS
  ----------------------------------------------------- */

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "Hospitals"),
      (snapshot) => {
        const records = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));

        setHospitals(records);
      },
      (error) => {
        console.error("Hospital listener failed:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  /* -----------------------------------------------------
     DERIVED DATA
  ----------------------------------------------------- */

  const selectedIncident = incidents.find(
    (item) => item.id === selectedId
  );

  const selectedAmbulance = ambulances.find(
    (item) =>
      item.id === selectedIncident?.ambulance ||
      item.documentId === selectedIncident?.ambulance
  );

  const selectedHospital = hospitals.find((item) =>
    String(item.id || item.hospitalId || "") === String(selectedIncident?.hospital || "") ||
    String(item.name || item.hospitalName || "").toLowerCase() === String(selectedIncident?.hospital || "").toLowerCase()
  ) || null;

  const patientLocation =
    selectedIncident?.latitude != null &&
    selectedIncident?.longitude != null
      ? {
          latitude: selectedIncident.latitude,
          longitude: selectedIncident.longitude,
        }
      : null;

  const ambulanceLocation =
    selectedAmbulance?.latitude != null &&
    selectedAmbulance?.longitude != null
      ? {
          latitude: selectedAmbulance.latitude,
          longitude: selectedAmbulance.longitude,
        }
      : null;

  const activeIncidents = useMemo(
    () =>
      incidents.filter(
        (item) =>
          !["Completed", "Rejected"].includes(item.status)
      ),
    [incidents]
  );

  const filteredIncidents =
    filter === "All"
      ? incidents
      : incidents.filter((item) => item.severity === filter);

  const availableAmbulances = ambulances.filter(
    (item) =>
      ["Available", "available", "ONLINE", "Online"].includes(item.status)
  );
  const selectedAmbulanceId = availableAmbulances.some(
    (item) => item.id === assignmentAmbulance
  ) ? assignmentAmbulance : availableAmbulances[0]?.id || "";
  const selectedHospitalId = hospitals.some(
    (item) => item.id === assignmentHospital
  ) ? assignmentHospital : hospitals[0]?.id || "";

  const assignedCount = ambulances.filter(
    (item) =>
      !["Available", "available", "ONLINE", "Online"].includes(item.status)
  ).length;

  /* -----------------------------------------------------
     LOGOUT
  ----------------------------------------------------- */

  async function handleLogout() {
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
      notify("Unable to log out. Please try again.");
    }
  }

  /* -----------------------------------------------------
     ASSIGN AMBULANCE + HOSPITAL
  ----------------------------------------------------- */

  async function assignAmbulance() {
    if (!selectedIncident) {
      notify("Select an emergency first.");
      return;
    }

    if (
      ["Completed", "Rejected"].includes(selectedIncident.status)
    ) {
      notify("This emergency cannot receive a new assignment.");
      return;
    }

    const vehicle = ambulances.find(
      (item) => item.id === selectedAmbulanceId
    );

    const hospital = hospitals.find(
      (item) => item.id === selectedHospitalId
    );

    if (!vehicle) {
      notify("Select a valid ambulance.");
      return;
    }

    if (!hospital) {
      notify("Select a valid hospital from Firebase.");
      return;
    }

    if (
      !["Available", "available", "ONLINE", "Online"].includes(
        vehicle.status
      )
    ) {
      notify("This ambulance is not available.");
      return;
    }

    setSaving(true);

    try {
      const result = await assignResources(selectedIncident.id, vehicle.documentId, hospital.id);
      if (!result.success) {
        notify(result.message || "Assignment could not be reserved.");
        return;
      }

      setCorridorIncidentId(selectedIncident.id);
      setCorridorStatus("Not Requested");

      notify(
        `${vehicle.id} assigned to ${getHospitalName(hospital)}.`
      );
    } catch (error) {
      console.error("Assignment failed:", error);

      if (error.code === "permission-denied") {
        notify(
          "Permission denied. Check Firestore rules for both updates."
        );
      } else if (error.code === "not-found") {
        notify("The emergency or ambulance document was not found.");
      } else {
        notify("Assignment failed. Check the console for details.");
      }
    } finally {
      setSaving(false);
    }
  }

  /* -----------------------------------------------------
     INCIDENT STATUS
  ----------------------------------------------------- */

  async function updateIncidentStatus(status) {
    if (!selectedIncident) return;

    setSaving(true);

    try {
      if (["Completed", "Cancelled", "Rejected"].includes(status)) {
        const result = await completeEmergency(selectedIncident.id, null, status);
        if (!result.success) {
          notify(result.message || "Could not close this emergency.");
          return;
        }
      } else {
        await updateDoc(doc(db, "Emergency_Cases", selectedIncident.id), {
          Status: status,
          updatedAt: serverTimestamp(),
        });
      }

      notify(`Emergency status updated to "${status}".`);
    } catch (error) {
      console.error("Status update failed:", error);

      notify(
        error.code === "permission-denied"
          ? "Permission denied while updating emergency status."
          : "Unable to update emergency status."
      );
    } finally {
      setSaving(false);
    }
  }

  /* -----------------------------------------------------
     DEMO INCIDENT
  ----------------------------------------------------- */

  async function addDemoIncident() {
    setSaving(true);

    try {
      const docRef = await addDoc(
        collection(db, "Emergency_Cases"),
        {
          emergencyType: "Medical Emergency",
          EmergencyType: "Medical Emergency",
          Priority: "High",
          Status: "Pending",
          description:
            "Demonstration incident created by the control room operator.",
          location: null,
          ambulanceId: null,
          hospitalId: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          source: "control-room-demo",
        }
      );

      setSelectedId(docRef.id);
      notify("Demo incident saved to Firebase.");
    } catch (error) {
      console.error("Creating demo incident failed:", error);

      notify(
        error.code === "permission-denied"
          ? "Permission denied while creating the incident."
          : "Could not create demo incident."
      );
    } finally {
      setSaving(false);
    }
  }

  /* -----------------------------------------------------
     MAP / REPORT
  ----------------------------------------------------- */

  function openMaps(incident) {
    if (
      incident.latitude != null &&
      incident.longitude != null
    ) {
      const url =
        `https://www.google.com/maps/search/?api=1&query=` +
        `${incident.latitude},${incident.longitude}`;

      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    notify("GPS coordinates are not available for this emergency.");
  }

  function exportReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      incidents,
      ambulances,
      hospitals: hospitals.map((hospital) => ({
        id: hospital.id,
        name: getHospitalName(hospital),
      })),
    };

    const blob = new Blob(
      [JSON.stringify(report, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "astralife-control-room-report.json";
    anchor.click();

    URL.revokeObjectURL(url);
    notify("Report exported.");
  }

  /* -----------------------------------------------------
     GREEN CORRIDOR — DEMONSTRATION ONLY
  ----------------------------------------------------- */

  function updateCorridorStatus(status) {
    setCorridorStatus(status);

    notify(
      `Demonstration corridor status changed to "${status}".`
    );
  }

  /* -----------------------------------------------------
     UI
  ----------------------------------------------------- */

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600">
              <Command size={24} />
            </div>

            <div>
              <h1 className="text-lg font-bold text-white">
                ASTRALIFE <span className="text-red-400">AI</span>
              </h1>

              <p className="text-xs text-slate-400">
                Emergency Control Room
              </p>
            </div>
          </a>

          <div className="hidden items-center gap-3 md:flex">
            <button
              type="button"
              onClick={handleLogout}
              className={SECONDARY_BUTTON}
            >
              <LogOut size={16} />
              Logout
            </button>

            <span className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Firebase Connected
            </span>

            <button
              type="button"
              onClick={() =>
                notify("Emergency data updates automatically through Firestore.")
              }
              className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-slate-300 hover:bg-slate-800"
              aria-label="Notifications"
            >
              <Bell size={19} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-slate-300 md:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-800 bg-slate-900 p-4 md:hidden">
            <button
              type="button"
              onClick={handleLogout}
              className={`${SECONDARY_BUTTON} w-full`}
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-7 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <Info
            size={20}
            className="mt-0.5 shrink-0 text-amber-300"
          />

          <div>
            <p className="text-sm font-semibold text-amber-200">
              Emergency coordination prototype
            </p>

            <p className="mt-1 text-sm leading-6 text-slate-400">
              This dashboard coordinates emergency records stored in
              Firebase. Confirm GPS freshness and all assignments before
              relying on displayed information. Green-corridor statuses
              are illustrative only.
            </p>
          </div>
        </div>

        <section className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-cyan-300">
              <Radio size={17} />
              Central Response Coordination
            </div>

            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Control Room Dashboard
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Review incidents, assign ambulances, select receiving
              hospitals and monitor response progress.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={addDemoIncident}
              disabled={saving}
              className={PRIMARY_BUTTON}
            >
              <Siren size={16} />
              New Demo Incident
            </button>

            <button
              type="button"
              onClick={exportReport}
              className={SECONDARY_BUTTON}
            >
              <FileText size={16} />
              Export Report
            </button>
          </div>
        </section>

        {/* STATISTICS */}

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Siren}
            label="Active Incidents"
            value={activeIncidents.length}
            description="Cases not yet completed or rejected"
            color="red"
          />

          <StatCard
            icon={Ambulance}
            label="Available Ambulances"
            value={availableAmbulances.length}
            description="Reported available status from Firestore; confirm before dispatch"
            color="cyan"
          />

          <StatCard
            icon={Activity}
            label="Assigned / Busy"
            value={assignedCount}
            description="Vehicles not marked available"
            color="amber"
          />

          <StatCard
            icon={CheckCircle2}
            label="Completed Incidents"
            value={
              incidents.filter(
                (item) => item.status === "Completed"
              ).length
            }
            description="Completed emergency records"
            color="green"
          />
        </section>

        {(incidentsError || ambulancesError) && (
          <div className="mb-6 space-y-2">
            {incidentsError && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {incidentsError}
              </p>
            )}

            {ambulancesError && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {ambulancesError}
              </p>
            )}
          </div>
        )}

        {/* MAP */}

        <section className={`${PANEL} mb-8 p-5 sm:p-6`}>
          <Heading
            icon={Route}
            title="Live Route Map"
            subtitle="Selected patient's GPS location and assigned ambulance coordinates"
          />

          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-xs text-slate-500">Selected emergency</p>
              <p className="mt-1 font-semibold text-white">
                {selectedIncident?.id || "No emergency selected"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-xs text-slate-500">Patient GPS</p>
              <p className="mt-1 text-sm text-cyan-300">
                {patientLocation
                  ? `${patientLocation.latitude.toFixed(5)}, ${patientLocation.longitude.toFixed(5)}`
                  : "Unavailable"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-xs text-slate-500">Ambulance GPS</p>
              <p className="mt-1 text-sm text-cyan-300">
                {ambulanceLocation
                  ? `${ambulanceLocation.latitude.toFixed(5)}, ${ambulanceLocation.longitude.toFixed(5)}`
                  : "Unavailable"}
              </p>
            </div>

          </div>

          <GreenCorridorMap
            patient={patientLocation}
            ambulance={ambulanceLocation}
            hospital={selectedHospital}
            hospitalId={selectedIncident?.hospital}
            ambulanceId={selectedIncident?.ambulance}
            hospitals={hospitals}
          />

          {selectedIncident && (
            <button
              type="button"
              onClick={() => openMaps(selectedIncident)}
              className={`${SECONDARY_BUTTON} mt-4 w-full`}
            >
              <Navigation size={16} />
              Open Patient Location in Google Maps
              <ArrowRight size={15} />
            </button>
          )}

          {!ambulanceLocation && selectedIncident?.ambulance && (
            <p className="mt-3 text-sm text-amber-300">
              Ambulance assigned, but valid GPS coordinates were not found
              in its Firestore document.
            </p>
          )}
        </section>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          {/* LEFT COLUMN */}

          <div className="space-y-6 xl:col-span-7">
            {/* INCIDENT MONITORING */}

            <section className={`${PANEL} p-5 sm:p-6`}>
              <Heading
                icon={Siren}
                title="Incident Monitoring"
                subtitle="Select an emergency to coordinate the response."
                action={
                  <button
                    type="button"
                    onClick={() => setFilter("All")}
                    className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"
                    title="Clear filters"
                  >
                    <RefreshCw size={16} />
                  </button>
                }
              />

              <div className="mb-5 flex flex-wrap items-center gap-2">
                <Filter size={16} className="mr-1 text-slate-500" />

                {["All", "Critical", "High", "Moderate"].map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setFilter(item)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                      filter === item
                        ? "bg-cyan-500/10 text-cyan-300"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {incidentsLoading && (
                  <p className="py-8 text-center text-sm text-slate-400">
                    Loading emergency cases...
                  </p>
                )}

                {!incidentsLoading &&
                  !incidentsError &&
                  filteredIncidents.map((incident) => (
                    <button
                      type="button"
                      key={incident.id}
                      onClick={() => {
                        setSelectedId(incident.id);
                        setCorridorIncidentId(incident.id);
                        setCorridorStatus("Not Requested");
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selectedId === incident.id
                          ? "border-cyan-500/40 bg-cyan-500/[0.04]"
                          : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`rounded-xl p-3 ${
                              incident.severity === "Critical"
                                ? "bg-red-500/10 text-red-300"
                                : "bg-orange-500/10 text-orange-300"
                            }`}
                          >
                            <AlertTriangle size={21} />
                          </div>

                          <div>
                            <h3 className="font-semibold text-white">
                              {incident.emergency}
                            </h3>

                            <p className="mt-1 text-xs text-slate-500">
                              {incident.id} · {incident.reportedAt}
                            </p>
                          </div>
                        </div>

                        <StatusBadge status={incident.status} />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <SeverityBadge severity={incident.severity} />

                        <Badge className="border-slate-700 bg-slate-800 text-slate-300">
                          {incident.victims} victim(s)
                        </Badge>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                        <div className="flex items-center gap-2 text-slate-400">
                          <MapPin size={15} className="text-cyan-300" />
                          {incident.location}
                        </div>

                        <div className="flex items-center gap-2 text-slate-400">
                          <Ambulance size={15} />
                          {incident.ambulance}
                        </div>

                        <div className="flex items-center gap-2 text-slate-400 sm:col-span-2">
                          <Hospital size={15} />
                          {hospitals.find(
                            (hospital) =>
                              hospital.id === incident.hospital
                          )
                            ? getHospitalName(
                                hospitals.find(
                                  (hospital) =>
                                    hospital.id === incident.hospital
                                )
                              )
                            : incident.hospital}
                        </div>
                      </div>
                    </button>
                  ))}

                {!incidentsLoading &&
                  !incidentsError &&
                  filteredIncidents.length === 0 && (
                    <p className="py-8 text-center text-sm text-slate-500">
                      No incidents match this filter.
                    </p>
                  )}
              </div>
            </section>

            {/* INCIDENT DETAILS */}

            <section className={`${PANEL} p-5 sm:p-6`}>
              <Heading
                icon={FileText}
                title="Incident Coordination"
                subtitle="Review details and update response status."
              />

              {selectedIncident ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                    <div>
                      <p className="text-xs text-slate-500">
                        EMERGENCY ID
                      </p>

                      <h3 className="mt-1 break-all text-lg font-bold text-white">
                        {selectedIncident.id}
                      </h3>

                      <p className="mt-1 text-sm text-slate-400">
                        {selectedIncident.emergency}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <SeverityBadge severity={selectedIncident.severity} />
                      <StatusBadge status={selectedIncident.status} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex gap-3">
                      <MapPin size={18} className="text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">Location</p>
                        <p className="mt-1 text-sm text-slate-200">
                          {selectedIncident.location}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Users size={18} className="text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">Victims</p>
                        <p className="mt-1 text-sm text-slate-200">
                          {selectedIncident.victims}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Ambulance size={18} className="text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">Assigned unit</p>
                        <p className="mt-1 text-sm text-slate-200">
                          {selectedIncident.ambulance}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Hospital size={18} className="text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">
                          Receiving hospital
                        </p>
                        <p className="mt-1 text-sm text-slate-200">
                          {hospitals.find(
                            (hospital) =>
                              hospital.id === selectedIncident.hospital
                          )
                            ? getHospitalName(
                                hospitals.find(
                                  (hospital) =>
                                    hospital.id === selectedIncident.hospital
                                )
                              )
                            : selectedIncident.hospital}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Incident notes
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {selectedIncident.notes}
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="incident-status"
                      className="mb-2 block text-sm font-semibold text-white"
                    >
                      Update incident status
                    </label>

                    <select
                      id="incident-status"
                      value={selectedIncident.status}
                      disabled={saving}
                      onChange={(event) =>
                        updateIncidentStatus(event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
                    >
                      {INCIDENT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Changes are saved to Firestore and reflected by
                      authorized real-time listeners.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openMaps(selectedIncident)}
                    className={`${SECONDARY_BUTTON} w-full`}
                  >
                    <Navigation size={16} />
                    Open incident location
                    <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  {incidentsLoading
                    ? "Loading incidents..."
                    : "Select an incident to manage it."}
                </p>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN */}

          <div className="space-y-6 xl:col-span-5">
            {/* AMBULANCE DISPATCH */}

            <section className={`${PANEL} p-5 sm:p-6`}>
              <Heading
                icon={Ambulance}
                title="Ambulance Dispatch"
                subtitle="Assign an available vehicle and receiving hospital."
              />

              {selectedIncident && (
                <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <p className="text-xs text-slate-500">
                    Selected emergency
                  </p>

                  <p className="mt-1 font-semibold text-white">
                    {selectedIncident.id}
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    {selectedIncident.emergency}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="ambulance-select"
                    className="mb-2 block text-sm font-medium text-slate-300"
                  >
                    Available ambulance
                  </label>

                  <select
                    id="ambulance-select"
                    value={selectedAmbulanceId}
                    onChange={(event) =>
                      setAssignmentAmbulance(event.target.value)
                    }
                    disabled={saving || ambulancesLoading}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
                  >
                    <option value="">Select ambulance</option>

                    {availableAmbulances.map((item) => (
                      <option key={item.documentId} value={item.id}>
                        {item.id} — {item.type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="hospital-select"
                    className="mb-2 block text-sm font-medium text-slate-300"
                  >
                    Receiving hospital
                  </label>

                  <select
                    id="hospital-select"
                    value={selectedHospitalId}
                    onChange={(event) =>
                      setAssignmentHospital(event.target.value)
                    }
                    disabled={saving || hospitals.length === 0}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
                  >
                    <option value="">Select hospital</option>

                    {hospitals.map((hospital) => (
                      <option key={hospital.id} value={hospital.id}>
                        {getHospitalName(hospital)}
                      </option>
                    ))}
                  </select>
                </div>

                {ambulancesError && (
                  <p className="text-sm text-red-300">
                    {ambulancesError}
                  </p>
                )}

                {hospitals.length === 0 && (
                  <p className="text-sm text-amber-300">
                    No hospital records found. Check the Hospitals collection.
                  </p>
                )}

                <button
                  type="button"
                  onClick={assignAmbulance}
                  disabled={
                    saving ||
                    !selectedIncident ||
                    !selectedAmbulanceId ||
                    !selectedHospitalId ||
                    selectedIncident.status === "Completed" ||
                    selectedIncident.status === "Rejected"
                  }
                  className={`${PRIMARY_BUTTON} w-full`}
                >
                  {saving ? (
                    <RefreshCw size={17} className="animate-spin" />
                  ) : (
                    <Check size={17} />
                  )}

                  {saving ? "Saving..." : "Assign Ambulance (Manual Override)"}
                </button>

                {/* Auto-dispatch button */}
                <button
                  type="button"
                  id="auto-dispatch-btn"
                  disabled={
                    dispatchBusy ||
                    saving ||
                    !selectedIncident ||
                    !selectedIncident.latitude ||
                    ["Completed", "Rejected", "Ambulance Assigned"].includes(
                      selectedIncident.status
                    )
                  }
                  onClick={async () => {
                    if (!selectedIncident) return;
                    if (!selectedIncident.latitude) {
                      notify("This emergency has no GPS coordinates. Auto-dispatch requires a patient GPS location.");
                      return;
                    }
                    setDispatchBusy(true);
                    try {
                      const result = await autoDispatch(selectedIncident.id, {
                        latitude: selectedIncident.latitude,
                        longitude: selectedIncident.longitude,
                      });
                      if (result.success) {
                        notify(`Auto-dispatched: ${result.ambulanceId} → ${result.hospitalName || result.hospitalId}${result.distanceKm ? ` (${result.distanceKm} km)` : ""}`);
                      } else if (result.reason === "no_ambulance") {
                        notify("No available ambulances found. Emergency marked Awaiting Ambulance.");
                      } else if (result.reason === "no_hospital") {
                        notify("No nearby hospital has verified coordinates and suitable available capacity. Assign a hospital manually.");
                      } else {
                        notify(`Auto-dispatch failed: ${result.message}`);
                      }
                    } catch (err) {
                      notify(`Auto-dispatch error: ${err.message}`);
                    } finally {
                      setDispatchBusy(false);
                    }
                  }}
                  className={`${SECONDARY_BUTTON} w-full`}
                >
                  {dispatchBusy ? (
                    <RefreshCw size={17} className="animate-spin" />
                  ) : (
                    <Radio size={17} />
                  )}
                  {dispatchBusy ? "Auto-dispatching..." : "Auto-Dispatch (Nearest Available)"}
                </button>

                {availableAmbulances.length === 0 &&
                  !ambulancesLoading && (
                    <p className="text-xs leading-5 text-amber-300">
                      No available ambulances were found in Firebase.
                    </p>
                  )}
              </div>
            </section>

            {/* FLEET */}

            <section className={`${PANEL} p-5 sm:p-6`}>
              <Heading
                icon={Radio}
                title="Fleet Status"
                subtitle="Reported Firestore status; confirm operational readiness before dispatch."
                action={
                  <span className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300">
                    {ambulances.length} units
                  </span>
                }
              />

              {ambulancesLoading ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Loading fleet...
                </p>
              ) : (
                <div className="space-y-3">
                  {ambulances.map((item) => {
                    const isAvailable = [
                      "Available",
                      "available",
                      "ONLINE",
                      "Online",
                    ].includes(item.status);

                    return (
                      <div
                        key={item.documentId}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-300">
                            <Ambulance size={19} />
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-white">
                              {item.id}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {item.type}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {item.latitude != null &&
                              item.longitude != null
                                ? `${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`
                                : "GPS unavailable"}
                            </p>
                          </div>
                        </div>

                        <Badge
                          className={
                            isAvailable
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                          }
                        >
                          {item.status}
                        </Badge>
                      </div>
                    );
                  })}

                  {ambulances.length === 0 && (
                    <p className="py-6 text-center text-sm text-slate-500">
                      No ambulance records found.
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* GREEN CORRIDOR */}

            <section className={`${PANEL} p-5 sm:p-6`}>
              <Heading
                icon={TrafficCone}
                title="Green Corridor Coordination"
                subtitle="Demonstration-only workflow."
              />

              <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <p className="text-xs text-slate-500">Incident</p>

                <select
                  value={corridorIncidentId}
                  onChange={(event) => {
                    setCorridorIncidentId(event.target.value);
                    setCorridorStatus("Not Requested");
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-cyan-500"
                >
                  <option value="">Select incident</option>

                  {incidents.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id} — {item.emergency}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4 flex items-start gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-300">
                  <Route size={19} />
                </div>

                <div>
                  <p className="text-sm font-semibold text-white">
                    Corridor status
                  </p>

                  <p className="mt-1 text-sm text-cyan-300">
                    {corridorStatus}
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    This section does not contact traffic signals or
                    government traffic-control systems.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  "Not Requested",
                  "Requested",
                  "Pending Authorization",
                  "Approved",
                  "Completed",
                  "Rejected",
                ].map((status) => (
                  <button
                    type="button"
                    key={status}
                    disabled={!corridorIncidentId}
                    onClick={() => updateCorridorStatus(status)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-sm transition ${
                      corridorStatus === status
                        ? "border-cyan-500/40 bg-cyan-500/5 text-cyan-300"
                        : "border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-white"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {status}

                    {corridorStatus === status && (
                      <CheckCircle2 size={16} />
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck
                    size={18}
                    className="mt-0.5 shrink-0 text-amber-300"
                  />

                  <p className="text-xs leading-5 text-slate-400">
                    Corridor status is stored only in this browser's
                    component state. Approval here is not real-world
                    authorization.
                  </p>
                </div>
              </div>
            </section>

            {/* SUMMARY */}

            <section className={`${PANEL} p-5 sm:p-6`}>
              <Heading
                icon={Activity}
                title="Coordination Summary"
                subtitle="Current Firestore state."
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-400">
                    Open incidents
                  </span>
                  <span className="font-semibold text-white">
                    {activeIncidents.length}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-400">
                    Available vehicles
                  </span>
                  <span className="font-semibold text-emerald-300">
                    {availableAmbulances.length}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-400">
                    Critical incidents
                  </span>
                  <span className="font-semibold text-red-300">
                    {
                      incidents.filter(
                        (item) =>
                          item.severity === "Critical" &&
                          !["Completed", "Rejected"].includes(item.status)
                      ).length
                    }
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-400">
                    Selected incident
                  </span>
                  <span className="break-all text-right font-semibold text-cyan-300">
                    {selectedIncident?.id || "—"}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>

        <footer className="mt-8 border-t border-slate-800 py-6 text-xs text-slate-500">
          <div className="flex flex-col justify-between gap-3 sm:flex-row">
            <p>
              © {new Date().getFullYear()} Astralife AI · Control Room
            </p>

            <a href="/" className="hover:text-white">
              Back to home
            </a>
          </div>
        </footer>
      </main>

      {notification && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-emerald-500/30 bg-slate-900 p-4 shadow-2xl"
        >
          <CheckCircle2
            size={19}
            className="mt-0.5 shrink-0 text-emerald-300"
          />

          <p className="text-sm text-slate-200">{notification}</p>

          <button
            type="button"
            onClick={() => setNotification("")}
            aria-label="Dismiss notification"
            className="text-slate-500 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
