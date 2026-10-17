import { useCallback, useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  LoaderCircle,
  MapPin,
  Navigation,
  Phone,
  Siren,
  Timer,
  Truck,
} from "lucide-react";

import { db } from "../assets/firebase";
import GreenCorridorMap from "./GreenCorridorMap";
import VoiceSOSButton from "../components/VoiceSOSButton";
import { dispatch } from "../api/dispatch";
import { calculateETA } from "../api/eta";

const EMERGENCY_TYPES = [
  "Medical Emergency",
  "Road Accident",
  "Cardiac Emergency",
  "Breathing Difficulty",
  "Pregnancy Emergency",
  "Fire Emergency",
];

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

function getCoordinates(value) {
  if (!value || typeof value !== "object") return null;

  const latitude = Number(value.latitude ?? value.lat);
  const longitude = Number(
    value.longitude ?? value.lng ?? value.lon
  );

  if (value.latitude == null && value.lat == null) return null;
  if (
    value.longitude == null &&
    value.lng == null &&
    value.lon == null
  )
    return null;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  )
    return null;

  return { latitude, longitude };
}

function getErrorMessage(error) {
  if (error?.code === "permission-denied")
    return "Firebase denied this operation. Your Firestore security rules need to allow this operation.";
  if (error?.code === "unavailable")
    return "Firebase is temporarily unavailable. Check your internet connection.";
  return error?.message || "An unexpected error occurred.";
}

function formatETA(etaData) {
  if (!etaData) return null;
  const { durationMinutes, arrivalTime, distanceKm, isLive, isStale, source } =
    etaData;

  const arrivalStr = arrivalTime
    ? arrivalTime.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return {
    durationMinutes,
    distanceKm,
    arrivalStr,
    isLive,
    isStale,
    source,
  };
}

/* ------------------------------------------------------------------ */
/* COMPONENT                                                           */
/* ------------------------------------------------------------------ */

export default function PatientDashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const [pageStatus, setPageStatus] = useState("idle");
  const [error, setError] = useState("");
  const [dispatchMessage, setDispatchMessage] = useState("");
  const [dispatchStatus, setDispatchStatus] = useState(""); // "dispatching" | "assigned" | "no_ambulance" | "no_hospital" | "failed"

  const [emergency, setEmergency] = useState(null);
  const [patientLocation, setPatientLocation] = useState(null);
  const [ambulanceLocation, setAmbulanceLocation] = useState(null);
  const [hospitals, setHospitals] = useState([]);

  const [gpsUpdatedAt, setGpsUpdatedAt] = useState(null);
  const [gpsError, setGpsError] = useState("");

  const [emergencyType, setEmergencyType] = useState("");
  const [savingType, setSavingType] = useState(false);
  const [typeMessage, setTypeMessage] = useState("");

  const [eta, setEta] = useState(null);
  const etaCalcRef = useRef(false);

  const submissionStarted = useRef(false);
  const activeEmergencyId = useRef(null);
  const dispatchAttempted = useRef(false);

  const shouldStartSOS = location.state?.startSOS === true;

  /* ---------------------------------------------------------------- */
  /* STEP 1: Capture GPS and create the emergency                      */
  /* ---------------------------------------------------------------- */

  const startSOS = useCallback(() => {
    if (submissionStarted.current) return;
    submissionStarted.current = true;

    setError("");
    setDispatchMessage("");
    setDispatchStatus("");
    setPageStatus("locating");

    if (!navigator.geolocation) {
      setPageStatus("error");
      setError(
        "Your browser does not support GPS. Call 112 for emergency assistance."
      );
      submissionStarted.current = false;
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        const capturedLocation = {
          latitude,
          longitude,
          accuracy,
          source: "browser-gps",
          mapsUrl: `https://www.google.com/maps?q=${latitude},${longitude}`,
        };

        setPatientLocation(capturedLocation);
        setPageStatus("sending");

        try {
          const emergencyData = {
            EmergencyType: null,
            Priority: null,
            Status: "Pending",
            location: capturedLocation,
            ambulanceId: null,
            hospitalId: null,
            victimCount: 1,
            description: null,
            source: "patient-sos",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          const emergencyRef = await addDoc(
            collection(db, "Emergency_Cases"),
            emergencyData
          );

          activeEmergencyId.current = emergencyRef.id;

          setEmergency({
            id: emergencyRef.id,
            ...emergencyData,
          });

          setPageStatus("tracking");

          navigate("/patient", {
            replace: true,
            state: { emergencyId: emergencyRef.id },
          });

          /* ---- Auto-dispatch after writing the emergency ---- */
          if (!dispatchAttempted.current) {
            dispatchAttempted.current = true;
            setDispatchStatus("dispatching");
            setDispatchMessage("Finding the nearest available ambulance…");

            try {
              const result = await dispatch(emergencyRef.id, {
                latitude,
                longitude,
              });

              if (result.success) {
                setDispatchStatus("assigned");
                setDispatchMessage(
                  `Ambulance ${result.ambulanceId} assigned` +
                    (result.distanceKm
                      ? ` (${result.distanceKm} km away`
                      : "") +
                    (result.etaMinutes
                      ? `, ETA ~${result.etaMinutes} min`
                      : "") +
                    (result.distanceKm ? ")" : "") +
                    `. Hospital: ${result.hospitalName || result.hospitalId}.`
                );
              } else if (result.reason === "no_ambulance") {
                setDispatchStatus("no_ambulance");
                setDispatchMessage(
                  "No ambulances currently available. Your emergency is visible to the control room — help is being arranged."
                );
                // Update emergency status
                await updateDoc(doc(db, "Emergency_Cases", emergencyRef.id), {
                  Status: "Awaiting Ambulance",
                  updatedAt: serverTimestamp(),
                });
              } else if (result.reason === "no_hospital") {
                setDispatchStatus("no_hospital");
                setDispatchMessage(
                  `Ambulance ${result.ambulanceId} is responding, but no hospital could be automatically selected. The control room has been alerted.`
                );
              } else {
                setDispatchStatus("failed");
                setDispatchMessage(
                  `Auto-dispatch encountered an issue: ${result.message} The control room will assign manually.`
                );
              }
            } catch (dispatchErr) {
              console.error("Dispatch call failed:", dispatchErr);
              setDispatchStatus("failed");
              setDispatchMessage(
                "Auto-dispatch failed. Your emergency is logged and visible to the control room."
              );
            }
          }
        } catch (submitError) {
          console.error("Failed to submit emergency:", submitError);
          setPageStatus("error");
          setError(getErrorMessage(submitError));
          submissionStarted.current = false;
        }
      },
      (gpsErrorResult) => {
        setPageStatus("error");
        submissionStarted.current = false;

        if (gpsErrorResult.code === gpsErrorResult.PERMISSION_DENIED) {
          setError(
            "Location permission was denied. Enable location access in your browser and retry."
          );
        } else if (
          gpsErrorResult.code === gpsErrorResult.POSITION_UNAVAILABLE
        ) {
          setError(
            "Your current GPS location is unavailable. Check your device location settings."
          );
        } else {
          setError(
            "GPS timed out. Please retry or call 112 for immediate assistance."
          );
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, [navigate]);

  /* ---------------------------------------------------------------- */
  /* Auto-start when Home page requests it                            */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (shouldStartSOS && !submissionStarted.current) {
      startSOS();
    }
  }, [shouldStartSOS, startSOS]);

  /* ---------------------------------------------------------------- */
  /* STEP 2: Listen for emergency status and ambulance assignment      */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const emergencyId =
      emergency?.id || location.state?.emergencyId;

    if (!emergencyId) return undefined;

    const emergencyRef = doc(db, "Emergency_Cases", emergencyId);

    const unsubscribe = onSnapshot(
      emergencyRef,
      (snapshot) => {
        if (!snapshot.exists()) return;

        const data = snapshot.data();

        setEmergency({ id: snapshot.id, ...data });

        const coordinates = getCoordinates(data.location);
        if (coordinates) {
          setPatientLocation((previous) => ({
            ...previous,
            ...coordinates,
            accuracy: data.location?.accuracy ?? previous?.accuracy,
            source: data.location?.source ?? previous?.source,
            mapsUrl:
              data.location?.mapsUrl ??
              `https://www.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}`,
          }));
        }

        setEmergencyType(data.EmergencyType || "");

        // Update dispatch status from Firestore if changed server-side
        const status = data.Status || "Pending";
        if (status === "Ambulance Assigned" && dispatchStatus !== "assigned") {
          setDispatchStatus("assigned");
          if (data.ambulanceId) {
            setDispatchMessage(
              `Ambulance ${data.ambulanceId} has been assigned to your emergency.`
            );
          }
        }
      },
      (listenerError) => {
        console.error("Emergency status listener failed:", listenerError);
        setError(
          listenerError.code === "permission-denied"
            ? "Your emergency was submitted, but tracking access is blocked by Firestore rules."
            : "Unable to refresh emergency status."
        );
      }
    );

    return unsubscribe;
  }, [emergency?.id, location.state?.emergencyId, dispatchStatus]);

  /* ---------------------------------------------------------------- */
  /* STEP 3: Subscribe to assigned ambulance GPS                       */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const ambulanceId = emergency?.ambulanceId;

    if (!ambulanceId) {
      setAmbulanceLocation(null);
      setGpsUpdatedAt(null);
      setGpsError("");
      return undefined;
    }

    const gpsQuery = query(
      collection(db, "Ambulance_Locations"),
      where("ambulanceId", "==", ambulanceId)
    );

    const unsubscribe = onSnapshot(
      gpsQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setAmbulanceLocation(null);
          setGpsUpdatedAt(null);
          setGpsError(
            "Waiting for the assigned ambulance to publish GPS coordinates."
          );
          return;
        }

        const records = snapshot.docs.map((item) => ({
          ...item.data(),
          documentId: item.id,
        }));

        records.sort(
          (a, b) =>
            (b.updatedAt?.toMillis?.() || 0) -
            (a.updatedAt?.toMillis?.() || 0)
        );

        const latest = records[0];

        const coordinates = getCoordinates(
          latest.location ?? latest.coordinates ?? latest
        );

        if (!coordinates) {
          setAmbulanceLocation(null);
          setGpsError(
            "An ambulance GPS record exists, but its coordinates are invalid."
          );
          return;
        }

        setAmbulanceLocation(coordinates);
        setGpsUpdatedAt(latest.updatedAt?.toDate?.() || null);
        setGpsError("");
      },
      (listenerError) => {
        console.error("Ambulance GPS listener failed:", listenerError);
        setGpsError(
          listenerError.code === "permission-denied"
            ? "Patient access to ambulance GPS is blocked by Firestore rules."
            : "Unable to retrieve the ambulance's latest GPS location."
        );
      }
    );

    return unsubscribe;
  }, [emergency?.ambulanceId]);

  /* ---------------------------------------------------------------- */
  /* STEP 4: Subscribe to hospitals for map markers                    */
  /* ---------------------------------------------------------------- */

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
      (listenerError) => {
        console.error("Hospital listener failed:", listenerError);
      }
    );
    return unsubscribe;
  }, []);

  /* ---------------------------------------------------------------- */
  /* STEP 5: Calculate ETA when ambulance GPS updates                  */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!ambulanceLocation || !patientLocation) {
      return;
    }

    let cancelled = false;
    etaCalcRef.current = true;

    calculateETA(
      ambulanceLocation.latitude,
      ambulanceLocation.longitude,
      patientLocation.latitude,
      patientLocation.longitude,
      gpsUpdatedAt
    )
      .then((result) => {
        if (!cancelled) setEta(formatETA(result));
      })
      .catch((err) => {
        console.warn("ETA calculation failed:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [
    ambulanceLocation?.latitude,
    ambulanceLocation?.longitude,
    patientLocation?.latitude,
    patientLocation?.longitude,
    gpsUpdatedAt,
  ]);

  /* ---------------------------------------------------------------- */
  /* STEP 6: Save emergency type                                       */
  /* ---------------------------------------------------------------- */

  async function handleEmergencyTypeChange(event) {
    const selectedType = event.target.value;
    setEmergencyType(selectedType);
    setTypeMessage("");
    setSavingType(true);

    try {
      if (!emergency?.id)
        throw new Error("Emergency record is not available yet.");

      const priority =
        selectedType === "Cardiac Emergency"
          ? "Critical"
          : selectedType === "Road Accident" ||
            selectedType === "Breathing Difficulty"
          ? "High"
          : selectedType
          ? "Moderate"
          : null;

      await updateDoc(doc(db, "Emergency_Cases", emergency.id), {
        EmergencyType: selectedType || null,
        Priority: priority,
        updatedAt: serverTimestamp(),
      });

      setTypeMessage(
        selectedType ? "Emergency type saved." : "Emergency type cleared."
      );
    } catch (updateError) {
      console.error("Failed to update emergency type:", updateError);
      setTypeMessage(getErrorMessage(updateError));
    } finally {
      setSavingType(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /* IDLE STATE — show SOS button with voice option                   */
  /* ---------------------------------------------------------------- */

  if (pageStatus === "idle" && !shouldStartSOS && !emergency) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07111f] px-5 text-white">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#0c1929] p-7 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
            <Siren size={36} />
          </div>

          <h1 className="mt-5 text-2xl font-bold">Emergency SOS</h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Share your current GPS location with the emergency response team.
          </p>

          <button
            type="button"
            id="sos-button"
            onClick={startSOS}
            className="mt-7 w-full rounded-xl bg-red-600 px-5 py-4 font-bold transition hover:bg-red-500"
          >
            <Siren size={20} className="mr-2 inline" />
            SEND SOS
          </button>

          {/* Voice SOS */}
          <VoiceSOSButton onConfirmed={startSOS} />

          {error && (
            <p
              role="alert"
              className="mt-4 text-sm leading-6 text-red-300"
            >
              {error}
            </p>
          )}

          <Link
            to="/"
            className="mt-5 inline-block text-sm text-slate-400 underline"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const currentStatus = emergency?.Status || "Pending";

  const statusColor =
    currentStatus === "Completed"
      ? "text-emerald-300"
      : currentStatus === "Rejected" || currentStatus === "Assignment Failed"
      ? "text-red-300"
      : currentStatus === "Awaiting Ambulance"
      ? "text-amber-300"
      : emergency?.ambulanceId
      ? "text-cyan-300"
      : "text-amber-300";

  const dispatchBannerColor =
    dispatchStatus === "assigned"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : dispatchStatus === "no_ambulance" || dispatchStatus === "failed"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : dispatchStatus === "no_hospital"
      ? "border-orange-500/30 bg-orange-500/10 text-orange-200"
      : "border-cyan-500/20 bg-cyan-500/5 text-cyan-300";

  return (
    <div className="min-h-screen bg-[#07111f] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
              <Siren size={24} />
            </span>

            <span>
              <span className="block text-lg font-bold">
                Astralife <span className="text-cyan-400">AI</span>
              </span>

              <span className="block text-xs text-slate-500">
                Patient Tracking
              </span>
            </span>
          </Link>

          <a
            href="tel:112"
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold hover:bg-red-500"
          >
            <Phone size={17} />
            Emergency 112
          </a>
        </header>

        {/* Loading states */}
        {(pageStatus === "locating" || pageStatus === "sending") && (
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
            <div className="flex items-center gap-3">
              <LoaderCircle
                size={24}
                className="animate-spin text-cyan-300"
              />

              <div>
                <h2 className="font-semibold">
                  {pageStatus === "locating"
                    ? "Getting your location..."
                    : "Sending emergency request..."}
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Please keep this page open.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Dispatch banner */}
        {dispatchStatus === "dispatching" && (
          <div className="mb-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div className="flex items-center gap-3">
              <LoaderCircle
                size={18}
                className="shrink-0 animate-spin text-cyan-300"
              />
              <p className="text-sm text-cyan-200">{dispatchMessage}</p>
            </div>
          </div>
        )}

        {dispatchMessage && dispatchStatus !== "dispatching" && (
          <div
            className={`mb-4 rounded-2xl border p-4 text-sm ${dispatchBannerColor}`}
          >
            <div className="flex items-start gap-3">
              {dispatchStatus === "assigned" ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              )}
              <p>{dispatchMessage}</p>
            </div>
          </div>
        )}

        {/* Error */}
        {pageStatus === "error" && (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-5"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={22}
                className="shrink-0 text-red-300"
              />

              <div>
                <h2 className="font-semibold">Emergency request failed</h2>

                <p className="mt-2 text-sm leading-6 text-red-200">{error}</p>

                <button
                  type="button"
                  onClick={() => {
                    submissionStarted.current = false;
                    startSOS();
                  }}
                  className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500"
                >
                  Retry SOS
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tracking dashboard */}
        {emergency && (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              {/* Emergency status */}
              <section className="rounded-2xl border border-slate-800 bg-[#0c1929] p-5">
                <div className="flex items-center gap-3">
                  <Clock size={22} className="text-cyan-300" />

                  <p className="text-sm text-slate-400">Emergency Status</p>
                </div>

                <h2 className={`mt-4 text-xl font-bold ${statusColor}`}>
                  {currentStatus}
                </h2>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {emergency.ambulanceId
                    ? `Assigned ambulance: ${emergency.ambulanceId}`
                    : "Waiting for ambulance assignment."}
                </p>
              </section>

              {/* Ambulance tracking + ETA */}
              <section className="rounded-2xl border border-slate-800 bg-[#0c1929] p-5">
                <div className="flex items-center gap-3">
                  <Truck size={22} className="text-cyan-300" />

                  <p className="text-sm text-slate-400">Ambulance ETA</p>
                </div>

                {eta ? (
                  <>
                    <h2 className="mt-4 text-xl font-bold text-emerald-300">
                      {eta.durationMinutes} min
                    </h2>
                    <p className="mt-1 text-sm text-slate-300">
                      {eta.distanceKm} km away
                    </p>
                    {eta.arrivalStr && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <Timer size={12} />
                        Arrives ~{eta.arrivalStr}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-slate-600">
                      {eta.isStale
                        ? "⚠ GPS data may be stale — ETA approximate"
                        : eta.isLive
                        ? "Road route via OSRM"
                        : "Approximate (straight-line + road factor)"}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="mt-4 text-xl font-bold">
                      {ambulanceLocation
                        ? "Calculating…"
                        : emergency.ambulanceId
                        ? "Waiting for GPS"
                        : "Not Assigned"}
                    </h2>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {gpsUpdatedAt
                        ? `Last update: ${gpsUpdatedAt.toLocaleTimeString()}`
                        : gpsError ||
                          "ETA shown after ambulance publishes GPS."}
                    </p>
                  </>
                )}
              </section>

              {/* Patient location */}
              <section className="rounded-2xl border border-slate-800 bg-[#0c1929] p-5">
                <div className="flex items-center gap-3">
                  <MapPin size={22} className="text-red-300" />

                  <p className="text-sm text-slate-400">Your Location</p>
                </div>

                {patientLocation && (
                  <>
                    <p className="mt-4 break-all font-mono text-sm">
                      {patientLocation.latitude.toFixed(5)},{" "}
                      {patientLocation.longitude.toFixed(5)}
                    </p>

                    <a
                      href={patientLocation.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-300 underline"
                    >
                      <Navigation size={13} />
                      Open in Maps
                    </a>
                  </>
                )}
              </section>
            </div>

            {/* Emergency type */}
            <section className="mb-6 rounded-2xl border border-slate-800 bg-[#0c1929] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">Emergency Type</h2>

                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Select the type of emergency. It will be shared with the
                    Control Room.
                  </p>
                </div>

                {savingType && (
                  <LoaderCircle
                    size={20}
                    className="animate-spin text-cyan-300"
                  />
                )}
              </div>

              <select
                value={emergencyType}
                onChange={handleEmergencyTypeChange}
                disabled={savingType}
                className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 disabled:opacity-60"
              >
                <option value="">Not selected</option>

                {EMERGENCY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              {typeMessage && (
                <p className="mt-3 text-sm text-slate-300">{typeMessage}</p>
              )}
            </section>

            {/* Live map */}
            <GreenCorridorMap
              patient={patientLocation}
              ambulance={ambulanceLocation}
              hospital={
                hospitals.find(
                  (item) =>
                    String(item.id || item.hospitalId || "") ===
                      String(emergency?.hospitalId || "") ||
                    String(
                      item.name || item.hospitalName || ""
                    ).toLowerCase() ===
                      String(emergency?.hospitalId || "").toLowerCase()
                ) || null
              }
              hospitalId={emergency?.hospitalId}
              ambulanceId={emergency?.ambulanceId}
              hospitals={hospitals}
            />

            {/* Emergency reference + GPS staleness */}
            <section className="mt-6 rounded-2xl border border-slate-800 bg-[#0c1929] p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2
                  size={22}
                  className="mt-0.5 text-emerald-300"
                />

                <div className="min-w-0">
                  <h2 className="font-semibold">
                    Emergency Request Submitted
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Your location has been submitted to the emergency response
                    system. Keep this page open to receive status and GPS
                    updates.
                  </p>

                  <p className="mt-3 break-all font-mono text-xs text-cyan-300">
                    Reference: {emergency.id}
                  </p>

                  {gpsUpdatedAt && (
                    <p className="mt-2 text-xs text-slate-500">
                      Ambulance GPS last updated:{" "}
                      {gpsUpdatedAt.toLocaleTimeString()}
                      {eta?.isStale && (
                        <span className="ml-2 text-amber-400">
                          ⚠ Stale — ETA may be inaccurate
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        <footer className="mt-8 text-center text-xs text-slate-600">
          Astralife AI · Emergency Response Coordination System
        </footer>
      </div>
    </div>
  );
}