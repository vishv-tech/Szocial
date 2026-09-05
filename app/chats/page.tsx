import { Suspense } from "react";
import { ChatsScreen } from "@/components/screens/ResidentScreens";

export default function ChatsPage() {
  return (
    <Suspense>
      <ChatsScreen />
    </Suspense>
  );
}
