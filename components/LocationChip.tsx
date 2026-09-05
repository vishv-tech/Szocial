import { MapPin } from "lucide-react";

type LocationChipProps = {
  location: string;
  onClick?: () => void;
};

export function LocationChip({ location, onClick }: LocationChipProps) {
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      className="inline-flex items-center gap-2 rounded-full bg-szocial-tealSoft px-4 py-2 text-sm font-semibold text-szocial-teal transition hover:bg-teal-100"
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      <MapPin className="h-4 w-4" />
      {location}
    </Comp>
  );
}
