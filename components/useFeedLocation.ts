"use client";

import { useEffect } from "react";
import { useAppStore } from "@/components/AppStoreProvider";
import { getCurrentLocation, reverseGeocodeLocation } from "@/lib/location";

// Refresh once per discovery-page visit. Do not prompt or track in the background.
export function useFeedLocation() {
  const { hydrated, setLocation } = useAppStore();
  useEffect(() => {
    if (!hydrated || !navigator.permissions || !navigator.geolocation) return;
    let cancelled = false;
    void (async () => {
      try {
        const permission = await navigator.permissions.query({ name: "geolocation" });
        if (permission.state !== "granted" || cancelled) return;
        const coordinates = await getCurrentLocation();
        const location = await reverseGeocodeLocation(coordinates.latitude, coordinates.longitude);
        if (!cancelled) setLocation(location);
      } catch {
        // Keep the saved/manual location when GPS is unavailable or denied.
      }
    })();
    return () => { cancelled = true; };
  }, [hydrated, setLocation]);
}
