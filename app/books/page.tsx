import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Book = { id: number; title: string; author: string; year: number | null };

export default async function BooksPage() {
  const { data: books, error } = await supabase
    .from("books")
    .select("*")
    .order("id");

  if (error) {
    return <p>Error loading books: {error.message}</p>;
  }

  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Books</h1>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {(books as Book[]).map((b) => (
          <li
            key={b.id}
            style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem", marginBottom: "0.75rem" }}
          >
            <strong>{b.title}</strong>
            <div>{b.author}{b.year ? `, ${b.year}` : ""}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}