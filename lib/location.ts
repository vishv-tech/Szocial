import type { LocationInfo } from "@/types";

export const LOCATION_STORAGE_KEY = "szocial_location";
export const LOCATION_FALLBACK_LABEL = "Select your location";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type NominatimAddress = {
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
};

type NominatimResponse = {
  display_name?: string;
  address?: NominatimAddress;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanCoordinate(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hasUsableLocation(location: LocationInfo) {
  return Boolean(
    location.area ||
      location.city ||
      location.formattedAddress ||
      (location.latitude !== null && location.longitude !== null)
  );
}

export function createEmptyLocation(): LocationInfo {
  return {
    latitude: null,
    longitude: null,
    area: "",
    city: "",
    source: "fallback",
    updatedAt: ""
  };
}

export function normalizeUserLocation(
  value: unknown,
  defaultSource: LocationInfo["source"] = "manual"
): LocationInfo | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const input = value as Record<string, unknown>;
  const source =
    input.source === "gps" || input.source === "manual" || input.source === "fallback"
      ? input.source
      : defaultSource;
  const lat = cleanCoordinate(input.latitude ?? input.lat);
  const lng = cleanCoordinate(input.longitude ?? input.lng);
  const validPair = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const latitude = validPair ? lat : null;
  const longitude = validPair ? lng : null;
  const location: LocationInfo = {
    latitude,
    longitude,
    area: cleanString(input.area),
    city: cleanString(input.city),
    state: cleanString(input.state) || undefined,
    country: cleanString(input.country) || undefined,
    formattedAddress: cleanString(input.formattedAddress) || undefined,
    landmark: cleanString(input.landmark) || undefined,
    source,
    updatedAt: cleanString(input.updatedAt) || new Date().toISOString()
  };

  return hasUsableLocation(location) ? location : null;
}

export function createManualLocation(location: Partial<LocationInfo>): LocationInfo | null {
  return normalizeUserLocation(
    {
      ...location,
      latitude: null,
      longitude: null,
      source: "manual",
      updatedAt: new Date().toISOString()
    },
    "manual"
  );
}

export function getCurrentLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        const messages: Record<number, string> = {
          1: "Location permission was denied.",
          2: "Your location could not be determined.",
          3: "Location detection timed out."
        };
        reject(new Error(messages[error.code] ?? "Location detection failed."));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000
      }
    );
  });
}

export async function reverseGeocodeLocation(
  latitude: number,
  longitude: number
): Promise<LocationInfo> {
  const coordinatesOnly: LocationInfo = {
    latitude,
    longitude,
    area: "",
    city: "",
    source: "gps",
    updatedAt: new Date().toISOString()
  };

  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(latitude),
      lon: String(longitude),
      addressdetails: "1",
      zoom: "18"
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en"
      }
    });
    if (!response.ok) return coordinatesOnly;

    const data = (await response.json()) as NominatimResponse;
    const address = data.address ?? {};
    const area =
      address.neighbourhood ||
      address.suburb ||
      address.quarter ||
      address.city_district ||
      "";
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      "";

    return {
      ...coordinatesOnly,
      area,
      city,
      state: address.state,
      country: address.country,
      formattedAddress: data.display_name
    };
  } catch {
    return coordinatesOnly;
  }
}

// Signup location lives in memory until the verified profile is saved to Supabase.
let pendingLocation: LocationInfo | null = null;
export function saveUserLocation(location: LocationInfo): LocationInfo | null {
  pendingLocation = normalizeUserLocation(location, location.source ?? 'manual');
  if (typeof window !== 'undefined') window.localStorage.removeItem(LOCATION_STORAGE_KEY);
  return pendingLocation;
}
export function loadUserLocation(): LocationInfo | null {
  if (typeof window !== 'undefined') window.localStorage.removeItem(LOCATION_STORAGE_KEY);
  return pendingLocation;
}
export function clearUserLocation() {
  pendingLocation = null;
  if (typeof window !== 'undefined') window.localStorage.removeItem(LOCATION_STORAGE_KEY);
}

export function formatUserLocation(
  location: LocationInfo | null | undefined,
  fallback = LOCATION_FALLBACK_LABEL
) {
  if (!location) return fallback;

  const area = cleanString(location.area);
  const city = cleanString(location.city);
  if (area && city && area.toLowerCase() !== city.toLowerCase()) return `${area}, ${city}`;
  if (area || city) return area || city;
  if (location.formattedAddress) return location.formattedAddress;
  if (location.latitude != null && location.longitude != null) return "Location detected";
  return fallback;
}

export function getLocationName(location: LocationInfo | null | undefined) {
  return cleanString(location?.area) || cleanString(location?.city);
}
