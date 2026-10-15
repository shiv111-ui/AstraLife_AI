import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../assets/firebase";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Ambulance,
  ArrowRight,
  BedDouble,
  Bell,
  Check,
  CheckCircle2,
  Clock3,
  ClipboardList,
  FileText,
  HeartPulse,
  Hospital,
  Info,
  MapPin,
  Menu,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
  Wifi,
  LogOut,
  X,
} from "lucide-react";

const INITIAL_CASES = [
  {
    id: "AST-2048",
    patient: "Emergency Patient",
    emergency: "Cardiac Emergency",
    severity: "Critical",
    status: "Incoming",
    eta: "6 min",
    victims: 1,
    location: "Near City Central Road",
    ambulance: "AMB-01",
    reportedAt: "2 min ago",
    notes: "Urgent cardiac assessment may be required.",
  },
  {
    id: "AST-2051",
    patient: "Emergency Patient",
    emergency: "Road Accident",
    severity: "High",
    status: "Preparing",
    eta: "10 min",
    victims: 2,
    location: "University Road Junction",
    ambulance: "AMB-03",
    reportedAt: "5 min ago",
    notes: "Multiple victims reported. Details require verification.",
  },
  {
    id: "AST-2055",
    patient: "Emergency Patient",
    emergency: "Breathing Difficulty",
    severity: "Moderate",
    status: "Received",
    eta: "15 min",
    victims: 1,
    location: "Central Market",
    ambulance: "AMB-02",
    reportedAt: "8 min ago",
    notes: "Respiratory complaint reported by the caller.",
  },
];

const INITIAL_BEDS = {
  general: { total: 30, occupied: 18 },
  icu: { total: 10, occupied: 7 },
  emergency: { total: 8, occupied: 4 },
};

const SEVERITY_STYLE = {
  Critical: "border-red-500/30 bg-red-500/10 text-red-300",
  High: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  Moderate: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

const STATUS_STYLE = {
  Incoming: "border-red-500/30 bg-red-500/10 text-red-300",
  Received: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  Preparing: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  "Ready for Handover":
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  Completed:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

const panel =
  "rounded-2xl border border-slate-800 bg-slate-900/80 shadow-lg shadow-black/10";

const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40";

const buttonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700";

function SectionHeading({ icon: Icon, title, subtitle, action }) {
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
    <Badge className={STATUS_STYLE[status] || STATUS_STYLE.Received}>
      {status}
    </Badge>
  );
}

function BedCard({ title, beds, onChange }) {
  const available = beds.total - beds.occupied;
  const percentage =
    beds.total > 0 ? (beds.occupied / beds.total) * 100 : 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-200">{title}</p>
        <BedDouble size={18} className="text-cyan-300" />
      </div>

      <p className="mt-4 text-2xl font-bold text-white">
        {available}
        <span className="ml-2 text-sm font-normal text-slate-500">
          available
        </span>
      </p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${
            percentage >= 85 ? "bg-red-500" : "bg-cyan-400"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{beds.occupied} occupied</span>
        <span>{beds.total} total</span>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() =>
            onChange(Math.max(0, beds.occupied - 1))
          }
          disabled={beds.occupied === 0}
          className="flex-1 rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-30"
        >
          − Occupied
        </button>
        <button
          type="button"
          onClick={() =>
            onChange(Math.min(beds.total, beds.occupied + 1))
          }
          disabled={beds.occupied === beds.total}
          className="flex-1 rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-30"
        >
          + Occupied
        </button>
      </div>
    </div>
  );
}

export default function HospitalDashboard() {
  const [cases, setCases] = useState(INITIAL_CASES);
  const [beds, setBeds] = useState(INITIAL_BEDS);
  const [selectedId, setSelectedId] = useState("AST-2048");
  const [filter, setFilter] = useState("All");
  const [online, setOnline] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notification, setNotification] = useState("");
  const [showBedEditor, setShowBedEditor] = useState(false);

  const selectedCase = cases.find((item) => item.id === selectedId);

  const incomingCases = useMemo(
    () =>
      cases.filter(
        (item) =>
          item.status !== "Completed" &&
          item.status !== "Ready for Handover"
      ),
    [cases]
  );

  const criticalCases = cases.filter(
    (item) => item.severity === "Critical" && item.status !== "Completed"
  );

  const filteredCases =
    filter === "All"
      ? cases
      : cases.filter((item) => item.status === filter);

  const availableBeds = Object.values(beds).reduce(
    (sum, item) => sum + item.total - item.occupied,
    0
  );

  function notify(message) {
    setNotification(message);
    window.setTimeout(() => setNotification(""), 3000);
  }

  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
      notify("Unable to log out. Please try again.");
    }
  }

  function updateCaseStatus(id, status) {
    setCases((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, status } : item
      )
    );
    notify(`Case ${id} updated to ${status}.`);
  }

  function updateBeds(type, occupied) {
    setBeds((previous) => ({
      ...previous,
      [type]: { ...previous[type], occupied },
    }));
  }

  function addDemoCase() {
    const newCase = {
      id: `AST-${Math.floor(2100 + Math.random() * 800)}`,
      patient: "New Demonstration Patient",
      emergency: "Medical Emergency",
      severity: "High",
      status: "Incoming",
      eta: "12 min",
      victims: 1,
      location: "Demonstration Location",
      ambulance: "AMB-04",
      reportedAt: "Just now",
      notes: "Sample case created from the Hospital Dashboard.",
    };

    setCases((previous) => [newCase, ...previous]);
    setSelectedId(newCase.id);
    notify("A demonstration case has been added.");
  }

  function openMaps(item) {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      item.location
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600">
              <Hospital size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                ASTRALIFE <span className="text-red-400">AI</span>
              </h1>
              <p className="text-xs text-slate-400">Hospital Operations</p>
            </div>
          </a>

          <div className="hidden items-center gap-3 md:flex">
            <span
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                online
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
                  : "border-slate-700 bg-slate-900 text-slate-400"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  online ? "bg-emerald-400" : "bg-slate-500"
                }`}
              />
              {online ? "Receiving cases" : "Unavailable"}
            </span>

            <button
              type="button"
              onClick={() => setOnline((value) => !value)}
              className={buttonSecondary}
            >
              <Wifi size={16} />
              {online ? "Set Unavailable" : "Set Available"}
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className={buttonSecondary}
          >
            <LogOut size={16} />
            Logout
          </button>

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
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setOnline((value) => !value)}
                className={`${buttonSecondary} w-full`}
              >
                <Wifi size={16} />
                {online ? "Set Unavailable" : "Set Available"}
              </button>
                
              <button
                type="button"
                onClick={handleLogout}
                className={`${buttonSecondary} w-full`}
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-7 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <Info size={20} className="mt-0.5 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-semibold text-amber-200">
              Demonstration mode
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Cases and bed counts are local sample data. This dashboard
              is not connected to a hospital information system, patient
              records, or a live ambulance network.
            </p>
          </div>
        </div>

        <section className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-cyan-300">
              <Activity size={17} />
              Emergency Care Network
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Hospital Dashboard
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Review incoming emergencies, prepare response teams,
              monitor bed availability and manage patient handovers.
            </p>
          </div>

          <button
            type="button"
            onClick={addDemoCase}
            disabled={!online}
            className={buttonPrimary}
          >
            <Plus size={17} />
            Add Demo Case
          </button>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={ClipboardList}
            label="Open Cases"
            value={incomingCases.length}
            description="Cases not yet completed"
            color="cyan"
          />
          <StatCard
            icon={AlertTriangle}
            label="Critical Cases"
            value={criticalCases.length}
            description="Require immediate review"
            color="red"
          />
          <StatCard
            icon={BedDouble}
            label="Available Beds"
            value={availableBeds}
            description="Across all configured categories"
            color="green"
          />
          <StatCard
            icon={Ambulance}
            label="Incoming Ambulances"
            value={
              cases.filter(
                (item) =>
                  item.status === "Incoming" ||
                  item.status === "Preparing"
              ).length
            }
            description="Based on sample case statuses"
            color="amber"
          />
        </section>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-7">
            <section className={`${panel} p-5 sm:p-6`}>
              <SectionHeading
                icon={Bell}
                title="Incoming Emergency Cases"
                subtitle="Select a case to review its details."
                action={
                  <span className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
                    {filteredCases.length} cases
                  </span>
                }
              />

              <div className="mb-5 flex flex-wrap gap-2">
                {["All", "Incoming", "Received", "Preparing", "Ready for Handover", "Completed"].map(
                  (item) => (
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
                  )
                )}
              </div>

              <div className="space-y-3">
                {filteredCases.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedId === item.id
                        ? "border-cyan-500/40 bg-cyan-500/[0.04]"
                        : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`rounded-xl p-3 ${
                            item.severity === "Critical"
                              ? "bg-red-500/10 text-red-300"
                              : "bg-orange-500/10 text-orange-300"
                          }`}
                        >
                          <HeartPulse size={21} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">
                            {item.emergency}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.id} · {item.ambulance}
                          </p>
                        </div>
                      </div>

                      <StatusBadge status={item.status} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <SeverityBadge severity={item.severity} />
                      <Badge className="border-slate-700 bg-slate-800 text-slate-300">
                        {item.victims} reported victim(s)
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div className="flex items-center gap-2 text-slate-400">
                        <MapPin size={15} className="text-cyan-300" />
                        {item.location}
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock3 size={15} />
                        ETA: {item.eta}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
                      <span className="text-xs text-slate-500">
                        Reported {item.reportedAt}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-cyan-300">
                        View details <ArrowRight size={14} />
                      </span>
                    </div>
                  </button>
                ))}

                {filteredCases.length === 0 && (
                  <div className="py-10 text-center text-sm text-slate-500">
                    No cases match this filter.
                  </div>
                )}
              </div>
            </section>

            <section className={`${panel} p-5 sm:p-6`}>
              <SectionHeading
                icon={FileText}
                title="Selected Patient Case"
                subtitle="Review the incident and update its hospital status."
              />

              {selectedCase ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                    <div>
                      <p className="text-xs text-slate-500">CASE ID</p>
                      <h3 className="mt-1 text-lg font-bold text-white">
                        {selectedCase.id}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {selectedCase.patient}
                      </p>
                    </div>
                    <SeverityBadge severity={selectedCase.severity} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex gap-3">
                      <UserRound size={18} className="text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">
                          Patient / Reporter
                        </p>
                        <p className="mt-1 text-sm text-slate-200">
                          {selectedCase.patient}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Ambulance size={18} className="text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">
                          Ambulance
                        </p>
                        <p className="mt-1 text-sm text-slate-200">
                          {selectedCase.ambulance}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <MapPin size={18} className="text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">
                          Incident location
                        </p>
                        <p className="mt-1 text-sm text-slate-200">
                          {selectedCase.location}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Users size={18} className="text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">
                          Reported victims
                        </p>
                        <p className="mt-1 text-sm text-slate-200">
                          {selectedCase.victims}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Incident notes
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {selectedCase.notes}
                    </p>
                  </div>

                  <div>
                    <p className="mb-3 text-sm font-semibold text-white">
                      Hospital response
                    </p>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {[
                        { status: "Received", label: "Mark Received" },
                        { status: "Preparing", label: "Prepare Team" },
                        {
                          status: "Ready for Handover",
                          label: "Ready for Handover",
                        },
                        { status: "Completed", label: "Complete Case" },
                      ].map((action) => (
                        <button
                          type="button"
                          key={action.status}
                          disabled={
                            !online ||
                            selectedCase.status === action.status
                          }
                          onClick={() =>
                            updateCaseStatus(selectedCase.id, action.status)
                          }
                          className={
                            action.status === "Completed"
                              ? `${buttonPrimary} w-full`
                              : `${buttonSecondary} w-full`
                          }
                        >
                          <CheckCircle2 size={16} />
                          {action.label}
                        </button>
                      ))}
                    </div>

                    {!online && (
                      <p className="mt-3 text-xs text-amber-300">
                        Set the hospital to available before changing case status.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => openMaps(selectedCase)}
                    className={`${buttonSecondary} w-full`}
                  >
                    <MapPin size={16} />
                    Open incident location in Maps
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Select a case to review its details.
                </p>
              )}
            </section>
          </div>

          <div className="space-y-6 xl:col-span-5">
            <section className={`${panel} p-5 sm:p-6`}>
              <SectionHeading
                icon={BedDouble}
                title="Bed Availability"
                subtitle="Update sample occupancy figures."
                action={
                  <button
                    type="button"
                    onClick={() => setShowBedEditor((value) => !value)}
                    className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"
                    aria-label="Toggle bed editor"
                  >
                    <RefreshCw size={16} />
                  </button>
                }
              />

              {showBedEditor && (
                <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs leading-5 text-slate-400">
                  Use the controls on each category to adjust the
                  demonstration occupied-bed count. Total capacity remains
                  fixed in this prototype.
                </div>
              )}

              <div className="space-y-4">
                <BedCard
                  title="General Ward"
                  beds={beds.general}
                  onChange={(value) => updateBeds("general", value)}
                />
                <BedCard
                  title="Intensive Care Unit (ICU)"
                  beds={beds.icu}
                  onChange={(value) => updateBeds("icu", value)}
                />
                <BedCard
                  title="Emergency Department"
                  beds={beds.emergency}
                  onChange={(value) => updateBeds("emergency", value)}
                />
              </div>
            </section>

            <section className={`${panel} p-5 sm:p-6`}>
              <SectionHeading
                icon={Stethoscope}
                title="Emergency Team Readiness"
                subtitle="Illustrative readiness checklist."
              />

              <div className="space-y-4">
                {[
                  {
                    title: "Emergency response team",
                    description: "Team availability must be confirmed locally.",
                    icon: Users,
                  },
                  {
                    title: "Emergency department",
                    description: "Review current department capacity.",
                    icon: Hospital,
                  },
                  {
                    title: "Patient handover",
                    description: "Verify patient details and handover records.",
                    icon: ClipboardList,
                  },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.title} className="flex items-start gap-3">
                      <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-300">
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex gap-2.5">
                  <ShieldCheck
                    size={18}
                    className="mt-0.5 shrink-0 text-amber-300"
                  />
                  <p className="text-xs leading-5 text-slate-400">
                    Sample readiness indicators are not a substitute for
                    verified clinical staffing, equipment or bed-management
                    systems.
                  </p>
                </div>
              </div>
            </section>

            <section className={`${panel} p-5 sm:p-6`}>
              <SectionHeading
                icon={Activity}
                title="Hospital Activity"
                subtitle="Recent status changes in this session."
              />

              <div className="space-y-3">
                {cases
                  .filter(
                    (item) =>
                      item.status === "Completed" ||
                      item.status === "Ready for Handover"
                  )
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3"
                    >
                      <CheckCircle2
                        size={19}
                        className="mt-0.5 text-emerald-300"
                      />
                      <div>
                        <p className="text-sm text-slate-200">
                          {item.emergency}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.id} · {item.status}
                        </p>
                      </div>
                    </div>
                  ))}

                {cases.every(
                  (item) =>
                    item.status !== "Completed" &&
                    item.status !== "Ready for Handover"
                ) && (
                  <p className="py-4 text-center text-sm text-slate-500">
                    No completed handovers yet.
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>

        <footer className="mt-8 border-t border-slate-800 py-6 text-xs text-slate-500">
          <div className="flex flex-col justify-between gap-3 sm:flex-row">
            <p>
              © {new Date().getFullYear()} Astralife AI · Hospital Prototype
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