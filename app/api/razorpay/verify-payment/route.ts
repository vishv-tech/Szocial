import crypto from "node:crypto";
import { NextResponse } from "next/server";

type VerifyPaymentBody = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  planId?: string;
  businessOwnerId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as VerifyPaymentBody;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret) {
    console.warn("Razorpay keys missing. Using mock payment verification.");
    return NextResponse.json({ success: true, mock: true });
  }

  if (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) {
    return NextResponse.json({ success: false, mock: false }, { status: 400 });
  }

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
    .digest("hex");

  return NextResponse.json({
    success: expectedSignature === body.razorpay_signature,
    mock: false
  });
}
