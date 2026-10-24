import type {
  AppState,
  Business,
  BusinessOwner,
  Chat,
  LocalPost,
  NotificationItem,
  PaymentHistoryRow,
  PaymentPlan,
  Report,
  ResidentUser
} from "@/types";

const bandraEast = { area: "Bandra East", city: "Mumbai", landmark: "Near MIG Club" };
const bandraWest = { area: "Bandra West", city: "Mumbai", landmark: "Near Linking Road" };
const matunga = { area: "Matunga", city: "Mumbai", landmark: "Five Gardens" };
const khar = { area: "Khar", city: "Mumbai", landmark: "16th Road" };
const unsetUserLocation = { area: "", city: "", source: "fallback" as const };

export const sampleResidents: ResidentUser[] = [
  {
    id: "user-vishv",
    name: "Vishv Lange",
    email: "vishv@szocial.local",
    mobile: "9876543210",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    age: 22,
    gender: "Male",
    location: bandraEast,
    verified: true,
    bio: "Always up for cricket, coffee, startup chats, and local food finds.",
    status: "Active",
    joinedDate: "2026-01-12",
    reports: 0,
    privacy: {
      showAge: true,
      showExactArea: false,
      allowDirectMessages: true
    }
  },
  {
    id: "user-aarya",
    name: "Aarya Mehta",
    email: "aarya@szocial.local",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
    age: 24,
    gender: "Female",
    location: bandraWest,
    verified: true,
    bio: "Movies, cafes, Sunday walks, and good book recommendations.",
    status: "Active",
    joinedDate: "2026-02-03",
    reports: 0,
    privacy: {
      showAge: true,
      showExactArea: true,
      allowDirectMessages: true
    }
  },
  {
    id: "user-rohan",
    name: "Rohan Shah",
    email: "rohan@szocial.local",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80",
    age: 29,
    gender: "Male",
    location: matunga,
    verified: false,
    bio: "Tutor recommendations, tech meetups, and local sports.",
    status: "Active",
    joinedDate: "2026-03-17",
    reports: 1,
    privacy: {
      showAge: false,
      showExactArea: false,
      allowDirectMessages: true
    }
  },
  {
    id: "user-sana",
    name: "Sana Khan",
    email: "sana@szocial.local",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    age: 26,
    gender: "Female",
    location: khar,
    verified: false,
    bio: "Fitness, volunteering, lost-and-found alerts, and Khar food spots.",
    status: "Active",
    joinedDate: "2026-04-02",
    reports: 0,
    privacy: {
      showAge: true,
      showExactArea: false,
      allowDirectMessages: true
    }
  }
];

export const samplePosts: LocalPost[] = [
  {
    id: "post-cricket",
    type: "fun",
    category: "Cricket",
    title: "Need 2 people for cricket today",
    description:
      "7 PM cricket at Five Gardens, anyone up? We are short by two players and keeping it friendly.",
    authorId: "user-aarya",
    location: matunga,
    landmark: "Five Gardens",
    createdAt: "2026-06-12T11:40:00.000Z",
    date: "2026-05-24",
    time: "7:00 PM",
    neededPeople: 2,
    genderPreference: "Any",
    ageGroup: "18-24",
    visibility: "Public",
    contactPreference: "Chat only",
    status: "Active",
    interestedUserIds: ["user-vishv"],
    acceptedUserIds: [],
    savedByUserIds: [],
    reports: 0,
    comments: [
      {
        id: "comment-1",
        userId: "user-vishv",
        text: "I can join if you still need one more.",
        createdAt: "2026-06-12T11:50:00.000Z"
      }
    ],
    distanceKm: 2.1
  },
  {
    id: "post-movie",
    type: "fun",
    category: "Movie",
    title: "Movie plan tonight?",
    description: "Thinking of catching a late show around Bandra. Open to comedy or thriller.",
    authorId: "user-vishv",
    location: bandraWest,
    landmark: "Bandra",
    createdAt: "2026-06-12T10:50:00.000Z",
    date: "2026-05-24",
    time: "8:00 PM",
    neededPeople: 3,
    genderPreference: "Mixed group",
    ageGroup: "18-24",
    visibility: "Nearby only",
    contactPreference: "Chat only",
    status: "Active",
    interestedUserIds: ["user-aarya"],
    acceptedUserIds: ["user-aarya"],
    savedByUserIds: ["user-sana"],
    reports: 0,
    comments: [],
    distanceKm: 1.4
  },
  {
    id: "post-walk",
    type: "fun",
    category: "Walking",
    title: "Morning walk group",
    description: "Slow-paced Carter Road walk followed by chai. New neighbours welcome.",
    authorId: "user-sana",
    location: bandraWest,
    landmark: "Carter Road",
    createdAt: "2026-06-11T14:45:00.000Z",
    date: "2026-05-25",
    time: "6:00 AM",
    neededPeople: 5,
    genderPreference: "Any",
    ageGroup: "Any",
    visibility: "Public",
    contactPreference: "Chat only",
    status: "Active",
    interestedUserIds: [],
    acceptedUserIds: [],
    savedByUserIds: [],
    reports: 0,
    comments: [],
    distanceKm: 1.9
  },
  {
    id: "post-hiking",
    type: "fun",
    category: "Hiking",
    title: "Weekend hiking plan",
    description: "Sunday morning group trail at Sanjay Gandhi National Park. Beginners are okay.",
    authorId: "user-rohan",
    location: { area: "Borivali", city: "Mumbai", landmark: "Sanjay Gandhi National Park" },
    landmark: "Main gate",
    createdAt: "2026-06-11T13:00:00.000Z",
    date: "2026-05-31",
    time: "7:00 AM",
    neededPeople: 4,
    genderPreference: "Any",
    ageGroup: "25-35",
    visibility: "Public",
    contactPreference: "Chat only",
    status: "Active",
    interestedUserIds: ["user-aarya"],
    acceptedUserIds: [],
    savedByUserIds: ["user-vishv"],
    reports: 0,
    comments: [],
    distanceKm: 14.2
  },
  {
    id: "help-tutor",
    type: "help",
    category: "Tutor",
    title: "Need maths teacher for Class 8",
    description:
      "Looking for a patient maths teacher near Bandra East for three classes a week.",
    authorId: "user-rohan",
    location: bandraEast,
    landmark: "Near Kalanagar",
    createdAt: "2026-06-12T10:15:00.000Z",
    urgency: "Normal",
    budget: "Rs. 300/hour",
    contactPreference: "Chat only",
    status: "Active",
    interestedUserIds: ["user-vishv"],
    acceptedUserIds: [],
    savedByUserIds: [],
    reports: 0,
    comments: [],
    distanceKm: 0.8
  },
  {
    id: "help-plumber",
    type: "help",
    category: "Plumber",
    title: "Need plumber urgently",
    description: "Kitchen sink pipe is leaking. Need someone reliable today.",
    authorId: "user-sana",
    location: khar,
    landmark: "Khar station side",
    createdAt: "2026-06-12T09:00:00.000Z",
    urgency: "Urgent",
    budget: "Negotiable",
    contactPreference: "Call after approval",
    status: "Active",
    interestedUserIds: [],
    acceptedUserIds: [],
    savedByUserIds: [],
    reports: 0,
    comments: [],
    distanceKm: 2.6
  },
  {
    id: "help-wallet",
    type: "help",
    category: "Lost and found",
    title: "Lost brown wallet near Linking Road",
    description: "Brown wallet with cards, probably dropped near a shoe store. Please ping if found.",
    authorId: "user-aarya",
    location: bandraWest,
    landmark: "Linking Road",
    createdAt: "2026-06-12T06:45:00.000Z",
    urgency: "Urgent",
    contactPreference: "Chat only",
    status: "Active",
    interestedUserIds: [],
    acceptedUserIds: [],
    savedByUserIds: ["user-vishv"],
    reports: 0,
    comments: [],
    distanceKm: 1.1
  }
];

export const sampleBusinessOwners: BusinessOwner[] = [
  {
    id: "owner-mocha",
    ownerName: "Kabir Fernandes",
    email: "owner@mocha.local",
    businessId: "biz-mocha",
    paymentStatus: "paid"
  }
];

export const sampleBusinesses: Business[] = [
  {
    id: "biz-mocha",
    ownerId: "owner-mocha",
    name: "The Mocha House",
    category: "Cafe",
    address: "Shop 4, Bandra East, Mumbai",
    location: bandraEast,
    phone: "+919876543210",
    whatsapp: "+919876543210",
    mapsLink: "https://maps.google.com/?q=Bandra+East+Mumbai",
    hours: "8 AM - 10 PM",
    about:
      "A newly opened premium cafe with warm interiors, coffee, snacks, and a cozy neighbourhood vibe.",
    services: ["Coffee", "Sandwiches", "Desserts", "Remote work tables"],
    offers: ["10% off on first visit"],
    tags: ["New in Bandra", "Coffee", "Snacks"],
    priceRange: "Mid-range",
    status: "Live",
    openStatus: "Open",
    verified: true,
    featured: true,
    listedByResidents: true,
    coverImage:
      "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80",
    logo:
      "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=900&q=80"
    ],
    rating: 4.8,
    reviews: 42,
    views: 1240,
    saves: 212,
    messages: 38,
    createdAt: "2026-05-24T04:30:00.000Z",
    updatedAt: "2026-06-10T09:00:00.000Z",
    offerCreatedAt: {
      "10% off on first visit": "2026-06-10T09:00:00.000Z"
    },
    payment: {
      planId: "premium",
      planName: "Premium Local Boost",
      amountPaid: 799,
      paymentId: "pay_demo_mocha",
      status: "paid",
      renewalDate: "2026-06-24",
      paidAt: "2026-05-24",
      mock: true
    }
  },
  {
    id: "biz-glowup",
    ownerId: "owner-glowup",
    name: "GlowUp Salon",
    category: "Salon",
    address: "Linking Road, Bandra West, Mumbai",
    location: bandraWest,
    phone: "+919811112222",
    hours: "10 AM - 9 PM",
    about: "Haircuts, styling, grooming, and quick beauty services for the neighbourhood.",
    services: ["Haircut", "Styling", "Facial", "Nail care"],
    offers: ["Free hair spa consultation"],
    tags: ["Salon", "Grooming", "Verified"],
    priceRange: "Premium",
    status: "Live",
    openStatus: "Open",
    verified: true,
    featured: false,
    listedByResidents: false,
    coverImage:
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80",
    logo:
      "https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=200&q=80",
    gallery: [],
    rating: 4.7,
    reviews: 31,
    views: 812,
    saves: 94,
    messages: 18,
    createdAt: "2026-05-20T05:30:00.000Z",
    updatedAt: "2026-06-08T08:00:00.000Z",
    offerCreatedAt: {
      "Free hair spa consultation": "2026-06-08T08:00:00.000Z"
    },
    payment: {
      planId: "growth",
      planName: "Growth Listing",
      amountPaid: 299,
      paymentId: "pay_demo_glow",
      status: "paid",
      renewalDate: "2026-06-20",
      paidAt: "2026-05-20",
      mock: true
    }
  },
  {
    id: "biz-fitzone",
    ownerId: "owner-fitzone",
    name: "FitZone Gym",
    category: "Gym",
    address: "16th Road, Khar, Mumbai",
    location: khar,
    phone: "+919822223333",
    hours: "6 AM - 11 PM",
    about: "Strength, cardio, functional training, and beginner-friendly workout plans.",
    services: ["Weights", "Cardio", "Personal training", "Yoga"],
    offers: ["Trial day free"],
    tags: ["Gym", "Fitness", "Trial"],
    priceRange: "Mid-range",
    status: "Live",
    openStatus: "Open",
    verified: true,
    featured: false,
    listedByResidents: false,
    coverImage:
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80",
    logo:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&q=80",
    gallery: [],
    rating: 4.6,
    reviews: 58,
    views: 940,
    saves: 121,
    messages: 24,
    createdAt: "2026-04-18T06:00:00.000Z",
    offerCreatedAt: {
      "Trial day free": "2026-05-02T06:00:00.000Z"
    }
  },
  {
    id: "biz-careplus",
    ownerId: "owner-careplus",
    name: "CarePlus Medical",
    category: "Medical",
    address: "Bandra East, Mumbai",
    location: bandraEast,
    phone: "+919833334444",
    hours: "24 hours",
    about: "Local medical store with essentials, delivery support, and pharmacist guidance.",
    services: ["Medicines", "Wellness products", "Local delivery"],
    offers: ["Free BP check on Sundays"],
    tags: ["Medical", "24 hours", "Delivery"],
    priceRange: "Budget",
    status: "Pending Approval",
    openStatus: "Open",
    verified: false,
    featured: false,
    listedByResidents: false,
    coverImage:
      "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80",
    logo:
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=200&q=80",
    gallery: [],
    rating: 4.5,
    reviews: 19,
    views: 530,
    saves: 68,
    messages: 10,
    createdAt: "2026-03-12T07:00:00.000Z",
    offerCreatedAt: {
      "Free BP check on Sundays": "2026-04-05T07:00:00.000Z"
    }
  },
  {
    id: "biz-urban-bites",
    ownerId: "owner-urban",
    name: "Urban Bites",
    category: "Restaurant",
    address: "Matunga, Mumbai",
    location: matunga,
    phone: "+919844445555",
    hours: "11 AM - 11 PM",
    about: "Modern casual restaurant with comfort food, quick bites, and family tables.",
    services: ["Lunch", "Dinner", "Takeaway", "Family seating"],
    offers: ["Buy one mocktail, get one free"],
    tags: ["Restaurant", "Family", "New"],
    priceRange: "Mid-range",
    status: "Live",
    openStatus: "Open",
    verified: false,
    featured: false,
    listedByResidents: true,
    coverImage:
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",
    logo:
      "https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=200&q=80",
    gallery: [],
    rating: 4.4,
    reviews: 27,
    views: 620,
    saves: 74,
    messages: 14,
    createdAt: "2026-05-05T08:00:00.000Z",
    offerCreatedAt: {
      "Buy one mocktail, get one free": "2026-05-28T08:00:00.000Z"
    }
  }
];

export const sampleChats: Chat[] = [
  {
    id: "chat-cricket",
    type: "Fun",
    name: "Aarya - Cricket plan",
    avatar: sampleResidents[1].avatar,
    location: "Five Gardens, Matunga",
    status: "Active",
    participantIds: ["user-vishv", "user-aarya"],
    postId: "post-cricket",
    createdAt: "2026-06-12T11:42:00.000Z",
    updatedAt: "2026-06-12T11:44:00.000Z",
    lastMessageAt: "2026-06-12T11:44:00.000Z",
    unread: 2,
    messages: [
      {
        id: "msg-1",
        senderId: "user-aarya",
        text: "We still need one more for cricket at 7.",
        createdAt: "2026-06-12T11:42:00.000Z"
      },
      {
        id: "msg-2",
        senderId: "user-vishv",
        text: "I am available. Should I bring an extra bat?",
        createdAt: "2026-06-12T11:44:00.000Z"
      }
    ]
  },
  {
    id: "chat-tutor",
    type: "Help",
    name: "Rohan - Maths tutor",
    avatar: sampleResidents[2].avatar,
    location: "Bandra East",
    status: "Active",
    participantIds: ["user-vishv", "user-rohan"],
    postId: "help-tutor",
    createdAt: "2026-06-12T10:20:00.000Z",
    updatedAt: "2026-06-12T10:20:00.000Z",
    lastMessageAt: "2026-06-12T10:20:00.000Z",
    unread: 0,
    messages: [
      {
        id: "msg-3",
        senderId: "user-rohan",
        text: "Do you know someone who teaches Class 8 maths?",
        createdAt: "2026-06-12T10:20:00.000Z"
      }
    ]
  },
  {
    id: "chat-mocha",
    type: "Business",
    name: "The Mocha House",
    avatar: sampleBusinesses[0].logo,
    location: "Bandra East",
    status: "Active",
    participantIds: ["user-vishv", "owner-mocha"],
    businessId: "biz-mocha",
    createdAt: "2026-06-11T10:30:00.000Z",
    updatedAt: "2026-06-11T10:30:00.000Z",
    lastMessageAt: "2026-06-11T10:30:00.000Z",
    unread: 1,
    messages: [
      {
        id: "msg-4",
        senderId: "owner-mocha",
        text: "Your 10% first-visit offer is available this week.",
        createdAt: "2026-06-11T10:30:00.000Z"
      }
    ]
  }
];

export const sampleNotifications: NotificationItem[] = [
  {
    id: "notif-1",
    type: "Join request",
    title: "Aarya accepted your cricket interest",
    description: "Chat is open for the Five Gardens plan."
  },
  {
    id: "notif-2",
    type: "Business offer",
    title: "The Mocha House has a new offer",
    description: "10% off on first visit for Szocial neighbours."
  },
  {
    id: "notif-3",
    type: "Help reply",
    title: "Rohan replied to maths tutor help",
    description: "He asked for tutor recommendations near Bandra East."
  }
];

export const paymentPlans: PaymentPlan[] = [
  {
    id: "starter",
    name: "Starter Local Listing",
    price: 99,
    amountPaise: 9900,
    description: "Launch a simple trusted local presence.",
    features: [
      "Basic business listing",
      "Add shop name, address, images",
      "Appear in New in Location",
      "Users can save and share listing",
      "Basic chat access"
    ]
  },
  {
    id: "growth",
    name: "Growth Listing",
    price: 299,
    amountPaise: 29900,
    description: "Grow visibility with offers and analytics.",
    features: [
      "Everything in Starter",
      "Higher visibility in local category",
      "Add offers and discounts",
      "Business chat access",
      "Basic analytics",
      "Verified business badge placeholder"
    ],
    highlight: true
  },
  {
    id: "premium",
    name: "Premium Local Boost",
    price: 799,
    amountPaise: 79900,
    description: "Feature your business in local discovery.",
    features: [
      "Everything in Growth",
      "Featured placement in New in Location",
      "Top category placement",
      "More photos",
      "Promotion badge",
      "Advanced analytics mock UI"
    ]
  }
];

export const sampleReports: Report[] = [
  {
    id: "report-1",
    itemType: "Post",
    itemId: "help-wallet",
    itemLabel: "Lost brown wallet near Linking Road",
    reason: "Wrong category",
    reportedBy: "user-vishv",
    status: "Open",
    createdAt: "2026-06-12T08:00:00.000Z"
  }
];

export const samplePaymentHistory: PaymentHistoryRow[] = [
  {
    id: "pay-row-1",
    date: "2026-05-24",
    businessId: "biz-mocha",
    planName: "Premium Local Boost",
    amount: 799,
    status: "paid",
    paymentId: "pay_demo_mocha"
  },
  {
    id: "pay-row-2",
    date: "2026-05-20",
    businessId: "biz-glowup",
    planName: "Growth Listing",
    amount: 299,
    status: "paid",
    paymentId: "pay_demo_glow"
  }
];

const safeSampleResidents = Array.isArray(sampleResidents) ? sampleResidents : [];
const safeSamplePosts = Array.isArray(samplePosts) ? samplePosts : [];
const safeSampleBusinessOwners = Array.isArray(sampleBusinessOwners) ? sampleBusinessOwners : [];
const safeSampleBusinesses = Array.isArray(sampleBusinesses) ? sampleBusinesses : [];
const safeSampleChats = Array.isArray(sampleChats) ? sampleChats : [];
const safeSampleReports = Array.isArray(sampleReports) ? sampleReports : [];
const safeSampleNotifications = Array.isArray(sampleNotifications) ? sampleNotifications : [];
const safePaymentPlans = Array.isArray(paymentPlans) ? paymentPlans : [];
const safeSamplePaymentHistory = Array.isArray(samplePaymentHistory) ? samplePaymentHistory : [];

export const initialAppState: AppState = {
  residents: safeSampleResidents,
  posts: safeSamplePosts,
  businesses: safeSampleBusinesses,
  businessOwners: safeSampleBusinessOwners,
  chats: safeSampleChats,
  reports: safeSampleReports,
  notifications: safeSampleNotifications,
  paymentPlans: safePaymentPlans,
  paymentHistory: safeSamplePaymentHistory,
  currentUserId: safeSampleResidents[0]?.id ?? null,
  currentBusinessOwnerId: null,
  location: unsetUserLocation
};

export const mockUsers = safeSampleResidents;
export const mockCurrentUser = safeSampleResidents[0];
export const mockPosts = safeSamplePosts;
export const mockFunPosts = safeSamplePosts.filter((post) => post.type === "fun");
export const mockHelpPosts = safeSamplePosts.filter((post) => post.type === "help");
export const mockBusinesses = safeSampleBusinesses;
export const mockChats = safeSampleChats;
export const mockMessages = safeSampleChats.flatMap((chat) =>
  Array.isArray(chat.messages) ? chat.messages : []
);
export const mockNotifications = safeSampleNotifications;
export const mockReports = safeSampleReports;
export const mockStats = [
  { label: "Local posts", value: String(safeSamplePosts.length) },
  { label: "Businesses", value: String(safeSampleBusinesses.length) },
  { label: "Active chats", value: String(safeSampleChats.length) }
];
export const mockAdminStats = [
  { label: "Total users", value: String(safeSampleResidents.length) },
  { label: "Total businesses", value: String(safeSampleBusinesses.length) },
  { label: "Total posts", value: String(safeSamplePosts.length) },
  { label: "Reports", value: String(safeSampleReports.length) }
];
export const pricingPlans = safePaymentPlans;
