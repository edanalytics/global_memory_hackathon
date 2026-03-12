import { useEffect, useState } from "react";
import type { StudentSummary } from "./App";

interface Props {
  student: StudentSummary;
  api: string;
}

interface StudentDetail {
  id: string;
  name: string;
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

interface CourseRecord {
  name: string;
  grade: string;
  credits: number;
  passed: boolean;
  alignments: string[];
}

interface StudentGoal {
  goalText: string;
  pathwayName: string;
  pathwayCode: string;
  alignedMessage: string;
}

interface ClrData {
  courses: CourseRecord[];
  totalCredits: number;
  goals: StudentGoal[];
}

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#888",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
  marginTop: 16,
};

export default function SummaryPane({ student, api }: Props) {
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [clr, setClr] = useState<ClrData | null>(null);
  const [hasClr, setHasClr] = useState(false);
  const [loadingClr, setLoadingClr] = useState(true);

  useEffect(() => {
    // Fetch both in parallel
    fetch(`${api}/students/${student.id}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(console.error);

    setLoadingClr(true);
    fetch(`${api}/students/${student.id}/clr`)
      .then((r) => r.json())
      .then((data) => {
        setHasClr(data.hasClr);
        setClr(data.clr);
      })
      .catch(console.error)
      .finally(() => setLoadingClr(false));
  }, [student.id, api]);

  const flags = detail
    ? [
        detail.isEconomicDisadvantaged && "Economically Disadvantaged",
        detail.isELL && "ELL",
        detail.isSpecialEducation && "Special Education",
        detail.is504Eligible && "504 Eligible",
      ].filter(Boolean)
    : [];

  return (
    <div style={{ padding: "16px 20px", fontSize: 13, lineHeight: 1.5 }}>
      {/* CLR badge */}
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Student Profile</span>
        {!loadingClr && (
          <span
            style={{
              background: hasClr ? "#e8f5e9" : "#fff3e0",
              color: hasClr ? "#2e7d32" : "#e65100",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {hasClr ? "CLR Available" : "No CLR Data"}
          </span>
        )}
      </div>

      {/* Demographics */}
      {detail && (
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 13 }}>
          <span style={{ color: "#888" }}>Gender</span>
          <span>{detail.gender}</span>
          <span style={{ color: "#888" }}>Race/Ethnicity</span>
          <span>{detail.raceEthnicity}</span>
          <span style={{ color: "#888" }}>DOB</span>
          <span>{detail.birthDate}</span>
          <span style={{ color: "#888" }}>School Year</span>
          <span>{detail.schoolYear}</span>
        </div>
      )}

      {flags.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
          {flags.map((f) => (
            <span
              key={f as string}
              style={{
                background: "#fff3e0",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 11,
              }}
            >
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Goals */}
      {clr && clr.goals.length > 0 && (
        <>
          <div style={sectionTitle}>Student Goals</div>
          {clr.goals.map((g, i) => (
            <div
              key={i}
              style={{
                background: "#f0f7ff",
                borderRadius: 6,
                padding: "8px 10px",
                marginBottom: 6,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>"{g.goalText}"</div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                Pathway: {g.pathwayName}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Course History */}
      {clr && clr.courses.length > 0 && (
        <>
          <div style={sectionTitle}>
            Course History ({clr.totalCredits} credits)
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: "4px 0", fontWeight: 600 }}>Course</th>
                <th style={{ padding: "4px 8px", fontWeight: 600, width: 40 }}>Grade</th>
                <th style={{ padding: "4px 0", fontWeight: 600, width: 30, textAlign: "right" }}>Cr</th>
              </tr>
            </thead>
            <tbody>
              {clr.courses.map((c, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "3px 0" }}>
                    {c.name}
                    {c.alignments.length > 0 && (
                      <span style={{ fontSize: 10, color: "#888", marginLeft: 4 }}>
                        [{c.alignments.join(", ")}]
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "3px 8px", textAlign: "center" }}>{c.grade}</td>
                  <td style={{ padding: "3px 0", textAlign: "right" }}>{c.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* No CLR message */}
      {!loadingClr && !hasClr && (
        <div style={{ marginTop: 16, color: "#888", fontStyle: "italic", fontSize: 12 }}>
          No CLR data on file. Course history and goals will appear here when available.
        </div>
      )}
    </div>
  );
}
