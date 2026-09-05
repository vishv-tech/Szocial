"use client";

import { useEffect, useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { useAppStore } from "@/components/AppStoreProvider";
import { useToast } from "@/components/ToastProvider";
import {
  createManualLocation,
  getCurrentLocation,
  reverseGeocodeLocation
} from "@/lib/location";
import type { LocationInfo } from "@/types";

type LocationModalProps = {
  open: boolean;
  onClose: () => void;
};

export function LocationModal({ open, onClose }: LocationModalProps) {
  const { state, setLocation } = useAppStore();
  const { notify } = useToast();
  const [manual, setManual] = useState(false);
  const [location, setLocalLocation] = useState<LocationInfo>(state.location);

  useEffect(() => {
    if (open) {
      setLocalLocation(state.location);
      setManual(false);
    }
  }, [open, state.location]);

  const detectLocation = async () => {
    try {
      const coordinates = await getCurrentLocation();
      const detected = await reverseGeocodeLocation(
        coordinates.latitude,
        coordinates.longitude
      );
      setLocalLocation(detected);
      setLocation(detected);
      onClose();
    } catch (error) {
      setManual(true);
      notify({
        title: "Location could not be detected",
        description:
          error instanceof Error
            ? `${error.message} Enter your locality manually.`
            : "Enter your locality manually.",
        variant: "warning"
      });
    }
  };

  return (
    <Modal
      description="Szocial only shows your general area publicly, never your exact live location."
      onClose={onClose}
      open={open}
      title="Change location"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Button onClick={detectLocation} variant="secondary">
          <LocateFixed className="h-4 w-4" />
          Allow Location
        </Button>
        <Button onClick={() => setManual(true)} variant="outline">
          <MapPin className="h-4 w-4" />
          Enter manually
        </Button>
      </div>
      {manual ? (
        <div className="mt-5 space-y-3">
          {(["city", "area", "landmark"] as const).map((field) => (
            <label className="block" key={field}>
              <span className="text-sm font-semibold capitalize text-szocial-ink">
                {field}
              </span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-szocial-teal"
                onChange={(event) =>
                  setLocalLocation((current) => ({
                    ...current,
                    [field]: event.target.value
                  }))
                }
                placeholder={field === "landmark" ? "Near a known place" : field}
                value={location[field] ?? ""}
              />
            </label>
          ))}
          <Button
            className="w-full"
            onClick={() => {
              const manualLocation = createManualLocation(location);
              if (!manualLocation) {
                notify({
                  title: "Location not set",
                  description: "Enter at least an area or city.",
                  variant: "warning"
                });
                return;
              }
              setLocation(manualLocation);
              onClose();
            }}
          >
            Save location
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}
