import { useEffect, useState, useRef, type FormEvent } from "react";
import Markdown from "react-markdown";
import type { StudentSummary } from "./App";

interface Props {
  student: StudentSummary;
  api: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPane({ student, api }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const messagesEnd = useRef<HTMLDivElement>(null);

  // Load the AI summary as the first assistant message
  useEffect(() => {
    setSummaryLoading(true);
    setMessages([]);
    fetch(`${api}/students/${student.id}/summary`)
      .then((r) => r.json())
      .then((data) => {
        setMessages([{ role: "assistant", content: data.summary }]);
      })
      .catch(console.error)
      .finally(() => setSummaryLoading(false));
  }, [student.id, api]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setSending(true);

    try {
      const res = await fetch(`${api}/students/${student.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error getting response." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "0 24px",
      }}
    >
      <h2 style={{ marginBottom: 0, marginTop: 16 }}>{student.name}</h2>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 12, paddingTop: 4 }}>
        Grade {student.gradeLevel}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", marginBottom: 16 }}>
        {summaryLoading && (
          <div style={{ color: "#888", fontSize: 14, padding: "12px 0" }}>
            Generating summary...
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: 12,
              textAlign: msg.role === "user" ? "right" : "left",
            }}
          >
            <div
              className={msg.role === "assistant" ? "chat-bubble" : undefined}
              style={{
                display: "inline-block",
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: 12,
                background: msg.role === "user" ? "#1976d2" : "#f0f0f0",
                color: msg.role === "user" ? "#fff" : "#333",
                fontSize: 14,
                lineHeight: 1.5,
                whiteSpace: msg.role === "user" ? "pre-wrap" : "normal",
                textAlign: "left",
              }}
            >
              {msg.role === "assistant" ? (
                <Markdown>{msg.content}</Markdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ color: "#888", fontSize: 14 }}>Thinking...</div>
        )}
        <div ref={messagesEnd} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        style={{ display: "flex", gap: 8, paddingBottom: 16 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this student..."
          disabled={summaryLoading || sending}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ddd",
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={summaryLoading || sending || !input.trim()}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: "#1976d2",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
