import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../assets/firebase";



import { useMemo, useState } from "react";
import {
  Activity,
  Ambulance,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileText,
  Gauge,
  HeartPulse,
  History,
  Hospital,
  Info,
  LocateFixed,
  LogOut,
  MapPin,
  Menu,
  Navigation,
  Phone,
  Radio,
  Route,
  ShieldCheck,
  Siren,
  Smartphone,
  UserRound,
  Users,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";

const INITIAL_MISSIONS = [
  {
    id: "AST-2048",
    patient: "Emergency Patient",
    emergency: "Cardiac Emergency",
    severity: "Critical",
    status: "Assigned",
    distance: "2.4 km",
    eta: "6 min",
    reportedAt: "2 min ago",
    phone: "Not provided",
    location: "Near City Central Road",
    destination: "City General Hospital",
    coordinates: "18.5204, 73.8567",
    victims: "1",
    description:
      "Patient requires urgent medical assistance. Please verify details at the incident location.",
  },
  {
    id: "AST-2042",
    patient: "Emergency Patient",
    emergency: "Road Accident",
    severity: "High",
    status: "Completed",
    distance: "4.1 km",
    eta: "9 min",
    reportedAt: "Today, earlier",
    phone: "Not provided",
    location: "University Road Junction",
    destination: "Central Medical Centre",
    coordinates: "18.5314, 73.8446",
    victims: "2",
    description: "Road accident reported. Victim count requires verification.",
  },
];

const WORKFLOW = [
  "Assigned",
  "Accepted",
  "En Route",
  "At Scene",
  "Patient Onboard",
  "At Hospital",
  "Completed",
];

const SEVERITY_STYLES = {
  Critical: "border-red-500/30 bg-red-500/10 text-red-300",
  High: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  Moderate: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

const STATUS_STYLES = {
  Assigned: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  Accepted: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  "En Route": "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  "At Scene": "border-violet-500/30 bg-violet-500/10 text-violet-300",
  "Patient Onboard":
    "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
  "At Hospital": "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  Completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  Rejected: "border-slate-600 bg-slate-800 text-slate-400",
};

const panelClass =
  "rounded-2xl border border-slate-800 bg-slate-900/80 shadow-lg shadow-black/10";

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:cursor-not-allowed disabled:opacity-40";

const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-700";

function SectionTitle({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-cyan-300">
          <Icon size={19} />
        </div>

        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>

      {action}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, description, accent }) {
  const accents = {
    red: "bg-red-500/10 text-red-300 border-red-500/20",
    cyan: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
    emerald:
      "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  };

  return (
    <div className={`${panelClass} p-5 transition hover:border-slate-700`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-white">
            {value}
          </p>
        </div>

        <div
          className={`rounded-xl border p-3 ${
            accents[accent] || accents.cyan
          }`}
        >
          <Icon size={21} />
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        STATUS_STYLES[status] || STATUS_STYLES.Assigned
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function SeverityBadge({ severity }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
        SEVERITY_STYLES[severity] || SEVERITY_STYLES.Moderate
      }`}
    >
      {severity}
    </span>
  );
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-slate-500">
        <Icon size={17} />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 break-words text-sm font-medium text-slate-200">
          {value}
        </p>
      </div>
    </div>
  );
}

export default function AmbulanceDashboard() {
  const [ambulanceOnline, setAmbulanceOnline] = useState(true);
  const [missions, setMissions] = useState(INITIAL_MISSIONS);
  const [selectedMissionId, setSelectedMissionId] = useState("AST-2048");
  const [activeTab, setActiveTab] = useState("active");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showVehicleDetails, setShowVehicleDetails] = useState(false);
  const [notification, setNotification] = useState(null);

  const selectedMission = missions.find(
    (mission) => mission.id === selectedMissionId
  );

  const activeMissions = useMemo(
    () =>
      missions.filter(
        (mission) =>
          !["Completed", "Rejected"].includes(mission.status)
      ),
    [missions]
  );

  const completedMissions = useMemo(
    () => missions.filter((mission) => mission.status === "Completed"),
    [missions]
  );

  const displayedMissions =
    activeTab === "active" ? activeMissions : completedMissions;

  const showMessage = (message, type = "success") => {
    setNotification({ message, type });

    window.setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
      showMessage("Unable to log out. Please try again.", "error");
    }
  };

  const updateMissionStatus = (missionId, newStatus) => {
    setMissions((currentMissions) =>
      currentMissions.map((mission) =>
        mission.id === missionId
          ? { ...mission, status: newStatus }
          : mission
      )
    );

    showMessage(`Mission status updated to "${newStatus}".`);
  };

  const rejectMission = (mission) => {
    const confirmed = window.confirm(
      `Reject demonstration assignment ${mission.id}? This action only updates the local demo.`
    );

    if (!confirmed) return;

    updateMissionStatus(mission.id, "Rejected");

    const nextMission = missions.find(
      (item) =>
        item.id !== mission.id &&
        !["Completed", "Rejected"].includes(item.status)
    );

    if (nextMission) {
      setSelectedMissionId(nextMission.id);
    }
  };

  const currentWorkflowIndex = selectedMission
    ? WORKFLOW.indexOf(selectedMission.status)
    : -1;

  const nextWorkflowStatus =
    selectedMission &&
    currentWorkflowIndex >= 0 &&
    currentWorkflowIndex < WORKFLOW.length - 1
      ? WORKFLOW[currentWorkflowIndex + 1]
      : null;

  const advanceMission = () => {
    if (!selectedMission || !nextWorkflowStatus) return;

    updateMissionStatus(selectedMission.id, nextWorkflowStatus);
  };

  const openNavigation = (mission) => {
    const [latitude, longitude] = mission.coordinates
      .split(",")
      .map((value) => value.trim());

    const destination =
      ["At Scene", "Accepted", "Assigned"].includes(mission.status)
        ? `${latitude},${longitude}`
        : mission.destination;

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      destination
    )}`;

    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };

  const formatDate = () =>
    new Intl.DateTimeFormat("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date());

  const renderMissionAction = (mission) => {
    if (mission.status === "Assigned") {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateMissionStatus(mission.id, "Accepted")}
            className={primaryButton}
          >
            <Check size={16} />
            Accept
          </button>

          <button
            type="button"
            onClick={() => rejectMission(mission)}
            className={secondaryButton}
          >
            <X size={16} />
            Reject
          </button>
        </div>
      );
    }

    if (mission.status === "Completed") {
      return (
        <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300">
          <CheckCircle2 size={17} />
          Mission completed
        </span>
      );
    }

    if (mission.status === "Rejected") {
      return (
        <span className="text-sm text-slate-500">
          Assignment rejected
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={() => setSelectedMissionId(mission.id)}
        className={secondaryButton}
      >
        View mission
        <ArrowRight size={16} />
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 shadow-lg shadow-red-950/30">
              <Ambulance size={24} className="text-white" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight text-white">
                ASTRALIFE <span className="text-red-400">AI</span>
              </h1>
              <p className="text-xs text-slate-400">
                Ambulance Operations
              </p>
            </div>
          </a>

          <div className="hidden items-center gap-3 md:flex">
            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  ambulanceOnline ? "bg-emerald-400" : "bg-slate-500"
                }`}
              />

              <span className="text-sm text-slate-300">
                {ambulanceOnline ? "Available" : "Offline"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setAmbulanceOnline((value) => !value)}
              className={ambulanceOnline ? secondaryButton : primaryButton}
            >
              {ambulanceOnline ? (
                <>
                  <WifiOff size={16} />
                  Go Offline
                </>
              ) : (
                <>
                  <Wifi size={16} />
                  Go Online
                </>
              )}
            </button>

            <button
              type="button"
              title="Notifications"
              onClick={() =>
                showMessage(
                  "Notifications are demonstration-only in this prototype.",
                  "info"
                )
              }
              className="relative rounded-xl border border-slate-800 bg-slate-900 p-3 text-slate-300 transition hover:bg-slate-800"
            >
              <Bell size={19} />
              {activeMissions.length > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className={secondaryButton}
            >
              <LogOut size={16} />
              Logout
            </button>    
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((value) => !value)}
            className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-slate-300 md:hidden"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-800 bg-slate-900 px-4 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Vehicle availability</span>
                <span
                  className={
                    ambulanceOnline
                      ? "text-emerald-300"
                      : "text-slate-400"
                  }
                >
                  {ambulanceOnline ? "Available" : "Offline"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setAmbulanceOnline((value) => !value)}
                className={secondaryButton}
              >
                {ambulanceOnline ? (
                  <WifiOff size={16} />
                ) : (
                  <Wifi size={16} />
                )}
                {ambulanceOnline ? "Go Offline" : "Go Online"}
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Prototype notice */}
        <div className="mb-7 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <Info size={20} className="mt-0.5 shrink-0 text-amber-300" />

          <div>
            <p className="text-sm font-semibold text-amber-200">
              Demonstration dashboard
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Assignments, availability and mission updates are simulated
              in your browser. This prototype does not receive live
              emergency requests, contact patients, or dispatch an ambulance.
              Never use it as a substitute for an actual emergency service.
            </p>
          </div>
        </div>

        {/* Page heading */}
        <section className="mb-8 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-cyan-300">
              <Activity size={17} />
              <span>Emergency Response Network</span>
            </div>

            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ambulance Dashboard
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Manage assignments, track mission progress and coordinate
              patient transportation from one workspace.
            </p>

            <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <CalendarClock size={15} />
              {formatDate()}
            </p>
          </div>

          <div
            className={`flex items-center gap-3 rounded-2xl border p-4 ${
              ambulanceOnline
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-slate-700 bg-slate-900"
            }`}
          >
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                ambulanceOnline
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {ambulanceOnline ? (
                <Radio size={23} />
              ) : (
                <WifiOff size={23} />
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-white">
                {ambulanceOnline
                  ? "Ambulance Available"
                  : "Ambulance Offline"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {ambulanceOnline
                  ? "Marked available in this demo"
                  : "Not available for new demo assignments"}
              </p>
            </div>
          </div>
        </section>

        {/* Dashboard statistics */}
        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Siren}
            label="Active Assignments"
            value={activeMissions.length}
            description="Missions not yet closed"
            accent="red"
          />

          <StatCard
            icon={CheckCircle2}
            label="Completed Missions"
            value={completedMissions.length}
            description="Completed in this demo session"
            accent="emerald"
          />

          <StatCard
            icon={Gauge}
            label="Vehicle Status"
            value={ambulanceOnline ? "Ready" : "Offline"}
            description="Availability can be changed above"
            accent="cyan"
          />

          <StatCard
            icon={Clock3}
            label="Next Assignment"
            value={
              ambulanceOnline && activeMissions.length > 0
                ? "Pending"
                : "—"
            }
            description="Live assignment feed not connected"
            accent="amber"
          />
        </section>

        {/* Main workspace */}
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          {/* Left column */}
          <div className="space-y-6 xl:col-span-7">
            {/* Assignments */}
            <section className={`${panelClass} p-5 sm:p-6`}>
              <SectionTitle
                icon={Siren}
                title="Emergency Assignments"
                subtitle="Select a mission to view its details."
                action={
                  <span className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300">
                    {displayedMissions.length} missions
                  </span>
                }
              />

              <div className="mb-5 flex gap-2 border-b border-slate-800 pb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("active")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    activeTab === "active"
                      ? "bg-red-500/10 text-red-300"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  Active ({activeMissions.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("completed")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    activeTab === "completed"
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  Completed ({completedMissions.length})
                </button>
              </div>

              <div className="space-y-4">
                {displayedMissions.map((mission) => {
                  const selected = selectedMissionId === mission.id;

                  return (
                    <button
                      type="button"
                      key={mission.id}
                      onClick={() => setSelectedMissionId(mission.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-cyan-500/40 bg-cyan-500/[0.04] ring-1 ring-cyan-500/10"
                          : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`rounded-xl p-3 ${
                              mission.severity === "Critical"
                                ? "bg-red-500/10 text-red-300"
                                : "bg-orange-500/10 text-orange-300"
                            }`}
                          >
                            <HeartPulse size={21} />
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-white">
                                {mission.emergency}
                              </h3>

                              <SeverityBadge severity={mission.severity} />
                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                              Mission ID: {mission.id}
                            </p>
                          </div>
                        </div>

                        <StatusBadge status={mission.status} />
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                        <div className="flex items-start gap-2 text-slate-400">
                          <MapPin
                            size={16}
                            className="mt-0.5 shrink-0 text-cyan-300"
                          />
                          <span>{mission.location}</span>
                        </div>

                        <div className="flex items-start gap-2 text-slate-400">
                          <Route
                            size={16}
                            className="mt-0.5 shrink-0 text-cyan-300"
                          />
                          <span>{mission.distance} away</span>
                        </div>

                        <div className="flex items-start gap-2 text-slate-400">
                          <Clock3
                            size={16}
                            className="mt-0.5 shrink-0"
                          />
                          <span>Estimated travel: {mission.eta}</span>
                        </div>

                        <div className="flex items-start gap-2 text-slate-400">
                          <Users
                            size={16}
                            className="mt-0.5 shrink-0"
                          />
                          <span>
                            {mission.victims} reported victim(s)
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
                        <span className="text-xs text-slate-500">
                          Reported {mission.reportedAt}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold ${
                            selected ? "text-cyan-300" : "text-slate-400"
                          }`}
                        >
                          {selected ? "Selected" : "View details"}
                          <ArrowRight size={14} />
                        </span>
                      </div>
                    </button>
                  );
                })}

                {displayedMissions.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-700 px-5 py-12 text-center">
                    <CheckCircle2
                      size={32}
                      className="mx-auto text-emerald-300"
                    />
                    <p className="mt-3 font-medium text-white">
                      No missions in this section
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Assignments will appear here when connected to a backend.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Selected mission details */}
            <section className={`${panelClass} p-5 sm:p-6`}>
              <SectionTitle
                icon={FileText}
                title="Mission Details"
                subtitle="Review the selected incident and update its workflow."
              />

              {selectedMission ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <div>
                      <p className="text-xs text-slate-500">MISSION ID</p>
                      <p className="mt-1 text-lg font-bold text-white">
                        {selectedMission.id}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {selectedMission.emergency}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <SeverityBadge severity={selectedMission.severity} />
                      <StatusBadge status={selectedMission.status} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <DetailItem
                      icon={UserRound}
                      label="Patient / Reporter"
                      value={selectedMission.patient}
                    />

                    <DetailItem
                      icon={Phone}
                      label="Contact number"
                      value={selectedMission.phone}
                    />

                    <DetailItem
                      icon={MapPin}
                      label="Incident location"
                      value={selectedMission.location}
                    />

                    <DetailItem
                      icon={Users}
                      label="Reported victims"
                      value={selectedMission.victims}
                    />

                    <DetailItem
                      icon={Hospital}
                      label="Suggested destination"
                      value={selectedMission.destination}
                    />

                    <DetailItem
                      icon={Navigation}
                      label="Incident coordinates"
                      value={selectedMission.coordinates}
                    />
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Incident description
                    </p>
                    <p className="text-sm leading-6 text-slate-300">
                      {selectedMission.description}
                    </p>
                  </div>

                  {selectedMission.status !== "Rejected" &&
                    selectedMission.status !== "Completed" && (
                      <div>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-white">
                            Mission workflow
                          </h3>

                          <span className="text-xs text-slate-500">
                            Step{" "}
                            {Math.max(currentWorkflowIndex + 1, 1)} of{" "}
                            {WORKFLOW.length}
                          </span>
                        </div>

                        <div className="mb-5 flex gap-1.5">
                          {WORKFLOW.map((step, index) => (
                            <div
                              key={step}
                              title={step}
                              className={`h-1.5 flex-1 rounded-full ${
                                index <= currentWorkflowIndex
                                  ? "bg-cyan-400"
                                  : "bg-slate-800"
                              }`}
                            />
                          ))}
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
                              <Activity size={20} />
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-white">
                                Current stage: {selectedMission.status}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Next stage:{" "}
                                {nextWorkflowStatus || "No further stage"}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={advanceMission}
                            disabled={
                              !ambulanceOnline ||
                              !nextWorkflowStatus ||
                              selectedMission.status === "Assigned"
                            }
                            className={`${primaryButton} mt-4 w-full sm:w-auto`}
                          >
                            {selectedMission.status === "Assigned"
                              ? "Accept assignment first"
                              : `Update to ${nextWorkflowStatus}`}
                            <ArrowRight size={16} />
                          </button>

                          {selectedMission.status === "Assigned" && (
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              Accept this assignment from the mission card
                              before advancing its status.
                            </p>
                          )}

                          {!ambulanceOnline && (
                            <p className="mt-2 text-xs text-amber-300">
                              Set the ambulance online to update the workflow.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                  {selectedMission.status === "Completed" && (
                    <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <BadgeCheck
                        size={22}
                        className="shrink-0 text-emerald-300"
                      />
                      <div>
                        <p className="font-semibold text-emerald-200">
                          Mission completed
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          This demonstration assignment has reached its final
                          workflow stage.
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedMission.status === "Rejected" && (
                    <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                      <p className="font-semibold text-slate-300">
                        Assignment rejected
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        This status only changes the local demonstration data.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => openNavigation(selectedMission)}
                      className={secondaryButton}
                    >
                      <Navigation size={16} />
                      Open navigation
                      <ExternalLink size={14} />
                    </button>

                    {selectedMission.status !== "Rejected" &&
                      selectedMission.status !== "Completed" &&
                      selectedMission.status !== "Assigned" && (
                        <button
                          type="button"
                          onClick={() => rejectMission(selectedMission)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/20 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/10"
                        >
                          <X size={16} />
                          Cancel demo assignment
                        </button>
                      )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
                  <Info size={28} className="mx-auto text-slate-500" />
                  <p className="mt-3 text-sm text-slate-400">
                    Select an assignment to view its details.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-6 xl:col-span-5">
            {/* Vehicle details */}
            <section className={`${panelClass} p-5 sm:p-6`}>
              <SectionTitle
                icon={Ambulance}
                title="Vehicle & Crew"
                subtitle="Demonstration vehicle information."
                action={
                  <span className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-1.5 text-xs font-semibold text-cyan-300">
                    AMB-01
                  </span>
                }
              />

              <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-800/80 to-slate-950 p-5">
                <div className="absolute -right-5 -top-5 opacity-[0.06]">
                  <Ambulance size={160} />
                </div>

                <div className="relative">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-red-500/10 p-2 text-red-300">
                        <Ambulance size={20} />
                      </div>
                      <span className="font-semibold text-white">
                        Ambulance Unit 01
                      </span>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        ambulanceOnline
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {ambulanceOnline ? "Available" : "Offline"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-700/70 bg-slate-950/50 p-3">
                      <p className="text-xs text-slate-500">Vehicle ID</p>
                      <p className="mt-1 font-semibold text-white">AMB-01</p>
                    </div>

                    <div className="rounded-xl border border-slate-700/70 bg-slate-950/50 p-3">
                      <p className="text-xs text-slate-500">Vehicle type</p>
                      <p className="mt-1 font-semibold text-white">
                        Basic Life Support
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setShowVehicleDetails((value) => !value)
                    }
                    className="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-700/70 bg-slate-950/50 px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-900"
                  >
                    View vehicle details
                    <ChevronDown
                      size={17}
                      className={`transition ${
                        showVehicleDetails ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {showVehicleDetails && (
                    <div className="mt-3 space-y-3 rounded-xl border border-slate-700/70 bg-slate-950/50 p-4">
                      <DetailItem
                        icon={Users}
                        label="Crew capacity"
                        value="Crew details not configured"
                      />
                      <DetailItem
                        icon={ShieldCheck}
                        label="Equipment status"
                        value="Not connected to equipment monitoring"
                      />
                      <DetailItem
                        icon={Smartphone}
                        label="GPS device"
                        value="Live tracking not connected"
                      />
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Route and location */}
            <section className={`${panelClass} p-5 sm:p-6`}>
              <SectionTitle
                icon={Route}
                title="Route & Location"
                subtitle="Navigation for the selected incident."
              />

              {selectedMission ? (
                <>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                          <Ambulance size={17} />
                        </div>
                        <div className="my-1 h-8 border-l border-dashed border-slate-700" />
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-300">
                          <MapPin size={17} />
                        </div>
                      </div>

                      <div className="flex-1 space-y-5 pt-1">
                        <div>
                          <p className="text-xs text-slate-500">
                            CURRENT VEHICLE LOCATION
                          </p>
                          <p className="mt-1 text-sm font-medium text-white">
                            Not available
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Live GPS tracking is not connected.
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            INCIDENT LOCATION
                          </p>
                          <p className="mt-1 text-sm font-medium text-white">
                            {selectedMission.location}
                          </p>
                          <p className="mt-1 text-xs text-cyan-300">
                            {selectedMission.coordinates}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Route size={16} />
                          <span className="text-xs">Distance</span>
                        </div>
                        <p className="mt-2 text-xl font-bold text-white">
                          {selectedMission.distance}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Clock3 size={16} />
                          <span className="text-xs">Estimated time</span>
                        </div>
                        <p className="mt-2 text-xl font-bold text-white">
                          {selectedMission.eta}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openNavigation(selectedMission)}
                    className={`${secondaryButton} mt-4 w-full`}
                  >
                    <LocateFixed size={17} />
                    Open route in Google Maps
                    <ExternalLink size={14} />
                  </button>

                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Distance and travel time are sample values. Live routing,
                    traffic and vehicle GPS are not integrated.
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Select a mission to view its route information.
                </p>
              )}
            </section>

            {/* Safety and operational checklist */}
            <section className={`${panelClass} p-5 sm:p-6`}>
              <SectionTitle
                icon={ShieldCheck}
                title="Operational Checklist"
                subtitle="A reminder for the response workflow."
              />

              <div className="space-y-4">
                {[
                  {
                    title: "Review incident details",
                    description: "Confirm the incident and reported needs.",
                    icon: FileText,
                    color: "text-cyan-300 bg-cyan-500/10",
                  },
                  {
                    title: "Confirm patient location",
                    description:
                      "Verify the location with the control room or reporter.",
                    icon: MapPin,
                    color: "text-sky-300 bg-sky-500/10",
                  },
                  {
                    title: "Coordinate hospital handover",
                    description:
                      "Follow the appropriate clinical and handover procedures.",
                    icon: Hospital,
                    color: "text-emerald-300 bg-emerald-500/10",
                  },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.title} className="flex items-start gap-3">
                      <div className={`rounded-xl p-2.5 ${item.color}`}>
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
                <div className="flex items-start gap-2.5">
                  <Info
                    size={18}
                    className="mt-0.5 shrink-0 text-amber-300"
                  />

                  <div>
                    <p className="text-sm font-semibold text-amber-200">
                      Important
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Follow your authorized emergency response procedures.
                      This dashboard does not provide clinical instructions
                      or authorize traffic signal changes.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Activity log */}
            <section className={`${panelClass} p-5 sm:p-6`}>
              <SectionTitle
                icon={History}
                title="Recent Activity"
                subtitle="Updates made during this browser session."
              />

              <div className="space-y-4">
                {missions
                  .filter((mission) =>
                    ["Completed", "Rejected"].includes(mission.status)
                  )
                  .map((mission) => (
                    <div
                      key={mission.id}
                      className="flex items-start gap-3"
                    >
                      <div
                        className={`rounded-xl p-2 ${
                          mission.status === "Completed"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {mission.status === "Completed" ? (
                          <CheckCircle2 size={17} />
                        ) : (
                          <X size={17} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-200">
                          {mission.emergency}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {mission.id} · {mission.status}
                        </p>
                      </div>

                      <span className="text-xs text-slate-500">
                        Demo
                      </span>
                    </div>
                  ))}

                {missions.every(
                  (mission) =>
                    !["Completed", "Rejected"].includes(mission.status)
                ) && (
                  <div className="py-5 text-center">
                    <History
                      size={25}
                      className="mx-auto text-slate-600"
                    />
                    <p className="mt-3 text-sm text-slate-400">
                      No recent activity yet
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Mission updates will appear here.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 border-t border-slate-800 py-6">
          <div className="flex flex-col justify-between gap-3 text-xs text-slate-500 sm:flex-row sm:items-center">
            <p>
              © {new Date().getFullYear()} Astralife AI · Emergency Response
              Prototype
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Simulation mode
              </span>

              <a
                href="/"
                className="inline-flex items-center gap-1.5 transition hover:text-white"
              >
                <ArrowLeft size={14} />
                Back to home
              </a>
            </div>
          </div>
        </footer>
      </main>

      {/* Toast notification */}
      {notification && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-2xl ${
            notification.type === "info"
              ? "border-cyan-500/30 bg-slate-900"
              : "border-emerald-500/30 bg-slate-900"
          }`}
        >
          {notification.type === "info" ? (
            <Info size={19} className="mt-0.5 shrink-0 text-cyan-300" />
          ) : (
            <CheckCircle2
              size={19}
              className="mt-0.5 shrink-0 text-emerald-300"
            />
          )}

          <p className="text-sm leading-5 text-slate-200">
            {notification.message}
          </p>

          <button
            type="button"
            onClick={() => setNotification(null)}
            className="ml-2 text-slate-500 transition hover:text-white"
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}