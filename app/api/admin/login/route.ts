import { NextResponse } from "next/server";
import {
  createAdminSession,
  isAdminAuthConfigured,
  validateAdminCredentials
} from "@/lib/admin-auth";

type AdminLoginBody = {
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json(
      { message: "Admin authentication is not configured." },
      { status: 500 }
    );
  }

  let body: AdminLoginBody;
  try {
    body = (await request.json()) as AdminLoginBody;
  } catch {
    return NextResponse.json(
      { message: "Invalid admin credentials." },
      { status: 401 }
    );
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!validateAdminCredentials(email, password)) {
    return NextResponse.json(
      { message: "Invalid admin credentials." },
      { status: 401 }
    );
  }

  await createAdminSession();
  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
