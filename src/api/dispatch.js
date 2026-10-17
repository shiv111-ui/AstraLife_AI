import { signInAnonymously } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../assets/firebase";

async function callFunction(name, payload, operation) {
  try {
    const callable = httpsCallable(functions, name);
    const response = await callable(payload);
    return response.data;
  } catch (error) {
    console.error("Trusted dispatch request failed", {
      operation,
      code: error?.code || "unknown",
      errorName: error?.name || "Error",
      authenticated: Boolean(auth.currentUser),
    });
    return {
      success: false,
      reason: error?.code === "functions/permission-denied" ? "permission_denied" : "backend_unavailable",
      operation,
      message: error?.code === "functions/failed-precondition"
        ? "Secure Firebase App Check is not configured for this app yet."
        : error?.message || "The secure dispatch service is unavailable.",
    };
  }
}

export async function submitPatientSOS(payload) {
  try {
    if (!auth.currentUser) await signInAnonymously(auth);
    return await callFunction("submitPatientSOS", payload, "submit SOS through the trusted backend");
  } catch (error) {
    console.error("Patient session setup failed", {
      operation: "anonymous Firebase sign-in",
      code: error?.code || "unknown",
      errorName: error?.name || "Error",
    });
    return {
      success: false,
      reason: "authentication_unavailable",
      operation: "anonymous Firebase sign-in",
      message: error?.message || "Could not start a secure patient session.",
    };
  }
}

export async function dispatch(emergencyId) {
  const result = await callFunction("dispatchExistingEmergency", { emergencyId }, "control-room dispatch");
  return { ...result, success: result?.assigned === true || result?.success === true };
}

export async function assignResources(emergencyId, ambulanceDocumentId, hospitalId) {
  return callFunction("assignEmergencyResources", { emergencyId, ambulanceDocumentId, hospitalId }, "control-room resource assignment");
}

export async function completeEmergency(emergencyId, ambulanceId, finalStatus = "Completed") {
  return callFunction("completeEmergency", { emergencyId, ambulanceId, finalStatus }, "ambulance mission completion");
}

export async function updateEmergencyStatus(emergencyId, ambulanceId, status) {
  return callFunction("updateEmergencyStatus", { emergencyId, ambulanceId, status }, "ambulance mission status update");
}
