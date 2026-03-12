import { query } from "./snowflake.js";

export interface Major {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface CourseRequirement {
  courseTitle: string;
  requirementType: string;
  sequence: number;
  creditsRequired: number | null;
}

interface RequisiteRow {
  REQUISITE_ID: string;
  REQUISITE_CODE: string;
  NAME: string;
  DESCRIPTION: string;
  REQUISITE_TYPE: string;
}

interface CourseReqRow {
  COURSE_REQUIREMENT_ID: string;
  REQUISITE_ID: string;
  COURSE_TITLE: string;
  CREDITS_REQUIRED: number | null;
  REQUIREMENT_TYPE: string;
  SEQUENCE: number;
}

// In-memory cache loaded on startup
let majors: Major[] = [];
const courseReqCache = new Map<string, CourseRequirement[]>();

export async function loadMajors(): Promise<void> {
  const rows = await query<RequisiteRow>(
    "SELECT * FROM dev_analytics.dev_rl_clr.fct_dxtera_requisites__usc ORDER BY NAME"
  );
  majors = rows.map((r) => ({
    id: r.REQUISITE_ID,
    code: r.REQUISITE_CODE,
    name: r.NAME,
    description: r.DESCRIPTION,
  }));
  console.log(`Loaded ${majors.length} majors`);
}

export function getAvailableMajors(): Major[] {
  return majors;
}

export function getMajorNames(): string[] {
  return majors.map((m) => m.name);
}

export function findMajor(search: string): Major | null {
  const lower = search.toLowerCase();
  // Exact match first
  const exact = majors.find((m) => m.name.toLowerCase() === lower || m.code.toLowerCase() === lower);
  if (exact) return exact;
  // Partial match
  return majors.find((m) => m.name.toLowerCase().includes(lower) || lower.includes(m.name.toLowerCase())) || null;
}

export async function getCourseRequirements(majorId: string): Promise<CourseRequirement[]> {
  const cached = courseReqCache.get(majorId);
  if (cached) return cached;

  const rows = await query<CourseReqRow>(
    "SELECT * FROM dev_analytics.dev_rl_clr.fct_dxtera_course_requirements__usc WHERE REQUISITE_ID = ? ORDER BY SEQUENCE",
    [majorId]
  );

  const reqs = rows.map((r) => ({
    courseTitle: r.COURSE_TITLE,
    requirementType: r.REQUIREMENT_TYPE,
    sequence: r.SEQUENCE,
    creditsRequired: r.CREDITS_REQUIRED,
  }));

  courseReqCache.set(majorId, reqs);
  return reqs;
}

export function formatMajorForPrompt(major: Major, courses: CourseRequirement[]): string {
  const lines: string[] = [
    `Major: ${major.name}`,
    `Description: ${major.description}`,
    "",
    "Required Courses:",
  ];

  // Group by requirement type
  const grouped = new Map<string, CourseRequirement[]>();
  for (const c of courses) {
    const type = c.requirementType || "other";
    if (!grouped.has(type)) grouped.set(type, []);
    grouped.get(type)!.push(c);
  }

  for (const [type, reqs] of grouped) {
    lines.push(`  [${type}]`);
    for (const r of reqs) {
      lines.push(`  - ${r.courseTitle}${r.creditsRequired ? ` (${r.creditsRequired} cr)` : ""}`);
    }
  }

  return lines.join("\n");
}
