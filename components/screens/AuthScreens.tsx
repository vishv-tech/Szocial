"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { Building2, LocateFixed, LockKeyhole, MapPin, UserPlus } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/Button";
import { useAppStore } from "@/components/AppStoreProvider";
import { ProfileImageCropper } from "@/components/ProfileImageCropper";
import { useToast } from "@/components/ToastProvider";
import {
  createEmptyLocation,
  createManualLocation,
  getCurrentLocation,
  loadUserLocation,
  normalizeUserLocation,
  reverseGeocodeLocation,
  saveUserLocation
} from "@/lib/location";
import { loadImageFromFile, validateProfileImageFile } from "@/lib/image-crop";
import { getUserDisplayPhoto } from "@/lib/user-photo";
import type { BusinessCategory, LocationInfo, ResidentUser } from "@/types";

const businessCategories: BusinessCategory[] = [
  "Cafe",
  "Restaurant",
  "Salon",
  "Medical",
  "Store",
  "Gym",
  "Classes",
  "Other"
];

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-szocial-ink">
        {label}
        {required ? <span className="text-szocial-orange"> *</span> : null}
      </span>
      <input
        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-szocial-teal"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

function LocationFields({
  location,
  onChange
}: {
  location: LocationInfo;
  onChange: (location: LocationInfo) => void;
}) {
  return (
    <div className="grid gap-3 rounded-2xl bg-szocial-mist p-4 sm:grid-cols-2">
      <TextField
        label="City"
        onChange={(city) =>
          onChange({
            ...location,
            city,
            latitude: null,
            longitude: null,
            source: "manual"
          })
        }
        required
        value={location.city}
      />
      <TextField
        label="Area"
        onChange={(area) =>
          onChange({
            ...location,
            area,
            latitude: null,
            longitude: null,
            source: "manual"
          })
        }
        required
        value={location.area}
      />
      <div className="sm:col-span-2">
        <TextField
          label="Landmark"
          onChange={(landmark) =>
            onChange({
              ...location,
              landmark,
              latitude: null,
              longitude: null,
              source: "manual"
            })
          }
          placeholder="Near a known place"
          value={location.landmark ?? ""}
        />
      </div>
    </div>
  );
}

function useLocationCapture(initial?: LocationInfo) {
  const { notify } = useToast();
  const [manual, setManual] = useState(false);
  const [location, setLocation] = useState<LocationInfo>(
    () => initial ?? loadUserLocation() ?? createEmptyLocation()
  );

  const detect = async () => {
    try {
      const coordinates = await getCurrentLocation();
      const detected = await reverseGeocodeLocation(
        coordinates.latitude,
        coordinates.longitude
      );
      setLocation(detected);
      saveUserLocation(detected);
      notify({ title: "Location detected successfully" });
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

  return { location, setLocation, manual, setManual, detect };
}

export function ResidentSignupScreen() {
  const router = useRouter();
  const { signupResident } = useAppStore();
  const { notify } = useToast();
  const { location, setLocation, manual, setManual, detect } = useLocationCapture();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<ResidentUser["gender"]>("Prefer not to say");
  const [photoName, setPhotoName] = useState("No file selected");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<{
    fileName: string;
    src: string;
  } | null>(null);

  const updateManualLocation = (nextLocation: LocationInfo) => {
    setLocation(nextLocation);
    const manualLocation = createManualLocation(nextLocation);
    if (manualLocation) saveUserLocation(manualLocation);
  };

  const selectProfilePhoto = async (file?: File) => {
    if (!file) return;

    const validationMessage = validateProfileImageFile(file);
    if (validationMessage) {
      notify({ title: validationMessage, variant: "warning" });
      return;
    }

    try {
      const src = await loadImageFromFile(file);
      setPendingPhoto({ fileName: file.name, src });
    } catch {
      notify({ title: "Could not load this image. Try another photo.", variant: "warning" });
    }
  };

  const submit = () => {
    const missingFields = [
      !name.trim() ? "Full name" : "",
      !email.trim() ? "mobile/email" : "",
      !password.trim() ? "password" : ""
    ].filter(Boolean);

    if (missingFields.length) {
      const singleFieldMessages: Record<string, string> = {
        "Full name": "Please enter your full name.",
        "mobile/email": "Please enter your mobile number or email.",
        password: "Please enter your password."
      };
      notify({
        title:
          missingFields.length === 1
            ? singleFieldMessages[missingFields[0]]
            : `Please complete: ${missingFields.join(", ")}.`,
        variant: "warning"
      });
      return;
    }

    const savedLocation = loadUserLocation();
    const validLocation = normalizeUserLocation(location) ?? savedLocation;
    if (!validLocation) {
      setManual(true);
      notify({
        title: "Please allow location or enter your location manually.",
        variant: "warning"
      });
      return;
    }

    const registered = signupResident({
      name: name.trim(),
      email: email.trim(),
      mobile: mobile.trim() || undefined,
      password,
      age: age ? Number(age) : undefined,
      gender,
      profilePhoto: profilePhoto || undefined,
      profilePhotoName: profilePhoto ? photoName : undefined,
      location: validLocation
    });
    if (registered) router.push("/home");
  };

  return (
    <AuthLayout
      subtitle="Create a resident profile and start discovering local plans, help, and businesses."
      title="Join as resident"
    >
      <div className="space-y-4">
        <TextField label="Full name" onChange={setName} required value={name} />
        <TextField
          label="Mobile number or email"
          onChange={setEmail}
          placeholder="vishv@szocial.local"
          required
          type="email"
          value={email}
        />
        <TextField label="Mobile number" onChange={setMobile} value={mobile} />
        <TextField label="Password" onChange={setPassword} required type="password" value={password} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Age" onChange={setAge} type="number" value={age} />
          <label className="block">
            <span className="text-sm font-semibold text-szocial-ink">Gender optional</span>
            <select
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal"
              onChange={(event) => setGender(event.target.value as ResidentUser["gender"])}
              value={gender}
            >
              {["Prefer not to say", "Male", "Female", "Other"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block rounded-2xl border border-dashed border-slate-200 p-4">
          <span className="text-sm font-semibold text-szocial-ink">Profile photo optional</span>
          {profilePhoto ? (
            <img
              alt="Selected profile preview"
              className="mt-3 h-16 w-16 rounded-2xl object-cover"
              src={getUserDisplayPhoto({ name, profilePhoto })}
            />
          ) : null}
          <input
            accept="image/jpeg,image/png,image/webp"
            className="mt-2 block w-full text-sm text-szocial-muted"
            onChange={(event) => {
              void selectProfilePhoto(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
            type="file"
          />
          <span className="mt-2 block text-xs text-szocial-muted">{photoName}</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button onClick={detect} variant="secondary">
            <LocateFixed className="h-4 w-4" />
            Allow Location
          </Button>
          <Button onClick={() => setManual(true)} variant="outline">
            <MapPin className="h-4 w-4" />
            Enter Location Manually
          </Button>
        </div>
        {manual ? <LocationFields location={location} onChange={updateManualLocation} /> : null}
        <Button className="w-full" onClick={submit}>
          <UserPlus className="h-4 w-4" />
          Signup
        </Button>
        <p className="text-center text-sm text-szocial-muted">
          Already have an account?{" "}
          <Link className="font-semibold text-szocial-teal" href="/login">
            Login
          </Link>
        </p>
      </div>
      <ProfileImageCropper
        fileName={pendingPhoto?.fileName ?? ""}
        imageSrc={pendingPhoto?.src ?? ""}
        onCancel={() => setPendingPhoto(null)}
        onError={(message) => notify({ title: message, variant: "warning" })}
        onUsePhoto={(croppedPhoto) => {
          if (!pendingPhoto) return;
          setProfilePhoto(croppedPhoto);
          setPhotoName(pendingPhoto.fileName);
          setPendingPhoto(null);
        }}
        open={Boolean(pendingPhoto)}
      />
    </AuthLayout>
  );
}

export function ResidentLoginScreen() {
  const router = useRouter();
  const { loginResident } = useAppStore();
  const [identifier, setIdentifier] = useState("vishv@szocial.local");
  const [password, setPassword] = useState("demo123");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 150));
      if (loginResident(identifier, password)) {
        router.push("/home");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      subtitle="Login with your mock resident account or a profile you created locally."
      title="Resident login"
    >
      <form className="space-y-4" onSubmit={submit}>
        <TextField label="Email or mobile" onChange={setIdentifier} required value={identifier} />
        <TextField label="Password" onChange={setPassword} required type="password" value={password} />
        <Button
          className="w-full"
          disabled={submitting}
          type="submit"
        >
          <LockKeyhole className="h-4 w-4" />
          {submitting ? "Logging in..." : "Login"}
        </Button>
        <p className="text-center text-sm text-szocial-muted">
          New here?{" "}
          <Link className="font-semibold text-szocial-teal" href="/signup">
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export function BusinessSignupScreen() {
  const router = useRouter();
  const { signupBusiness } = useAppStore();
  const { notify } = useToast();
  const { location, setLocation, manual, setManual, detect } = useLocationCapture();
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState<BusinessCategory>("Cafe");
  const [address, setAddress] = useState("");

  const submit = () => {
    if (!ownerName || !email || !password || !businessName || !address) {
      notify({ title: "Missing required business fields", variant: "warning" });
      return;
    }
    signupBusiness({ ownerName, email, password, businessName, category, address, location });
    router.push("/business/pricing");
  };

  return (
    <AuthLayout
      subtitle="Create your business owner account, choose a paid listing plan, then setup your public listing."
      title="List your business"
    >
      <div className="space-y-4">
        <TextField label="Owner name" onChange={setOwnerName} required value={ownerName} />
        <TextField label="Mobile/email" onChange={setEmail} required value={email} />
        <TextField label="Password" onChange={setPassword} required type="password" value={password} />
        <TextField label="Business name" onChange={setBusinessName} required value={businessName} />
        <label className="block">
          <span className="text-sm font-semibold text-szocial-ink">Business category *</span>
          <select
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal"
            onChange={(event) => setCategory(event.target.value as BusinessCategory)}
            value={category}
          >
            {businessCategories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <TextField label="Business address" onChange={setAddress} required value={address} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Button onClick={detect} variant="secondary">
            <LocateFixed className="h-4 w-4" />
            Allow Location
          </Button>
          <Button onClick={() => setManual(true)} variant="outline">
            <MapPin className="h-4 w-4" />
            Enter Manually
          </Button>
        </div>
        {manual ? <LocationFields location={location} onChange={setLocation} /> : null}
        <Button className="w-full" onClick={submit}>
          <Building2 className="h-4 w-4" />
          Create Business Account
        </Button>
        <p className="text-center text-sm text-szocial-muted">
          Already listed?{" "}
          <Link className="font-semibold text-szocial-teal" href="/business/login">
            Business login
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export function BusinessLoginScreen() {
  const router = useRouter();
  const { loginBusiness } = useAppStore();
  const [identifier, setIdentifier] = useState("owner@mocha.local");
  const [password, setPassword] = useState("demo123");

  return (
    <AuthLayout
      subtitle="Login to manage listing plans, business details, chats, offers, and analytics."
      title="Business login"
    >
      <div className="space-y-4">
        <TextField label="Business email" onChange={setIdentifier} required value={identifier} />
        <TextField label="Password" onChange={setPassword} required type="password" value={password} />
        <Button
          className="w-full"
          onClick={() => {
            const route = loginBusiness(identifier, password);
            if (route) router.push(route);
          }}
        >
          <LockKeyhole className="h-4 w-4" />
          Login
        </Button>
        <p className="text-center text-sm text-szocial-muted">
          Need a listing?{" "}
          <Link className="font-semibold text-szocial-teal" href="/business/signup">
            Create business account
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
