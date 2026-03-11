import { useEffect, useState, FormEvent } from "react";
import { StudentSummary } from "./App";

interface Props {
  student: StudentSummary;
  api: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function StudentView({ student, api }: Props) {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${api}/students/${student.id}/summary`)
      .then((r) => r.json())
      .then((data) => {
        setSummary(data.summary);
        setMessages([]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [student.id, api]);

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
        maxWidth: 800,
        margin: "0 auto",
        padding: "0 24px",
      }}
    >
      <h2 style={{ marginBottom: 4 }}>{student.name}</h2>
      <div style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
        Grade {student.grade} &middot; GPA {student.gpa}
      </div>

      {/* Summary */}
      <div
        style={{
          background: "#f0f7ff",
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          whiteSpace: "pre-wrap",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        {loading ? "Generating session prep summary..." : summary}
      </div>

      {/* Chat messages */}
      <div style={{ flex: 1, overflow: "auto", marginBottom: 16 }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: 12,
              textAlign: msg.role === "user" ? "right" : "left",
            }}
          >
            <div
              style={{
                display: "inline-block",
                maxWidth: "80%",
                padding: "10px 14px",
                borderRadius: 12,
                background: msg.role === "user" ? "#1976d2" : "#f0f0f0",
                color: msg.role === "user" ? "#fff" : "#333",
                fontSize: 14,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                textAlign: "left",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ color: "#888", fontSize: 14 }}>Thinking...</div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        style={{
          display: "flex",
          gap: 8,
          paddingBottom: 16,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this student..."
          disabled={loading || sending}
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
          disabled={loading || sending || !input.trim()}
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
