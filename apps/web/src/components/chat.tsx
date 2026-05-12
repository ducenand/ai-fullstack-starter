"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setStreaming(true);

    const assistantIdx = next.length;
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6)) as { text?: string; done?: boolean; error?: string };
          if (data.text) {
            setMessages((m) => {
              const updated = [...m];
              updated[assistantIdx] = { role: "assistant", content: (updated[assistantIdx]?.content ?? "") + data.text };
              return updated;
            });
          }
        }
      }
    } catch {
      setMessages((m) => {
        const updated = [...m];
        updated[assistantIdx] = { role: "assistant", content: "Error: failed to get response." };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "60vh" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "1rem", background: "#1a1a1a", borderRadius: 8, marginBottom: "0.75rem" }}>
        {messages.length === 0 && (
          <p style={{ color: "#555", textAlign: "center", marginTop: "30%" }}>
            Start a conversation with Claude
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: "1rem", textAlign: m.role === "user" ? "right" : "left" }}>
            <span
              style={{
                display: "inline-block", padding: "0.6rem 0.9rem", borderRadius: 8,
                background: m.role === "user" ? "#2563eb" : "#262626",
                maxWidth: "80%", whiteSpace: "pre-wrap", fontSize: "0.9rem", lineHeight: 1.5,
              }}
            >
              {m.content || (streaming && i === messages.length - 1 ? "▌" : "")}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder="Ask anything..."
          disabled={streaming}
          style={{
            flex: 1, padding: "0.6rem 0.9rem", borderRadius: 8, border: "1px solid #333",
            background: "#1a1a1a", color: "#f0f0f0", fontSize: "0.9rem", outline: "none",
          }}
        />
        <button
          onClick={() => void send()}
          disabled={streaming || !input.trim()}
          style={{
            padding: "0.6rem 1.2rem", borderRadius: 8, border: "none",
            background: streaming ? "#333" : "#2563eb", color: "#fff",
            cursor: streaming ? "not-allowed" : "pointer", fontSize: "0.9rem",
          }}
        >
          {streaming ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
