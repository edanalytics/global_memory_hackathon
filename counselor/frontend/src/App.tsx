import { useState } from "react";
import StudentList from "./StudentList";
import ChatPane from "./ChatPane";
import SummaryPane from "./SummaryPane";

export interface StudentSummary {
  id: string;
  name: string;
  displayName: string;
  gradeLevel: string;
}

const API = import.meta.env.DEV ? "http://localhost:3001/api" : "/api";

export default function App() {
  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  async function handleRefresh() {
    if (!selected) return;
    await fetch(`${API}/students/${selected.id}/reset`, { method: "POST" });
    setRefreshKey((k) => k + 1);
  }

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden", fontFamily: "system-ui" }}>
      {/* Left: Student list */}
      <div
        style={{
          width: 240,
          borderRight: "1px solid #ddd",
          overflow: "auto",
          background: "#f8f9fa",
          flexShrink: 0,
        }}
      >
        <StudentList api={API} selected={selected} onSelect={setSelected} />
      </div>

      {selected ? (
        <>
          {/* Middle: Chat */}
          <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
            <ChatPane
              key={`${selected.id}-${refreshKey}`}
              student={selected}
              api={API}
              onRefresh={handleRefresh}
            />
          </div>

          {/* Right: Summary + CLR */}
          <div
            style={{
              width: 540,
              borderLeft: "1px solid #ddd",
              overflow: "auto",
              background: "#fafafa",
              flexShrink: 0,
            }}
          >
            <SummaryPane key={`summary-${selected.id}-${refreshKey}`} student={selected} api={API} />
          </div>
        </>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#888",
          }}
        >
          Select a student to begin
        </div>
      )}
    </div>
  );
}
