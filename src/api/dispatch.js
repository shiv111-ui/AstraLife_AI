import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../assets/firebase";

const AVAILABLE_STATUSES = new Set([
  "Available",
  "available",
  "ONLINE",
  "Online",
  "online",
  "Free",
  "free",
  "AVAILABLE",
]);

const EARTH_RADIUS_KM = 6371;
const MAX_GPS_AGE_MS = 5 * 60 * 1000;

function getCoordinates(value) {
  if (!value || typeof value !== "object") return null;

  const candidates = [
    value,
    value.location,
    value.coordinates,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (typeof candidate !== "object") continue;

    const latitude = Number(
      candidate.latitude ?? candidate.lat ?? candidate._lat
    );

    const longitude = Number(
      candidate.longitude ??
        candidate.lng ??
        candidate.lon ??
        candidate._long
    );

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      return { latitude, longitude };
    }
  }

  return null;
}

function distanceKm(a, b) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) ** 2;

  return (
    EARTH_RADIUS_KM *
    2 *
    Math.atan2(
      Math.sqrt(haversine),
      Math.sqrt(Math.max(0, 1 - haversine))
    )
  );
}

function getTimestampMillis(value) {
  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value === "number") {
    return value;
  }

  return 0;
}

async function getAmbulanceLocations() {
  const snapshot = await getDocs(
    collection(db, "Ambulance_Locations")
  );

  const locations = new Map();

  snapshot.forEach((item) => {
    const data = item.data();

    const ambulanceId = String(
      data.ambulanceId ??
        data.ambulance_id ??
        item.id
    ).trim();

    const coordinates = getCoordinates(data);

    if (!ambulanceId || !coordinates) return;

    const updatedAt = getTimestampMillis(
      data.updatedAt ?? data.timestamp
    );

    // Do not use GPS data older than five minutes.
    if (
      updatedAt > 0 &&
      Date.now() - updatedAt > MAX_GPS_AGE_MS
    ) {
      return;
    }

    const existing = locations.get(ambulanceId);

    if (!existing || updatedAt >= existing.updatedAt) {
      locations.set(ambulanceId, {
        ...coordinates,
        updatedAt,
      });
    }
  });

  return locations;
}

async function getAvailableAmbulances() {
  const snapshot = await getDocs(
    collection(db, "Ambulances")
  );

  return snapshot.docs
    .map((item) => {
      const data = item.data();

      return {
        documentId: item.id,
        ambulanceId: String(
          data.ambulance_id ??
            data.ambulanceId ??
            item.id
        ).trim(),
        status:
          data.current_status ??
          data.status ??
          data.Status ??
          "",
      };
    })
    .filter(
      (ambulance) =>
        ambulance.ambulanceId &&
        AVAILABLE_STATUSES.has(ambulance.status)
    );
}

async function getNearestHospital(patientCoordinates) {
  const snapshot = await getDocs(
    collection(db, "Hospitals")
  );

  let nearestHospital = null;
  let shortestDistance = Infinity;

  snapshot.forEach((item) => {
    const data = item.data();

    const accepting =
      data.acceptingEmergencies ??
      data.accepting ??
      data.active;

    if (accepting === false) return;

    const coordinates = getCoordinates(data);

    if (!coordinates) return;

    const distance = distanceKm(
      patientCoordinates,
      coordinates
    );

    if (distance < shortestDistance) {
      shortestDistance = distance;

      nearestHospital = {
        id: item.id,
        name:
          data.name ??
          data.hospitalName ??
          item.id,
        distanceKm: distance,
      };
    }
  });

  return nearestHospital;
}

/**
 * Assign an available ambulance and a suitable hospital.
 *
 * @param {string} emergencyId Emergency_Cases document ID.
 * @param {{latitude: number, longitude: number}} patientCoords
 */
export async function dispatch(emergencyId, patientCoords) {
  try {
    if (
      typeof emergencyId !== "string" ||
      !emergencyId.trim()
    ) {
      return {
        success: false,
        reason: "invalid_emergency",
        message: "A valid emergency ID is required.",
      };
    }

    const patientCoordinates = getCoordinates(patientCoords);

    if (!patientCoordinates) {
      return {
        success: false,
        reason: "invalid_location",
        message: "The patient's location is invalid.",
      };
    }

    const emergencyRef = doc(
      db,
      "Emergency_Cases",
      emergencyId
    );

    // Check that the emergency exists and has not already been assigned.
    const emergencySnapshot = await getDocs(
      collection(db, "Emergency_Cases")
    );

    const emergencyExists = emergencySnapshot.docs.some(
      (item) => item.id === emergencyId
    );

    if (!emergencyExists) {
      return {
        success: false,
        reason: "emergency_not_found",
        message: "The emergency record was not found.",
      };
    }

    const locations = await getAmbulanceLocations();
    const ambulances = await getAvailableAmbulances();

    if (ambulances.length === 0) {
      return {
        success: false,
        reason: "no_ambulance",
        message: "No available ambulances were found.",
      };
    }

    const rankedAmbulances = ambulances
      .map((ambulance) => {
        const location = locations.get(
          ambulance.ambulanceId
        );

        return {
          ...ambulance,
          location: location ?? null,
          distanceKm: location
            ? distanceKm(patientCoordinates, location)
            : Infinity,
        };
      })
      .filter((ambulance) => ambulance.location)
      .sort(
        (a, b) => a.distanceKm - b.distanceKm
      );

    if (rankedAmbulances.length === 0) {
      return {
        success: false,
        reason: "no_ambulance_location",
        message:
          "No available ambulance has a recent GPS location.",
      };
    }

    const hospital = await getNearestHospital(
      patientCoordinates
    );

    if (!hospital) {
      return {
        success: false,
        reason: "no_hospital",
        message:
          "No suitable hospital with valid coordinates was found.",
      };
    }

    // Try the nearest ambulance first. The transaction checks availability
    // again to reduce the risk of assigning an already-assigned ambulance.
    for (const ambulance of rankedAmbulances) {
      const ambulanceRef = doc(
        db,
        "Ambulances",
        ambulance.documentId
      );

      try {
        const assignment = await runTransaction(
          db,
          async (transaction) => {
            const currentEmergency =
              await transaction.get(emergencyRef);

            const currentAmbulance =
              await transaction.get(ambulanceRef);

            if (
              !currentEmergency.exists() ||
              !currentAmbulance.exists()
            ) {
              return { assigned: false };
            }

            const emergencyData = currentEmergency.data();
            const ambulanceData = currentAmbulance.data();

            const emergencyStatus = String(
              emergencyData.Status ??
                emergencyData.status ??
                ""
            ).toLowerCase();

            if (
              emergencyData.ambulanceId ||
              emergencyData.ambulance_id ||
              [
                "completed",
                "cancelled",
                "canceled",
              ].includes(emergencyStatus)
            ) {
              return {
                assigned: false,
                alreadyHandled: true,
              };
            }

            const currentStatus =
              ambulanceData.current_status ??
              ambulanceData.status ??
              ambulanceData.Status ??
              "";

            if (!AVAILABLE_STATUSES.has(currentStatus)) {
              return { assigned: false };
            }

            transaction.update(emergencyRef, {
              ambulanceId: ambulance.ambulanceId,
              hospitalId: hospital.id,
              Status: "Ambulance Assigned",
              assignedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            transaction.update(ambulanceRef, {
              current_status: "Assigned",
              assignedEmergencyId: emergencyId,
              updatedAt: serverTimestamp(),
            });

            return { assigned: true };
          }
        );

        if (assignment.alreadyHandled) {
          return {
            success: false,
            reason: "already_handled",
            message:
              "This emergency has already been assigned or closed.",
          };
        }

        if (!assignment.assigned) {
          continue;
        }

        return {
          success: true,
          ambulanceId: ambulance.ambulanceId,
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          distanceKm: Number(
            ambulance.distanceKm.toFixed(2)
          ),
          hospitalDistanceKm: Number(
            hospital.distanceKm.toFixed(2)
          ),
          // Approximate straight-line ETA, not road-routing ETA.
          etaMinutes: Math.max(
            1,
            Math.ceil((ambulance.distanceKm / 40) * 60)
          ),
        };
      } catch (error) {
        console.error(
          `Assignment failed for ambulance ${ambulance.ambulanceId}:`,
          error
        );

        if (error.code === "permission-denied") {
          return {
            success: false,
            reason: "permission_denied",
            message:
              "Firebase rules do not permit this assignment. Check the security rules and dispatch architecture.",
          };
        }

        // Try the next ambulance if this one could not be reserved.
      }
    }

    return {
      success: false,
      reason: "no_ambulance",
      message:
        "No ambulance could be reserved. Notify the control room.",
    };
  } catch (error) {
    console.error("Dispatch failed:", error);

    return {
      success: false,
      reason: "dispatch_failed",
      message:
        error.code === "permission-denied"
          ? "Firebase denied dispatch access. Check Firestore rules."
          : "Dispatch failed. Check the Firebase connection and console.",
    };
  }
}

/**
 * Release an ambulance after its emergency is completed.
 *
 * Pass the Ambulances document ID, not an arbitrary ambulance name.
 */
export async function releaseAmbulance(
  ambulanceDocumentId,
  emergencyId = null
) {
  try {
    if (
      typeof ambulanceDocumentId !== "string" ||
      !ambulanceDocumentId.trim()
    ) {
      return {
        success: false,
        message: "A valid ambulance document ID is required.",
      };
    }

    const ambulanceRef = doc(
      db,
      "Ambulances",
      ambulanceDocumentId
    );

    await runTransaction(db, async (transaction) => {
      const ambulanceSnapshot =
        await transaction.get(ambulanceRef);

      if (!ambulanceSnapshot.exists()) {
        throw new Error("Ambulance record not found.");
      }

      const data = ambulanceSnapshot.data();

      // If an emergency ID is supplied, only release this ambulance
      // when it is assigned to that specific emergency.
      if (
        emergencyId &&
        data.assignedEmergencyId !== emergencyId
      ) {
        throw new Error(
          "This ambulance is not assigned to that emergency."
        );
      }

      transaction.update(ambulanceRef, {
        current_status: "Available",
        assignedEmergencyId: null,
        updatedAt: serverTimestamp(),
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Release ambulance failed:", error);

    return {
      success: false,
      message: error.message,
    };
  }
}