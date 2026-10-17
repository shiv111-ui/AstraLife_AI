ASTRALIFE AI — FILES MATCHED TO YOUR UPLOADED PROJECT

1. Replace src/pages/AmbulanceDashboard.jsx with the supplied AmbulanceDashboard.jsx.
2. Replace src/pages/HospitalDashboard.jsx with the supplied HospitalDashboard.jsx.
3. Firebase Console > Firestore Database > Rules: back up existing rules, then review/paste firestore.rules and Publish.
4. Confirm Staff/{Firebase Auth UID} has role='ambulance' or 'hospital', active=true, and matching ambulanceId/hospitalId. IDs must match the corresponding document IDs.
5. Emergency_Cases records and queries use ambulanceId and hospitalId.

The dashboard files are copied from your uploaded project, preserving design. The rules are aligned to the current collection names and query fields. Live Firebase data/rules were not available to run end-to-end tests.

Important: current patient SOS creates a case without createdByUid. Rules allow only the specific GPS SOS create shape but do not grant public read/update access. If the patient page must read back the SOS while unauthenticated, implement a secure ownership mechanism rather than allowing public reads of all emergency cases. Test all four account roles before relying on these rules.
