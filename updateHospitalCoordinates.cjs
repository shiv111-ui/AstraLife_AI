const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");

const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore(app);

// Ahilyanagar city center
const CENTER_LAT = 19.0946;
const CENTER_LNG = 74.7384;

function seededRandom(seed) {
  let value = seed;
  return function () {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

// Generate stable demo coordinates around Ahilyanagar.
function generateDemoLocation(index) {
  const random = seededRandom(index + 2026);

  let minDistance;
  let maxDistance;
  let zone;

  if (index < 25) {
    minDistance = 0.3;
    maxDistance = 1.8;
    zone = "City Center";
  } else if (index < 40) {
    minDistance = 1.8;
    maxDistance = 3.5;
    zone = "Residential Area";
  } else {
    minDistance = 3.5;
    maxDistance = 5.0;
    zone = "Outskirts";
  }

  const angle = random() * 2 * Math.PI;
  const distance = minDistance + random() * (maxDistance - minDistance);

  // Convert kilometers into approximate latitude/longitude offsets.
  const latitude =
    CENTER_LAT + (distance * Math.cos(angle)) / 111;

  const longitude =
    CENTER_LNG +
    (distance * Math.sin(angle)) /
      (111 * Math.cos((CENTER_LAT * Math.PI) / 180));

  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    isDemo: true,
    zone,
  };
}

async function main() {
  const snapshot = await db.collection("Hospitals").get();

  if (snapshot.empty) {
    console.log("No hospital records found.");
    return;
  }

  console.log(`Found ${snapshot.size} hospital records.`);

  const batch = db.batch();
  let updated = 0;
  let skipped = 0;

  snapshot.docs.forEach((doc, index) => {
    const hospital = doc.data();
    const location = hospital.location;

    // Preserve existing valid coordinates.
    if (
      location &&
      Number.isFinite(Number(location.latitude)) &&
      Number.isFinite(Number(location.longitude))
    ) {
      skipped++;
      console.log(`Skipped existing coordinates: ${doc.id}`);
      return;
    }

    const demoLocation = generateDemoLocation(index);

    // Update only location-related fields; preserve all other data.
    batch.update(doc.ref, {
      location: demoLocation,
      locationSource: "DEMO_GENERATED",
      isDemoLocation: true,
    });

    updated++;

    console.log(
      `${doc.id} | ${hospital.name || "Hospital"} | ` +
        `${demoLocation.latitude}, ${demoLocation.longitude} | ` +
        `${demoLocation.zone}`
    );
  });

  if (updated > 0) {
    await batch.commit();
  }

  console.log("\n========== COMPLETE ==========");
  console.log(`Total hospitals: ${snapshot.size}`);
  console.log(`Updated with demo coordinates: ${updated}`);
  console.log(`Skipped existing coordinates: ${skipped}`);
  console.log("Firestore update completed.");
  console.log("All generated coordinates are marked as DEMO.");
}

main()
  .catch((error) => {
    console.error("Failed to update hospital coordinates:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await app.delete();
  });