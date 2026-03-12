import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { loadStudents, getStudents, getStudentById } from "./students.js";
import { generateSummary, chat, clearStudentCache } from "./chat.js";
import { getClrData, clearClrCache } from "./clr.js";

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

// Get student detail (instant, no LLM)
app.get("/api/students/:id", (req, res) => {
  const student = getStudentById(req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found" });
  res.json(student);
});

// Get CLR data (instant, no LLM)
app.get("/api/students/:id/clr", async (req, res) => {
  const student = getStudentById(req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found" });

  try {
    const clr = await getClrData(student.id);
    res.json({ hasClr: !!clr, clr });
  } catch (err: any) {
    console.error("CLR error:", err.message);
    res.status(500).json({ error: "Failed to fetch CLR" });
  }
});

// Get AI summary
app.get("/api/students/:id/summary", async (req, res) => {
  const student = getStudentById(req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found" });

  try {
    const { summary, hasClr } = await generateSummary(student);
    res.json({ student, summary, hasClr });
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

// Reset cached data for a student
app.post("/api/students/:id/reset", (req, res) => {
  const student = getStudentById(req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found" });

  clearStudentCache(student.id);
  clearClrCache(student.id);
  res.json({ ok: true });
});

// Serve static frontend in production (Docker)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));
app.get("*", (_req, res, next) => {
  if (_req.path.startsWith("/api")) return next();
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(3001, async () => {
  console.log("Counselor backend running on http://localhost:3001");

  try {
    await loadStudents();
  } catch (err: any) {
    console.error("Failed to load students:", err.message);
  }

});
