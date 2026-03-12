import { useEffect, useState, FormEvent } from "react";
import type { StudentSummary } from "./App";

interface Props {
  student: StudentSummary;
  api: string;
}

interface StudentDetail {
  id: string;
  name: string;
  displayName: string;
  gradeLevel: string;
  birthDate: string;
  gender: string;
  raceEthnicity: string;
  isEconomicDisadvantaged: boolean;
  isELL: boolean;
  isSpecialEducation: boolean;
  is504Eligible: boolean | null;
  schoolYear: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function ProfileCard({ s }: { s: StudentDetail }) {
  const flags = [
    s.isEconomicDisadvantaged && "Economically Disadvantaged",
    s.isELL && "ELL",
    s.isSpecialEducation && "Special Education",
    s.is504Eligible && "504 Eligible",
  ].filter(Boolean);

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        fontSize: 13,
        color: "#555",
        padding: "8px 0",
        borderBottom: "1px solid #eee",
        marginBottom: 12,
      }}
    >
      <span><b>Grade</b> {s.gradeLevel}</span>
      <span><b>Gender</b> {s.gender}</span>
      <span><b>Race/Ethnicity</b> {s.raceEthnicity}</span>
      <span><b>DOB</b> {s.birthDate}</span>
      {flags.length > 0 && (
        <span>
          {flags.map((f) => (
            <span
              key={f as string}
              style={{
                background: "#fff3e0",
                borderRadius: 4,
                padding: "2px 6px",
                marginRight: 4,
                fontSize: 12,
              }}
            >
              {f}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

export default function StudentView({ student, api }: Props) {
  const [detail, setDetail] = useState<StudentDetail | null>(null);
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
        setDetail(data.student);
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
      {/* Header + Profile */}
      <h2 style={{ marginBottom: 0, marginTop: 16 }}>{student.name}</h2>
      {detail && <ProfileCard s={detail} />}

      {/* AI Insights */}
      <div
        style={{
          background: "#f0f7ff",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 12,
          fontSize: 13,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          maxHeight: 180,
          overflow: "auto",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 12, color: "#666" }}>
          AI INSIGHTS
        </div>
        {loading ? "Generating..." : summary}
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
