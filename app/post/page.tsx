import { Suspense } from "react";
import { CreatePostScreen } from "@/components/screens/ResidentScreens";

export default function PostPage() {
  return (
    <Suspense>
      <CreatePostScreen />
    </Suspense>
  );
}
