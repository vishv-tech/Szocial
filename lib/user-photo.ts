import type { ResidentUser } from "@/types";

type UserPhotoSource = Partial<
  Pick<ResidentUser, "name" | "profilePhoto" | "avatar">
> & {
  avatarUrl?: unknown;
  photo?: unknown;
};

function photoValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function createInitialsAvatar(name?: string) {
  const initials =
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("")
      .replace(/[^A-Z0-9]/g, "") || "S";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="36" fill="#0f766e"/><text x="80" y="94" text-anchor="middle" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#ffffff">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function getUserDisplayPhoto(user: UserPhotoSource | null | undefined) {
  if (!user) return createInitialsAvatar();

  return (
    photoValue(user.profilePhoto) ||
    photoValue(user.avatarUrl) ||
    photoValue(user.photo) ||
    photoValue(user.avatar) ||
    createInitialsAvatar(user.name)
  );
}

export function normalizeResidentPhoto(user: ResidentUser): ResidentUser {
  const legacyUser = user as ResidentUser & {
    avatarUrl?: unknown;
    photo?: unknown;
  };
  const profilePhoto =
    photoValue(user.profilePhoto) ||
    photoValue(legacyUser.avatarUrl) ||
    photoValue(legacyUser.photo) ||
    undefined;

  return {
    ...user,
    profilePhoto,
    avatar: photoValue(user.avatar) || createInitialsAvatar(user.name)
  };
}
