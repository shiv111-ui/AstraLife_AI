import admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  coordinates,
  distanceKm,
  emergencyDocumentId,
  hasExplicitHospitalAcceptance,
  reserveCapacity,
  validatePatientSOS,
} from "./dispatch-core.js";

admin.initializeApp();
const db = admin.firestore();
const { FieldValue } = admin.firestore;
const REGION = "asia-south1";
const CLOSED = new Set(["completed", "cancelled", "canceled", "rejected"]);
const AVAILABILITY = new Set(["available", "online", "free"]);
const AMBULANCE_STATUSES = new Set(["Accepted", "En Route", "At Scene", "Transporting", "At Hospital", "Patient Onboard"]);

function staffPath(uid) {
  return db.collection("Staff").doc(uid);
}

async function requireRole(request, role, resourceField = null, resourceId = null) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in is required.");
  const snapshot = await staffPath(request.auth.uid).get();
  const staff = snapshot.data();
  if (!snapshot.exists || staff?.active !== true || staff?.role !== role) {
    throw new HttpsError("permission-denied", "This staff role is not authorized for the operation.");
  }
  if (resourceField && String(staff[resourceField] ?? "") !== String(resourceId ?? "")) {
    throw new HttpsError("permission-denied", "This account is not assigned to that resource.");
  }
  return staff;
}

function hospitalSnapshot(data, id) {
  return {
    id,
    ...(typeof data.name === "string" ? { name: data.name } : {}),
    ...(typeof data.address === "string" ? { address: data.address } : {}),
    ...(typeof data.contact_number === "string" ? { contactNumber: data.contact_number } : {}),
    ...(coordinates(data) ? { coordinates: coordinates(data) } : {}),
  };
}

function ambulanceSnapshot(data, id) {
  return {
    id,
    ...(typeof data.vehicle_number === "string" ? { vehicleNumber: data.vehicle_number } : {}),
    ...(typeof data.service_provider === "string" ? { serviceProvider: data.service_provider } : {}),
    ...(typeof data.contact_number === "string" ? { contactNumber: data.contact_number } : {}),
    ...(typeof data.service_type === "string" ? { serviceType: data.service_type } : {}),
  };
}

function eligibilityScore(ambulance, type) {
  const text = `${ambulance.service_type ?? ""} ${Array.isArray(ambulance.equipped_with) ? ambulance.equipped_with.join(" ") : ""} ${ambulance.medical_staff ?? ""}`.toLowerCase();
  if (/cardiac|heart|stroke|critical/i.test(type)) return /acls|cardiac|defibrillator|advanced cardiac/.test(text) ? 2 : 0;
  if (/breath|respirat|oxygen/i.test(type)) return /ventilator|oxygen/.test(text) ? 2 : 0;
  if (/pregnan|maternity|obstetric|childbirth/i.test(type)) return /nurse|advanced|medical/.test(text) ? 1 : 0;
  return /emergency|advanced|medical|emt/.test(text) ? 1 : 0;
}

async function markWaiting(emergencyRef, status, reason) {
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(emergencyRef);
    if (!current.exists) return;
    const data = current.data();
    const currentStatus = String(data.Status ?? data.status ?? "").toLowerCase();
    if (data.ambulanceId || CLOSED.has(currentStatus)) return;
    transaction.update(emergencyRef, { Status: status, dispatchReason: reason, updatedAt: FieldValue.serverTimestamp() });
  });
}

async function tryAutomaticAssignment(emergencyRef) {
  const emergencySnapshot = await emergencyRef.get();
  if (!emergencySnapshot.exists) throw new HttpsError("not-found", "Emergency record was not found.");
  const emergency = emergencySnapshot.data();
  if (emergency.ambulanceId || CLOSED.has(String(emergency.Status ?? "").toLowerCase())) return { assigned: false, reason: "already_handled" };
  const patientPoint = coordinates(emergency.location);
  if (!patientPoint) return { assigned: false, reason: "invalid_location" };

  const [ambulanceSnapshot, locationSnapshot, hospitalSnapshot] = await Promise.all([
    db.collection("Ambulances").get(),
    db.collection("Ambulance_Locations").get(),
    db.collection("Hospitals").get(),
  ]);
  const now = Date.now();
  const locations = new Map();
  for (const item of locationSnapshot.docs) {
    const data = item.data();
    const point = coordinates(data);
    const time = data.updatedAt?.toMillis?.() ?? data.timestamp?.toMillis?.() ?? 0;
    const id = String(data.ambulanceId ?? data.ambulance_id ?? item.id);
    if (!point || !time || now - time > 5 * 60 * 1000 || now < time) continue;
    locations.set(id, { ...point, updatedAt: time });
  }
  const ambulances = ambulanceSnapshot.docs.map((item) => {
    const data = item.data();
    const id = String(data.ambulance_id ?? data.ambulanceId ?? item.id);
    const point = locations.get(id);
    return { ref: item.ref, data, id, point, status: String(data.current_status ?? data.status ?? "").toLowerCase() };
  }).filter((item) => item.point && AVAILABILITY.has(item.status))
    .map((item) => ({ ...item, score: eligibilityScore(item.data, emergency.EmergencyType), distance: distanceKm(patientPoint, item.point) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.distance - b.distance);

  if (!ambulances.length) {
    await markWaiting(emergencyRef, "Awaiting Ambulance", "No available ambulance has verified suitability and a recent location.");
    return { assigned: false, reason: "no_ambulance" };
  }

  const hospitals = hospitalSnapshot.docs.map((item) => {
    const data = item.data();
    const point = coordinates(data);
    const reservation = reserveCapacity(data, emergency.EmergencyType);
    if (!point || !reservation || !hasExplicitHospitalAcceptance(data)) return null;
    return { ref: item.ref, data, id: item.id, point, reservation, distance: distanceKm(patientPoint, point) };
  }).filter(Boolean).sort((a, b) => a.distance - b.distance);
  if (!hospitals.length) {
    await markWaiting(emergencyRef, "Awaiting Hospital", "No hospital has verified coordinates, explicit acceptance, and suitable available capacity.");
    return { assigned: false, reason: "no_hospital" };
  }

  for (const hospital of hospitals) {
    for (const ambulance of ambulances) {
      const outcome = await db.runTransaction(async (transaction) => {
        const [currentEmergency, currentAmbulance, currentHospital] = await Promise.all([
          transaction.get(emergencyRef), transaction.get(ambulance.ref), transaction.get(hospital.ref),
        ]);
        if (!currentEmergency.exists || !currentAmbulance.exists || !currentHospital.exists) return "retry";
        const emergencyData = currentEmergency.data();
        if (emergencyData.ambulanceId || CLOSED.has(String(emergencyData.Status ?? "").toLowerCase())) return "handled";
        const ambulanceData = currentAmbulance.data();
        const hospitalData = currentHospital.data();
        const reservation = reserveCapacity(hospitalData, emergencyData.EmergencyType);
        const ambulanceStatus = String(ambulanceData.current_status ?? ambulanceData.status ?? "").toLowerCase();
        if (!AVAILABILITY.has(ambulanceStatus) || ambulanceData.assignedEmergencyId || !reservation || !hasExplicitHospitalAcceptance(hospitalData)) return "retry";

        const ambulanceId = String(ambulanceData.ambulance_id ?? ambulanceData.ambulanceId ?? ambulance.id);
        const driveDistanceKm = ambulance.distance * 1.3;
        const etaMinutes = Math.max(1, Math.ceil(driveDistanceKm / 40 * 60));
        transaction.update(emergencyRef, {
          ambulanceId,
          hospitalId: hospital.id,
          ambulanceDetails: ambulanceSnapshot(ambulanceData, ambulanceId),
          hospitalDetails: hospitalSnapshot(hospitalData, hospital.id),
          ambulanceLocation: { ...ambulance.point, updatedAt: FieldValue.serverTimestamp() },
          dispatchEta: { minutes: etaMinutes, distanceKm: Number(driveDistanceKm.toFixed(2)), source: "haversine-approximation" },
          reservedBedPath: reservation.bedPath,
          reservedEmergencyBedPath: reservation.overallPath,
          Status: "Ambulance Assigned",
          dispatchReason: null,
          assignedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.update(ambulance.ref, { current_status: "Assigned", assignedEmergencyId: emergencyRef.id, updatedAt: FieldValue.serverTimestamp() });
        transaction.update(hospital.ref, {
          [reservation.bedPath]: Number(hospitalData.bed_availability[reservation.category].vacant) - 1,
          [reservation.overallPath]: Number(hospitalData.bed_availability.vacant_beds) - 1,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return "assigned";
      });
      if (outcome === "assigned") {
        const ambulanceId = String(ambulance.data.ambulance_id ?? ambulance.data.ambulanceId ?? ambulance.id);
        const driveDistanceKm = ambulance.distance * 1.3;
        const etaMinutes = Math.max(1, Math.ceil(driveDistanceKm / 40 * 60));
        return {
          assigned: true,
          ambulanceId,
          hospitalId: hospital.id,
          hospitalName: hospital.data.name ?? null,
          distanceKm: Number(driveDistanceKm.toFixed(2)),
          etaMinutes,
          etaSource: "haversine-approximation",
        };
      }
      if (outcome === "handled") return { assigned: false, reason: "already_handled" };
    }
  }
  await markWaiting(emergencyRef, "Awaiting Hospital", "Resources changed during reservation; control room review is required.");
  return { assigned: false, reason: "no_resources" };
}

export const submitPatientSOS = onCall({ region: REGION, enforceAppCheck: true }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "A transient Firebase patient session is required.");
  let input;
  try { input = validatePatientSOS(request.data); }
  catch (error) { throw new HttpsError("invalid-argument", error.message); }

  const documentId = emergencyDocumentId(request.auth.uid, input.requestId);
  const emergencyRef = db.collection("Emergency_Cases").doc(documentId);
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(emergencyRef);
    if (current.exists) {
      if (current.data().patientUid !== request.auth.uid) throw new HttpsError("permission-denied", "Request identifier is already in use.");
      return;
    }
    transaction.create(emergencyRef, {
      patientUid: request.auth.uid,
      requestId: input.requestId,
      EmergencyType: input.emergencyType,
      Priority: null,
      Status: "Pending",
      location: { ...input.location, source: "browser-gps" },
      ambulanceId: null,
      hospitalId: null,
      ambulanceDetails: null,
      hospitalDetails: null,
      ambulanceLocation: null,
      dispatchEta: null,
      dispatchReason: null,
      victimCount: 1,
      description: null,
      source: "patient-sos",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  let assignment;
  try {
    assignment = await tryAutomaticAssignment(emergencyRef);
  } catch (error) {
    console.error("Automatic assignment failed after SOS creation", { code: error?.code || "unknown" });
    assignment = { assigned: false, reason: "dispatch_unavailable" };
  }
  return { emergencyId: documentId, ...assignment };
});

export const dispatchExistingEmergency = onCall({ region: REGION, enforceAppCheck: true }, async (request) => {
  await requireRole(request, "control-room");
  if (typeof request.data?.emergencyId !== "string" || !request.data.emergencyId) throw new HttpsError("invalid-argument", "Emergency ID is required.");
  return tryAutomaticAssignment(db.collection("Emergency_Cases").doc(request.data.emergencyId));
});

export const assignEmergencyResources = onCall({ region: REGION, enforceAppCheck: true }, async (request) => {
  await requireRole(request, "control-room");
  const { emergencyId, ambulanceDocumentId, hospitalId } = request.data ?? {};
  if (![emergencyId, ambulanceDocumentId, hospitalId].every((value) => typeof value === "string" && value.length > 0)) throw new HttpsError("invalid-argument", "Emergency, ambulance, and hospital IDs are required.");
  const emergencyRef = db.collection("Emergency_Cases").doc(emergencyId);
  const ambulanceRef = db.collection("Ambulances").doc(ambulanceDocumentId);
  const hospitalRef = db.collection("Hospitals").doc(hospitalId);
  return db.runTransaction(async (transaction) => {
    const [emergencySnap, ambulanceSnap, hospitalSnap] = await Promise.all([transaction.get(emergencyRef), transaction.get(ambulanceRef), transaction.get(hospitalRef)]);
    if (!emergencySnap.exists || !ambulanceSnap.exists || !hospitalSnap.exists) throw new HttpsError("not-found", "Emergency or resource record was not found.");
    const emergency = emergencySnap.data();
    const ambulance = ambulanceSnap.data();
    const hospital = hospitalSnap.data();
    if (emergency.ambulanceId || CLOSED.has(String(emergency.Status ?? "").toLowerCase())) throw new HttpsError("failed-precondition", "This emergency is already assigned or closed.");
    if (!AVAILABILITY.has(String(ambulance.current_status ?? ambulance.status ?? "").toLowerCase()) || ambulance.assignedEmergencyId) throw new HttpsError("failed-precondition", "This ambulance is not available.");
    const reservation = reserveCapacity(hospital, emergency.EmergencyType);
    if (!reservation) throw new HttpsError("failed-precondition", "This hospital has no suitable available capacity.");
    const ambulanceId = String(ambulance.ambulance_id ?? ambulance.ambulanceId ?? ambulanceDocumentId);
    transaction.update(emergencyRef, {
      ambulanceId, hospitalId,
      ambulanceDetails: ambulanceSnapshot(ambulance, ambulanceId),
      hospitalDetails: hospitalSnapshot(hospital, hospitalId),
      reservedBedPath: reservation.bedPath,
      reservedEmergencyBedPath: reservation.overallPath,
      Status: "Ambulance Assigned",
      dispatchReason: null,
      assignedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(ambulanceRef, { current_status: "Assigned", assignedEmergencyId: emergencyId, updatedAt: FieldValue.serverTimestamp() });
    transaction.update(hospitalRef, {
      [reservation.bedPath]: Number(hospital.bed_availability[reservation.category].vacant) - 1,
      [reservation.overallPath]: Number(hospital.bed_availability.vacant_beds) - 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { success: true, ambulanceId, hospitalId };
  });
});

export const completeEmergency = onCall({ region: REGION, enforceAppCheck: true }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in is required.");
  const emergencyId = request.data?.emergencyId;
  const finalStatus = request.data?.finalStatus || "Completed";
  if (typeof emergencyId !== "string" || !CLOSED.has(String(finalStatus).toLowerCase())) throw new HttpsError("invalid-argument", "A valid emergency ID and terminal status are required.");
  const staffSnapshot = await staffPath(request.auth.uid).get();
  const staff = staffSnapshot.data();
  if (!staffSnapshot.exists || staff?.active !== true || !["ambulance", "control-room"].includes(staff.role)) {
    throw new HttpsError("permission-denied", "This staff role is not authorized to close emergencies.");
  }
  if (staff.role === "ambulance" && String(staff.ambulanceId ?? "") !== String(request.data?.ambulanceId ?? "")) {
    throw new HttpsError("permission-denied", "This account is not assigned to that ambulance.");
  }
  const emergencyRef = db.collection("Emergency_Cases").doc(emergencyId);
  const initialCase = await emergencyRef.get();
  if (!initialCase.exists) throw new HttpsError("not-found", "Emergency record was not found.");
  const initialEmergency = initialCase.data();
  if (staff.role === "ambulance" && String(initialEmergency.ambulanceId ?? "") !== String(staff.ambulanceId)) {
    throw new HttpsError("permission-denied", "This emergency is not assigned to this ambulance.");
  }
  let ambulanceRef = null;
  if (initialEmergency.ambulanceId) {
    const ambulanceMatches = await db.collection("Ambulances").where("ambulance_id", "==", initialEmergency.ambulanceId).limit(2).get();
    const matched = ambulanceMatches.docs.find((item) => String(item.data().ambulance_id ?? item.data().ambulanceId ?? item.id) === String(initialEmergency.ambulanceId));
    if (!matched) throw new HttpsError("failed-precondition", "The assigned ambulance record is missing; control-room reconciliation is required.");
    ambulanceRef = matched.ref;
  }
  const hospitalRef = initialEmergency.hospitalId ? db.collection("Hospitals").doc(initialEmergency.hospitalId) : null;
  return db.runTransaction(async (transaction) => {
    const [caseSnap, ambulanceSnap, hospitalSnap] = await Promise.all([
      transaction.get(emergencyRef),
      ambulanceRef ? transaction.get(ambulanceRef) : Promise.resolve(null),
      hospitalRef ? transaction.get(hospitalRef) : Promise.resolve(null),
    ]);
    if (!caseSnap.exists) throw new HttpsError("not-found", "Emergency record was not found.");
    const emergency = caseSnap.data();
    if (staff.role === "ambulance") {
      if (!ambulanceSnap.exists) throw new HttpsError("not-found", "Ambulance record was not found.");
      const ambulance = ambulanceSnap.data();
      if (String(emergency.ambulanceId ?? "") !== String(staff.ambulanceId) || ambulance.assignedEmergencyId !== emergencyId) throw new HttpsError("permission-denied", "This emergency is not assigned to this ambulance.");
    }
    if (staff.role === "control-room" && ambulanceSnap?.exists && ambulanceSnap.data().assignedEmergencyId !== emergencyId) {
      throw new HttpsError("failed-precondition", "The ambulance assignment no longer matches this emergency.");
    }
    if (CLOSED.has(String(emergency.Status ?? "").toLowerCase())) return { success: true, alreadyClosed: true };
    transaction.update(emergencyRef, { Status: finalStatus, updatedAt: FieldValue.serverTimestamp() });
    if (ambulanceRef) transaction.update(ambulanceRef, { current_status: "Available", assignedEmergencyId: null, updatedAt: FieldValue.serverTimestamp() });
    if (hospitalSnap?.exists) {
      const hospital = hospitalSnap.data();
      const update = { updatedAt: FieldValue.serverTimestamp() };
      for (const path of [emergency.reservedBedPath, emergency.reservedEmergencyBedPath]) {
        if (!new Set([
          "bed_availability.icu_beds.vacant",
          "bed_availability.general_ward_beds.vacant",
          "bed_availability.vacant_beds",
        ]).has(path)) continue;
        const pieces = path.split(".");
        let target = hospital;
        for (const key of pieces) target = target?.[key];
        if (Number.isFinite(Number(target))) {
          const totalPath = path === "bed_availability.vacant_beds"
            ? "bed_availability.total_beds"
            : path.replace(".vacant", ".total");
          let totalTarget = hospital;
          for (const key of totalPath.split(".")) totalTarget = totalTarget?.[key];
          if (Number.isFinite(Number(totalTarget)) && Number(target) < Number(totalTarget)) update[path] = Number(target) + 1;
        }
      }
      transaction.update(hospitalRef, update);
    }
    return { success: true };
  });
});

export const updateEmergencyStatus = onCall({ region: REGION, enforceAppCheck: true }, async (request) => {
  const { emergencyId, ambulanceId, status } = request.data ?? {};
  if (typeof emergencyId !== "string" || !emergencyId || typeof ambulanceId !== "string" || !ambulanceId || !AMBULANCE_STATUSES.has(status)) {
    throw new HttpsError("invalid-argument", "A valid emergency, ambulance, and mission status are required.");
  }
  await requireRole(request, "ambulance", "ambulanceId", ambulanceId);
  const matches = await db.collection("Ambulances").where("ambulance_id", "==", ambulanceId).limit(2).get();
  const ambulanceDoc = matches.docs.find((item) => String(item.data().ambulance_id ?? item.data().ambulanceId ?? item.id) === ambulanceId);
  if (!ambulanceDoc) throw new HttpsError("not-found", "Ambulance record was not found.");
  const emergencyRef = db.collection("Emergency_Cases").doc(emergencyId);
  return db.runTransaction(async (transaction) => {
    const [emergencySnap, ambulanceSnap] = await Promise.all([
      transaction.get(emergencyRef),
      transaction.get(ambulanceDoc.ref),
    ]);
    if (!emergencySnap.exists || !ambulanceSnap.exists) throw new HttpsError("not-found", "Emergency or ambulance record was not found.");
    const emergency = emergencySnap.data();
    const ambulance = ambulanceSnap.data();
    if (String(emergency.ambulanceId ?? "") !== ambulanceId || ambulance.assignedEmergencyId !== emergencyId) {
      throw new HttpsError("permission-denied", "This emergency is not assigned to this ambulance.");
    }
    if (CLOSED.has(String(emergency.Status ?? "").toLowerCase())) throw new HttpsError("failed-precondition", "This emergency is already closed.");
    transaction.update(emergencyRef, { Status: status, updatedAt: FieldValue.serverTimestamp() });
    return { success: true };
  });
});

export const mirrorAmbulanceLocation = onDocumentWritten({ document: "Ambulance_Locations/{locationId}", region: REGION }, async (event) => {
  const location = event.data?.after?.data();
  if (!location) return;
  const ambulanceId = String(location.ambulanceId ?? location.ambulance_id ?? event.params.locationId);
  const point = coordinates(location);
  if (!point) return;
  const ambulanceMatches = await db.collection("Ambulances").where("ambulance_id", "==", ambulanceId).limit(1).get();
  const ambulance = ambulanceMatches.docs[0];
  const emergencyId = ambulance?.data()?.assignedEmergencyId;
  if (!emergencyId) return;
  const emergencyRef = db.collection("Emergency_Cases").doc(emergencyId);
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(emergencyRef);
    if (!current.exists || current.data().ambulanceId !== ambulanceId) return;
    transaction.update(emergencyRef, {
      ambulanceLocation: { ...point, updatedAt: location.updatedAt ?? FieldValue.serverTimestamp() },
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
});
