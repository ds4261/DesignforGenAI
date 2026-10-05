import CaptionCollection from "./CaptionCollection";

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  return <CaptionCollection requestedPage={(await searchParams).page} />;
}
