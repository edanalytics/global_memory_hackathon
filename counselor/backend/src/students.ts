import { query } from "./snowflake.js";

export interface Student {
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

interface DimStudentRow {
  K_STUDENT: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  DISPLAY_NAME: string;
  GRADE_LEVEL: string;
  BIRTH_DATE: string;
  GENDER: string;
  RACE_ETHNICITY: string;
  IS_ECONOMIC_DISADVANTAGED: boolean;
  IS_ENGLISH_LANGUAGE_LEARNER_SCH_ACTIVE: boolean;
  IS_SPECIAL_EDUCATION_SCH_ACTIVE: boolean;
  IS_504_ELIGIBLE: boolean | null;
  SCHOOL_YEAR: number;
  IS_LATEST_RECORD: boolean;
}

function mapRow(row: DimStudentRow): Student {
  return {
    id: row.K_STUDENT,
    name: `${row.FIRST_NAME} ${row.LAST_NAME}`,
    displayName: row.DISPLAY_NAME,
    gradeLevel: row.GRADE_LEVEL,
    birthDate: row.BIRTH_DATE,
    gender: row.GENDER,
    raceEthnicity: row.RACE_ETHNICITY,
    isEconomicDisadvantaged: row.IS_ECONOMIC_DISADVANTAGED,
    isELL: row.IS_ENGLISH_LANGUAGE_LEARNER_SCH_ACTIVE,
    isSpecialEducation: row.IS_SPECIAL_EDUCATION_SCH_ACTIVE,
    is504Eligible: row.IS_504_ELIGIBLE,
    schoolYear: row.SCHOOL_YEAR,
  };
}

// In-memory cache loaded on startup
let students: Student[] = [];

export async function loadStudents(): Promise<void> {
  // Students with goals (demo priority)
  const withGoals = await query<DimStudentRow>(
    `SELECT s.* FROM dev_analytics.dev_rl_wh.dim_student s
     INNER JOIN dev_analytics.dev_rl_clr.student_aligned_goals g ON s.K_STUDENT = g.K_STUDENT
     WHERE s.IS_LATEST_RECORD = TRUE
     ORDER BY s.LAST_NAME, s.FIRST_NAME`
  );

  const goalStudentIds = new Set(withGoals.map((r) => r.K_STUDENT));

  // 4 more without goals
  const withoutGoals = await query<DimStudentRow>(
    `SELECT * FROM dev_analytics.dev_rl_wh.dim_student
     WHERE IS_LATEST_RECORD = TRUE
     ORDER BY LAST_NAME, FIRST_NAME
     LIMIT 20`
  );
  const extras = withoutGoals.filter((r) => !goalStudentIds.has(r.K_STUDENT)).slice(0, 4);

  // Deduplicate (in case of multiple goals per student)
  const deduped = new Map<string, DimStudentRow>();
  for (const r of [...withGoals, ...extras]) {
    if (!deduped.has(r.K_STUDENT)) deduped.set(r.K_STUDENT, r);
  }

  students = Array.from(deduped.values()).map(mapRow);
  console.log(`Loaded ${students.length} students (${goalStudentIds.size} with goals, ${extras.length} without)`);
}

export function getStudents(): Student[] {
  return students;
}

export function getStudentById(id: string): Student | undefined {
  return students.find((s) => s.id === id);
}
