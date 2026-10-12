import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import CaptionForm from "./CaptionForm";

export default async function CaptionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="page-shell">
      <nav className="nav-links">
        <Link href="/" className="hover:underline">Home</Link>
        <Link href="/gallery" className="hover:underline">Gallery</Link>
        <Link href="/my-captions" className="hover:underline">My captions</Link>
      </nav>
      <h1 className="page-heading">Your caption studio</h1>
      {user ? <CaptionForm /> : (
        <Link href="/" className="button-primary">
          Sign in to create captions
        </Link>
      )}
    </main>
  );
}
