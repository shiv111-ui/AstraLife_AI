import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Ambulance,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Clock3,
  Command,
  FileText,
  Filter,
  Hospital,
  Info,
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
  Wifi,
  X,
  Zap,
} from "lucide-react";

const INITIAL_INCIDENTS = [
  {
    id: "AST-2048",
    emergency: "Cardiac Emergency",
    severity: "Critical",
    status: "Reported",
    location: "Near City Central Road",
    reportedAt: "2 min ago",
    victims: 1,
    ambulance: "Unassigned",
    hospital: "City General Hospital",
    notes: "Urgent medical response requested.",
    corridor: "Not Requested",
  },
  {
    id: "AST-2051",
    emergency: "Road Accident",
    severity: "High",
    status: "Assigned",
    location: "University Road Junction",
    reportedAt: "5 min ago",
    victims: 2,
    ambulance: "AMB-02",
    hospital: "Central Medical Centre",
    notes: "Multiple victims reported. Verify details on arrival.",
    corridor: "Pending Review",
  },
  {
    id: "AST-2055",
    emergency: "Breathing Difficulty",
    severity: "Moderate",
    status: "En Route",
    location: "Central Market",
    reportedAt: "8 min ago",
    victims: 1,
    ambulance: "AMB-03",
    hospital: "City General Hospital",
    notes: "Medical assistance requested.",
    corridor: "Not Requested",
  },
];

const INITIAL_AMBULANCES = [
  { id: "AMB-01", type: "Basic Life Support", status: "Available" },
  { id: "AMB-02", type: "Advanced Life Support", status: "Assigned" },
  { id: "AMB-03", type: "Basic Life Support", status: "En Route" },
  { id: "AMB-04", type: "Advanced Life Support", status: "Available" },
];

const HOSPITALS = [
  "City General Hospital",
  "Central Medical Centre",
  "District Emergency Hospital",
];

const INCIDENT_STATUSES = [
  "Reported",
  "Verified",
  "Assigned",
  "En Route",
  "At Scene",
  "Transporting",
  "At Hospital",
  "Completed",
];

const SEVERITY_STYLE = {
  Critical: "border-red-500/30 bg-red-500/10 text-red-300",
  High: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  Moderate: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

const STATUS_STYLE = {
  Reported: "border-red-500/30 bg-red-500/10 text-red-300",
  Verified: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  Assigned: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  "En Route": "border-sky-500/30 bg-sky-500/10 text-sky-300",
  "At Scene": "border-violet-500/30 bg-violet-500/10 text-violet-300",
  Transporting: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
  "At Hospital": "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  Completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

const panel =
  "rounded-2xl border border-slate-800 bg-slate-900/80 shadow-lg shadow-black/10";

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40";

const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40";

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
    <div className={`${panel} p-5`}>
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
    <Badge className={SEVERITY_STYLE[severity] || SEVERITY_STYLE.Moderate}>
      {severity}
    </Badge>
  );
}

function StatusBadge({ status }) {
  return (
    <Badge className={STATUS_STYLE[status] || STATUS_STYLE.Reported}>
      {status}
    </Badge>
  );
}

export default function ControlRoomDashboard() {
  const [incidents, setIncidents] = useState(INITIAL_INCIDENTS);
  const [ambulances, setAmbulances] = useState(INITIAL_AMBULANCES);
  const [selectedId, setSelectedId] = useState("AST-2048");
  const [filter, setFilter] = useState("All");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notification, setNotification] = useState("");
  const [assignmentAmbulance, setAssignmentAmbulance] = useState("AMB-01");
  const [assignmentHospital, setAssignmentHospital] = useState(
    "City General Hospital"
  );
  const [corridorStatus, setCorridorStatus] = useState("Not Requested");
  const [corridorIncidentId, setCorridorIncidentId] = useState("AST-2048");

  const selectedIncident = incidents.find(
    (item) => item.id === selectedId
  );

  const activeIncidents = useMemo(
    () => incidents.filter((item) => item.status !== "Completed"),
    [incidents]
  );

  const filteredIncidents =
    filter === "All"
      ? incidents
      : incidents.filter((item) => item.severity === filter);

  const availableAmbulances = ambulances.filter(
    (item) => item.status === "Available"
  );

  const assignedCount = ambulances.filter(
    (item) => item.status !== "Available"
  ).length;

  function notify(message) {
    setNotification(message);
    window.setTimeout(() => setNotification(""), 3000);
  }

  function updateIncident(id, changes) {
    setIncidents((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, ...changes } : item
      )
    );
  }

  function assignAmbulance() {
    if (!selectedIncident) return;

    if (selectedIncident.status === "Completed") {
      notify("Completed incidents cannot receive a new assignment.");
      return;
    }

    const vehicle = ambulances.find(
      (item) => item.id === assignmentAmbulance
    );

    if (!vehicle || vehicle.status !== "Available") {
      notify("Select an available ambulance.");
      return;
    }

    setAmbulances((previous) =>
      previous.map((item) =>
        item.id === assignmentAmbulance
          ? { ...item, status: "Assigned" }
          : item
      )
    );

    updateIncident(selectedIncident.id, {
      ambulance: assignmentAmbulance,
      hospital: assignmentHospital,
      status: "Assigned",
    });

    setCorridorIncidentId(selectedIncident.id);
    setAssignmentAmbulance(
      ambulances.find(
        (item) =>
          item.id !== assignmentAmbulance &&
          item.status === "Available"
      )?.id || ""
    );

    notify(
      `${assignmentAmbulance} assigned to ${selectedIncident.id} in the demo.`
    );
  }

  function updateIncidentStatus(status) {
    if (!selectedIncident) return;

    updateIncident(selectedIncident.id, { status });

    if (status === "Completed" && selectedIncident.ambulance !== "Unassigned") {
      setAmbulances((previous) =>
        previous.map((item) =>
          item.id === selectedIncident.ambulance
            ? { ...item, status: "Available" }
            : item
        )
      );
    }

    notify(`Incident status changed to "${status}".`);
  }

  function updateCorridorStatus(status) {
    setCorridorStatus(status);

    updateIncident(corridorIncidentId, {
      corridor: status,
    });

    notify(`Corridor status updated to "${status}".`);
  }

  function addDemoIncident() {
    const newIncident = {
      id: `AST-${Math.floor(2100 + Math.random() * 800)}`,
      emergency: "Medical Emergency",
      severity: "High",
      status: "Reported",
      location: "Demonstration Location",
      reportedAt: "Just now",
      victims: 1,
      ambulance: "Unassigned",
      hospital: "City General Hospital",
      notes: "Sample incident created by the control room operator.",
      corridor: "Not Requested",
    };

    setIncidents((previous) => [newIncident, ...previous]);
    setSelectedId(newIncident.id);
    setCorridorIncidentId(newIncident.id);
    setCorridorStatus("Not Requested");
    notify("A demonstration incident has been created.");
  }

  function openMaps(incident) {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      incident.location
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function exportReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      demonstrationOnly: true,
      incidents,
      ambulances,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "astralife-control-room-demo-report.json";
    anchor.click();

    URL.revokeObjectURL(url);
    notify("Demonstration report exported.");
  }

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
            <span className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Demo system online
            </span>

            <button
              type="button"
              onClick={() =>
                notify("There are no live network notifications in this demo.")
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
            <p className="text-sm text-emerald-300">
              Demonstration system online
            </p>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-7 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <Info size={20} className="mt-0.5 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-semibold text-amber-200">
              Simulation only
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Incident data, ambulance assignments and corridor statuses are
              stored only in this browser session. No real emergency services
              are contacted. Green-corridor actions are illustrative only;
              real traffic coordination requires authorization from the
              appropriate authorities.
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
              Review incidents, coordinate ambulance assignments, select
              receiving hospitals and monitor response progress.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={addDemoIncident}
              className={primaryButton}
            >
              <Siren size={16} />
              New Demo Incident
            </button>

            <button
              type="button"
              onClick={exportReport}
              className={secondaryButton}
            >
              <FileText size={16} />
              Export Report
            </button>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Siren}
            label="Active Incidents"
            value={activeIncidents.length}
            description="Incidents not yet completed"
            color="red"
          />
          <StatCard
            icon={Ambulance}
            label="Available Ambulances"
            value={availableAmbulances.length}
            description="Vehicles available in the demo"
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
            value={incidents.filter((item) => item.status === "Completed").length}
            description="Closed during this demo session"
            color="green"
          />
        </section>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-7">
            <section className={`${panel} p-5 sm:p-6`}>
              <Heading
                icon={Siren}
                title="Incident Monitoring"
                subtitle="Select an incident to coordinate its response."
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
                {filteredIncidents.map((incident) => (
                  <button
                    type="button"
                    key={incident.id}
                    onClick={() => {
                      setSelectedId(incident.id);
                      setCorridorIncidentId(incident.id);
                      setCorridorStatus(incident.corridor);
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
                        {incident.hospital}
                      </div>
                    </div>
                  </button>
                ))}

                {filteredIncidents.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No incidents match this filter.
                  </p>
                )}
              </div>
            </section>

            <section className={`${panel} p-5 sm:p-6`}>
              <Heading
                icon={FileText}
                title="Incident Coordination"
                subtitle="Review details and manage response status."
              />

              {selectedIncident ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                    <div>
                      <p className="text-xs text-slate-500">INCIDENT ID</p>
                      <h3 className="mt-1 text-lg font-bold text-white">
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
                        <p className="text-xs text-slate-500">Receiving hospital</p>
                        <p className="mt-1 text-sm text-slate-200">
                          {selectedIncident.hospital}
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
                      These updates only affect this browser's demonstration data.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openMaps(selectedIncident)}
                    className={`${secondaryButton} w-full`}
                  >
                    <Navigation size={16} />
                    Open incident location
                    <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Select an incident to manage it.
                </p>
              )}
            </section>
          </div>

          <div className="space-y-6 xl:col-span-5">
            <section className={`${panel} p-5 sm:p-6`}>
              <Heading
                icon={Ambulance}
                title="Ambulance Dispatch"
                subtitle="Assign an available demonstration vehicle."
              />

              {selectedIncident && (
                <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <p className="text-xs text-slate-500">Selected incident</p>
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
                    value={assignmentAmbulance}
                    onChange={(event) =>
                      setAssignmentAmbulance(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
                  >
                    <option value="">Select ambulance</option>
                    {availableAmbulances.map((item) => (
                      <option key={item.id} value={item.id}>
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
                    value={assignmentHospital}
                    onChange={(event) =>
                      setAssignmentHospital(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
                  >
                    {HOSPITALS.map((hospital) => (
                      <option key={hospital} value={hospital}>
                        {hospital}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={assignAmbulance}
                  disabled={
                    !selectedIncident ||
                    !assignmentAmbulance ||
                    selectedIncident.status === "Completed"
                  }
                  className={`${primaryButton} w-full`}
                >
                  <Check size={17} />
                  Assign Ambulance
                </button>

                {availableAmbulances.length === 0 && (
                  <p className="text-xs leading-5 text-amber-300">
                    No demonstration ambulances are currently marked available.
                  </p>
                )}
              </div>
            </section>

            <section className={`${panel} p-5 sm:p-6`}>
              <Heading
                icon={Radio}
                title="Fleet Status"
                subtitle="Sample ambulance availability."
                action={
                  <span className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300">
                    {ambulances.length} units
                  </span>
                }
              />

              <div className="space-y-3">
                {ambulances.map((item) => {
                  const isAvailable = item.status === "Available";

                  return (
                    <div
                      key={item.id}
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
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Fleet status changes when a vehicle is assigned or an incident
                is marked completed. Live GPS and vehicle telemetry are not
                connected.
              </p>
            </section>

            <section className={`${panel} p-5 sm:p-6`}>
              <Heading
                icon={TrafficCone}
                title="Green Corridor Coordination"
                subtitle="Simulated request and approval workflow."
              />

              <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <p className="text-xs text-slate-500">Incident</p>
                <select
                  value={corridorIncidentId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setCorridorIncidentId(id);
                    const incident = incidents.find((item) => item.id === id);
                    setCorridorStatus(
                      incident?.corridor || "Not Requested"
                    );
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-cyan-500"
                >
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
                    No traffic signal or road-control systems are connected.
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
                    onClick={() => updateCorridorStatus(status)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-sm transition ${
                      corridorStatus === status
                        ? "border-cyan-500/40 bg-cyan-500/5 text-cyan-300"
                        : "border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-white"
                    }`}
                  >
                    {status}
                    {corridorStatus === status && <CheckCircle2 size={16} />}
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
                    An application status of Approved is only a simulation.
                    Real corridor activation must be authorized and coordinated
                    by the appropriate traffic and emergency authorities.
                  </p>
                </div>
              </div>
            </section>

            <section className={`${panel} p-5 sm:p-6`}>
              <Heading
                icon={Activity}
                title="Coordination Summary"
                subtitle="Current demonstration state."
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
                          item.status !== "Completed"
                      ).length
                    }
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-400">
                    Selected incident
                  </span>
                  <span className="font-semibold text-cyan-300">
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
              © {new Date().getFullYear()} Astralife AI · Control Room Prototype
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