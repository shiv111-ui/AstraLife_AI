import express from "express";
import cors from "cors";
import {
  initializeAndSeed, query, queryOne, execute, insert,
} from "./db.js";
import {
  analyzeSeverity, selectAmbulance, selectHospital,
  greenCorridor, predictivePlacement,
} from "./engine.js";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({
  success: true,
  message: "ASTRALIFE AI backend is running",
  timestamp: new Date().toISOString(),
}));

app.get("/api/dashboard", (req, res) => {
  try {
    const ambulances = query(`SELECT COUNT(*) total,
      SUM(CASE WHEN status='AVAILABLE' THEN 1 ELSE 0 END) available,
      SUM(CASE WHEN status='BUSY' THEN 1 ELSE 0 END) busy FROM ambulances`)[0];
    const hospitals = query(`SELECT COUNT(*) total, COALESCE(SUM(emergency_beds),0) emergency_beds
      FROM hospitals WHERE status='OPEN'`)[0];
    const emergencies = query(`SELECT COUNT(*) total,
      SUM(CASE WHEN status IN ('NEW','DISPATCHED','IN_TRANSIT') THEN 1 ELSE 0 END) active
      FROM emergencies`)[0];

    res.json({ success: true, data: { ambulances, hospitals, emergencies } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/ambulances", (req, res) => {
  try { res.json({ success: true, data: query("SELECT * FROM ambulances ORDER BY id DESC") }); }
  catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.get("/api/hospitals", (req, res) => {
  try { res.json({ success: true, data: query("SELECT * FROM hospitals ORDER BY id DESC") }); }
  catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.get("/api/emergencies", (req, res) => {
  try {
    const rows = query(`SELECT e.*, a.code ambulance_code, h.name hospital_name
      FROM emergencies e
      LEFT JOIN ambulances a ON a.id=e.ambulance_id
      LEFT JOIN hospitals h ON h.id=e.hospital_id
      ORDER BY e.id DESC`);
    res.json({ success: true, data: rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post("/api/emergencies", (req, res) => {
  try {
    const { patient_name, age, gender, phone, symptoms, emergency_type, latitude, longitude } = req.body;
    if (!patient_name || !symptoms || !emergency_type || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: "patient_name, symptoms, emergency_type, latitude and longitude are required" });
    }

    const analysis = analyzeSeverity({ symptoms, emergencyType: emergency_type, age });
    const id = insert(`INSERT INTO emergencies
      (patient_name,age,gender,phone,symptoms,emergency_type,severity,priority,latitude,longitude,status,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [
      patient_name, age || null, gender || null, phone || null, symptoms, emergency_type,
      analysis.severity, analysis.priority, Number(latitude), Number(longitude), "NEW", new Date().toISOString(),
    ]);

    res.status(201).json({ success: true, message: "Emergency created successfully", data: queryOne("SELECT * FROM emergencies WHERE id=?", [id]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete a patient emergency record. If an ambulance was assigned, release it.
app.delete("/api/emergencies/:id", (req, res) => {
  try {
    const emergencyId = Number(req.params.id);
    if (!Number.isInteger(emergencyId) || emergencyId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid emergency ID" });
    }

    const emergency = queryOne(
      "SELECT * FROM emergencies WHERE id = ?",
      [emergencyId]
    );
    if (!emergency) {
      return res.status(404).json({ success: false, message: "Patient emergency not found" });
    }

    // Do not leave an ambulance marked BUSY after its assigned emergency is removed.
    if (emergency.ambulance_id) {
      execute(
        "UPDATE ambulances SET status = 'AVAILABLE', last_updated = ? WHERE id = ?",
        [new Date().toISOString(), emergency.ambulance_id]
      );
    }

    execute("DELETE FROM emergencies WHERE id = ?", [emergencyId]);

    res.json({
      success: true,
      message: "Patient emergency deleted successfully",
      data: { id: emergencyId }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/dispatch/:id", (req, res) => {
  try {
    const emergencyId = Number(req.params.id);
    const emergency = queryOne("SELECT * FROM emergencies WHERE id=?", [emergencyId]);
    if (!emergency) return res.status(404).json({ success: false, message: "Emergency not found" });

    const ambulance = selectAmbulance(query("SELECT * FROM ambulances WHERE status='AVAILABLE'"), emergency.latitude, emergency.longitude);
    if (!ambulance) return res.status(409).json({ success: false, message: "No available ambulance" });

    const hospital = selectHospital(query("SELECT * FROM hospitals WHERE status='OPEN' AND emergency_beds>0"), emergency.emergency_type, emergency.latitude, emergency.longitude);
    if (!hospital) return res.status(409).json({ success: false, message: "No suitable hospital available" });

    const now = new Date().toISOString();
    execute("UPDATE ambulances SET status='BUSY', last_updated=? WHERE id=?", [now, ambulance.id]);
    execute("UPDATE emergencies SET ambulance_id=?, hospital_id=?, status='DISPATCHED', dispatched_at=? WHERE id=?", [ambulance.id, hospital.id, now, emergencyId]);

    res.json({ success: true, message: "Ambulance dispatched successfully", data: {
      emergency: queryOne("SELECT * FROM emergencies WHERE id=?", [emergencyId]), ambulance, hospital,
    }});
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.get("/api/green-corridor/:emergencyId", (req, res) => {
  try {
    const emergency = queryOne("SELECT * FROM emergencies WHERE id=?", [Number(req.params.emergencyId)]);
    if (!emergency) return res.status(404).json({ success: false, message: "Emergency not found" });
    const signals = query("SELECT * FROM signals ORDER BY sequence_no ASC");
    const corridor = greenCorridor(signals);
    const route = [[Number(emergency.latitude), Number(emergency.longitude)], ...corridor.map(s => [s.latitude, s.longitude])];
    res.json({ success: true, data: { emergencyId: emergency.id, route, signals: corridor } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.get("/api/predictive-placement", (req, res) => {
  try { res.json({ success: true, data: predictivePlacement(query("SELECT * FROM demand_history ORDER BY id DESC")) }); }
  catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.use((req, res) => res.status(404).json({ success: false, message: "API endpoint not found" }));

async function startServer() {
  await initializeAndSeed();
  app.listen(PORT, () => {
    console.log(`ASTRALIFE AI backend: http://localhost:${PORT}`);
  });
}

startServer().catch(error => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
