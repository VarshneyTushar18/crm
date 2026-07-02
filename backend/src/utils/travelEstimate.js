const DEFAULT_TRAVEL_MINUTES = 30;
const AVERAGE_SPEED_KMH = 40;

const toRad = (deg) => (deg * Math.PI) / 180;

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const travelMinutesFromCoords = (from, to) => {
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return DEFAULT_TRAVEL_MINUTES;
  const km = haversineKm(Number(from.lat), Number(from.lng), Number(to.lat), Number(to.lng));
  if (km < 0.5) return 0;
  return Math.max(5, Math.round((km / AVERAGE_SPEED_KMH) * 60));
};

const buildMapsUrl = (location = "", lat = null, lng = null) => {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  if (location) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  }
  return "";
};

const calcEta = (startTime, travelMinutes = 0) => {
  if (!startTime) return null;
  const eta = new Date(startTime);
  eta.setMinutes(eta.getMinutes() + Number(travelMinutes || 0));
  return eta;
};

module.exports = {
  DEFAULT_TRAVEL_MINUTES,
  travelMinutesFromCoords,
  buildMapsUrl,
  calcEta,
};
