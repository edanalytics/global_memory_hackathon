import { useState } from "react";
import StudentList from "./StudentList";
import StudentView from "./StudentView";

export interface StudentSummary {
  id: string;
  name: string;
  displayName: string;
  gradeLevel: string;
}

const API = "http://localhost:3001/api";

export default function App() {
  const [selected, setSelected] = useState<StudentSummary | null>(null);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui" }}>
      <div
        style={{
          width: 280,
          borderRight: "1px solid #ddd",
          overflow: "auto",
          background: "#f8f9fa",
        }}
      >
        <StudentList api={API} selected={selected} onSelect={setSelected} />
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {selected ? (
          <StudentView key={selected.id} student={selected} api={API} />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#888",
            }}
          >
            Select a student to begin
          </div>
        )}
      </div>
    </div>
  );
}
