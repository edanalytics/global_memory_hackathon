export interface MajorRequirements {
  name: string;
  description: string;
  firstSemesterCourses: string[];
  prereqs: string[];
  notes: string;
}

const majors: Record<string, MajorRequirements> = {
  "Agricultural Engineering": {
    name: "Agricultural Engineering",
    description: "Combines engineering principles with agricultural science to solve problems in food production, machinery, and natural resource management.",
    firstSemesterCourses: [
      "ENGR 101 - Introduction to Engineering",
      "MATH 151 - Calculus I",
      "CHEM 101 - General Chemistry I",
      "AGRI 100 - Introduction to Agriculture",
      "ENGL 101 - Composition I",
    ],
    prereqs: [
      "High school algebra II and trigonometry (or placement into Calculus I)",
      "High school chemistry recommended",
      "High school physics recommended",
    ],
    notes: "Students without calculus readiness will need to start in College Algebra or Pre-Calculus, which adds a semester to the typical plan.",
  },
  "Nursing": {
    name: "Nursing (BSN)",
    description: "Prepares students for registered nurse licensure through clinical training and health science coursework.",
    firstSemesterCourses: [
      "BIOL 141 - Human Anatomy & Physiology I",
      "CHEM 101 - General Chemistry I",
      "PSYC 101 - Introduction to Psychology",
      "ENGL 101 - Composition I",
      "MATH 110 - College Algebra",
    ],
    prereqs: [
      "High school biology with lab",
      "High school chemistry recommended",
      "Minimum 2.8 GPA for program admission (applied after first year)",
    ],
    notes: "Nursing program admission is competitive and typically happens after the first year of pre-nursing coursework. A strong GPA in science courses is critical.",
  },
  "Computer Science": {
    name: "Computer Science (BS)",
    description: "Covers programming, algorithms, systems, and theory for careers in software development, data science, and technology.",
    firstSemesterCourses: [
      "CS 101 - Introduction to Computer Science",
      "MATH 151 - Calculus I",
      "ENGL 101 - Composition I",
      "General Education Elective",
    ],
    prereqs: [
      "High school algebra II (or placement into College Algebra)",
      "Prior programming experience helpful but not required",
    ],
    notes: "Students with AP CS credit may start in CS 201 (Data Structures). Students not calculus-ready should plan for an additional semester of math.",
  },
  "Biology": {
    name: "Biology (BS)",
    description: "Broad study of living systems, preparing students for careers in research, healthcare, education, or graduate study.",
    firstSemesterCourses: [
      "BIOL 151 - General Biology I",
      "CHEM 101 - General Chemistry I",
      "MATH 130 - Pre-Calculus or MATH 151 - Calculus I",
      "ENGL 101 - Composition I",
    ],
    prereqs: [
      "High school biology",
      "High school chemistry",
      "High school algebra II",
    ],
    notes: "Pre-med students should plan for Calculus I by sophomore year. Students with strong high school biology may test out of BIOL 151.",
  },
  "Veterinary Science": {
    name: "Veterinary Science / Pre-Vet (BS)",
    description: "Prepares students for veterinary school admission through animal science and biological science coursework.",
    firstSemesterCourses: [
      "BIOL 151 - General Biology I",
      "CHEM 101 - General Chemistry I",
      "ANSC 100 - Introduction to Animal Science",
      "ENGL 101 - Composition I",
      "MATH 130 - Pre-Calculus or MATH 151 - Calculus I",
    ],
    prereqs: [
      "High school biology",
      "High school chemistry",
      "High school algebra II",
    ],
    notes: "Vet school admission is highly competitive (typically <15% acceptance rate). Strong science GPA and animal experience (volunteer, farm work) are critical differentiators.",
  },
  "Business Administration": {
    name: "Business Administration (BBA)",
    description: "Broad business degree covering management, marketing, finance, and operations.",
    firstSemesterCourses: [
      "BUS 101 - Introduction to Business",
      "ECON 201 - Microeconomics",
      "MATH 110 - College Algebra or MATH 120 - Business Calculus",
      "ENGL 101 - Composition I",
      "General Education Elective",
    ],
    prereqs: [
      "High school algebra II",
    ],
    notes: "Students declare a concentration (Finance, Marketing, Management, etc.) typically in sophomore year. Strong math placement opens more quantitative concentrations like Finance.",
  },
};

export const availableMajors = Object.keys(majors);

export function getMajorRequirements(major: string): MajorRequirements | null {
  // Exact match first
  if (majors[major]) return majors[major];

  // Case-insensitive fuzzy match
  const lower = major.toLowerCase();
  for (const [key, value] of Object.entries(majors)) {
    if (key.toLowerCase() === lower) return value;
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) return value;
  }

  return null;
}
