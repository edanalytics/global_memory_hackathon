import Anthropic from "@anthropic-ai/sdk";
import { Student } from "./students.js";
import { getTranscript, getAssessments, getCredentials } from "./clr.js";

const client = new Anthropic();

interface Message {
  role: "user" | "assistant";
  content: string;
}

// In-memory conversation store: studentId -> messages
const conversations = new Map<string, Message[]>();

function buildSystemPrompt(student: Student): string {
  const flags = [
    student.isEconomicDisadvantaged && "Economically Disadvantaged",
    student.isELL && "ELL",
    student.isSpecialEducation && "Special Education",
    student.is504Eligible && "504 Eligible",
  ].filter(Boolean).join(", ") || "None";

  return `You are an AI assistant for a college academic advisor. The advisor helps incoming freshmen choose courses and plan their first semester. The student's demographic profile is already displayed on screen — do not repeat it.

Student data (for your reference):
- Name: ${student.name}
- Gender: ${student.gender}, Race/Ethnicity: ${student.raceEthnicity}
- Birth Date: ${student.birthDate}
- Flags: ${flags}

DATA AVAILABLE: You currently only have the student's basic demographic profile. You do NOT have their high school transcript, test scores, AP/IB credits, course history, or assessments. Be honest about this. Do not speculate about what courses they have or haven't taken.

YOUR ROLE:
- Help the advisor figure out what courses to recommend for this student's first semester
- When the advisor tells you the student's interests or intended major, suggest relevant first-semester coursework
- When asked about prereqs or placement, be clear about what you'd need to verify (transcript, placement test scores, AP credits) vs. what you can answer from general catalog knowledge
- Be direct and practical. No life coaching, no sociological commentary, no conversation tips. The advisor is a professional.
- Keep responses concise.`;
}

const summaryCache = new Map<string, string>();

export async function generateSummary(student: Student): Promise<string> {
  const cached = summaryCache.get(student.id);
  if (cached) return cached;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: buildSystemPrompt(student),
    messages: [
      {
        role: "user",
        content:
          "I'm about to meet with this incoming freshman. Based on what we have on file, give me a brief status: what do we know, what's missing that I should ask about, and any flags relevant to course planning. 2-4 bullets max, no headers.",
      },
    ],
  });

  const summary =
    response.content[0].type === "text" ? response.content[0].text : "";

  summaryCache.set(student.id, summary);
  conversations.set(student.id, [{ role: "assistant", content: summary }]);

  return summary;
}

export async function chat(
  student: Student,
  userMessage: string,
): Promise<string> {
  const history = conversations.get(student.id) || [];
  history.push({ role: "user", content: userMessage });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: buildSystemPrompt(student),
    messages: history,
  });

  const reply =
    response.content[0].type === "text" ? response.content[0].text : "";
  history.push({ role: "assistant", content: reply });
  conversations.set(student.id, history);

  return reply;
}
