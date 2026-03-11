import "dotenv/config";
import express from "express";
import cors from "cors";
import { students } from "./students.js";
import { generateSummary, chat } from "./chat.js";

const app = express();
app.use(cors());
app.use(express.json());

// Get all students
app.get("/api/students", (_req, res) => {
  res.json(students.map(({ id, name, grade, gpa }) => ({ id, name, grade, gpa })));
});

// Get student detail + AI summary
app.get("/api/students/:id/summary", async (req, res) => {
  const student = students.find((s) => s.id === req.params.id);
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
  const student = students.find((s) => s.id === req.params.id);
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

app.listen(3001, () => {
  console.log("Counselor backend running on http://localhost:3001");
});
