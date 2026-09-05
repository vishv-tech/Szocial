import type { LocationInfo, ResidentUser } from "@/types";

export const RESIDENT_USER_KEY = "szocial_user";
export const RESIDENT_USERS_KEY = "szocial_users";
export const RESIDENT_AUTH_KEY = "szocial_auth";

type LegacyResident = Partial<ResidentUser> & {
  emailOrMobile?: unknown;
  phone?: unknown;
  identifier?: unknown;
  contact?: unknown;
  avatarUrl?: unknown;
  photo?: unknown;
  ownerName?: unknown;
  businessId?: unknown;
  role?: unknown;
  type?: unknown;
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeLoginIdentifier(value: string) {
  const trimmed = value.trim();
  return trimmed.includes("@")
    ? trimmed.toLowerCase()
    : trimmed.replace(/\s+/g, "");
}

export function getResidentLoginIdentifiers(user: unknown) {
  if (!user || typeof user !== "object") return [];
  const record = user as LegacyResident;
  return Array.from(
    new Set(
      [
        record.email,
        record.mobile,
        record.phone,
        record.emailOrMobile,
        record.identifier,
        record.contact
      ]
        .map((value) =>
          typeof value === "string" ? normalizeLoginIdentifier(value) : ""
        )
        .filter(Boolean)
    )
  );
}

function stableLegacyId(identifier: string) {
  let hash = 2166136261;
  for (let index = 0; index < identifier.length; index += 1) {
    hash ^= identifier.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `user-legacy-${(hash >>> 0).toString(16)}`;
}

function normalizeLocation(value: unknown): LocationInfo {
  const location =
    value && typeof value === "object"
      ? (value as Partial<LocationInfo>)
      : {};
  return {
    ...location,
    city: stringValue(location.city),
    area: stringValue(location.area),
    source: location.source ?? "fallback"
  };
}

function normalizeStoredResident(value: unknown): ResidentUser | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as LegacyResident;
  const identifiers = getResidentLoginIdentifiers(record);
  const name = stringValue(record.name);
  const password =
    typeof record.password === "string" ? record.password : "";
  if (
    !name ||
    !password ||
    !identifiers.length ||
    record.ownerName ||
    record.businessId ||
    stringValue(record.role).toLowerCase() === "admin" ||
    stringValue(record.type).toLowerCase() === "admin"
  ) {
    return null;
  }

  const primaryIdentifier = identifiers[0];
  const email =
    stringValue(record.email) ||
    identifiers.find((identifier) => identifier.includes("@")) ||
    primaryIdentifier;
  const mobile =
    stringValue(record.mobile) ||
    stringValue(record.phone) ||
    identifiers.find((identifier) => !identifier.includes("@")) ||
    undefined;
  const privacy =
    record.privacy && typeof record.privacy === "object"
      ? {
          showAge: record.privacy.showAge ?? true,
          showExactArea: record.privacy.showExactArea ?? false,
          allowDirectMessages: record.privacy.allowDirectMessages ?? true
        }
      : {
          showAge: true,
          showExactArea: false,
          allowDirectMessages: true
        };

  return {
    id: stringValue(record.id) || stableLegacyId(primaryIdentifier),
    name,
    email,
    mobile,
    password,
    avatar: stringValue(record.avatar),
    profilePhoto:
      stringValue(record.profilePhoto) ||
      stringValue(record.avatarUrl) ||
      stringValue(record.photo) ||
      undefined,
    profilePhotoName: stringValue(record.profilePhotoName) || undefined,
    updatedAt: stringValue(record.updatedAt) || undefined,
    age: typeof record.age === "number" ? record.age : undefined,
    gender: record.gender,
    location: normalizeLocation(record.location),
    verified: Boolean(record.verified),
    bio: stringValue(record.bio) || "Local resident profile.",
    status: record.status === "Banned" ? "Banned" : "Active",
    joinedDate:
      stringValue(record.joinedDate) || new Date().toISOString().slice(0, 10),
    reports: typeof record.reports === "number" ? record.reports : 0,
    privacy
  };
}

function completeness(user: ResidentUser) {
  return [
    user.name,
    user.email,
    user.mobile,
    user.password,
    user.avatar,
    user.profilePhoto,
    user.profilePhotoName,
    user.bio,
    user.location.area,
    user.location.city,
    user.updatedAt
  ].filter(Boolean).length;
}

function locationCompleteness(location: LocationInfo) {
  return [
    location.area,
    location.city,
    location.landmark,
    location.latitude,
    location.longitude,
    location.formattedAddress
  ].filter((value) => value !== undefined && value !== null && value !== "")
    .length;
}

function timestamp(value?: string) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function sameResident(left: ResidentUser, right: ResidentUser) {
  if (left.id === right.id) return true;
  const rightIdentifiers = new Set(getResidentLoginIdentifiers(right));
  return getResidentLoginIdentifiers(left).some((identifier) =>
    rightIdentifiers.has(identifier)
  );
}

function mergeResident(left: ResidentUser, right: ResidentUser) {
  const rightIsPreferred =
    timestamp(right.updatedAt) > timestamp(left.updatedAt) ||
    (timestamp(right.updatedAt) === timestamp(left.updatedAt) &&
      completeness(right) > completeness(left));
  const preferred = rightIsPreferred ? right : left;
  const fallback = rightIsPreferred ? left : right;

  return {
    ...fallback,
    ...preferred,
    id: left.id,
    email: preferred.email || fallback.email,
    mobile: preferred.mobile || fallback.mobile,
    password: preferred.password || fallback.password,
    avatar: preferred.avatar || fallback.avatar,
    profilePhoto: preferred.profilePhoto || fallback.profilePhoto,
    profilePhotoName:
      preferred.profilePhotoName || fallback.profilePhotoName,
    bio: preferred.bio || fallback.bio,
    location:
      locationCompleteness(preferred.location) >=
      locationCompleteness(fallback.location)
        ? preferred.location
        : fallback.location,
    privacy: {
      ...fallback.privacy,
      ...preferred.privacy
    }
  };
}

export function deduplicateResidentUsers(values: unknown[]) {
  return values.reduce<ResidentUser[]>((users, value) => {
    const user = normalizeStoredResident(value);
    if (!user) return users;
    const duplicateIndex = users.findIndex((existing) =>
      sameResident(existing, user)
    );
    if (duplicateIndex < 0) return [...users, user];
    return users.map((existing, index) =>
      index === duplicateIndex ? mergeResident(existing, user) : existing
    );
  }, []);
}

function readJson(key: string) {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function saveResidentUsers(users: ResidentUser[]) {
  const normalized = deduplicateResidentUsers(users);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      RESIDENT_USERS_KEY,
      JSON.stringify(normalized)
    );
  }
  return normalized;
}

export function loadActiveResident() {
  return normalizeStoredResident(readJson(RESIDENT_USER_KEY));
}

export function loadResidentUsers() {
  if (typeof window === "undefined") return [];
  const storedRegistry = readJson(RESIDENT_USERS_KEY);
  const registry = Array.isArray(storedRegistry) ? storedRegistry : [];
  const activeUser = loadActiveResident();
  const users = deduplicateResidentUsers([
    ...registry,
    ...(activeUser ? [activeUser] : [])
  ]);

  if (users.length) saveResidentUsers(users);
  return users;
}

export function upsertResidentUser(user: ResidentUser) {
  const normalized = normalizeStoredResident(user);
  if (!normalized) return loadResidentUsers();
  const users = loadResidentUsers();
  const duplicateIndex = users.findIndex((existing) =>
    sameResident(existing, normalized)
  );
  const updated =
    duplicateIndex < 0
      ? [...users, normalized]
      : users.map((existing, index) =>
          index === duplicateIndex
            ? mergeResident(existing, normalized)
            : existing
        );
  return saveResidentUsers(updated);
}

export function registerResidentUser(
  user: ResidentUser,
  fallbackUsers: ResidentUser[] = []
) {
  const normalized = normalizeStoredResident(user);
  if (!normalized) return false;
  const existingUsers = deduplicateResidentUsers([
    ...loadResidentUsers(),
    ...fallbackUsers
  ]);
  if (existingUsers.some((existing) => sameResident(existing, normalized))) {
    return false;
  }

  saveResidentUsers([...loadResidentUsers(), normalized]);
  return setActiveResident(normalized);
}

export function findResidentByCredentials(
  identifier: string,
  password: string,
  fallbackUsers: ResidentUser[] = []
) {
  const normalizedIdentifier = normalizeLoginIdentifier(identifier);
  if (!normalizedIdentifier) return null;
  const users = deduplicateResidentUsers([
    ...loadResidentUsers(),
    ...fallbackUsers
  ]);
  return (
    users.find(
      (user) =>
        getResidentLoginIdentifiers(user).includes(normalizedIdentifier) &&
        user.password === password
    ) ?? null
  );
}

export function setActiveResident(user: ResidentUser) {
  const normalized = normalizeStoredResident(user);
  if (!normalized || typeof window === "undefined") return false;
  upsertResidentUser(normalized);
  window.localStorage.setItem(
    RESIDENT_USER_KEY,
    JSON.stringify(normalized)
  );
  window.localStorage.setItem(RESIDENT_AUTH_KEY, "true");
  return true;
}
