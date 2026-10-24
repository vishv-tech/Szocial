export type LocationInfo = {
  city: string;
  area: string;
  landmark?: string;
  latitude?: number | null;
  longitude?: number | null;
  state?: string;
  country?: string;
  formattedAddress?: string;
  source?: "gps" | "manual" | "fallback";
  updatedAt?: string;
};

export type ResidentUser = {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  avatar: string;
  avatarPath?: string;
  profilePhoto?: string;
  profilePhotoName?: string;
  updatedAt?: string;
  age?: number;
  gender?: "Male" | "Female" | "Other" | "Prefer not to say";
  location: LocationInfo;
  verified: boolean;
  bio: string;
  status: "Active" | "Banned";
  joinedDate: string;
  reports: number;
  privacy: {
    showAge: boolean;
    showExactArea: boolean;
    allowDirectMessages: boolean;
  };
};

export type PostType = "fun" | "help";
export type PostStatus = "Active" | "Completed" | "Draft" | "Solved" | "Removed";
export type ContactPreference = "Chat only" | "Call after approval";

export type PostComment = {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
};

export type LocalPost = {
  imagePaths?: string[];
  images?: string[];
  id: string;
  type: PostType;
  category: string;
  title: string;
  description: string;
  authorId: string;
  location: LocationInfo;
  landmark?: string;
  createdAt: string;
  updatedAt?: string;
  date?: string;
  time?: string;
  neededPeople?: number;
  genderPreference?: "Any" | "Male" | "Female" | "Mixed group";
  ageGroup?: "Any" | "13-17" | "18-24" | "25-35" | "35+";
  visibility?: "Public" | "Nearby only" | "Private after approval";
  urgency?: "Normal" | "Urgent";
  budget?: string;
  contactPreference: ContactPreference;
  status: PostStatus;
  interestedUserIds: string[];
  acceptedUserIds: string[];
  savedByUserIds: string[];
  reports: number;
  comments: PostComment[];
  distanceKm: number;
};

export type BusinessCategory =
  | "Cafe"
  | "Restaurant"
  | "Salon"
  | "Medical"
  | "Store"
  | "Gym"
  | "Classes"
  | "Other";

export type BusinessStatus = "Draft" | "Live" | "Paused" | "Pending Approval" | "Removed";
export type PaymentStatus = "unpaid" | "paid" | "failed" | "cancelled" | "created" | "refunded";

export type PaymentPlan = {
  id: "starter" | "growth" | "premium";
  name: string;
  price: number;
  amountPaise: number;
  description: string;
  features: string[];
  highlight?: boolean;
};

export type BusinessPayment = {
  planId: PaymentPlan["id"];
  planName: string;
  amountPaid: number;
  paymentId: string;
  status: PaymentStatus;
  renewalDate: string;
  paidAt: string;
  mock: boolean;
};

export type BusinessOwner = {
  id: string;
  ownerName: string;
  email: string;
  businessId: string;
  paymentStatus: PaymentStatus;
};

export type Business = {
  id: string;
  ownerId: string;
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
  priceRange: "Budget" | "Mid-range" | "Premium";
  status: BusinessStatus;
  openStatus: "Open" | "Closed";
  verified: boolean;
  featured: boolean;
  listedByResidents: boolean;
  coverImage: string;
  logo: string;
  mediaPaths?: {logo:string;coverImage:string;gallery:string[]};
  gallery: string[];
  rating: number;
  reviews: number;
  views: number;
  saves: number;
  messages: number;
  createdAt: string;
  updatedAt?: string;
  offerCreatedAt?: Record<string, string>;
  payment?: BusinessPayment;
};

export type ChatType = "Fun" | "Help" | "Business";

export type ChatMessage = {
  id: string;
  senderId: string;
  senderType?: "resident" | "business";
  text: string;
  createdAt: string;
  kind?: "text" | "image" | "location" | "system";
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
  locationLabel?: string;
};

export type ChatParticipant = {
  id: string;
  participantType: "resident" | "business";
  name: string;
  profilePhoto?: string;
  location?: string;
};

export type Chat = {
  id: string;
  type: ChatType;
  name: string;
  avatar: string;
  location: string;
  status: "Active" | "Blocked" | "Left";
  historyHasMore?: boolean;
  blockedByIds?: string[];
  blockedById?: string;
  blockedByType?: "resident" | "business";
  blockedAt?: string;
  participantIds: string[];
  participants?: ChatParticipant[];
  createdAt?: string;
  updatedAt?: string;
  lastMessageAt?: string;
  businessId?: string;
  postId?: string;
  unread: number;
  readAtByParticipant?: Record<string, string>;
  messages: ChatMessage[];
};

export type ReportReason =
  | "Spam"
  | "Fake post"
  | "Unsafe"
  | "Harassment"
  | "Wrong category"
  | "Fake listing"
  | "Wrong location"
  | "Closed permanently"
  | "Other";

export type Report = {
  id: string;
  itemType: "Post" | "User" | "Business" | "Chat";
  itemId: string;
  itemLabel: string;
  reason: ReportReason;
  reportedBy: string;
  reportedUserIds?: string[];
  status: "Open" | "Resolved";
  createdAt: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  description: string;
  type: "Join request" | "Chat update" | "Business offer" | "Help reply";
};

export type NotificationType =
  | "interest"
  | "comment"
  | "message"
  | "business_message"
  | "business_interest"
  | "accepted"
  | "business_offer"
  | "moderation"
  | "system";

export type NotificationRecipientType = "resident" | "business";

export type SzocialNotification = {
  id: string;
  recipientId: string;
  recipientType: NotificationRecipientType;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  type: NotificationType;
  title: string;
  message: string;
  entityId?: string;
  entityType?: "post" | "help_post" | "business" | "chat" | "comment" | "report";
  postId?: string;
  businessId?: string;
  chatId?: string;
  isRead: boolean;
  createdAt: string;
};

export type PaymentHistoryRow = {
  mode?: 'test'|'live';
  refundedAmount?: number;
  id: string;
  date: string;
  businessId: string;
  planName: string;
  amount: number;
  status: PaymentStatus;
  paymentId: string;
};

export type AppState = {
  residents: ResidentUser[];
  posts: LocalPost[];
  businesses: Business[];
  businessOwners: BusinessOwner[];
  chats: Chat[];
  reports: Report[];
  notifications: NotificationItem[];
  paymentPlans: PaymentPlan[];
  paymentHistory: PaymentHistoryRow[];
  currentUserId: string | null;
  currentBusinessOwnerId: string | null;
  location: LocationInfo;
};
