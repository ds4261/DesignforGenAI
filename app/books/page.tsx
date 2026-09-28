import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type Joke = { id: number; setup: string; punchline: string };

export default async function BooksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: jokes, error } = await supabase
    .from("jokes")
    .select("*")
    .order("id");

  if (error) {
    return <p>Error loading jokes: {error.message}</p>;
  }

  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Jokes</h1>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {(jokes as Joke[]).map((j) => (
          <li
            key={j.id}
            style={{
              background: "linear-gradient(to right, #bae6fd, #bbf7d0)",
              borderRadius: 16,
              padding: "1rem 1.25rem",
              marginBottom: "0.75rem",
            }}
          >
            <strong>{j.setup}</strong>
            <div>{j.punchline}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}