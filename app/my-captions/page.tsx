import CaptionCollection from "@/app/gallery/CaptionCollection";

export default async function MyCaptionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  return <CaptionCollection mine requestedPage={(await searchParams).page} />;
}
