import Anthropic from "@anthropic-ai/sdk";
import { Student } from "./students.js";
import { getClrData, formatClrForPrompt, ClrData } from "./clr.js";
import { findMajor, getMajorNames, getCourseRequirements, formatMajorForPrompt } from "./majors.js";

const client = new Anthropic();

// In-memory conversation store: studentId -> messages
const conversations = new Map<string, Anthropic.MessageParam[]>();

function buildTools(): Anthropic.Tool[] {
  const majorNames = getMajorNames();
  return [
    {
      name: "get_major_requirements",
      description: `Look up course requirements for a specific college major. Available majors include: ${majorNames.slice(0, 30).join(", ")}${majorNames.length > 30 ? `, and ${majorNames.length - 30} more` : ""}. Use a partial name to search.`,
      input_schema: {
        type: "object" as const,
        properties: {
          major: {
            type: "string",
            description: "The name (or partial name) of the major to look up",
          },
        },
        required: ["major"],
      },
    },
  ];
}

function buildSystemPrompt(student: Student, clr: ClrData | null): string {
  const flags = [
    student.isEconomicDisadvantaged && "Economically Disadvantaged",
    student.isELL && "ELL",
    student.isSpecialEducation && "Special Education",
    student.is504Eligible && "504 Eligible",
  ].filter(Boolean).join(", ") || "None";

  const clrSection = clr
    ? `\nCOMPREHENSIVE LEARNER RECORD (CLR) — HIGH SCHOOL DATA:\n${formatClrForPrompt(clr)}\n\nThis is the student's HIGH SCHOOL record. Courses listed here are high school courses, NOT college courses. Pathways and goals from the CLR refer to high school career pathways (e.g., "Plant and Animal Systems"), which indicate the student's interests but are NOT the same as college majors. Use this data to understand the student's background, strengths, and interests, then map those to appropriate COLLEGE majors from the available majors list.`
    : `\nDATA AVAILABLE: You currently only have the student's basic demographic profile. You do NOT have their high school transcript, test scores, AP/IB credits, course history, or assessments. Be honest about this. Do not speculate about what courses they have or haven't taken.`;

  return `You are an AI assistant for a college academic advisor. The advisor helps incoming freshmen choose courses and plan their first semester. The student's demographic profile is already displayed on screen — do not repeat it.

Student data (for your reference):
- Name: ${student.name}
- Gender: ${student.gender}, Race/Ethnicity: ${student.raceEthnicity}
- Birth Date: ${student.birthDate}
- Flags: ${flags}
${clrSection}

AVAILABLE TOOLS:
You have access to a get_major_requirements tool that can look up course requirements for any major in the institution's catalog. Use it whenever a major or program is mentioned — do not guess at requirements from general knowledge.

AVAILABLE MAJORS (${getMajorNames().length} total):
${getMajorNames().join(", ")}

YOUR ROLE:
- Help the advisor figure out what courses to recommend for this student's first semester
- When the advisor mentions a student's interests, suggest relevant majors from the list above and use the tool to look up their requirements
- When you have both CLR data and major requirements, cross-reference them to identify which prereqs the student has already met and which gaps exist
- Be direct and practical. No life coaching, no sociological commentary, no conversation tips. The advisor is a professional.
- Keep responses concise.`;
}

async function handleToolCall(name: string, input: Record<string, string>): Promise<string> {
  if (name === "get_major_requirements") {
    const major = findMajor(input.major);
    if (!major) {
      return JSON.stringify({ error: `No major found matching "${input.major}". Try a different search term.` });
    }
    const courses = await getCourseRequirements(major.id);
    return formatMajorForPrompt(major, courses);
  }
  return JSON.stringify({ error: "Unknown tool" });
}

async function callWithTools(
  system: string,
  messages: Anthropic.MessageParam[],
): Promise<string> {
  const tools = buildTools();

  let response = await client.messages.create({
    model: "claude-sonnet-4-6",
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
        console.log(`[tool call] ${block.name}(${JSON.stringify(block.input)})`);
        const result = await handleToolCall(block.name, block.input as Record<string, string>);
        console.log(`[tool result] ${result.slice(0, 200)}${result.length > 200 ? "..." : ""}`);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });

    response = await client.messages.create({
      model: "claude-sonnet-4-6",
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

export function getChatHistory(studentId: string): { role: string; content: string }[] {
  const history = conversations.get(studentId) || [];
  // Filter to just user/assistant text messages (skip tool use/results and the initial summary prompt)
  return history
    .filter((m) => typeof m.content === "string")
    .slice(2) // skip the initial summary prompt and summary response
    .map((m) => ({ role: m.role, content: m.content as string }));
}

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
