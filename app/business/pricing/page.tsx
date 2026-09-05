import { Suspense } from "react";
import { BusinessPricingScreen } from "@/components/screens/BusinessScreens";

export default function BusinessPricingPage() {
  return (
    <Suspense>
      <BusinessPricingScreen />
    </Suspense>
  );
}
