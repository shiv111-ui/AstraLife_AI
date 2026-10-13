const criticalWords = [
  "cardiac arrest", "chest pain", "stroke", "unconscious", "severe bleeding",
  "not breathing", "breathlessness", "accident", "trauma", "seizure"
];

export function analyzeSeverity({ symptoms = "", emergencyType = "", age = 0 }) {
  const text = `${symptoms} ${emergencyType}`.toLowerCase();
  let score = 20;

  for (const word of criticalWords) {
    if (text.includes(word)) score += 12;
  }

  if (Number(age) >= 65) score += 8;
  if (Number(age) > 0 && Number(age) < 5) score += 8;
  if (text.includes("mild")) score -= 10;

  score = Math.max(0, Math.min(100, score));

  let severity = "LOW";
  if (score >= 75) severity = "CRITICAL";
  else if (score >= 55) severity = "HIGH";
  else if (score >= 35) severity = "MEDIUM";

  return {
    severity,
    score,
    priority: severity,
  };
}

export function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function selectAmbulance(ambulances, lat, lon) {
  const available = ambulances.filter(a => a.status === "AVAILABLE");
  if (!available.length) return null;

  return available
    .map(a => ({ ...a, distance: distanceKm(lat, lon, a.latitude, a.longitude) }))
    .sort((a, b) => a.distance - b.distance)[0];
}

export function selectHospital(hospitals, emergencyType, lat, lon) {
  const open = hospitals.filter(h => h.status === "OPEN" && Number(h.emergency_beds) > 0);
  const type = typeof emergencyType === "string" ? emergencyType : "";

  const scored = open.map(h => {
    const d = distanceKm(lat, lon, h.latitude, h.longitude);
    const specialty = (h.specialties || "").toLowerCase().includes(type.toLowerCase()) ? 0.6 : 1;
    return { ...h, distance: d, routingScore: d * specialty };
  });

  return scored.sort((a, b) => a.routingScore - b.routingScore)[0] || null;
}

export function greenCorridor(signals) {
  return signals
    .sort((a, b) => Number(a.sequence_no) - Number(b.sequence_no))
    .map(s => ({
      id: s.id,
      name: s.name,
      latitude: Number(s.latitude),
      longitude: Number(s.longitude),
      action: "PRIORITY_GREEN",
      estimatedDelaySeconds: Number(s.priority_seconds || 30),
    }));
}

export function predictivePlacement(rows) {
  return rows.map(r => {
    const risk = Math.round(
      Number(r.emergency_count) * 2 +
      Number(r.traffic_index) * 0.45 +
      Number(r.weather_index) * 0.25 +
      Number(r.event_index) * 0.35
    );
    return { ...r, riskScore: Math.min(100, risk) };
  }).sort((a, b) => b.riskScore - a.riskScore);
}
