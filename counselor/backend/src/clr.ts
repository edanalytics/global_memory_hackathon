// CLR (Comprehensive Learner Record) data from Snowflake.
// Stubs for now — replace queries once we know the schema.

import { query } from "./snowflake.js";

export async function getTranscript(studentId: string) {
  // TODO: query Snowflake for transcript data
  // return query("SELECT * FROM transcripts WHERE student_id = ?", [studentId]);
  return null;
}

export async function getAssessments(studentId: string) {
  // TODO: query Snowflake for assessment results
  // return query("SELECT * FROM assessments WHERE student_id = ?", [studentId]);
  return null;
}

export async function getCredentials(studentId: string) {
  // TODO: query Snowflake for credentials/certifications
  // return query("SELECT * FROM credentials WHERE student_id = ?", [studentId]);
  return null;
}
