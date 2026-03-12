import { useEffect, useState } from "react";
import type { StudentSummary } from "./App";

interface Props {
  api: string;
  selected: StudentSummary | null;
  onSelect: (s: StudentSummary) => void;
}

export default function StudentList({ api, selected, onSelect }: Props) {
  const [students, setStudents] = useState<StudentSummary[]>([]);

  useEffect(() => {
    fetch(`${api}/students`)
      .then((r) => r.json())
      .then(setStudents)
      .catch(console.error);
  }, [api]);

  return (
    <div>
      <h3 style={{ padding: "16px 16px 8px", margin: 0 }}>Students</h3>
      {students.map((s) => (
        <div
          key={s.id}
          onClick={() => onSelect(s)}
          style={{
            padding: "12px 16px",
            cursor: "pointer",
            background: selected?.id === s.id ? "#e3f2fd" : "transparent",
            borderBottom: "1px solid #eee",
          }}
        >
          <div style={{ fontWeight: 500 }}>{s.name}</div>
        </div>
      ))}
    </div>
  );
}
