import { notFound } from "next/navigation";
import { Chat } from "@/components/chat";

export default function E2EChatTestPage() {
  if (process.env["PLAYWRIGHT_TEST_MODE"] !== "1") notFound();
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>
      <Chat />
    </main>
  );
}
