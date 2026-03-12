import "dotenv/config";
import express from "express";
import cors from "cors";
import { loadStudents, getStudents, getStudentById } from "./students.js";
import { generateSummary, chat } from "./chat.js";

const app = express();
app.use(cors());
app.use(express.json());

// Get all students
app.get("/api/students", (_req, res) => {
  res.json(
    getStudents().map(({ id, name, displayName, gradeLevel }) => ({
      id,
      name,
      displayName,
      gradeLevel,
    })),
  );
});

// Get student detail + AI summary
app.get("/api/students/:id/summary", async (req, res) => {
  const student = getStudentById(req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found" });

  try {
    const summary = await generateSummary(student);
    res.json({ student, summary });
  } catch (err: any) {
    console.error("Summary error:", err.message);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

// Chat with AI about a student
app.post("/api/students/:id/chat", async (req, res) => {
  const student = getStudentById(req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found" });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  try {
    const reply = await chat(student, message);
    res.json({ reply });
  } catch (err: any) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "Failed to get response" });
  }
});

app.listen(3001, async () => {
  console.log("Counselor backend running on http://localhost:3001");

  try {
    await loadStudents();
  } catch (err: any) {
    console.error("Failed to load students:", err.message);
  }
});
