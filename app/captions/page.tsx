import SignInButton from "../SignInButton";
import { createClient } from "@/lib/supabase-server";
import CaptionForm from "./CaptionForm";

export default async function CaptionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="page-shell compact-studio">

      <h1 className="page-heading">Your caption studio</h1>
      {user ? <CaptionForm /> : (
        <SignInButton>Sign in to create captions</SignInButton>
      )}
    </main>
  );
}
