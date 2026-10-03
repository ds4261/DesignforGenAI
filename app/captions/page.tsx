import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import CaptionForm from "./CaptionForm";

export default async function CaptionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="max-w-2xl mx-auto w-full px-6 py-8">
      <Link href="/" className="hover:underline">Home</Link>
      <h1 className="text-3xl font-bold mt-6 mb-3">NYC photo captions</h1>
      {user ? <CaptionForm /> : (
        <Link href="/" className="inline-block px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700">
          Sign in to create captions
        </Link>
      )}
    </main>
  );
}
