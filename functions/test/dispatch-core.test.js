import test from "node:test";
import assert from "node:assert/strict";
import { coordinates, distanceKm, emergencyDocumentId, hasExplicitHospitalAcceptance, reserveCapacity, validatePatientSOS } from "../dispatch-core.js";

const validRequest = {
  requestId: "b4e4d47c-cc33-4d54-bd8e-4bec32d97fa1",
  emergencyType: "Medical Emergency",
  location: { latitude: 19.1, longitude: 74.7, accuracy: 18 },
};

test("validates and normalizes a patient SOS request", () => {
  assert.deepEqual(validatePatientSOS(validRequest), validRequest);
});

test("rejects unsupported fields, types, and out-of-range coordinates", () => {
  assert.throws(() => validatePatientSOS({ ...validRequest, patientUid: "spoofed" }), /unsupported fields/);
  assert.throws(() => validatePatientSOS({ ...validRequest, emergencyType: "Unknown" }), /valid emergency type/);
  assert.throws(() => validatePatientSOS({ ...validRequest, location: { latitude: 91, longitude: 10 } }), /coordinates/);
});

test("reads only existing capacity fields and never reserves a zero bed", () => {
  const hospital = { bed_availability: { vacant_beds: 2, general_ward_beds: { vacant: 1 }, icu_beds: { vacant: 0 } } };
  assert.deepEqual(reserveCapacity(hospital, "Medical Emergency"), {
    category: "general_ward_beds",
    bedPath: "bed_availability.general_ward_beds.vacant",
    overallPath: "bed_availability.vacant_beds",
  });
  assert.equal(reserveCapacity({ bed_availability: { vacant_beds: 0, general_ward_beds: { vacant: 3 } } }, "Medical Emergency"), null);
  assert.equal(reserveCapacity(hospital, "Cardiac Emergency"), null);
});

test("does not infer hospital acceptance from capacity alone", () => {
  assert.equal(hasExplicitHospitalAcceptance({ bed_availability: { vacant_beds: 4 } }), false);
  assert.equal(hasExplicitHospitalAcceptance({ active: true }), false);
  assert.equal(hasExplicitHospitalAcceptance({ acceptingEmergencies: true }), true);
});

test("SOS retries use a stable patient-scoped emergency document ID", () => {
  const first = emergencyDocumentId("patient-uid", validRequest.requestId);
  assert.equal(emergencyDocumentId("patient-uid", validRequest.requestId), first);
  assert.notEqual(emergencyDocumentId("another-uid", validRequest.requestId), first);
});

test("parses nested coordinates and calculates finite distance", () => {
  assert.deepEqual(coordinates({ location: { coordinates: { latitude: 19.1, longitude: 74.7 } } }), { latitude: 19.1, longitude: 74.7 });
  assert.ok(distanceKm({ latitude: 19.1, longitude: 74.7 }, { latitude: 19.2, longitude: 74.8 }) > 0);
});
