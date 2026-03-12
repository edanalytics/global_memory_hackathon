import { query } from "./snowflake.js";

export interface CourseRecord {
  name: string;
  grade: string;
  credits: number;
  passed: boolean;
  alignments: string[];
}

export interface StudentGoal {
  goalText: string;
  pathwayName: string;
  pathwayCode: string;
  alignedMessage: string;
}

export interface ClrData {
  courses: CourseRecord[];
  totalCredits: number;
  goals: StudentGoal[];
}

interface ClrRow {
  K_STUDENT: string;
  CLR_PAYLOAD: string;
}

interface GoalRow {
  RAW_GOAL_TEXT: string;
  PATHWAY_NAME: string;
  REQUISITE_CODE: string;
  ALIGNED_MESSAGE: string;
}

// In-memory cache
const clrCache = new Map<string, ClrData | null>();

async function fetchGoals(studentId: string): Promise<StudentGoal[]> {
  try {
    const rows = await query<GoalRow>(
      "SELECT RAW_GOAL_TEXT, PATHWAY_NAME, REQUISITE_CODE, ALIGNED_MESSAGE FROM dev_analytics.dev_rl_clr.student_aligned_goals WHERE K_STUDENT = ?",
      [studentId]
    );
    return rows.map((r) => ({
      goalText: r.RAW_GOAL_TEXT,
      pathwayName: r.PATHWAY_NAME,
      pathwayCode: r.REQUISITE_CODE,
      alignedMessage: r.ALIGNED_MESSAGE,
    }));
  } catch (err: any) {
    console.error(`Goals fetch failed for ${studentId}:`, err.message);
    return [];
  }
}

export async function getClrData(studentId: string): Promise<ClrData | null> {
  const cached = clrCache.get(studentId);
  if (cached !== undefined) return cached;

  try {
    const [clrRows, goals] = await Promise.all([
      query<ClrRow>(
        "SELECT CLR_PAYLOAD FROM dev_analytics.dev_rl_clr.fct_clr_json WHERE K_STUDENT = ?",
        [studentId]
      ),
      fetchGoals(studentId),
    ]);

    if (!clrRows.length && !goals.length) {
      clrCache.set(studentId, null);
      return null;
    }

    let courses: CourseRecord[] = [];
    let totalCredits = 0;

    if (clrRows.length) {
      const payload = typeof clrRows[0].CLR_PAYLOAD === "string"
        ? JSON.parse(clrRows[0].CLR_PAYLOAD)
        : clrRows[0].CLR_PAYLOAD;

      const assertions: any[] = payload.assertions || [];

      const courseMap = new Map<string, CourseRecord>();
      for (const a of assertions) {
        const name: string = a.achievement?.name || "Unknown";
        const grade: string = a.results?.[0]?.value || "N/A";
        const credits: number = a.creditsEarned ?? 0;
        const passed: boolean = a.results?.[0]?.status === "Pass";
        const alignments: string[] = (a.achievement?.alignments || [])
          .map((al: any) => al.targetName)
          .filter(Boolean);

        const existing = courseMap.get(name);
        if (!existing || credits > existing.credits) {
          courseMap.set(name, { name, grade, credits, passed, alignments });
        }
      }

      courses = Array.from(courseMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);
    }

    const data: ClrData = { courses, totalCredits, goals };
    clrCache.set(studentId, data);
    return data;
  } catch (err: any) {
    console.error(`CLR fetch failed for ${studentId}:`, err.message);
    clrCache.set(studentId, null);
    return null;
  }
}

export function formatClrForPrompt(clr: ClrData): string {
  const parts: string[] = [];

  if (clr.courses.length) {
    const lines = clr.courses.map(
      (c) => `- ${c.name}: ${c.grade} (${c.credits} cr)${c.alignments.length ? ` [${c.alignments.join(", ")}]` : ""}`
    );
    parts.push(`Completed Courses (${clr.totalCredits} total credits):\n${lines.join("\n")}`);
  }

  if (clr.goals.length) {
    const goalLines = clr.goals.map(
      (g) => `- Goal: "${g.goalText}" → Pathway: ${g.pathwayName} (${g.pathwayCode})`
    );
    parts.push(`Student Goals:\n${goalLines.join("\n")}`);
  }

  return parts.join("\n\n");
}
