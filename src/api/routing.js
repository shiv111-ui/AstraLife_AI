const ROUTING_API =
  "https://router.project-osrm.org/route/v1/driving";

/**
 * Validate a latitude/longitude pair.
 */
function isValidCoordinate(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Calculate the driving route between two locations.
 *
 * Parameters:
 *   startLatitude  - Ambulance latitude
 *   startLongitude - Ambulance longitude
 *   endLatitude    - Patient latitude
 *   endLongitude   - Patient longitude
 *
 * Returns:
 *   {
 *     distanceKm,
 *     durationMinutes,
 *     coordinates
 *   }
 */
export async function getRoute(
  startLatitude,
  startLongitude,
  endLatitude,
  endLongitude
) {
  const startLat = Number(startLatitude);
  const startLng = Number(startLongitude);
  const endLat = Number(endLatitude);
  const endLng = Number(endLongitude);

  // Validate both locations.
  if (!isValidCoordinate(startLat, startLng)) {
    throw new Error("Invalid ambulance GPS coordinates.");
  }

  if (!isValidCoordinate(endLat, endLng)) {
    throw new Error("Invalid patient GPS coordinates.");
  }

  // OSRM expects longitude first, then latitude.
  const coordinates = [
    `${startLng},${startLat}`,
    `${endLng},${endLat}`,
  ].join(";");

  const url =
    `${ROUTING_API}/${coordinates}` +
    "?overview=full&geometries=geojson&steps=false";

  const controller = new AbortController();

  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Routing service returned HTTP ${response.status}.`
      );
    }

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes?.length) {
      throw new Error(
        data.message || "No driving route was found."
      );
    }

    const route = data.routes[0];

    if (
      !Number.isFinite(route.distance) ||
      !Number.isFinite(route.duration) ||
      !Array.isArray(route.geometry?.coordinates)
    ) {
      throw new Error(
        "The routing service returned invalid route data."
      );
    }

    // GeoJSON coordinates are [longitude, latitude].
    // Leaflet requires [latitude, longitude].
    const routeCoordinates = route.geometry.coordinates
      .filter(
        (coordinate) =>
          Array.isArray(coordinate) &&
          coordinate.length >= 2 &&
          Number.isFinite(coordinate[0]) &&
          Number.isFinite(coordinate[1])
      )
      .map(([longitude, latitude]) => [
        latitude,
        longitude,
      ]);

    if (routeCoordinates.length < 2) {
      throw new Error(
        "The routing service did not return enough route points."
      );
    }

    return {
      distanceKm: Number(
        (route.distance / 1000).toFixed(2)
      ),

      durationMinutes: Math.ceil(
        route.duration / 60
      ),

      coordinates: routeCoordinates,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "Route calculation timed out. Please try again."
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        "Unable to connect to the routing service. Check your internet connection."
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}