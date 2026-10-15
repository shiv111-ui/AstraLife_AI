import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../assets/firebase";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  HeartPulse,
  Info,
  LoaderCircle,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  Siren,
  UserRound,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import LocationPicker from "../components/LocationPicker";

const EMERGENCY_TYPES = [
  {
    label: "Medical Emergency",
    description: "Illness or urgent medical condition",
    icon: HeartPulse,
  },
  {
    label: "Road Accident",
    description: "Vehicle collision or road injury",
    icon: AlertTriangle,
  },
  {
    label: "Cardiac Emergency",
    description: "Heart attack or heart-related emergency",
    icon: Activity,
  },
  {
    label: "Breathing Difficulty",
    description: "Difficulty breathing or shortness of breath",
    icon: Activity,
  },
  {
    label: "Pregnancy Emergency",
    description: "Pregnancy-related urgent medical condition",
    icon: HeartPulse,
  },
  {
    label: "Fire Emergency",
    description: "Fire or smoke-related incident",
    icon: Siren,
  },
];

const VICTIM_COUNT_TYPES = ["Medical Emergency", "Road Accident"];

const SEVERITIES = [
  {
    value: "Critical",
    description: "Life-threatening",
    style: "border-red-400 bg-red-500/10 text-red-300",
  },
  {
    value: "High",
    description: "Urgent assistance",
    style: "border-orange-400 bg-orange-500/10 text-orange-300",
  },
  {
    value: "Moderate",
    description: "Needs attention",
    style: "border-amber-400 bg-amber-500/10 text-amber-300",
  },
];

export default function PatientDashboard() {
  const [form, setForm] = useState({
    patientName: "",
    phone: "",
    emergencyType: "",
    severity: "High",
    victimCount: "",
    description: "",
  });

  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [locationError, setLocationError] = useState("");
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [emergency, setEmergency] = useState(null);
  const [formError, setFormError] = useState("");

  const locationSectionRef = useRef(null);

  const showVictimCount = VICTIM_COUNT_TYPES.includes(
    form.emergencyType
  );

  const inputClass =
    "w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20";

  const labelClass = "mb-2 block text-sm font-medium text-slate-200";

  // Automatically scroll to the location section after GPS succeeds.
  useEffect(() => {
    if (locationStatus === "success" && location) {
      requestAnimationFrame(() => {
        locationSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [locationStatus, location]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setFormError("");
  };

  // Detect the device's current location.
  const detectLocation = () => {
    setLocationError("");
    setLocationStatus("loading");
    setLocationConfirmed(false);
    setFormError("");

    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationError(
        "Location detection is not supported by your browser."
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          setLocationStatus("error");
          setLocationError(
            "The browser returned an invalid location. Please try again."
          );
          return;
        }

        setLocation({
          latitude,
          longitude,
          accuracy,
          timestamp: position.timestamp,
          source: "gps",
        });

        setLocationStatus("success");

        if (accuracy > 1000) {
          setLocationError(
            "GPS accuracy is low. Move the map marker to the correct location before confirming."
          );
        } else {
          setLocationError("");
        }
      },
      (error) => {
        setLocationStatus("error");

        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError(
              "Location permission was denied. Allow location access in your browser settings and try again."
            );
            break;

          case error.POSITION_UNAVAILABLE:
            setLocationError(
              "Your location is currently unavailable. Check your device location settings and try again."
            );
            break;

          case error.TIMEOUT:
            setLocationError(
              "Location detection took too long. Please try again."
            );
            break;

          default:
            setLocationError(
              "Unable to detect your location. Please try again."
            );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  };

  // Handle a location selected on the map.
  const handleMapLocationChange = (position) => {
    if (
      !position ||
      !Number.isFinite(position.latitude) ||
      !Number.isFinite(position.longitude) ||
      position.latitude < -90 ||
      position.latitude > 90 ||
      position.longitude < -180 ||
      position.longitude > 180
    ) {
      setLocationError("Please select a valid location on the map.");
      return;
    }

    setLocation({
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: 0,
      timestamp: Date.now(),
      source: "manual",
    });

    setLocationStatus("success");
    setLocationConfirmed(false);
    setLocationError("");
    setFormError("");
  };

  // Confirm the selected location.
  const confirmPickupLocation = () => {
    if (!location) {
      setLocationError(
        "Please detect your location or select a location on the map."
      );
      return;
    }

    if (
      !Number.isFinite(location.latitude) ||
      !Number.isFinite(location.longitude) ||
      location.latitude < -90 ||
      location.latitude > 90 ||
      location.longitude < -180 ||
      location.longitude > 180
    ) {
      setLocationError("Please select a valid location.");
      return;
    }

    if (location.source === "gps" && location.accuracy > 1000) {
      setLocationError(
        "GPS accuracy is too low. Move the marker to the correct location manually before confirming."
      );
      setLocationConfirmed(false);
      return;
    }

    setLocationConfirmed(true);
    setLocationError("");
    setFormError("");
  };

  const validateForm = () => {
    if (!form.emergencyType) {
      return "Please select an emergency type.";
    }

    if (
      form.phone.trim() &&
      !/^\d{10}$/.test(form.phone.trim())
    ) {
      return "Enter a valid 10-digit phone number, or leave the field empty.";
    }

    if (showVictimCount && !form.victimCount) {
      return "Please select the number of victims.";
    }

    if (!location) {
      return "Please detect your location or select a location on the map.";
    }

    if (!locationConfirmed) {
      return "Please confirm your location before submitting.";
    }

    if (
      !Number.isFinite(location.latitude) ||
      !Number.isFinite(location.longitude) ||
      location.latitude < -90 ||
      location.latitude > 90 ||
      location.longitude < -180 ||
      location.longitude > 180
    ) {
      return "The selected location is invalid. Please select it again.";
    }

    if (location.source === "gps" && location.accuracy > 1000) {
      return "GPS accuracy is too low. Select the correct location manually on the map.";
    }

    return "";
  };

  // Create a demonstration request.
  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    
    const validationError = validateForm();
    
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const incidentData = {
        EmergencyType: form.emergencyType,
        Priority: form.severity,
        Status: "Pending",
      
        // Optional fields: null when left blank
        patientName: form.patientName.trim() || null,
        phone: form.phone.trim() || null,
        description: form.description.trim() || null,
      
        victimCount: showVictimCount
          ? form.victimCount
          : null,
      
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          source: location.source,
        },
      
        ambulanceId: null,
        hospitalId: null,
      
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
    
      // Save the emergency request to Firestore
      const documentRef = await addDoc(
        collection(db, "Emergency_Cases"),
        incidentData
      );
    
      // Generate a display reference from the Firestore document ID
      const emergencyId = `AST-${documentRef.id
        .slice(-8)
        .toUpperCase()}`;
      
      // Show confirmation only after Firestore saves successfully
      setEmergency({
        id: emergencyId,
        patientName: incidentData.patientName || "Not provided",
        phone: incidentData.phone || "Not provided",
        emergencyType: incidentData.EmergencyType,
        severity: incidentData.Priority,
        victimCount: incidentData.victimCount,
        description:
          incidentData.description || "No additional details provided.",
        location: incidentData.location,
        status: "Created · Not Dispatched",
        createdAt: new Date().toLocaleString(),
      });
    } catch (error) {
      console.error("Emergency submission failed:", error);
    
      setFormError(
        "Unable to save your emergency request. Please check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Emergency confirmation screen.
  if (emergency) {
    return (
      <div className="min-h-screen bg-[#07111f] px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={17} />
            Back to Home
          </Link>

          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-[#0c1929] shadow-2xl shadow-black/20">
            <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-6 py-8 text-center sm:px-10">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 size={36} />
              </div>

              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Request Created
              </p>

              <h1 className="text-2xl font-bold sm:text-3xl">
                Emergency Details Recorded
              </h1>

              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400">
                Your emergency details have been recorded in this
                demonstration interface.
              </p>
            </div>

            <div className="space-y-6 p-6 sm:p-10">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Emergency Reference ID
                </p>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <span className="break-all text-xl font-bold tracking-wide text-cyan-300">
                    {emergency.id}
                  </span>

                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
                    {emergency.status}
                  </span>
                </div>
              </div>

              <div>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <FileText className="text-cyan-400" size={20} />
                  Emergency Summary
                </h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ["Emergency Type", emergency.emergencyType],
                    ["Reported Severity", emergency.severity],
                    ...(emergency.victimCount
                      ? [["Number of Victims", emergency.victimCount]]
                      : []),
                    ["Reported Name", emergency.patientName],
                    ["Contact Number", emergency.phone],
                    ["Created At", emergency.createdAt],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
                    >
                      <p className="mb-1 text-xs text-slate-500">
                        {label}
                      </p>
                      <p className="font-semibold text-white">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <MapPin className="text-cyan-400" size={20} />
                  Confirmed Location
                </h2>

                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <p className="text-sm text-slate-300">
                    Latitude:{" "}
                    <span className="font-mono text-cyan-300">
                      {emergency.location.latitude.toFixed(6)}
                    </span>
                  </p>

                  <p className="mt-2 text-sm text-slate-300">
                    Longitude:{" "}
                    <span className="font-mono text-cyan-300">
                      {emergency.location.longitude.toFixed(6)}
                    </span>
                  </p>

                  <a
                    href={`https://www.google.com/maps?q=${emergency.location.latitude},${emergency.location.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
                  >
                    <Navigation size={16} />
                    View Location on Google Maps
                  </a>
                </div>
              </div>

              <div>
                <h2 className="mb-3 text-lg font-semibold">
                  Additional Details
                </h2>

                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm leading-6 text-slate-300">
                  {emergency.description}
                </div>
              </div>

              <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <AlertTriangle
                  className="mt-0.5 shrink-0 text-amber-400"
                  size={20}
                />

                <div>
                  <p className="font-semibold text-amber-300">
                    Important: No ambulance has been dispatched
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    This is a frontend demonstration. The request has
                    not been sent to an ambulance, hospital, or control
                    room. For an actual emergency in India, call 112.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full rounded-xl bg-cyan-500 px-5 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                Create Another Request
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07111f] text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#091423]/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
              <Siren size={23} />
            </div>

            <div>
              <h1 className="text-lg font-bold tracking-tight">
                Astralife <span className="text-cyan-400">AI</span>
              </h1>
              <p className="text-xs text-slate-500">
                Emergency Response Platform
              </p>
            </div>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">Back to Home</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Page heading */}
        <div className="mb-8 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
            EMERGENCY REPORTING
          </div>

          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Report an <span className="text-red-400">Emergency</span>
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Provide the available information and confirm the incident
            location. You can submit a report even if you do not know
            the victim&apos;s name or phone number.
          </p>
        </div>

        {/* Emergency information banner */}
        <div className="mb-8 flex gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 sm:p-5">
          <AlertTriangle
            className="mt-0.5 shrink-0 text-red-400"
            size={22}
          />

          <div>
            <p className="font-semibold text-red-300">
              Is this a real emergency?
            </p>

            <p className="mt-1 text-sm leading-6 text-slate-400">
              For immediate emergency assistance in India, call{" "}
              <a
                href="tel:112"
                className="font-bold text-white underline decoration-red-400 underline-offset-4"
              >
                112
              </a>
              . This website is currently a demonstration and does
              not dispatch emergency services.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
        >
          {/* Main form */}
          <div className="space-y-6">
            {/* Patient / reporter information */}
            <section className="rounded-2xl border border-slate-800 bg-[#0c1929] p-5 shadow-xl shadow-black/10 sm:p-7">
              <div className="mb-6 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                  <UserRound size={22} />
                </div>

                <div>
                  <h3 className="text-lg font-semibold">
                    Patient / Reporter Information
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    These details are optional.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="patientName" className={labelClass}>
                    Patient or Reporter Name{" "}
                    <span className="font-normal text-slate-500">
                      (Optional)
                    </span>
                  </label>

                  <input
                    id="patientName"
                    name="patientName"
                    type="text"
                    value={form.patientName}
                    onChange={handleChange}
                    placeholder="Enter name if known"
                    className={inputClass}
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className={labelClass}>
                    Contact Number{" "}
                    <span className="font-normal text-slate-500">
                      (Optional)
                    </span>
                  </label>

                  <div className="relative">
                    <Phone
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                    />

                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="10-digit mobile number"
                      className={`${inputClass} pl-10`}
                      autoComplete="tel"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2 text-xs leading-5 text-slate-500">
                <Info size={15} className="mt-0.5 shrink-0" />
                <p>
                  If the victim&apos;s identity or phone number is
                  unknown, leave these fields empty and continue.
                </p>
              </div>
            </section>

            {/* Emergency details */}
            <section className="rounded-2xl border border-slate-800 bg-[#0c1929] p-5 shadow-xl shadow-black/10 sm:p-7">
              <div className="mb-6 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                  <HeartPulse size={23} />
                </div>

                <div>
                  <h3 className="text-lg font-semibold">
                    Emergency Details
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Select the type and severity of the emergency.
                  </p>
                </div>
              </div>

              {/* Emergency type selection */}
              <fieldset>
                <legend className={labelClass}>
                  Type of Emergency{" "}
                  <span className="text-red-400">*</span>
                </legend>

                <div className="grid gap-3 sm:grid-cols-2">
                  {EMERGENCY_TYPES.map((item) => {
                    const Icon = item.icon;
                    const selected =
                      form.emergencyType === item.label;

                    return (
                      <button
                        key={item.label}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setForm((previous) => ({
                            ...previous,
                            emergencyType: item.label,
                            victimCount: VICTIM_COUNT_TYPES.includes(
                              item.label
                            )
                              ? previous.victimCount
                              : "",
                          }));

                          setFormError("");
                        }}
                        className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                          selected
                            ? "border-red-400 bg-red-500/10 ring-1 ring-red-400/20"
                            : "border-slate-700 bg-slate-900/50 hover:border-slate-500"
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            selected
                              ? "bg-red-500/15 text-red-300"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          <Icon size={19} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white">
                            {item.label}
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {item.description}
                          </p>
                        </div>

                        {selected && (
                          <CheckCircle2
                            size={18}
                            className="shrink-0 text-red-400"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Severity */}
              <div className="mt-6">
                <label className={labelClass}>
                  Reported Severity{" "}
                  <span className="text-red-400">*</span>
                </label>

                <div className="grid grid-cols-3 gap-3">
                  {SEVERITIES.map((item) => {
                    const selected = form.severity === item.value;

                    return (
                      <button
                        key={item.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setForm((previous) => ({
                            ...previous,
                            severity: item.value,
                          }));
                        }}
                        className={`rounded-xl border p-3 text-center transition ${
                          selected
                            ? item.style
                            : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-500"
                        }`}
                      >
                        <span className="block text-sm font-semibold">
                          {item.value}
                        </span>

                        <span className="mt-1 hidden text-[11px] opacity-75 sm:block">
                          {item.description}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Severity is reported by the person submitting the form.
                </p>
              </div>

              {/* Victim count */}
              {showVictimCount && (
                <div className="mt-6">
                  <label
                    htmlFor="victimCount"
                    className={labelClass}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Users size={16} className="text-slate-400" />
                      Number of Victims{" "}
                      <span className="text-red-400">*</span>
                    </span>
                  </label>

                  <select
                    id="victimCount"
                    name="victimCount"
                    value={form.victimCount}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="">
                      Select number of victims
                    </option>
                    <option value="1">1 victim</option>
                    <option value="2">2 victims</option>
                    <option value="3">3 victims</option>
                    <option value="4">4 victims</option>
                    <option value="5+">5 or more victims</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
              )}

              {/* Additional information */}
              <div className="mt-6">
                <label
                  htmlFor="description"
                  className={labelClass}
                >
                  Additional Information{" "}
                  <span className="font-normal text-slate-500">
                    (Optional)
                  </span>
                </label>

                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Describe the situation, visible injuries, nearby landmarks, or other useful details..."
                  className={`${inputClass} resize-y`}
                />

                <p className="mt-2 text-xs text-slate-500">
                  Share only the details you know. Do not delay seeking
                  real emergency assistance to complete this form.
                </p>
              </div>
            </section>

            {/* Emergency location */}
            <section
              ref={locationSectionRef}
              className="scroll-mt-6 rounded-2xl border border-slate-800 bg-[#0c1929] p-5 shadow-xl shadow-black/10 sm:p-7"
            >
              <div className="mb-6 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                  <MapPin size={22} />
                </div>

                <div>
                  <h3 className="text-lg font-semibold">
                    Emergency Location
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Detect your current location, check the map, and
                    confirm the correct incident or pickup point.
                  </p>
                </div>
              </div>

              {/* GPS detection button */}
              <button
                type="button"
                onClick={detectLocation}
                disabled={locationStatus === "loading"}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {locationStatus === "loading" ? (
                  <>
                    <LoaderCircle
                      size={19}
                      className="animate-spin"
                    />
                    Detecting Your Location...
                  </>
                ) : (
                  <>
                    <Navigation size={19} />
                    Detect My Location
                  </>
                )}
              </button>

              {locationStatus === "loading" && (
                <p className="mt-3 text-center text-xs text-slate-400">
                  Waiting for your browser&apos;s location service...
                </p>
              )}

              {/* Location errors and warnings */}
              {locationError && (
                <div
                  role="status"
                  className={`mt-4 flex gap-3 rounded-xl border p-4 ${
                    locationStatus === "error"
                      ? "border-red-500/20 bg-red-500/5"
                      : "border-amber-500/20 bg-amber-500/5"
                  }`}
                >
                  <AlertCircle
                    size={19}
                    className={`mt-0.5 shrink-0 ${
                      locationStatus === "error"
                        ? "text-red-400"
                        : "text-amber-400"
                    }`}
                  />

                  <p className="text-sm leading-6 text-slate-300">
                    {locationError}
                  </p>
                </div>
              )}

              {/* Detected coordinates */}
              {location && (
                <div className="mt-5 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      size={18}
                      className="text-cyan-400"
                    />

                    <p className="text-sm font-semibold text-cyan-300">
                      Location detected
                    </p>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <p className="text-slate-400">
                      Latitude:{" "}
                      <span className="font-mono text-white">
                        {location.latitude.toFixed(6)}
                      </span>
                    </p>

                    <p className="text-slate-400">
                      Longitude:{" "}
                      <span className="font-mono text-white">
                        {location.longitude.toFixed(6)}
                      </span>
                    </p>
                  </div>

                  {location.source === "gps" && (
                    <p className="mt-3 text-xs text-slate-500">
                      Estimated GPS accuracy:{" "}
                      {Math.round(location.accuracy)} metres
                    </p>
                  )}

                  {location.source === "manual" && (
                    <p className="mt-3 text-xs text-cyan-300">
                      Location selected manually on the map.
                    </p>
                  )}
                </div>
              )}

              {/* Map and confirmation */}
              {location && (
                <div className="mt-6">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-white">
                        Verify Your Location
                      </h4>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Click the map or drag its marker to correct the
                        position if needed.
                      </p>
                    </div>

                    <MapPin
                      size={20}
                      className="shrink-0 text-cyan-400"
                    />
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-700">
                    <LocationPicker
                      position={location}
                      onLocationChange={handleMapLocationChange}
                      onConfirm={confirmPickupLocation}
                    />
                  </div>

                  {locationConfirmed && (
                    <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <CheckCircle2
                        size={20}
                        className="mt-0.5 shrink-0 text-emerald-400"
                      />

                      <div>
                        <p className="font-semibold text-emerald-300">
                          Pickup location confirmed
                        </p>

                        <p className="mt-1 text-sm leading-5 text-slate-400">
                          The selected coordinates will be included in
                          the emergency report.
                        </p>
                      </div>
                    </div>
                  )}

                  {!locationConfirmed && (
                    <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500">
                      <Info
                        size={15}
                        className="mt-0.5 shrink-0"
                      />
                      Confirm the location using the map&apos;s
                      confirmation button before submitting the report.
                    </p>
                  )}
                </div>
              )}

              {/* No location selected */}
              {!location && locationStatus !== "loading" && (
                <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-5 text-center">
                  <MapPin
                    size={25}
                    className="mx-auto text-slate-500"
                  />

                  <p className="mt-3 text-sm font-medium text-slate-300">
                    Location not selected yet
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Click &quot;Detect My Location&quot; to load the map
                    and select your location.
                  </p>
                </div>
              )}
            </section>

            {/* Validation error */}
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4"
              >
                <AlertCircle
                  size={20}
                  className="mt-0.5 shrink-0 text-red-400"
                />

                <p className="text-sm leading-6 text-red-200">
                  {formError}
                </p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-red-500 px-6 py-4 font-bold text-white shadow-lg shadow-red-950/20 transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <LoaderCircle
                    size={20}
                    className="animate-spin"
                  />
                  Creating Emergency Report...
                </>
              ) : (
                <>
                  <Siren size={21} />
                  Submit Emergency Report
                </>
              )}
            </button>

            <p className="text-center text-xs leading-5 text-slate-500">
              Submitting creates a demonstration record only. It does
              not contact emergency services or dispatch an ambulance.
            </p>
          </div>

          {/* Right-side information panel */}
          <aside className="space-y-5 lg:sticky lg:top-6">
            <div className="rounded-2xl border border-slate-800 bg-[#0c1929] p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                  <ShieldCheck size={21} />
                </div>

                <h3 className="font-semibold">
                  Reporting Checklist
                </h3>
              </div>

              <div className="space-y-4">
                {[
                  "Select the emergency type",
                  "Choose the reported severity",
                  "Provide victim count when required",
                  "Detect and verify the location",
                  "Confirm the pickup point",
                ].map((item, index) => (
                  <div
                    key={item}
                    className="flex items-start gap-3"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-400">
                      {index + 1}
                    </div>

                    <p className="pt-0.5 text-sm leading-5 text-slate-400">
                      {item}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-slate-800 pt-4">
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock size={15} />
                  Name and phone number are optional.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0c1929] p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                  <AlertTriangle size={21} />
                </div>

                <h3 className="font-semibold">
                  Important Information
                </h3>
              </div>

              <ul className="space-y-3 text-sm leading-6 text-slate-400">
                <li className="flex gap-2">
                  <Check
                    size={17}
                    className="mt-1 shrink-0 text-cyan-400"
                  />
                  <span>Report only the details you know.</span>
                </li>

                <li className="flex gap-2">
                  <Check
                    size={17}
                    className="mt-1 shrink-0 text-cyan-400"
                  />
                  <span>Verify the map marker before submitting.</span>
                </li>

                <li className="flex gap-2">
                  <Check
                    size={17}
                    className="mt-1 shrink-0 text-cyan-400"
                  />
                  <span>
                    You can report an incident without identifying the
                    victim.
                  </span>
                </li>
              </ul>

              <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <p className="text-sm font-semibold text-red-300">
                  For a real emergency
                </p>

                <a
                  href="tel:112"
                  className="mt-2 inline-flex items-center gap-2 text-2xl font-bold text-white transition hover:text-red-300"
                >
                  <Phone size={21} />
                  112
                </a>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  India&apos;s emergency helpline.
                </p>
              </div>
            </div>
          </aside>
        </form>
      </main>

      <footer className="mt-8 border-t border-slate-800 px-4 py-6 text-center text-xs text-slate-600">
        Astralife AI · Emergency Response Coordination Prototype
      </footer>
    </div>
  );
}