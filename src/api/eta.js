/**
 * eta.js — ETA calculation with OSRM routing and throttling
 *
 * Uses the same OSRM endpoint as routing.js. Throttles recalculations to
 * at most once every 60 seconds per ambulance-to-destination pair.
 * Falls back to Haversine + assumed speed when OSRM is unavailable.
 */

import { getRoute } from "./routing.js";

const ASSUMED_SPEED_KMH = 40; // urban ambulance speed assumption

/**
 * Haversine distance in km.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Cache entry: { result, expiresAt } */
const _cache = new Map();
const THROTTLE_MS = 60_000; // 60 seconds

function cacheKey(aLat, aLng, dLat, dLng) {
  return `${aLat.toFixed(4)},${aLng.toFixed(4)}->${dLat.toFixed(4)},${dLng.toFixed(4)}`;
}

/**
 * Calculate ETA from ambulance coordinates to destination coordinates.
 *
 * @param {number} ambulanceLat
 * @param {number} ambulanceLng
 * @param {number} destinationLat
 * @param {number} destinationLng
 * @param {Date|null} gpsUpdatedAt — timestamp of the ambulance's latest GPS fix
 *
 * @returns {object} {
 *   distanceKm,       number
 *   durationMinutes,  number
 *   arrivalTime,      Date
 *   isLive,           boolean — true if OSRM road data was used
 *   isStale,          boolean — true if GPS was last updated more than 3 min ago
 *   updatedAt,        Date
 *   source,           "osrm" | "haversine-fallback"
 * }
 */
export async function calculateETA(
  ambulanceLat,
  ambulanceLng,
  destinationLat,
  destinationLng,
  gpsUpdatedAt = null
) {
  const key = cacheKey(
    ambulanceLat,
    ambulanceLng,
    destinationLat,
    destinationLng
  );

  const cached = _cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const now = new Date();

  const isStale =
    gpsUpdatedAt instanceof Date
      ? now - gpsUpdatedAt > 3 * 60 * 1000
      : false;

  let distanceKm;
  let durationMinutes;
  let source;

  try {
    const route = await getRoute(
      ambulanceLat,
      ambulanceLng,
      destinationLat,
      destinationLng
    );
    distanceKm = route.distanceKm;
    durationMinutes = route.durationMinutes;
    source = "osrm";
  } catch {
    // OSRM unavailable — use Haversine fallback
    distanceKm = Number(
      haversineKm(
        ambulanceLat,
        ambulanceLng,
        destinationLat,
        destinationLng
      ).toFixed(2)
    );
    // Add ~30% for road detours
    const roadEstimateKm = distanceKm * 1.3;
    durationMinutes = Math.ceil((roadEstimateKm / ASSUMED_SPEED_KMH) * 60);
    source = "haversine-fallback";
  }

  const arrivalTime = new Date(now.getTime() + durationMinutes * 60 * 1000);

  const result = {
    distanceKm,
    durationMinutes,
    arrivalTime,
    isLive: source === "osrm",
    isStale,
    updatedAt: now,
    source,
  };

  _cache.set(key, { result, expiresAt: Date.now() + THROTTLE_MS });

  return result;
}
