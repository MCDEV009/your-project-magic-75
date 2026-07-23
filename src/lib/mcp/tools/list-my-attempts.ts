import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_my_attempts",
  title: "List my test attempts",
  description: "List the signed-in user's recent test attempts with score and status.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max rows to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const uid = ctx.getUserId();
    const { data: parts } = await supabase
      .from("test_participants")
      .select("id")
      .eq("user_id", uid);
    const pids = (parts ?? []).map((p: any) => p.id);
    if (pids.length === 0) {
      return { content: [{ type: "text", text: "[]" }], structuredContent: { attempts: [] } };
    }
    const { data, error } = await supabase
      .from("test_attempts")
      .select("id, test_id, status, score, mcq_score, written_score, total_questions, correct_answers, submitted_at, created_at")
      .in("participant_id", pids)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { attempts: data },
    };
  },
});