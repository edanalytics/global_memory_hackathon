import Anthropic from "@anthropic-ai/sdk";
import { Student } from "./students.js";
import { getClrData, formatClrForPrompt, ClrData } from "./clr.js";
import { getMajorRequirements, availableMajors } from "./majors.js";

const client = new Anthropic();

// In-memory conversation store: studentId -> messages
const conversations = new Map<string, Anthropic.MessageParam[]>();

const tools: Anthropic.Tool[] = [
  {
    name: "get_major_requirements",
    description: `Look up course requirements, prerequisites, and first-semester plan for a specific college major. Available majors: ${availableMajors.join(", ")}. Returns null if the major is not in the catalog.`,
    input_schema: {
      type: "object" as const,
      properties: {
        major: {
          type: "string",
          description: "The name of the major to look up",
        },
      },
      required: ["major"],
    },
  },
];

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
- When the advisor tells you the student's interests or intended major, use the get_major_requirements tool to look up specific requirements before making recommendations
- When you have both CLR data and major requirements, cross-reference them to identify which prereqs the student has already met and which gaps exist
- Be direct and practical. No life coaching, no sociological commentary, no conversation tips. The advisor is a professional.
- Keep responses concise.`;
}

function handleToolCall(name: string, input: Record<string, string>): string {
  if (name === "get_major_requirements") {
    const reqs = getMajorRequirements(input.major);
    if (!reqs) return JSON.stringify({ error: `No requirements found for "${input.major}". Available majors: ${availableMajors.join(", ")}` });
    return JSON.stringify(reqs);
  }
  return JSON.stringify({ error: "Unknown tool" });
}

async function callWithTools(
  system: string,
  messages: Anthropic.MessageParam[],
): Promise<string> {
  let response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system,
    tools,
    messages,
  });

  // Tool use loop — keep going until we get a final text response
  while (response.stop_reason === "tool_use") {
    const assistantContent = response.content;
    messages.push({ role: "assistant", content: assistantContent });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of assistantContent) {
      if (block.type === "tool_use") {
        const result = handleToolCall(block.name, block.input as Record<string, string>);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });

    response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system,
      tools,
      messages,
    });
  }

  // Extract text from final response
  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "";
}

const summaryCache = new Map<string, string>();
const clrCache = new Map<string, ClrData | null>();

export function clearStudentCache(studentId: string) {
  summaryCache.delete(studentId);
  clrCache.delete(studentId);
  conversations.delete(studentId);
}

async function getStudentClr(studentId: string): Promise<ClrData | null> {
  if (clrCache.has(studentId)) return clrCache.get(studentId)!;
  const clr = await getClrData(studentId);
  clrCache.set(studentId, clr);
  return clr;
}

export async function generateSummary(student: Student): Promise<{ summary: string; hasClr: boolean }> {
  const clr = await getStudentClr(student.id);
  const cached = summaryCache.get(student.id);
  if (cached) return { summary: cached, hasClr: !!clr };

  const summaryPrompt = clr
    ? "I'm about to meet with this incoming freshman. Based on their CLR, give me a brief status: key strengths, any gaps or concerns for college readiness, and specific recommendations for first-semester course planning. 3-5 bullets max, no headers."
    : "I'm about to meet with this incoming freshman. Based on what we have on file, give me a brief status: what do we know, what's missing that I should ask about, and any flags relevant to course planning. 2-4 bullets max, no headers.";

  const system = buildSystemPrompt(student, clr);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: summaryPrompt }];

  const summary = await callWithTools(system, messages);

  summaryCache.set(student.id, summary);
  // Store a simple version for conversation continuity
  conversations.set(student.id, [
    { role: "user", content: summaryPrompt },
    { role: "assistant", content: summary },
  ]);

  return { summary, hasClr: !!clr };
}

export async function chat(
  student: Student,
  userMessage: string,
): Promise<string> {
  const clr = await getStudentClr(student.id);
  const history = conversations.get(student.id) || [];
  history.push({ role: "user", content: userMessage });

  const system = buildSystemPrompt(student, clr);
  const reply = await callWithTools(system, [...history]);

  history.push({ role: "assistant", content: reply });
  conversations.set(student.id, history);

  return reply;
}
