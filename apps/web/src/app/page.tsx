import { auth, signIn, signOut } from "@/lib/auth";
import { Chat } from "@/components/chat";

export default async function Home() {
  const session = await auth();

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        AI Fullstack Starter
      </h1>
      <p style={{ color: "#888", marginBottom: "2rem", fontSize: "0.9rem" }}>
        Next.js 15 · Prisma · Auth.js · Claude API · BullMQ · Turborepo
      </p>

      {session?.user ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <span style={{ fontSize: "0.85rem", color: "#888" }}>
              Signed in as <strong style={{ color: "#f0f0f0" }}>{session.user.email}</strong>
            </span>
            <form action={async () => { "use server"; await signOut(); }}>
              <button type="submit" style={btnStyle("#333", "#f0f0f0")}>Sign out</button>
            </form>
          </div>
          <Chat />
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 300 }}>
          <p style={{ color: "#888", fontSize: "0.9rem" }}>Sign in to use the AI chat demo.</p>
          <form action={async () => { "use server"; await signIn("github"); }}>
            <button type="submit" style={btnStyle("#238636", "#fff")}>Sign in with GitHub</button>
          </form>
          <form action={async () => { "use server"; await signIn("google"); }}>
            <button type="submit" style={btnStyle("#4285F4", "#fff")}>Sign in with Google</button>
          </form>
        </div>
      )}
    </main>
  );
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg, color, border: "none", borderRadius: 6,
    padding: "0.5rem 1rem", cursor: "pointer", fontSize: "0.85rem", width: "100%",
  };
}
