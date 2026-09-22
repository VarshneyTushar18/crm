export const buildMapsLink = (assignment, site) => {
  if (assignment?.mapsUrl) return assignment.mapsUrl;
  const location = assignment?.location || site;
  if (!location) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
};
