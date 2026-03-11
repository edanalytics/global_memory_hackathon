export interface Student {
  id: string;
  name: string;
  grade: number;
  gpa: number;
  interests: string[];
  notes: string;
}

export const students: Student[] = [
  {
    id: "1",
    name: "Maria Santos",
    grade: 11,
    gpa: 3.7,
    interests: ["biology", "volunteering", "debate"],
    notes: "Interested in pre-med track. First-generation college student.",
  },
  {
    id: "2",
    name: "James Chen",
    grade: 12,
    gpa: 3.2,
    interests: ["computer science", "gaming", "robotics club"],
    notes: "Strong in STEM but struggling with essay writing. Considering community college transfer path.",
  },
  {
    id: "3",
    name: "Aisha Johnson",
    grade: 11,
    gpa: 3.9,
    interests: ["creative writing", "theater", "social justice"],
    notes: "Looking at liberal arts colleges. Needs financial aid guidance.",
  },
  {
    id: "4",
    name: "Tyler Rivera",
    grade: 12,
    gpa: 2.8,
    interests: ["auto shop", "sports", "part-time job"],
    notes: "Exploring trade schools and apprenticeships. Works 20hrs/week.",
  },
];
