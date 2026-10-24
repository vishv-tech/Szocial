import type { ResidentUser, BusinessCategory, LocationInfo, PostType, LocalPost, ContactPreference, Business } from "@/types";
export type ResidentSignupInput = {
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

export type BusinessSignupInput = {
  ownerName: string;
  email: string;
  password: string;
  businessName: string;
  category: BusinessCategory;
  address: string;
  location: LocationInfo;
};

export type CreatePostInput = {
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

export type SendChatMessageInput = {
  text: string;
  kind?: "text" | "location";
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
  locationLabel?: string;
};

export type BusinessProfileInput = {
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

