import Anthropic from "@anthropic-ai/sdk";
import { Student } from "./students.js";
import { getClrData, formatClrForPrompt, ClrData } from "./clr.js";

const client = new Anthropic();

interface Message {
  role: "user" | "assistant";
  content: string;
}

// In-memory conversation store: studentId -> messages
const conversations = new Map<string, Message[]>();

function buildSystemPrompt(student: Student, clr: ClrData | null): string {
  const flags = [
    student.isEconomicDisadvantaged && "Economically Disadvantaged",
    student.isELL && "ELL",
    student.isSpecialEducation && "Special Education",
    student.is504Eligible && "504 Eligible",
  ].filter(Boolean).join(", ") || "None";

  const clrSection = clr
    ? `\nCOMPREHENSIVE LEARNER RECORD (CLR):\n${formatClrForPrompt(clr)}\n\nYou have this student's complete high school course history from their CLR. Use it to make specific recommendations — check prereqs, identify strengths/weaknesses by subject area, and note any gaps.`
    : `\nDATA AVAILABLE: You currently only have the student's basic demographic profile. You do NOT have their high school transcript, test scores, AP/IB credits, course history, or assessments. Be honest about this. Do not speculate about what courses they have or haven't taken.`;

  return `You are an AI assistant for a college academic advisor. The advisor helps incoming freshmen choose courses and plan their first semester. The student's demographic profile is already displayed on screen — do not repeat it.

Student data (for your reference):
- Name: ${student.name}
- Gender: ${student.gender}, Race/Ethnicity: ${student.raceEthnicity}
- Birth Date: ${student.birthDate}
- Flags: ${flags}
${clrSection}

YOUR ROLE:
- Help the advisor figure out what courses to recommend for this student's first semester
- When the advisor tells you the student's interests or intended major, suggest relevant first-semester coursework
- When asked about prereqs or placement, ${clr ? "reference the CLR data to check what they've completed" : "be clear about what you'd need to verify (transcript, placement test scores, AP credits) vs. what you can answer from general catalog knowledge"}
- Be direct and practical. No life coaching, no sociological commentary, no conversation tips. The advisor is a professional.
- Keep responses concise.`;
}

const summaryCache = new Map<string, string>();
const clrCache = new Map<string, ClrData | null>();

async function getStudentClr(studentId: string): Promise<ClrData | null> {
  if (clrCache.has(studentId)) return clrCache.get(studentId)!;
  const clr = await getClrData(studentId);
  clrCache.set(studentId, clr);
  return clr;
}

export async function generateSummary(student: Student): Promise<{ summary: string; hasClr: boolean }> {
  const clr = await getStudentClr(student.id);
  const cacheKey = student.id;
  const cached = summaryCache.get(cacheKey);
  if (cached) return { summary: cached, hasClr: !!clr };

  const summaryPrompt = clr
    ? "I'm about to meet with this incoming freshman. Based on their CLR, give me a brief status: key strengths, any gaps or concerns for college readiness, and specific recommendations for first-semester course planning. 3-5 bullets max, no headers."
    : "I'm about to meet with this incoming freshman. Based on what we have on file, give me a brief status: what do we know, what's missing that I should ask about, and any flags relevant to course planning. 2-4 bullets max, no headers.";

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: buildSystemPrompt(student, clr),
    messages: [{ role: "user", content: summaryPrompt }],
  });

  const summary =
    response.content[0].type === "text" ? response.content[0].text : "";

  summaryCache.set(cacheKey, summary);
  conversations.set(student.id, [{ role: "assistant", content: summary }]);

  return { summary, hasClr: !!clr };
}

export async function chat(
  student: Student,
  userMessage: string,
): Promise<string> {
  const clr = await getStudentClr(student.id);
  const history = conversations.get(student.id) || [];
  history.push({ role: "user", content: userMessage });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: buildSystemPrompt(student, clr),
    messages: history,
  });

  const reply =
    response.content[0].type === "text" ? response.content[0].text : "";
  history.push({ role: "assistant", content: reply });
  conversations.set(student.id, history);

  return reply;
}
