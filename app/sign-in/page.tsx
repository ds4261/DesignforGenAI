import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import SignInButton from "../SignInButton";

export default async function SignInPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");
  return (
    <main className="page-shell flex flex-1 items-center justify-center py-12">
      <section className="studio-panel w-full max-w-md text-center">
        <p className="eyebrow">YOUR NEXT CITY STORY</p>
        <h1 className="text-3xl font-semibold mb-4">Sign in to join in</h1>
        <p className="palette-muted mb-6 leading-7">Vote for your favorite captions, create your own, and keep them in My captions.</p>
        <SignInButton className="button-primary w-full">Continue with Google</SignInButton>
        <Link href="/" className="inline-block mt-6 text-sm underline underline-offset-4">Keep browsing the gallery</Link>
      </section>
    </main>
  );
}
