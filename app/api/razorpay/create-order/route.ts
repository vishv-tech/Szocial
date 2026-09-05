import { NextResponse } from "next/server";
import { pricingPlans } from "@/lib/mock-data";

type CreateOrderBody = {
  planId?: string;
  amount?: number;
  businessOwnerId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as CreateOrderBody;
  const plans = Array.isArray(pricingPlans) ? pricingPlans : [];
  const plan = plans.find((item) => item.id === body.planId) ?? plans[0];
  if (!plan) {
    return NextResponse.json(
      { error: "No pricing plans are available." },
      { status: 400 }
    );
  }
  const amount = body.amount ?? plan.amountPaise;
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.warn("Razorpay keys missing. Using mock payment mode.");
    return NextResponse.json({
      mock: true,
      orderId: `order_mock_${Date.now()}`,
      amount,
      currency: "INR",
      keyId: "mock_key",
      plan
    });
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount,
      currency: "INR",
      receipt: `szocial_${body.businessOwnerId ?? "business"}_${Date.now()}`
    })
  });

  if (!response.ok) {
    return NextResponse.json(
      {
        mock: true,
        orderId: `order_mock_${Date.now()}`,
        amount,
        currency: "INR",
        keyId,
        plan,
        warning: "Razorpay order creation failed. Using mock payment mode."
      },
      { status: 200 }
    );
  }

  const order = (await response.json()) as { id: string; amount: number; currency: string };

  return NextResponse.json({
    mock: false,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId,
    plan
  });
}
