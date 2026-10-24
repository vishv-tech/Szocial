import type { LocationInfo } from "@/types";

type LocationLike =
  | string
  | LocationInfo
  | {
      location?: LocationLike;
      area?: unknown;
      city?: unknown;
      landmark?: unknown;
      address?: unknown;
      formattedAddress?: unknown;
      latitude?: unknown;
      longitude?: unknown;
    }
  | null
  | undefined;

type Coordinates = {
  latitude: number;
  longitude: number;
};

export function normalizeAreaName(value: unknown) {
  return typeof value === "string"
    ? value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ")
    : "";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function collectLocationParts(value: LocationLike, parts: string[], seen: Set<object>) {
  if (!value) return;
  if (typeof value === "string") {
    if (value.trim()) parts.push(value.trim());
    return;
  }
  if (typeof value !== "object" || seen.has(value)) return;

  seen.add(value);
  if ("location" in value) collectLocationParts(value.location, parts, seen);

  const record = value as Record<string, unknown>;
  for (const key of ["area", "landmark", "city", "address", "formattedAddress"] as const) {
    const part = stringValue(record[key]);
    if (part) parts.push(part);
  }
}

export function getLocationText(value: LocationLike) {
  const parts: string[] = [];
  collectLocationParts(value, parts, new Set());
  return [...new Set(parts)].join(", ");
}

function getAreaName(value: LocationLike): string {
  if (!value) return "";
  if (typeof value === "string") return normalizeAreaName(value);
  if (typeof value !== "object") return "";

  if ("location" in value) {
    const nestedArea = getAreaName(value.location);
    if (nestedArea) return nestedArea;
  }

  return normalizeAreaName(value.area);
}

export function getCoordinates(value: LocationLike): Coordinates | null {
  if (!value || typeof value !== "object") return null;

  const nested = "location" in value ? getCoordinates(value.location) : null;
  if (nested) return nested;

  const latitude = numberValue(value.latitude);
  const longitude = numberValue(value.longitude);
  return latitude !== null && longitude !== null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
}

function includesArea(locationText: string, area: string) {
  const text = ` ${normalizeAreaName(locationText)} `;
  const normalizedArea = normalizeAreaName(area);
  return Boolean(normalizedArea && text.includes(` ${normalizedArea} `));
}

export function haversineDistanceKm(from: Coordinates, to: Coordinates) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(Math.min(1, value)), Math.sqrt(Math.max(0, 1 - value)));
}

export function getNearbyScore(userLocation: LocationLike, itemLocation: LocationLike) {
  const userCoordinates = getCoordinates(userLocation);
  const itemCoordinates = getCoordinates(itemLocation);
  if (userCoordinates && itemCoordinates) {
    return haversineDistanceKm(userCoordinates, itemCoordinates);
  }

  const userText = getLocationText(userLocation);
  const itemText = getLocationText(itemLocation);
  const normalizedUserArea = getAreaName(userLocation) || normalizeAreaName(userText);
  const normalizedItemArea = getAreaName(itemLocation);

  if (!normalizedUserArea || !itemText) return Number.POSITIVE_INFINITY;

  const userCity =
    userLocation && typeof userLocation === "object" && "city" in userLocation
      ? normalizeAreaName(userLocation.city)
      : "";
  const itemCity = itemLocation && typeof itemLocation === "object" && "city" in itemLocation
    ? normalizeAreaName(itemLocation.city) : "";
  if (userCity && itemCity && userCity !== itemCity) return Number.POSITIVE_INFINITY;
  // With no coordinates these are locality tiers, not distances in km.
  if (normalizedItemArea === normalizedUserArea) return 0;
  return userCity && includesArea(itemText, userCity) ? 1 : Number.POSITIVE_INFINITY;
}

export function sortByNearbyRelevance<T>(
  items: T[],
  userLocation: LocationLike,
  getItemLocation: (item: T) => LocationLike
) {
  const userText = getLocationText(userLocation);
  const userCoordinates = getCoordinates(userLocation);
  if (!userText && !userCoordinates) return [...items];

  return items
    .map((item, index) => ({ item, index, location: getItemLocation(item) }))
    .sort((left, right) => {
      if (userCoordinates) {
        const leftHasCoordinates = Boolean(getCoordinates(left.location));
        const rightHasCoordinates = Boolean(getCoordinates(right.location));
        if (leftHasCoordinates !== rightHasCoordinates) return leftHasCoordinates ? -1 : 1;
      }

      const scoreDifference =
        getNearbyScore(userLocation, left.location) -
        getNearbyScore(userLocation, right.location);
      return scoreDifference || left.index - right.index;
    })
    .map(({ item }) => item);
}
