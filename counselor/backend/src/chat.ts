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
  return `You are an AI assistant helping a college guidance counselor prepare for their first session with a student. Be concise and actionable.

Student Profile:
- Name: ${student.name}
- Grade: ${student.grade}
- GPA: ${student.gpa}
- Interests: ${student.interests.join(", ")}
- Counselor Notes: ${student.notes}

Help the counselor by:
- Suggesting potential good-fit majors based on the student's interests and profile
- Identifying key requirements or deadlines the student should prioritize
- Flagging areas where the student may need extra support
- Suggesting conversation topics for the upcoming session

Keep responses focused and practical. You're helping the counselor, not the student directly.`;
}

export async function generateSummary(student: Student): Promise<string> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: buildSystemPrompt(student),
    messages: [
      {
        role: "user",
        content:
          "Please provide a brief preparation summary for my upcoming first session with this student. Include suggested majors to discuss, key priorities, and recommended talking points.",
      },
    ],
  });

  const summary =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Initialize conversation with the summary
  conversations.set(student.id, [{ role: "assistant", content: summary }]);

  return summary;
}

export async function chat(
  student: Student,
  userMessage: string
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
