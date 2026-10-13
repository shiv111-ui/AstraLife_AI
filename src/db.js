
import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "..", "astralife.db");

let database = null;

/* =========================
   INITIALIZE DATABASE
========================= */

export async function initializeDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) =>
      path.join(
        __dirname,
        "..",
        "node_modules",
        "sql.js",
        "dist",
        file
      ),
  });

  if (fs.existsSync(dbPath)) {
    const file = fs.readFileSync(dbPath);
    database = new SQL.Database(file);
  } else {
    database = new SQL.Database();
  }

  /* =========================
     AMBULANCES
  ========================= */

  database.run(`
    CREATE TABLE IF NOT EXISTS ambulances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      driver TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      equipment TEXT NOT NULL,
      last_updated TEXT NOT NULL
    );
  `);

  /* =========================
     HOSPITALS
  ========================= */

  database.run(`
    CREATE TABLE IF NOT EXISTS hospitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      emergency_beds INTEGER DEFAULT 0,
      icu_beds INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'OPEN',
      specialties TEXT NOT NULL
    );
  `);

  /* =========================
     SIGNALS
  ========================= */

  database.run(`
    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'NORMAL',
      sequence_no INTEGER NOT NULL DEFAULT 0,
      priority_seconds INTEGER NOT NULL DEFAULT 30
    );
  `);

  /* =========================
     EMERGENCIES
  ========================= */

  database.run(`
    CREATE TABLE IF NOT EXISTS emergencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_name TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      phone TEXT,
      symptoms TEXT NOT NULL,
      emergency_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      priority TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      ambulance_id INTEGER,
      hospital_id INTEGER,
      status TEXT NOT NULL DEFAULT 'NEW',
      created_at TEXT NOT NULL,
      dispatched_at TEXT,
      completed_at TEXT
    );
  `);

  /* =========================
     DEMAND HISTORY
  ========================= */

  database.run(`
    CREATE TABLE IF NOT EXISTS demand_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      zone TEXT NOT NULL,
      emergency_count INTEGER NOT NULL,
      traffic_index REAL NOT NULL,
      weather_index REAL NOT NULL,
      event_index REAL NOT NULL,
      recorded_at TEXT NOT NULL
    );
  `);

  saveDatabase();

  return database;
}

/* =========================
   SAVE DATABASE
========================= */

export function saveDatabase() {
  if (!database) {
    return;
  }

  const data = database.export();

  fs.writeFileSync(
    dbPath,
    Buffer.from(data)
  );
}

/* =========================
   QUERY
========================= */

export function query(sql, params = []) {
  if (!database) {
    throw new Error("Database is not initialized");
  }

  const statement = database.prepare(sql);

  statement.bind(params);

  const rows = [];

  while (statement.step()) {
    rows.push(statement.getAsObject());
  }

  statement.free();

  return rows;
}

/* =========================
   QUERY ONE
========================= */

export function queryOne(sql, params = []) {
  const rows = query(sql, params);

  return rows.length > 0 ? rows[0] : null;
}

/* =========================
   EXECUTE
========================= */

export function execute(sql, params = []) {
  if (!database) {
    throw new Error("Database is not initialized");
  }

  database.run(sql, params);

  saveDatabase();
}

/* =========================
   INSERT
========================= */

export function insert(sql, params = []) {
  if (!database) {
    throw new Error("Database is not initialized");
  }

  database.run(sql, params);

  const result = queryOne(
    "SELECT last_insert_rowid() AS id"
  );

  saveDatabase();

  return result.id;
}

/* =========================
   SEED DATABASE
========================= */

export function seedIfEmpty() {
  if (!database) {
    throw new Error("Database is not initialized");
  }

  const ambulanceCount = queryOne(
    "SELECT COUNT(*) AS count FROM ambulances"
  );

  if (Number(ambulanceCount.count) === 0) {
    const now = new Date().toISOString();

    database.run(
      `
      INSERT INTO ambulances
      (code, driver, status, latitude, longitude, equipment, last_updated)
      VALUES
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        "AMB-101",
        "Raj Patil",
        "AVAILABLE",
        19.8762,
        75.3433,
        "ICU, Oxygen, ECG",
        now,

        "AMB-102",
        "Amit Shinde",
        "AVAILABLE",
        19.8891,
        75.3256,
        "Oxygen, First Aid",
        now,

        "AMB-103",
        "Neha More",
        "BUSY",
        19.8605,
        75.3521,
        "ICU, Ventilator, Oxygen",
        now,

        "AMB-104",
        "Vikas Pawar",
        "AVAILABLE",
        19.9012,
        75.3187,
        "Oxygen, ECG, First Aid",
        now,
      ]
    );
  }

  /* =========================
     HOSPITAL SEED DATA
  ========================= */

  const hospitalCount = queryOne(
    "SELECT COUNT(*) AS count FROM hospitals"
  );

  if (Number(hospitalCount.count) === 0) {
    database.run(
      `
      INSERT INTO hospitals
      (
        name,
        address,
        latitude,
        longitude,
        emergency_beds,
        icu_beds,
        status,
        specialties
      )
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        "CityCare Emergency Hospital",
        "Station Road, Aurangabad",
        19.8762,
        75.3433,
        18,
        8,
        "OPEN",
        "Trauma, Cardiology, Neurology",

        "Nextron Medical Center",
        "CIDCO, Aurangabad",
        19.9123,
        75.3451,
        12,
        6,
        "OPEN",
        "Trauma, Orthopedics, General",

        "Central General Hospital",
        "Central Aurangabad",
        19.8797,
        75.3394,
        10,
        4,
        "OPEN",
        "General, Emergency, Pediatrics",
      ]
    );
  }

  /* =========================
     SIGNAL SEED DATA
  ========================= */

  const signalCount = queryOne(
    "SELECT COUNT(*) AS count FROM signals"
  );

  if (Number(signalCount.count) === 0) {
    database.run(
      `
      INSERT INTO signals
      (name, latitude, longitude, status, sequence_no, priority_seconds)
      VALUES
      (?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?)
      `,
      [
        "Signal-A",
        19.8791,
        75.3391,
        "NORMAL", 1, 45,

        "Signal-B",
        19.8852,
        75.3421,
        "NORMAL", 2, 45,

        "Signal-C",
        19.8921,
        75.3472,
        "NORMAL", 3, 45,

        "Signal-D",
        19.8992,
        75.3511,
        "NORMAL", 4, 45,
      ]
    );
  }

  /* =========================
     DEMAND HISTORY
  ========================= */

  const historyCount = queryOne(
    "SELECT COUNT(*) AS count FROM demand_history"
  );

  if (Number(historyCount.count) === 0) {
    const now = new Date().toISOString();

    database.run(
      `
      INSERT INTO demand_history
      (
        zone,
        emergency_count,
        traffic_index,
        weather_index,
        event_index,
        recorded_at
      )
      VALUES
      (?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?)
      `,
      [
        "Zone A",
        18,
        0.78,
        0.30,
        0.20,
        now,

        "Zone B",
        11,
        0.55,
        0.20,
        0.40,
        now,

        "Zone C",
        7,
        0.35,
        0.15,
        0.10,
        now,
      ]
    );
  }

  saveDatabase();

  console.log("Database seed completed.");
}

/* =========================
   INITIALIZE + SEED
========================= */

export async function initializeAndSeed() {
  await initializeDatabase();

  seedIfEmpty();

  return database;
}

