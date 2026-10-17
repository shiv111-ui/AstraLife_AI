import crypto from "node:crypto";

export const EMERGENCY_TYPES = new Set([
  "Medical Emergency",
  "Road Accident",
  "Cardiac Emergency",
  "Breathing Difficulty",
  "Pregnancy Emergency",
  "Fire Emergency",
]);

export function emergencyDocumentId(uid, requestId) {
  return crypto.createHash("sha256").update(`${uid}:${requestId}`).digest("hex").slice(0, 40);
}

export function validatePatientSOS(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid SOS payload.");
  }
  if (Object.keys(payload).some((key) => !["requestId", "emergencyType", "location"].includes(key))) {
    throw new Error("SOS payload contains unsupported fields.");
  }
  if (typeof payload.requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.requestId)) {
    throw new Error("A valid request ID is required.");
  }
  if (!EMERGENCY_TYPES.has(payload.emergencyType)) {
    throw new Error("Select a valid emergency type.");
  }
  const latitude = Number(payload.location?.latitude);
  const longitude = Number(payload.location?.longitude);
  const accuracy = Number(payload.location?.accuracy);
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    throw new Error("Valid GPS coordinates are required.");
  }
  if (payload.location?.accuracy != null && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100000)) {
    throw new Error("GPS accuracy is invalid.");
  }
  return { requestId: payload.requestId.toLowerCase(), emergencyType: payload.emergencyType, location: { latitude, longitude, ...(payload.location?.accuracy == null ? {} : { accuracy }) } };
}

export function coordinates(value) {
  if (!value || typeof value !== "object") return null;
  for (const point of [value, value.location, value.coordinates, value.location?.coordinates]) {
    if (!point || typeof point !== "object") continue;
    const latitude = Number(point.latitude ?? point.lat ?? point._lat);
    const longitude = Number(point.longitude ?? point.lng ?? point.lon ?? point._long);
    if (Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180) return { latitude, longitude };
  }
  return null;
}

export function distanceKm(a, b) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function reserveCapacity(hospital, emergencyType) {
  const overallPath = "bed_availability.vacant_beds";
  const overall = Number(hospital?.bed_availability?.vacant_beds);
  if (!Number.isFinite(overall) || overall < 1) return null;
  const categories = /cardiac|heart|stroke|critical/i.test(emergencyType)
    ? ["icu_beds"]
    : /pregnan|maternity|obstetric|childbirth/i.test(emergencyType)
      ? ["general_ward_beds"]
      : ["general_ward_beds", "icu_beds"];
  for (const category of categories) {
    const path = `bed_availability.${category}.vacant`;
    const available = Number(hospital?.bed_availability?.[category]?.vacant);
    if (Number.isFinite(available) && available > 0) {
      return { category, bedPath: path, overallPath };
    }
  }
  return null;
}

export function hasExplicitHospitalAcceptance(hospital) {
  // `active` is an account/configuration flag and does not prove the hospital
  // is operationally accepting a transfer. Capacity alone is not acceptance.
  return hospital?.acceptingEmergencies === true || hospital?.accepting === true ||
    ["available", "open", "accepting"].includes(String(hospital?.current_status ?? hospital?.status ?? "").toLowerCase());
}
