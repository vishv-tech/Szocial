"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { initialAppState } from "@/lib/mock-data";
import {
  createEmptyLocation,
  formatUserLocation,
  loadUserLocation,
  normalizeUserLocation,
  saveUserLocation
} from "@/lib/location";
import {
  createInitialsAvatar,
  getUserDisplayPhoto,
  normalizeResidentPhoto
} from "@/lib/user-photo";
import {
  createNotification,
  loadNotifications,
  markAllNotificationsRead
} from "@/lib/notifications";
import {
  findResidentByCredentials,
  loadActiveResident,
  loadResidentUsers,
  registerResidentUser,
  RESIDENT_AUTH_KEY,
  RESIDENT_USER_KEY,
  setActiveResident,
  upsertResidentUser
} from "@/lib/resident-auth";
import {
  buildChatParticipants,
  normalizeChatParticipants,
  sameChatParticipantSet
} from "@/lib/chat-participants";
import {
  createTimestamp,
  normalizeTimestamp
} from "@/lib/date-time";
import { asArray } from "@/lib/utils";
import type {
  AppState,
  Business,
  BusinessCategory,
  BusinessOwner,
  BusinessStatus,
  ContactPreference,
  LocalPost,
  LocationInfo,
  PaymentPlan,
  PaymentStatus,
  PostType,
  ReportReason,
  ResidentUser,
  SzocialNotification
} from "@/types";
import { useToast } from "@/components/ToastProvider";

const STORAGE_KEY = "szocial-mvp-state-v2";
const BUSINESS_OWNER_KEY = "szocial_business_owner";
const BUSINESS_AUTH_KEY = "szocial_business_auth";
const BUSINESS_PAYMENT_KEY = "szocial_business_payment_status";
const BUSINESS_PLAN_KEY = "szocial_business_selected_plan";
const BUSINESS_PROFILE_KEY = "szocial_business_profile";
const BUSINESS_PROFILE_COMPLETE_KEY = "szocial_business_profile_complete";

type ResidentSignupInput = {
  name: string;
  email: string;
  mobile?: string;
  password: string;
  age?: number;
  gender?: ResidentUser["gender"];
  location: LocationInfo;
  profilePhoto?: string;
  profilePhotoName?: string;
};

type BusinessSignupInput = {
  ownerName: string;
  email: string;
  password: string;
  businessName: string;
  category: BusinessCategory;
  address: string;
  location: LocationInfo;
};

type CreatePostInput = {
  type: PostType;
  category: string;
  title: string;
  description: string;
  location: LocationInfo;
  landmark?: string;
  date?: string;
  time?: string;
  neededPeople?: number;
  genderPreference?: LocalPost["genderPreference"];
  ageGroup?: LocalPost["ageGroup"];
  visibility?: LocalPost["visibility"];
  urgency?: "Normal" | "Urgent";
  budget?: string;
  contactPreference: ContactPreference;
};

type SendChatMessageInput = {
  text: string;
  kind?: "text" | "location";
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
  locationLabel?: string;
};

type BusinessProfileInput = {
  name: string;
  category: BusinessCategory;
  address: string;
  location: LocationInfo;
  phone: string;
  whatsapp?: string;
  mapsLink?: string;
  hours: string;
  about: string;
  services: string[];
  offers: string[];
  tags: string[];
  priceRange: Business["priceRange"];
  coverImage?: string;
  logo?: string;
  gallery?: string[];
};

type AppStoreContextValue = {
  state: AppState;
  hydrated: boolean;
  currentUser: ResidentUser;
  currentBusinessOwner: BusinessOwner | null;
  currentBusiness: Business | null;
  residentNotifications: SzocialNotification[];
  businessNotifications: SzocialNotification[];
  residentUnreadCount: number;
  businessUnreadCount: number;
  locationLabel: string;
  setLocation: (location: LocationInfo) => void;
  signupResident: (input: ResidentSignupInput) => boolean;
  loginResident: (identifier: string, password: string) => boolean;
  logoutResident: () => void;
  updateResidentProfile: (input: Partial<ResidentUser>) => void;
  updatePrivacy: (privacy: ResidentUser["privacy"]) => void;
  submitVerification: () => void;
  toggleInterest: (postId: string) => void;
  offerHelp: (postId: string) => void;
  addComment: (postId: string, text: string) => void;
  toggleSaveBusiness: (businessId: string) => void;
  createPost: (input: CreatePostInput) => string;
  updatePost: (postId: string, input: Partial<LocalPost>) => void;
  deletePost: (postId: string) => void;
  closePost: (postId: string) => void;
  markSolved: (postId: string) => void;
  acceptInterestedUser: (postId: string, userId: string) => string;
  rejectInterestedUser: (postId: string, userId: string) => void;
  submitReport: (
    itemType: "Post" | "User" | "Business" | "Chat",
    itemId: string,
    itemLabel: string,
    reason: ReportReason
  ) => void;
  startPostChat: (postId: string) => string;
  startBusinessChat: (businessId: string) => string;
  sendChatMessage: (chatId: string, input: string | SendChatMessageInput) => boolean;
  blockChat: (chatId: string) => void;
  signupBusiness: (input: BusinessSignupInput) => void;
  loginBusiness: (identifier: string, password: string) => string | null;
  logoutBusiness: () => void;
  markResidentNotificationsRead: () => void;
  markBusinessNotificationsRead: () => void;
  getBusinessNextRoute: (ownerId?: string | null) => string;
  completeBusinessPayment: (plan: PaymentPlan, paymentId: string, mock: boolean) => void;
  failBusinessPayment: (plan: PaymentPlan) => void;
  updateBusinessProfile: (input: BusinessProfileInput) => void;
  publishBusiness: () => boolean;
  setCurrentBusinessStatus: (status: BusinessStatus) => void;
  addBusinessOffer: (offer: string) => void;
  cancelBusinessPlan: () => void;
  setUserStatus: (userId: string, status: ResidentUser["status"]) => void;
  verifyUser: (userId: string) => void;
  setBusinessAdminStatus: (businessId: string, status: BusinessStatus) => void;
  verifyBusiness: (businessId: string) => void;
  featureBusiness: (businessId: string) => void;
  setBusinessPaymentStatus: (businessId: string, status: PaymentStatus) => void;
  removePostAdmin: (postId: string) => void;
  resolveReport: (reportId: string) => void;
};

const AppStoreContext = createContext<AppStoreContextValue | null>(null);

const fallbackLocation = createEmptyLocation();

const fallbackResident: ResidentUser = {
  id: "user-fallback",
  name: "Szocial Resident",
  email: "resident@szocial.local",
  password: "demo123",
  avatar: createInitialsAvatar("Szocial Resident"),
  location: fallbackLocation,
  verified: false,
  bio: "Local resident profile.",
  status: "Active",
  joinedDate: "2026-01-01",
  reports: 0,
  privacy: {
    showAge: true,
    showExactArea: false,
    allowDirectMessages: true
  }
};

function arrayWithFallback<T>(value: T[] | null | undefined, fallback: T[] | null | undefined = []) {
  return Array.isArray(value) ? value : asArray(fallback);
}

function cloneInitialState(): AppState {
  return JSON.parse(JSON.stringify(initialAppState)) as AppState;
}

function mergeState(saved: Partial<AppState>): AppState {
  return normalizeAppState({
    ...cloneInitialState(),
    ...saved,
    paymentPlans: cloneInitialState().paymentPlans
  });
}

function normalizeAppState(input: Partial<AppState>): AppState {
  const cleanInput = {
    ...input
  } as Partial<AppState> & { adminAuthenticated?: unknown };
  delete cleanInput.adminAuthenticated;
  const base = cloneInitialState();
  const migrationTimestamp = createTimestamp();
  const location =
    normalizeUserLocation(input.location, input.location?.source ?? "fallback") ??
    normalizeUserLocation(base.location, "fallback") ??
    fallbackLocation;
  const residents = arrayWithFallback(input.residents, base.residents).map(normalizeResidentPhoto);
  const posts = arrayWithFallback(input.posts, base.posts).map((post) => {
    const createdAt = normalizeTimestamp(post.createdAt, {
      migrationNow: migrationTimestamp
    });
    return {
      ...post,
      createdAt,
      ...(post.updatedAt
        ? {
            updatedAt: normalizeTimestamp(post.updatedAt, {
              fallback: createdAt,
              migrationNow: migrationTimestamp
            })
          }
        : {}),
      location: post.location ?? location,
      interestedUserIds: asArray(post.interestedUserIds),
      acceptedUserIds: asArray(post.acceptedUserIds),
      savedByUserIds: asArray(post.savedByUserIds),
      comments: asArray(post.comments).map((comment) => ({
        ...comment,
        createdAt: normalizeTimestamp(comment.createdAt, {
          fallback: createdAt,
          migrationNow: migrationTimestamp
        }),
        ...(comment.updatedAt
          ? {
              updatedAt: normalizeTimestamp(comment.updatedAt, {
                fallback: createdAt,
                migrationNow: migrationTimestamp
              })
            }
          : {})
      })),
      reports: post.reports ?? 0,
      distanceKm: post.distanceKm ?? 0
    };
  });
  const businesses = arrayWithFallback(input.businesses, base.businesses).map(
    (business) => {
      const createdAt = normalizeTimestamp(
        business.createdAt ?? business.payment?.paidAt,
        { migrationNow: migrationTimestamp }
      );
      const offers = asArray(business.offers);
      return {
        ...business,
        createdAt,
        ...(business.updatedAt
          ? {
              updatedAt: normalizeTimestamp(business.updatedAt, {
                fallback: createdAt,
                migrationNow: migrationTimestamp
              })
            }
          : {}),
        offerCreatedAt: Object.fromEntries(
          offers.map((offer) => [
            offer,
            normalizeTimestamp(business.offerCreatedAt?.[offer], {
              fallback: createdAt,
              migrationNow: migrationTimestamp
            })
          ])
        ),
        location: business.location ?? location,
        services: asArray(business.services),
        offers,
        tags: asArray(business.tags),
        gallery: asArray(business.gallery),
        views: business.views ?? 0,
        saves: business.saves ?? 0,
        messages: business.messages ?? 0,
        reviews: business.reviews ?? 0
      };
    }
  );
  const businessOwners = arrayWithFallback(input.businessOwners, base.businessOwners);
  const chats = arrayWithFallback(input.chats, base.chats).map((chat) => {
    const messages = asArray(chat.messages).map((message) => ({
      ...message,
      createdAt: normalizeTimestamp(message.createdAt, {
        fallback: chat.createdAt,
        migrationNow: migrationTimestamp
      })
    }));
    const createdAt = normalizeTimestamp(chat.createdAt, {
      fallback: messages[0]?.createdAt,
      migrationNow: migrationTimestamp
    });
    const lastMessageAt = normalizeTimestamp(chat.lastMessageAt, {
      fallback: messages.at(-1)?.createdAt ?? createdAt,
      migrationNow: migrationTimestamp
    });
    return normalizeChatParticipants(
      {
        ...chat,
        createdAt,
        updatedAt: normalizeTimestamp(chat.updatedAt, {
          fallback: lastMessageAt,
          migrationNow: migrationTimestamp
        }),
        lastMessageAt,
        blockedById: chat.status === "Blocked" ? chat.blockedById : undefined,
        blockedByType: chat.status === "Blocked" ? chat.blockedByType : undefined,
        blockedAt: chat.status === "Blocked" ? chat.blockedAt : undefined,
        participantIds: asArray(chat.participantIds),
        messages,
        unread: chat.unread ?? 0
      },
      { residents, businesses, businessOwners, posts }
    );
  });

  return {
    ...base,
    ...cleanInput,
    residents,
    posts,
    businesses,
    businessOwners,
    chats,
    reports: arrayWithFallback(input.reports, base.reports).map((report) => ({
      ...report,
      createdAt: normalizeTimestamp(report.createdAt, {
        migrationNow: migrationTimestamp
      })
    })),
    notifications: arrayWithFallback(input.notifications, base.notifications),
    paymentPlans: arrayWithFallback(base.paymentPlans),
    paymentHistory: arrayWithFallback(input.paymentHistory, base.paymentHistory),
    currentUserId:
      input.currentUserId === undefined ? base.currentUserId : input.currentUserId,
    currentBusinessOwnerId:
      input.currentBusinessOwnerId === undefined
        ? base.currentBusinessOwnerId
        : input.currentBusinessOwnerId,
    location
  };
}

function readLocalStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  window.localStorage.setItem(key, serialized);
}

function withoutStoredDataPhoto(user: ResidentUser): ResidentUser {
  return user.profilePhoto?.startsWith("data:")
    ? { ...user, profilePhoto: undefined }
    : user;
}

function getPersistableAppState(state: AppState) {
  const normalized = normalizeAppState(state);
  return {
    ...normalized,
    residents: normalized.residents.map((resident) =>
      withoutStoredDataPhoto(resident)
    )
  };
}

function getBusinessPaymentStatusFromStorage(): PaymentStatus | null {
  if (typeof window === "undefined") return null;
  const status = window.localStorage.getItem(BUSINESS_PAYMENT_KEY) as PaymentStatus | null;
  return status;
}

function getBusinessProfileCompleteFromStorage() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(BUSINESS_PROFILE_COMPLETE_KEY) === "true";
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function formatLocation(location: LocationInfo | null | undefined) {
  return formatUserLocation(location);
}

function getNotificationPhoto(user: ResidentUser) {
  const photo = getUserDisplayPhoto(user);
  return photo.startsWith("data:") ? undefined : photo;
}

function addMonthDate() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { notify } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<AppState>(() => cloneInitialState());
  const [residentNotifications, setResidentNotifications] = useState<SzocialNotification[]>([]);
  const [businessNotifications, setBusinessNotifications] = useState<SzocialNotification[]>([]);
  const skipNextPersistence = useRef(false);
  const lastResidentLoginFailureAt = useRef(0);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const savedLocation = loadUserLocation();
    let activeLocation = savedLocation ?? createEmptyLocation();
    let nextState = cloneInitialState();
    if (saved) {
      try {
        nextState = mergeState(JSON.parse(saved) as Partial<AppState>);
      } catch {
        nextState = cloneInitialState();
      }
    }

    const registeredUsers = loadResidentUsers().map(normalizeResidentPhoto);
    if (registeredUsers.length) {
      nextState = normalizeAppState({
        ...nextState,
        residents: [
          ...registeredUsers,
          ...asArray(nextState.residents).filter(
            (resident) => !registeredUsers.some((user) => user.id === resident.id)
          )
        ]
      });
    }

    const storedUser = loadActiveResident();
    if (storedUser) {
      const storedUserLocation =
        normalizeUserLocation(storedUser.location) ?? activeLocation;
      if (window.localStorage.getItem(RESIDENT_AUTH_KEY) === "true") {
        activeLocation =
          saveUserLocation(storedUserLocation) ?? storedUserLocation;
      }
      const activeUser = {
        ...normalizeResidentPhoto(storedUser),
        location: storedUserLocation
      };
      const residents = [
        activeUser,
        ...asArray(nextState.residents).filter((resident) => resident.id !== activeUser.id)
      ];
      nextState = normalizeAppState({
        ...nextState,
        residents,
        currentUserId:
          window.localStorage.getItem(RESIDENT_AUTH_KEY) === "true"
            ? activeUser.id
            : nextState.currentUserId
      });
    }

    const storedOwner = readLocalStorage<BusinessOwner>(BUSINESS_OWNER_KEY);
    if (storedOwner) {
      const paymentStatus = getBusinessPaymentStatusFromStorage() ?? storedOwner.paymentStatus;
      const owner = { ...storedOwner, paymentStatus };
      nextState = normalizeAppState({
        ...nextState,
        businessOwners: [
          owner,
          ...asArray(nextState.businessOwners).filter((item) => item.id !== owner.id)
        ],
        currentBusinessOwnerId:
          window.localStorage.getItem(BUSINESS_AUTH_KEY) === "true"
            ? owner.id
            : nextState.currentBusinessOwnerId
      });
    }

    setState(
      normalizeAppState({
        ...nextState,
        currentUserId:
          window.localStorage.getItem(RESIDENT_AUTH_KEY) === "true"
            ? storedUser?.id ?? nextState.currentUserId
            : null,
        currentBusinessOwnerId:
          window.localStorage.getItem(BUSINESS_AUTH_KEY) === "true"
            ? storedOwner?.id ?? nextState.currentBusinessOwnerId
            : null,
        location: activeLocation
      })
    );
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      if (skipNextPersistence.current) {
        skipNextPersistence.current = false;
        return;
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(getPersistableAppState(state)));
    }
  }, [hydrated, state]);

  useEffect(() => {
    const syncChatsFromStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const incoming = mergeState(JSON.parse(event.newValue) as Partial<AppState>);
        setState((current) => {
          if (JSON.stringify(current.chats) === JSON.stringify(incoming.chats)) {
            return current;
          }
          skipNextPersistence.current = true;
          return {
            ...current,
            chats: incoming.chats
          };
        });
      } catch {
        // Ignore malformed state written by another tab.
      }
    };

    window.addEventListener("storage", syncChatsFromStorage);
    return () => window.removeEventListener("storage", syncChatsFromStorage);
  }, []);

  const safeState = useMemo(() => normalizeAppState(state), [state]);
  const storedCurrentUser =
    safeState.residents.find((user) => user.id === safeState.currentUserId) ??
    safeState.residents[0] ??
    fallbackResident;
  const currentUser = useMemo(
    () => ({ ...storedCurrentUser, location: safeState.location }),
    [safeState.location, storedCurrentUser]
  );
  const currentBusinessOwner =
    safeState.businessOwners.find((owner) => owner.id === safeState.currentBusinessOwnerId) ??
    null;
  const currentBusiness =
    safeState.businesses.find((business) => business.id === currentBusinessOwner?.businessId) ??
    null;
  const locationLabel = formatLocation(safeState.location);
  const residentUnreadCount = residentNotifications.filter((item) => !item.isRead).length;
  const businessUnreadCount = businessNotifications.filter((item) => !item.isRead).length;

  useEffect(() => {
    if (!hydrated) return;
    setResidentNotifications(
      safeState.currentUserId
        ? loadNotifications("resident", safeState.currentUserId)
        : []
    );
  }, [hydrated, safeState.currentUserId]);

  useEffect(() => {
    if (!hydrated) return;
    setBusinessNotifications(
      safeState.currentBusinessOwnerId
        ? loadNotifications("business", safeState.currentBusinessOwnerId)
        : []
    );
  }, [hydrated, safeState.currentBusinessOwnerId]);

  const pushNotification = useCallback(
    (
      input: Omit<SzocialNotification, "id" | "isRead" | "createdAt">,
      allowDuplicate = false
    ) => {
      const created = createNotification(input, { allowDuplicate });
      if (!created) return false;
      if (
        input.recipientType === "resident" &&
        input.recipientId === safeState.currentUserId
      ) {
        setResidentNotifications(loadNotifications("resident", input.recipientId));
      }
      if (
        input.recipientType === "business" &&
        input.recipientId === safeState.currentBusinessOwnerId
      ) {
        setBusinessNotifications(loadNotifications("business", input.recipientId));
      }
      return true;
    },
    [safeState.currentBusinessOwnerId, safeState.currentUserId]
  );

  const markResidentNotificationsRead = useCallback(() => {
    if (!safeState.currentUserId) return;
    setResidentNotifications(
      markAllNotificationsRead("resident", safeState.currentUserId)
    );
  }, [safeState.currentUserId]);

  const markBusinessNotificationsRead = useCallback(() => {
    if (!safeState.currentBusinessOwnerId) return;
    setBusinessNotifications(
      markAllNotificationsRead("business", safeState.currentBusinessOwnerId)
    );
  }, [safeState.currentBusinessOwnerId]);

  const setLocation = useCallback(
    (location: LocationInfo) => {
      const savedLocation = saveUserLocation(location);
      if (!savedLocation) {
        notify({
          title: "Location not set",
          description: "Enter an area or city to save your location.",
          variant: "warning"
        });
        return;
      }

      setState((current) => {
        const residents = asArray(current.residents).map((user) =>
          user.id === current.currentUserId ? { ...user, location: savedLocation } : user
        );
        const activeUser = residents.find((user) => user.id === current.currentUserId);
        if (activeUser) {
          writeLocalStorage(RESIDENT_USER_KEY, activeUser);
          upsertResidentUser(activeUser);
        }
        return { ...current, residents, location: savedLocation };
      });
      notify({
        title: "Location updated",
        description: `Showing local activity around ${formatLocation(savedLocation)}.`
      });
    },
    [notify]
  );

  const signupResident = useCallback(
    (input: ResidentSignupInput) => {
      const id = createId("user");
      const location =
        normalizeUserLocation(input.location) ?? createEmptyLocation();
      const profilePhoto = input.profilePhoto?.trim() || undefined;
      const user: ResidentUser = {
        id,
        name: input.name,
        email: input.email,
        mobile: input.mobile,
        password: input.password,
        avatar: createInitialsAvatar(input.name),
        profilePhoto,
        profilePhotoName: input.profilePhotoName,
        updatedAt: new Date().toISOString(),
        age: input.age,
        gender: input.gender,
        location,
        verified: false,
        bio: "New to Szocial and ready to meet neighbours.",
        status: "Active",
        joinedDate: new Date().toISOString().slice(0, 10),
        reports: 0,
        privacy: {
          showAge: true,
          showExactArea: false,
          allowDirectMessages: true
        }
      };

      if (!registerResidentUser(user, state.residents)) {
        notify({
          title: "Account already exists",
          description:
            "An account with this email or mobile number already exists.",
          variant: "warning"
        });
        return false;
      }

      saveUserLocation(location);
      setState((current) => ({
        ...current,
        residents: [user, ...asArray(current.residents)],
        currentUserId: id,
        currentBusinessOwnerId: null,
        location
      }));
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(BUSINESS_AUTH_KEY);
      }
      notify({ title: "Welcome to Szocial", description: "Your resident profile is ready." });
      return true;
    },
    [notify, state.residents]
  );

  const loginResident = useCallback(
    (identifier: string, password: string) => {
      const user = findResidentByCredentials(
        identifier,
        password,
        state.residents
      );

      if (!user) {
        const now = Date.now();
        if (now - lastResidentLoginFailureAt.current > 3200) {
          lastResidentLoginFailureAt.current = now;
          notify({
            title: "Login failed",
            description: "Incorrect email/mobile or password.",
            variant: "warning"
          });
        }
        return false;
      }

      const savedLocation =
        normalizeUserLocation(user.location) ??
        loadUserLocation() ??
        createEmptyLocation();
      saveUserLocation(savedLocation);
      const activeUser = {
        ...normalizeResidentPhoto(user),
        location: savedLocation
      };
      setState((current) => ({
        ...current,
        currentUserId: user.id,
        currentBusinessOwnerId: null,
        residents: [
          activeUser,
          ...asArray(current.residents).filter(
            (resident) => resident.id !== user.id
          )
        ],
        location: savedLocation
      }));
      setActiveResident(activeUser);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(BUSINESS_AUTH_KEY);
      }
      notify({ title: "Logged in", description: `Good to see you, ${user.name}.` });
      return true;
    },
    [notify, state.residents]
  );

  const logoutResident = useCallback(() => {
    setState((current) => ({ ...current, currentUserId: null }));
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RESIDENT_AUTH_KEY);
    }
    notify({ title: "Logged out", description: "Your local session was cleared." });
  }, [notify]);

  const updateResidentProfile = useCallback(
    (input: Partial<ResidentUser>) => {
      setState((current) => {
        const residents = asArray(current.residents).map((user) => {
          if (user.id !== current.currentUserId) return user;
          const updated = normalizeResidentPhoto({ ...user, ...input });
          return {
            ...updated,
            id: user.id,
            email: user.email,
            mobile: user.mobile,
            password: user.password
          };
        });
        const activeUser = residents.find((user) => user.id === current.currentUserId);
        if (activeUser) {
          writeLocalStorage(RESIDENT_USER_KEY, activeUser);
          upsertResidentUser(activeUser);
        }
        return { ...current, residents };
      });
      notify({ title: "Profile updated" });
    },
    [notify]
  );

  const updatePrivacy = useCallback(
    (privacy: ResidentUser["privacy"]) => {
      setState((current) => {
        const residents = asArray(current.residents).map((user) =>
          user.id === current.currentUserId ? { ...user, privacy } : user
        );
        const activeUser = residents.find((user) => user.id === current.currentUserId);
        if (activeUser) {
          writeLocalStorage(RESIDENT_USER_KEY, activeUser);
          upsertResidentUser(activeUser);
        }
        return { ...current, residents };
      });
      notify({ title: "Privacy settings saved" });
    },
    [notify]
  );

  const submitVerification = useCallback(() => {
    notify({
      title: "Verification request submitted",
      description: "This is a mock flow. Admin approval can be connected later."
    });
  }, [notify]);

  const toggleInterest = useCallback(
    (postId: string) => {
      const post = asArray(state.posts).find((item) => item.id === postId);
      const sender = asArray(state.residents).find(
        (user) => user.id === state.currentUserId
      );
      if (!post || !sender) return;
      if (post.authorId === sender.id) {
        notify({
          title: "This is your post",
          description: "You cannot send an interest request to yourself.",
          variant: "warning"
        });
        return;
      }
      if (asArray(post.interestedUserIds).includes(sender.id)) {
        notify({
          title: "Interest already sent",
          description: "The post creator already has your request."
        });
        return;
      }

      setState((current) => ({
        ...current,
        posts: asArray(current.posts).map((post) => {
          if (post.id !== postId || !current.currentUserId) return post;
          return {
            ...post,
            interestedUserIds: Array.from(
              new Set([...asArray(post.interestedUserIds), current.currentUserId])
            )
          };
        })
      }));
      pushNotification({
        recipientType: "resident",
        recipientId: post.authorId,
        senderId: sender.id,
        senderName: sender.name,
        senderPhoto: getNotificationPhoto(sender),
        type: "interest",
        title: "New interest request",
        message: `${sender.name} is interested in your post: ${post.title}`,
        entityType: post.type === "help" ? "help_post" : "post",
        entityId: post.id,
        postId: post.id
      });
      notify({ title: "Interest sent", description: "Interest sent to the post creator." });
    },
    [notify, pushNotification, state.currentUserId, state.posts, state.residents]
  );

  const offerHelp = useCallback(
    (postId: string) => {
      toggleInterest(postId);
    },
    [toggleInterest]
  );

  const addComment = useCallback(
    (postId: string, text: string) => {
      if (!text.trim()) return;
      const post = asArray(state.posts).find((item) => item.id === postId);
      const sender = asArray(state.residents).find(
        (user) => user.id === state.currentUserId
      );
      if (!post || !sender) return;
      const commentId = createId("comment");
      const createdAt = createTimestamp();
      setState((current) => ({
        ...current,
        posts: asArray(current.posts).map((post) =>
          post.id === postId && current.currentUserId
            ? {
                ...post,
                comments: [
                  ...asArray(post.comments),
                  {
                    id: commentId,
                    userId: current.currentUserId,
                    text: text.trim(),
                    createdAt
                  }
                ]
              }
            : post
        )
      }));
      if (sender.id !== post.authorId) {
        pushNotification(
          {
            recipientType: "resident",
            recipientId: post.authorId,
            senderId: sender.id,
            senderName: sender.name,
            senderPhoto: getNotificationPhoto(sender),
            type: "comment",
            title: "New comment on your post",
            message: `${sender.name} commented on: ${post.title}`,
            entityType: "comment",
            entityId: commentId,
            postId: post.id
          },
          true
        );
      }
      notify({ title: "Comment added" });
    },
    [notify, pushNotification, state.currentUserId, state.posts, state.residents]
  );

  const toggleSaveBusiness = useCallback(
    (businessId: string) => {
      setState((current) => ({
        ...current,
        businesses: asArray(current.businesses).map((business) =>
          business.id === businessId
            ? { ...business, saves: Math.max(0, business.saves + 1) }
            : business
        )
      }));
      notify({ title: "Business saved", description: "Added to your saved local spots." });
    },
    [notify]
  );

  const createPost = useCallback(
    (input: CreatePostInput) => {
      const id = createId(input.type === "fun" ? "post" : "help");
      const createdAt = createTimestamp();
      const post: LocalPost = {
        id,
        ...input,
        authorId: state.currentUserId ?? asArray(state.residents)[0]?.id ?? fallbackResident.id,
        createdAt,
        status: "Active",
        interestedUserIds: [],
        acceptedUserIds: [],
        savedByUserIds: [],
        reports: 0,
        comments: [],
        distanceKm: 0.4
      };
      setState((current) => ({ ...current, posts: [post, ...asArray(current.posts)] }));
      notify({
        title: input.type === "fun" ? "Your plan is live" : "Help request posted",
        description:
          input.type === "fun"
            ? "Neighbours nearby can now show interest."
            : "Your request is visible in Help."
      });
      return id;
    },
    [notify, state.currentUserId, state.residents]
  );

  const updatePost = useCallback(
    (postId: string, input: Partial<LocalPost>) => {
      const updatedAt = createTimestamp();
      setState((current) => ({
        ...current,
        posts: asArray(current.posts).map((post) =>
          post.id === postId
            ? {
                ...post,
                ...input,
                createdAt: post.createdAt,
                updatedAt
              }
            : post
        )
      }));
      notify({ title: "Post updated" });
    },
    [notify]
  );

  const deletePost = useCallback(
    (postId: string) => {
      setState((current) => ({
        ...current,
        posts: asArray(current.posts).filter((post) => post.id !== postId)
      }));
      notify({ title: "Post deleted" });
    },
    [notify]
  );

  const closePost = useCallback(
    (postId: string) => {
      setState((current) => ({
        ...current,
        posts: asArray(current.posts).map((post) =>
          post.id === postId ? { ...post, status: "Completed" } : post
        )
      }));
      notify({ title: "Post closed" });
    },
    [notify]
  );

  const markSolved = useCallback(
    (postId: string) => {
      setState((current) => ({
        ...current,
        posts: asArray(current.posts).map((post) =>
          post.id === postId ? { ...post, status: "Solved" } : post
        )
      }));
      notify({ title: "Marked as solved" });
    },
    [notify]
  );

  const acceptInterestedUser = useCallback(
    (postId: string, userId: string) => {
      const post = asArray(state.posts).find((item) => item.id === postId);
      const user = asArray(state.residents).find((item) => item.id === userId);
      const creatorId = state.currentUserId;
      if (!post || !user || !creatorId || creatorId === userId) {
        return "";
      }

      const participantIds = [creatorId, userId];
      const existing = asArray(state.chats).find(
        (chat) =>
          chat.postId === postId &&
          chat.status !== "Left" &&
          sameChatParticipantSet(chat, participantIds)
      );
      if (existing) {
        setState((current) => ({
          ...current,
          posts: asArray(current.posts).map((item) =>
            item.id === postId
              ? {
                  ...item,
                  acceptedUserIds: Array.from(
                    new Set([...asArray(item.acceptedUserIds), userId])
                  )
                }
              : item
          )
        }));
        notify({
          title: "Request accepted",
          description: "The existing chat was opened."
        });
        return existing.id;
      }

      const chatId = createId("chat");
      const createdAt = createTimestamp();
      setState((current) => ({
        ...current,
        posts: asArray(current.posts).map((item) =>
          item.id === postId
            ? { ...item, acceptedUserIds: Array.from(new Set([...asArray(item.acceptedUserIds), userId])) }
            : item
        ),
        chats: post && user
          ? [
              {
                id: chatId,
                type: post.type === "fun" ? "Fun" : "Help",
                name: `${user.name} - ${post.title}`,
                avatar: getUserDisplayPhoto(user),
                location: formatLocation(post.location),
                status: "Active",
                participantIds,
                participants: buildChatParticipants(participantIds, {
                  residents: current.residents,
                  businesses: current.businesses,
                  businessOwners: current.businessOwners,
                  posts: current.posts
                }),
                postId,
                createdAt,
                updatedAt: createdAt,
                lastMessageAt: createdAt,
                unread: 0,
                messages: [
                  {
                    id: createId("msg"),
                    senderId: "system",
                    text: "Request accepted. Chat started with this neighbour.",
                    createdAt,
                    kind: "system"
                  }
                ]
              },
              ...asArray(current.chats)
            ]
          : asArray(current.chats)
      }));
      notify({ title: "Request accepted", description: "A chat was created." });
      return chatId;
    },
    [
      notify,
      state.chats,
      state.currentUserId,
      state.posts,
      state.residents
    ]
  );

  const rejectInterestedUser = useCallback(
    (postId: string, userId: string) => {
      setState((current) => ({
        ...current,
        posts: asArray(current.posts).map((post) =>
          post.id === postId
            ? {
                ...post,
                interestedUserIds: asArray(post.interestedUserIds).filter((id) => id !== userId)
              }
            : post
        )
      }));
      notify({ title: "Request rejected" });
    },
    [notify]
  );

  const submitReport = useCallback(
    (
      itemType: "Post" | "User" | "Business" | "Chat",
      itemId: string,
      itemLabel: string,
      reason: ReportReason
    ) => {
      const createdAt = createTimestamp();
      setState((current) => ({
        ...current,
        reports: [
          {
            id: createId("report"),
            itemType,
            itemId,
            itemLabel,
            reason,
            reportedBy: current.currentUserId ?? "user-vishv",
            status: "Open",
            createdAt
          },
          ...asArray(current.reports)
        ],
        posts: itemType === "Post"
          ? asArray(current.posts).map((post) =>
              post.id === itemId ? { ...post, reports: (post.reports ?? 0) + 1 } : post
            )
          : asArray(current.posts)
      }));
      notify({ title: "Report submitted", description: "Thanks for helping keep Szocial safe." });
    },
    [notify]
  );

  const startPostChat = useCallback(
    (postId: string) => {
      const sender = asArray(state.residents).find(
        (user) => user.id === state.currentUserId
      );
      const post = asArray(state.posts).find((item) => item.id === postId);
      const author = asArray(state.residents).find((user) => user.id === post?.authorId);
      const participantIds =
        sender && author ? [sender.id, author.id] : [];
      const existing = asArray(state.chats).find(
        (chat) =>
          chat.postId === postId &&
          chat.status !== "Left" &&
          participantIds.length === 2 &&
          sameChatParticipantSet(chat, participantIds)
      );
      if (existing) {
        notify({ title: "Chat opened", description: "Chat started with this neighbour." });
        return existing.id;
      }

      const chatId = createId("chat");
      if (post && author && sender && author.id !== sender.id) {
        const createdAt = createTimestamp();
        setState((current) => ({
          ...current,
          chats: [
            {
              id: chatId,
              type: post.type === "fun" ? "Fun" : "Help",
              name: `${author.name} - ${post.title}`,
              avatar: getUserDisplayPhoto(author),
              location: formatLocation(post.location),
              status: "Active",
              participantIds,
              participants: buildChatParticipants(participantIds, {
                residents: current.residents,
                businesses: current.businesses,
                businessOwners: current.businessOwners,
                posts: current.posts
              }),
              postId,
              createdAt,
              updatedAt: createdAt,
              lastMessageAt: createdAt,
              unread: 0,
              messages: [
                {
                  id: createId("msg"),
                  senderId: "system",
                  text: "Chat started with this neighbour.",
                  createdAt,
                  kind: "system"
                }
              ]
            },
            ...asArray(current.chats)
          ]
        }));
        pushNotification({
          recipientType: "resident",
          recipientId: author.id,
          senderId: sender.id,
          senderName: sender.name,
          senderPhoto: getNotificationPhoto(sender),
          type: "message",
          title: "New message",
          message: `${sender.name} started a chat about: ${post.title}`,
          entityType: "chat",
          entityId: chatId,
          postId: post.id,
          chatId
        });
      } else if (author?.id === sender?.id) {
        notify({
          title: "This is your post",
          description: "You cannot start a chat with yourself.",
          variant: "warning"
        });
        return "";
      }
      notify({ title: "Chat opened", description: "Chat started with this neighbour." });
      return chatId;
    },
    [
      notify,
      pushNotification,
      state.chats,
      state.currentUserId,
      state.posts,
      state.residents
    ]
  );

  const startBusinessChat = useCallback(
    (businessId: string) => {
      const sender = asArray(state.residents).find(
        (user) => user.id === state.currentUserId
      );
      const business = asArray(state.businesses).find((item) => item.id === businessId);
      const participantIds =
        sender && business ? [sender.id, business.ownerId] : [];
      const existing = asArray(state.chats).find(
        (chat) =>
          chat.businessId === businessId &&
          chat.status !== "Left" &&
          participantIds.length === 2 &&
          sameChatParticipantSet(chat, participantIds)
      );
      if (existing) {
        notify({ title: "Business chat opened" });
        return existing.id;
      }

      const chatId = createId("chat");
      if (business && sender) {
        const createdAt = createTimestamp();
        setState((current) => ({
          ...current,
          businesses: asArray(current.businesses).map((item) =>
            item.id === businessId ? { ...item, messages: item.messages + 1 } : item
          ),
          chats: [
            {
              id: chatId,
              type: "Business",
              name: business.name,
              avatar: business.logo,
              location: formatLocation(business.location),
              status: "Active",
              participantIds,
              participants: buildChatParticipants(participantIds, {
                residents: current.residents,
                businesses: current.businesses,
                businessOwners: current.businessOwners,
                posts: current.posts
              }),
              businessId,
              createdAt,
              updatedAt: createdAt,
              lastMessageAt: createdAt,
              unread: 0,
              messages: [
                {
                  id: createId("msg"),
                  senderId: "system",
                  text: `Business chat started with ${business.name}.`,
                  createdAt,
                  kind: "system"
                }
              ]
            },
            ...asArray(current.chats)
          ]
        }));
        pushNotification({
          recipientType: "business",
          recipientId: business.ownerId,
          senderId: sender.id,
          senderName: sender.name,
          senderPhoto: getNotificationPhoto(sender),
          type: "business_message",
          title: "New business message",
          message: `${sender.name} messaged your business: ${business.name}`,
          entityType: "business",
          entityId: chatId,
          businessId: business.id,
          chatId
        });
      }
      notify({ title: "Business chat opened" });
      return chatId;
    },
    [
      notify,
      pushNotification,
      state.businesses,
      state.chats,
      state.currentUserId,
      state.residents
    ]
  );

  const sendChatMessage = useCallback(
    (chatId: string, input: string | SendChatMessageInput) => {
      const messageInput =
        typeof input === "string"
          ? { text: input, kind: "text" as const }
          : { ...input, kind: input.kind ?? "text" };
      const { text, kind, latitude, longitude, mapsUrl, locationLabel } =
        messageInput;
      if (!text.trim()) return false;
      if (
        kind === "location" &&
        (!Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          !mapsUrl?.startsWith("https://www.google.com/maps/"))
      ) {
        return false;
      }
      const chat = asArray(state.chats).find((item) => item.id === chatId);
      const senderId = state.currentBusinessOwnerId ?? state.currentUserId;
      if (
        !chat ||
        !senderId ||
        chat.status !== "Active" ||
        !asArray(chat.participantIds).includes(senderId)
      ) {
        return false;
      }
      const senderResident = asArray(state.residents).find(
        (resident) => resident.id === senderId
      );
      const senderOwner = asArray(state.businessOwners).find(
        (owner) => owner.id === senderId
      );
      const senderBusiness = asArray(state.businesses).find(
        (business) => business.ownerId === senderOwner?.id
      );
      const senderName =
        senderResident?.name ?? senderBusiness?.name ?? senderOwner?.ownerName ?? "Szocial user";
      const senderPhoto = senderResident
        ? getNotificationPhoto(senderResident)
        : senderBusiness?.logo;
      const senderType = senderOwner ? "business" : "resident";
      const messageId = createId("msg");
      const createdAt = createTimestamp();
      setState((current) => ({
        ...current,
        chats: asArray(current.chats).map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                updatedAt: createdAt,
                lastMessageAt: createdAt,
                messages: [
                  ...asArray(chat.messages),
                  {
                    id: messageId,
                    senderId,
                    senderType,
                    text: text.trim(),
                    createdAt,
                    kind,
                    ...(kind === "location"
                      ? {
                          latitude,
                          longitude,
                          mapsUrl,
                          locationLabel
                        }
                      : {})
                  }
                ]
              }
            : chat
        )
      }));

      if (senderResident && chat.type === "Business") {
        const business = asArray(state.businesses).find(
          (item) => item.id === chat.businessId
        );
        if (business) {
          pushNotification(
            {
              recipientType: "business",
              recipientId: business.ownerId,
              senderId,
              senderName,
              senderPhoto,
              type: "business_message",
              title: "New business message",
              message:
                kind === "location"
                  ? `${senderName} shared a location with you.`
                  : `${senderName} sent a message to ${business.name}.`,
              entityType: "chat",
              entityId: messageId,
              businessId: business.id,
              chatId
            },
            true
          );
        }
      } else {
        asArray(chat.participantIds)
          .filter((participantId) => participantId !== senderId)
          .filter((participantId) =>
            asArray(state.residents).some((resident) => resident.id === participantId)
          )
          .forEach((recipientId) => {
            pushNotification(
              {
                recipientType: "resident",
                recipientId,
                senderId,
                senderName,
                senderPhoto,
                type: "message",
                title: "New message",
                message:
                  kind === "location"
                    ? `${senderName} shared a location with you.`
                    : `${senderName} sent you a message.`,
                entityType: "chat",
                entityId: messageId,
                chatId
              },
              true
            );
          });
      }
      return true;
    },
    [
      pushNotification,
      state.businessOwners,
      state.businesses,
      state.chats,
      state.currentBusinessOwnerId,
      state.currentUserId,
      state.residents
    ]
  );

  const blockChat = useCallback(
    (chatId: string) => {
      const participantId = state.currentBusinessOwnerId ?? state.currentUserId;
      const participantType = state.currentBusinessOwnerId ? "business" : "resident";
      const chat = asArray(state.chats).find((item) => item.id === chatId);

      if (
        !chat ||
        !participantId ||
        !asArray(chat.participantIds).includes(participantId)
      ) {
        notify({
          title: "Chat action unavailable",
          description: "Your participant identity could not be verified.",
          variant: "warning"
        });
        return;
      }

      if (chat.status === "Left") {
        notify({
          title: "Chat action unavailable",
          description: "A chat that has been left cannot be blocked.",
          variant: "warning"
        });
        return;
      }

      if (
        chat.status === "Blocked" &&
        (chat.blockedById !== participantId ||
          chat.blockedByType !== participantType)
      ) {
        notify({
          title: "Chat remains blocked",
          description: "Only the participant who blocked this chat can unblock it.",
          variant: "warning"
        });
        return;
      }

      const unblocking = chat.status === "Blocked";
      setState((current) => ({
        ...current,
        chats: asArray(current.chats).map((chat) =>
          chat.id === chatId
            ? unblocking
              ? {
                  ...chat,
                  status: "Active",
                  blockedById: undefined,
                  blockedByType: undefined,
                  blockedAt: undefined
                }
              : {
                  ...chat,
                  status: "Blocked",
                  blockedById: participantId,
                  blockedByType: participantType,
                  blockedAt: new Date().toISOString()
                }
            : chat
        )
      }));
      notify(
        unblocking
          ? {
              title: "Chat unblocked",
              description: "You can send messages again."
            }
          : {
              title: "Chat blocked",
              description: "Messaging is unavailable until you unblock this chat."
            }
      );
    },
    [
      notify,
      state.chats,
      state.currentBusinessOwnerId,
      state.currentUserId
    ]
  );

  const signupBusiness = useCallback(
    (input: BusinessSignupInput) => {
      const ownerId = createId("owner");
      const businessId = createId("biz");
      const createdAt = createTimestamp();
      const owner: BusinessOwner = {
        id: ownerId,
        ownerName: input.ownerName,
        email: input.email,
        password: input.password,
        businessId,
        paymentStatus: "unpaid"
      };
      const business: Business = {
        id: businessId,
        ownerId,
        name: input.businessName,
        category: input.category,
        address: input.address,
        location: input.location,
        phone: "",
        hours: "10 AM - 9 PM",
        about: "",
        services: [],
        offers: [],
        tags: [],
        priceRange: "Mid-range",
        status: "Draft",
        openStatus: "Open",
        verified: false,
        featured: false,
        listedByResidents: false,
        coverImage:
          "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
        logo:
          "https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=200&q=80",
        gallery: [],
        rating: 0,
        reviews: 0,
        views: 0,
        saves: 0,
        messages: 0,
        createdAt,
        offerCreatedAt: {}
      };

      setState((current) => ({
        ...current,
        businessOwners: [owner, ...asArray(current.businessOwners)],
        businesses: [business, ...asArray(current.businesses)],
        currentUserId: null,
        currentBusinessOwnerId: ownerId
      }));
      writeLocalStorage(BUSINESS_OWNER_KEY, owner);
      writeLocalStorage(BUSINESS_AUTH_KEY, "true");
      writeLocalStorage(BUSINESS_PAYMENT_KEY, "unpaid");
      writeLocalStorage(BUSINESS_PROFILE_COMPLETE_KEY, "false");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(RESIDENT_AUTH_KEY);
      }
      notify({
        title: "Business account created",
        description: "Choose a listing plan to continue."
      });
    },
    [notify]
  );

  const getBusinessNextRoute = useCallback(
    (ownerId?: string | null) => {
      const id = ownerId ?? state.currentBusinessOwnerId;
      const owner = asArray(state.businessOwners).find((item) => item.id === id);
      if (!owner) return "/business/login";
      const business = asArray(state.businesses).find((item) => item.id === owner.businessId);
      const storagePayment = getBusinessPaymentStatusFromStorage();
      const paymentStatus = storagePayment ?? owner.paymentStatus;
      if (paymentStatus !== "paid") return "/business/pricing";
      const storageProfileComplete = getBusinessProfileCompleteFromStorage();
      const profileComplete = Boolean(
        storageProfileComplete ||
          (business && business.status !== "Draft" && business.about && business.phone)
      );
      if (!business || !profileComplete) {
        return "/business/setup";
      }
      return "/business/dashboard";
    },
    [state.businessOwners, state.businesses, state.currentBusinessOwnerId]
  );

  const loginBusiness = useCallback(
    (identifier: string, password: string) => {
      const normalized = identifier.trim().toLowerCase();
      const owner = asArray(state.businessOwners).find(
        (item) => (item.email ?? "").toLowerCase() === normalized && item.password === password
      );
      if (!owner) {
        notify({
          title: "Business login failed",
          description: "Try owner@mocha.local with demo123, or create an account.",
          variant: "warning"
        });
        return null;
      }

      const paymentStatus = getBusinessPaymentStatusFromStorage() ?? owner.paymentStatus;
      setState((current) => ({
        ...current,
        currentUserId: null,
        currentBusinessOwnerId: owner.id,
        businessOwners: asArray(current.businessOwners).map((item) =>
          item.id === owner.id ? { ...item, paymentStatus } : item
        )
      }));
      writeLocalStorage(BUSINESS_OWNER_KEY, { ...owner, paymentStatus });
      writeLocalStorage(BUSINESS_AUTH_KEY, "true");
      writeLocalStorage(BUSINESS_PAYMENT_KEY, paymentStatus);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(RESIDENT_AUTH_KEY);
      }
      notify({ title: "Business login successful" });
      return getBusinessNextRoute(owner.id);
    },
    [getBusinessNextRoute, notify, state.businessOwners]
  );

  const logoutBusiness = useCallback(() => {
    setState((current) => ({ ...current, currentBusinessOwnerId: null }));
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(BUSINESS_AUTH_KEY);
    }
    notify({ title: "Business account logged out" });
  }, [notify]);

  const completeBusinessPayment = useCallback(
    (plan: PaymentPlan, paymentId: string, mock: boolean) => {
      setState((current) => {
        const owner = asArray(current.businessOwners).find(
          (item) => item.id === current.currentBusinessOwnerId
        );
        if (!owner) return current;
        const payment = {
          planId: plan.id,
          planName: plan.name,
          amountPaid: plan.price,
          paymentId,
          status: "paid" as const,
          renewalDate: addMonthDate(),
          paidAt: new Date().toISOString().slice(0, 10),
          mock
        };
        return {
          ...current,
          businessOwners: asArray(current.businessOwners).map((item) =>
            item.id === owner.id ? { ...item, paymentStatus: "paid" } : item
          ),
          businesses: asArray(current.businesses).map((business) =>
            business.id === owner.businessId ? { ...business, payment } : business
          ),
          paymentHistory: [
            {
              id: createId("payment"),
              date: payment.paidAt,
              businessId: owner.businessId,
              planName: plan.name,
              amount: plan.price,
              status: "paid",
              paymentId
            },
            ...asArray(current.paymentHistory)
          ]
        };
      });
      writeLocalStorage(BUSINESS_PAYMENT_KEY, "paid");
      writeLocalStorage(BUSINESS_PLAN_KEY, plan);
      notify({
        title: "Payment successful",
        description: `${plan.name} is active for your listing.`
      });
    },
    [notify]
  );

  const failBusinessPayment = useCallback(
    (plan: PaymentPlan) => {
      setState((current) => {
        const owner = asArray(current.businessOwners).find(
          (item) => item.id === current.currentBusinessOwnerId
        );
        return {
          ...current,
          paymentHistory: owner
            ? [
                {
                  id: createId("payment"),
                  date: new Date().toISOString().slice(0, 10),
                  businessId: owner.businessId,
                  planName: plan.name,
                  amount: plan.price,
                  status: "failed",
                  paymentId: "pay_failed_mock"
                },
                ...asArray(current.paymentHistory)
              ]
            : asArray(current.paymentHistory)
        };
      });
      writeLocalStorage(BUSINESS_PAYMENT_KEY, "failed");
      notify({ title: "Payment failed", variant: "warning" });
    },
    [notify]
  );

  const updateBusinessProfile = useCallback(
    (input: BusinessProfileInput) => {
      const updatedAt = createTimestamp();
      setState((current) => {
        const owner = asArray(current.businessOwners).find(
          (item) => item.id === current.currentBusinessOwnerId
        );
        if (!owner) return current;
        return {
          ...current,
          businesses: asArray(current.businesses).map((business) =>
            business.id === owner.businessId
              ? {
                  ...business,
                  ...input,
                  createdAt: business.createdAt,
                  updatedAt
                }
              : business
          )
        };
      });
      writeLocalStorage(BUSINESS_PROFILE_KEY, input);
      writeLocalStorage(BUSINESS_PROFILE_COMPLETE_KEY, "true");
      notify({ title: "Business profile saved" });
    },
    [notify]
  );

  const publishBusiness = useCallback(() => {
    const owner = asArray(state.businessOwners).find(
      (item) => item.id === state.currentBusinessOwnerId
    );
    const paymentStatus = getBusinessPaymentStatusFromStorage() ?? owner?.paymentStatus;
    if (!owner || paymentStatus !== "paid") {
      notify({
        title: "Complete payment to make your listing live",
        description: "Please choose a listing plan to continue.",
        variant: "warning"
      });
      return false;
    }

    const updatedAt = createTimestamp();
    setState((current) => ({
        ...current,
        businesses: asArray(current.businesses).map((business) =>
          business.id === owner.businessId
            ? { ...business, status: "Live", updatedAt }
            : business
        )
    }));
    notify({ title: "Your business is now live" });
    return true;
  }, [notify, state.businessOwners, state.currentBusinessOwnerId]);

  const setCurrentBusinessStatus = useCallback(
    (status: BusinessStatus) => {
      const updatedAt = createTimestamp();
      setState((current) => {
        const owner = asArray(current.businessOwners).find(
          (item) => item.id === current.currentBusinessOwnerId
        );
        return {
          ...current,
          businesses: asArray(current.businesses).map((business) =>
            business.id === owner?.businessId
              ? { ...business, status, updatedAt }
              : business
          )
        };
      });
      notify({ title: `Listing status changed to ${status}` });
    },
    [notify]
  );

  const addBusinessOffer = useCallback(
    (offer: string) => {
      if (!offer.trim()) return;
      const normalizedOffer = offer.trim();
      const createdAt = createTimestamp();
      setState((current) => {
        const owner = asArray(current.businessOwners).find(
          (item) => item.id === current.currentBusinessOwnerId
        );
        return {
          ...current,
          businesses: asArray(current.businesses).map((business) =>
            business.id === owner?.businessId
              ? {
                  ...business,
                  offers: [normalizedOffer, ...asArray(business.offers)],
                  offerCreatedAt: {
                    ...business.offerCreatedAt,
                    [normalizedOffer]: createdAt
                  },
                  updatedAt: createdAt
                }
              : business
          )
        };
      });
      notify({ title: "Offer added" });
    },
    [notify]
  );

  const cancelBusinessPlan = useCallback(() => {
    setState((current) => {
      const owner = asArray(current.businessOwners).find(
        (item) => item.id === current.currentBusinessOwnerId
      );
      return {
        ...current,
        businessOwners: asArray(current.businessOwners).map((item) =>
          item.id === owner?.id ? { ...item, paymentStatus: "cancelled" } : item
        ),
        businesses: asArray(current.businesses).map((business) =>
          business.id === owner?.businessId
            ? {
                ...business,
                status: "Paused",
                payment: business.payment
                  ? { ...business.payment, status: "cancelled" }
                  : business.payment
              }
            : business
        )
      };
    });
    writeLocalStorage(BUSINESS_PAYMENT_KEY, "cancelled");
    notify({ title: "Subscription cancelled", description: "Listing moved to paused." });
  }, [notify]);

  const setUserStatus = useCallback(
    (userId: string, status: ResidentUser["status"]) => {
      setState((current) => ({
        ...current,
        residents: asArray(current.residents).map((user) =>
          user.id === userId ? { ...user, status } : user
        )
      }));
      notify({ title: `User marked ${status}` });
    },
    [notify]
  );

  const verifyUser = useCallback(
    (userId: string) => {
      setState((current) => ({
        ...current,
        residents: asArray(current.residents).map((user) =>
          user.id === userId ? { ...user, verified: true } : user
        )
      }));
      notify({ title: "User verified" });
    },
    [notify]
  );

  const setBusinessAdminStatus = useCallback(
    (businessId: string, status: BusinessStatus) => {
      setState((current) => ({
        ...current,
        businesses: asArray(current.businesses).map((business) =>
          business.id === businessId ? { ...business, status } : business
        )
      }));
      notify({ title: `Business status changed to ${status}` });
    },
    [notify]
  );

  const verifyBusiness = useCallback(
    (businessId: string) => {
      setState((current) => ({
        ...current,
        businesses: asArray(current.businesses).map((business) =>
          business.id === businessId ? { ...business, verified: true } : business
        )
      }));
      notify({ title: "Business verified" });
    },
    [notify]
  );

  const featureBusiness = useCallback(
    (businessId: string) => {
      setState((current) => ({
        ...current,
        businesses: asArray(current.businesses).map((business) =>
          business.id === businessId ? { ...business, featured: !business.featured } : business
        )
      }));
      notify({ title: "Feature status updated" });
    },
    [notify]
  );

  const setBusinessPaymentStatus = useCallback(
    (businessId: string, status: PaymentStatus) => {
      setState((current) => ({
        ...current,
        businessOwners: asArray(current.businessOwners).map((owner) => {
          const business = asArray(current.businesses).find((item) => item.id === businessId);
          return owner.id === business?.ownerId ? { ...owner, paymentStatus: status } : owner;
        }),
        businesses: asArray(current.businesses).map((business) =>
          business.id === businessId
            ? {
                ...business,
                payment: business.payment
                  ? { ...business.payment, status }
                  : {
                      planId: "starter",
                      planName: "Starter Local Listing",
                      amountPaid: 99,
                      paymentId: `admin_mock_${Date.now()}`,
                      status,
                      renewalDate: addMonthDate(),
                      paidAt: new Date().toISOString().slice(0, 10),
                      mock: true
                    }
              }
            : business
        )
      }));
      notify({ title: `Payment marked ${status}` });
    },
    [notify]
  );

  const removePostAdmin = useCallback(
    (postId: string) => {
      setState((current) => ({
        ...current,
        posts: asArray(current.posts).map((post) =>
          post.id === postId ? { ...post, status: "Removed" } : post
        )
      }));
      notify({ title: "Post removed" });
    },
    [notify]
  );

  const resolveReport = useCallback(
    (reportId: string) => {
      setState((current) => ({
        ...current,
        reports: asArray(current.reports).map((report) =>
          report.id === reportId ? { ...report, status: "Resolved" } : report
        )
      }));
      notify({ title: "Report resolved" });
    },
    [notify]
  );

  const value = useMemo<AppStoreContextValue>(
    () => ({
      state: safeState,
      hydrated,
      currentUser,
      currentBusinessOwner,
      currentBusiness,
      residentNotifications,
      businessNotifications,
      residentUnreadCount,
      businessUnreadCount,
      locationLabel,
      setLocation,
      signupResident,
      loginResident,
      logoutResident,
      updateResidentProfile,
      updatePrivacy,
      submitVerification,
      toggleInterest,
      offerHelp,
      addComment,
      toggleSaveBusiness,
      createPost,
      updatePost,
      deletePost,
      closePost,
      markSolved,
      acceptInterestedUser,
      rejectInterestedUser,
      submitReport,
      startPostChat,
      startBusinessChat,
      sendChatMessage,
      blockChat,
      signupBusiness,
      loginBusiness,
      logoutBusiness,
      markResidentNotificationsRead,
      markBusinessNotificationsRead,
      getBusinessNextRoute,
      completeBusinessPayment,
      failBusinessPayment,
      updateBusinessProfile,
      publishBusiness,
      setCurrentBusinessStatus,
      addBusinessOffer,
      cancelBusinessPlan,
      setUserStatus,
      verifyUser,
      setBusinessAdminStatus,
      verifyBusiness,
      featureBusiness,
      setBusinessPaymentStatus,
      removePostAdmin,
      resolveReport
    }),
    [
      acceptInterestedUser,
      addBusinessOffer,
      addComment,
      blockChat,
      businessNotifications,
      businessUnreadCount,
      cancelBusinessPlan,
      closePost,
      completeBusinessPayment,
      createPost,
      currentBusiness,
      currentBusinessOwner,
      currentUser,
      deletePost,
      failBusinessPayment,
      featureBusiness,
      getBusinessNextRoute,
      hydrated,
      locationLabel,
      loginBusiness,
      loginResident,
      logoutBusiness,
      logoutResident,
      markBusinessNotificationsRead,
      markResidentNotificationsRead,
      markSolved,
      offerHelp,
      publishBusiness,
      rejectInterestedUser,
      residentNotifications,
      residentUnreadCount,
      removePostAdmin,
      resolveReport,
      sendChatMessage,
      setBusinessAdminStatus,
      setBusinessPaymentStatus,
      setCurrentBusinessStatus,
      setLocation,
      setUserStatus,
      signupBusiness,
      signupResident,
      startBusinessChat,
      startPostChat,
      safeState,
      submitReport,
      submitVerification,
      toggleInterest,
      toggleSaveBusiness,
      updatePost,
      updateBusinessProfile,
      updatePrivacy,
      updateResidentProfile,
      verifyBusiness,
      verifyUser
    ]
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error("useAppStore must be used within AppStoreProvider");
  }

  return context;
}
