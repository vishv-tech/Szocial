import { BusinessDetailScreen } from "@/components/screens/ResidentScreens";

type BusinessDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BusinessDetailPage({ params }: BusinessDetailPageProps) {
  const { id } = await params;
  return <BusinessDetailScreen businessId={id} />;
}
