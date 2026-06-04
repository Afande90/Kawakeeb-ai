/**
 * Pattern 5 (Odysseus) — Teacher escalation + skill capture. The moat.
 *
 * A cheap model handles the turn. If it fails (failure-detection regex), a
 * stronger "teacher" model is called to fix it. The teacher ALSO writes a
 * reusable skill row to Supabase capturing the lesson — but only if the
 * teacher's own output passes the same failure check (no persisting garbage).
 *
 * Matching skills are then injected into the cheap model's prompt next time,
 * so the system gets cheaper AND smarter over time.
 *
 * Source: odysseus teacher_escalation.py.
 */

import "server-only";
import { generateText } from "ai";
import { createSkill, listSkills } from "@/lib/db/agents";
import { replyIndicatesFailure } from "./failure-detection";
import { getNextAvailableModel } from "./multi-providers";

export interface TeacherResult {
  escalated: boolean;
  skillCaptured: boolean;
  text: string;
}

/**
 * Run a prompt with teacher escalation.
 *
 * 1. Cheap model attempts the task (caller usually already did this and passes
 *    the cheapReply in; if not, we run it).
 * 2. If the cheap reply failed, call the teacher (reasoning model) to fix it.
 * 3. If the teacher's reply passes the failure check, persist a skill capturing
 *    how to handle this class of request.
 */
export async function escalateIfFailed(opts: {
  prompt: string;
  system: string;
  cheapReply: string;
  /** category for any captured skill */
  category?: string;
}): Promise<TeacherResult> {
  const { prompt, system, cheapReply, category = "general" } = opts;

  if (!replyIndicatesFailure(cheapReply)) {
    return { text: cheapReply, escalated: false, skillCaptured: false };
  }

  // ─── Escalate to teacher ───
  let teacherText = cheapReply;
  try {
    const { model } = await getNextAvailableModel("reasoning");
    const res = await generateText({
      model,
      system: `${system}\n\nA cheaper assistant could not complete this request. Solve it correctly and completely.`,
      prompt,
    });
    teacherText = res.text;
  } catch (err) {
    console.error("[teacher] escalation call failed:", err);
    return { text: cheapReply, escalated: true, skillCaptured: false };
  }

  // Only capture a skill if the teacher actually succeeded.
  if (replyIndicatesFailure(teacherText)) {
    return { text: teacherText, escalated: true, skillCaptured: false };
  }

  // ─── Capture the lesson as a skill ───
  let skillCaptured = false;
  try {
    const { model } = await getNextAvailableModel("fast");
    const lesson = await generateText({
      model,
      system:
        "Write a concise reusable skill (markdown) that teaches how to handle " +
        "this CLASS of request well, based on the successful answer. Generalize " +
        "— don't just restate the specific answer. Start with a one-line title.",
      prompt: `REQUEST:\n${prompt}\n\nSUCCESSFUL ANSWER:\n${teacherText}`,
    });
    const content = lesson.text.trim();
    if (content && !replyIndicatesFailure(content)) {
      const firstLine = content
        .split("\n")[0]
        .replace(/^#+\s*/, "")
        .slice(0, 80);
      await createSkill({
        name: firstLine || "Captured skill",
        description: "Auto-captured from a teacher escalation.",
        content,
        category,
      });
      skillCaptured = true;
    }
  } catch (err) {
    console.error("[teacher] skill capture failed:", err);
  }

  return { text: teacherText, escalated: true, skillCaptured };
}

/**
 * Find skills whose name/description loosely match the prompt, to inject into
 * the cheap model next time. Simple keyword overlap — cheap and dependency-free.
 */
export async function findRelevantSkills(
  prompt: string,
  limit = 3
): Promise<string[]> {
  const skills = await listSkills({ activeOnly: true });
  const words = new Set(
    prompt
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3)
  );
  const scored = skills
    .map((s) => {
      const hay = `${s.name} ${s.description ?? ""}`.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (hay.includes(w)) {
          score += 1;
        }
      }
      return { skill: s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((x) => x.skill.content);
}
