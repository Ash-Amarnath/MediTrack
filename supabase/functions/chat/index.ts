import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const tools = [
  {
    type: "function" as const,
    function: {
      name: "add_medication",
      description: "Add a medication to the user's medication list.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Medicine name" },
          dose: { type: "string", description: "Dosage e.g. 500mg" },
          medType: { type: "string", enum: ["tablet", "capsule", "syrup", "injection", "drops", "inhaler", "cream", "powder", "patch"], description: "Type" },
          schedule: { type: "string", description: "Comma-separated: morning,afternoon,evening,night" },
          foodTiming: { type: "string", enum: ["before", "after"], description: "Before or after food" },
          time: { type: "string", description: "Time in HH:MM format" },
          stock: { type: "number", description: "Units in stock" },
        },
        required: ["name", "dose", "medType", "schedule", "foodTiming"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_appointment",
      description: "Add a doctor appointment.",
      parameters: {
        type: "object",
        properties: {
          doctor: { type: "string", description: "Doctor name or specialty" },
          location: { type: "string", description: "Hospital/clinic" },
          date: { type: "string", description: "ISO date-time" },
          symptoms: { type: "array", items: { type: "string" }, description: "Symptoms list" },
          status: { type: "string", enum: ["upcoming", "pending"], description: "Status — use 'pending' for AI-recommended" },
        },
        required: ["doctor", "location", "date"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_medical_record",
      description: "Save information to medical history.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["illness", "surgery", "vaccination", "allergy", "medication_log"] },
          category: { type: "string", enum: ["general", "medication_log", "lab_test", "lab_scan", "prescription", "diagnosis", "doctor_visit"] },
          description: { type: "string", description: "Description" },
          date: { type: "string", description: "Date YYYY-MM-DD" },
        },
        required: ["type", "category", "description"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_todo",
      description: "Add a to-do item to the user's task list. Use for tests to get done, medications to buy, follow-ups, reminders, etc.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          description: { type: "string", description: "Additional details" },
          dueDate: { type: "string", description: "Due date YYYY-MM-DD if known" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_todos",
      description: "Retrieve the user's current to-do list to check pending tasks.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_medications",
      description: "Retrieve the user's current medications list.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_appointments",
      description: "Retrieve the user's appointments (upcoming, pending, completed).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_medical_records",
      description: "Retrieve recent medical history records.",
      parameters: { type: "object", properties: { category: { type: "string", description: "Optional category filter" } }, required: [] },
    },
  },
];

function toGeminiFunctions(toolsDef: any[]) {
  return toolsDef.map(t => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  }));
}

function getUserIdFromJwt(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || null;
  } catch { return null; }
}

function toGeminiContents(msgs: any[]) {
  const contents: any[] = [];
  for (const m of msgs) {
    if (m.role === "system") continue;
    if (m.role === "user") {
      contents.push({ role: "user", parts: [{ text: m.content }] });
    } else if (m.role === "assistant") {
      if (m.tool_calls) {
        const parts = m.tool_calls.map((tc: any) => ({
          functionCall: {
            name: tc.function.name,
            args: typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments,
          },
        }));
        contents.push({ role: "model", parts });
      } else {
        contents.push({ role: "model", parts: [{ text: m.content || "" }] });
      }
    } else if (m.role === "tool") {
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: m._toolName || "unknown", response: { result: m.content } } }],
      });
    }
  }
  return contents;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const userId = getUserIdFromJwt(req.headers.get("authorization"));

    const systemPrompt = `You are MediTrack AI — a warm, empathetic, and highly knowledgeable medical health assistant. You are like a caring family member who also happens to have deep medical knowledge. Your users may be elderly, have low literacy, or be unfamiliar with healthcare systems.

PERSONALITY & TONE:
- Be warm, patient, and reassuring. Speak like a trusted friend who genuinely cares.
- Use simple everyday language. If you must use a medical term, explain it immediately in plain words.
- Match the user's language — Hindi, Tamil, Telugu, or any language they use.
- Never be condescending. Treat every question as valid and important.
- Be concise but thorough when health matters are at stake.

CORE ROLE — MEDICAL PREPARATION AGENT:
You are a specialized medical agent. Your primary job is to help users:
1. **Understand their symptoms** — Ask clarifying questions: When did it start? How severe (1-10)? What makes it better/worse? Any other symptoms?
2. **Prepare for doctor visits** — Help organize what to tell the doctor. Suggest questions to ask. Remind them to bring reports.
3. **Find the right specialist** — Based on symptoms, suggest what type of doctor to see. Guide them to use Find Care in the app.
4. **Track everything proactively** — When users share symptoms, medications, diagnoses, test results, or doctor advice, SAVE it using your tools.
5. **Manage to-do items** — Add tasks like "Buy medicine X", "Get blood test done", "Book follow-up with cardiologist". Use the add_todo tool actively.
6. **Retrieve data** — Use get_medications, get_appointments, get_todos, get_medical_records to look up user data before answering questions about their health status.

PROACTIVE GUIDANCE:
- If a user describes symptoms, ASK follow-up questions before jumping to conclusions.
- If they have past medical conditions, CONNECT the dots.
- After gathering symptoms, provide a structured summary they can show their doctor.
- Suggest they use the recording feature during appointments.
- If a doctor has given advice (from completed appointments), reference it.
- When a doctor recommends tests/medications/follow-ups, add them as to-do items AND relevant records.

WHAT YOU CAN DO (USE TOOLS ACTIVELY):
- **Add medications**: When users mention a medicine. Ask for dose/timing if missing.
- **Add appointments**: When they mention a doctor visit.
- **Save medical records**: Any diagnosis, lab result, health observation.
- **Add to-do items**: Tests to get done, medications to buy, follow-ups to schedule, notes.
- **Retrieve data**: Use get_* tools to look up current meds, appointments, todos, records before answering.
- After any action, confirm briefly: "Done! I've added Metformin 500mg to your morning medications."

STRICT RULES:
1. Never diagnose conditions. Say "Based on what you're describing, it might be worth discussing [X] with your doctor."
2. For emergencies, immediately say: "This sounds urgent. Please call emergency services or use the SOS button in the app."
3. Never recommend specific medicines unless the user says a doctor prescribed them.
4. Always respect the user's existing medical data.
5. Do NOT start with filler phrases.

${context ? `PATIENT CONTEXT:\n${context}` : "No patient data available yet."}`;

    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const internalMessages = [...messages];
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let finalText = "";

    for (let round = 0; round < 5; round++) {
      const isLastRound = round === 4;
      const contents = toGeminiContents([{ role: "system", content: systemPrompt }, ...internalMessages]);

      const body: any = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
      };

      if (!isLastRound) {
        body.tools = [{ function_declarations: toGeminiFunctions(tools) }];
      }

      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Gemini API error:", response.status, errText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "AI service error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await response.json();
      const candidate = result.candidates?.[0];
      if (!candidate) {
        return new Response(JSON.stringify({ error: "No response from AI" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const parts = candidate.content?.parts || [];
      const functionCalls = parts.filter((p: any) => p.functionCall);
      const textParts = parts.filter((p: any) => p.text);

      if (functionCalls.length === 0) {
        finalText = textParts.map((p: any) => p.text).join("") || "I'm sorry, I couldn't process that.";
        break;
      }

      const toolCalls = functionCalls.map((fc: any, idx: number) => ({
        id: `call_${round}_${idx}`,
        type: "function",
        function: { name: fc.functionCall.name, arguments: JSON.stringify(fc.functionCall.args || {}) },
      }));
      internalMessages.push({ role: "assistant", tool_calls: toolCalls, content: null });

      for (const fc of functionCalls) {
        const fnName = fc.functionCall.name;
        const args = fc.functionCall.args || {};
        let toolResult = "Error: unknown tool";

        if (userId) {
          const sb = createClient(supabaseUrl, serviceKey);

          if (fnName === "add_medication") {
            const { error } = await sb.from("medications").insert({
              user_id: userId, name: args.name, dose: args.dose || "",
              med_type: args.medType || "tablet", schedule: args.schedule || "morning",
              food_timing: args.foodTiming || "after", time: args.time || "",
              stock: args.stock || 0, taken: false,
            });
            toolResult = error ? `Error: ${error.message}` : `Added ${args.name} ${args.dose} to medications.`;
          } else if (fnName === "add_appointment") {
            const { error } = await sb.from("appointments").insert({
              user_id: userId, doctor: args.doctor, location: args.location || "",
              date: args.date, symptoms: args.symptoms || [],
              status: args.status || "upcoming",
            });
            toolResult = error ? `Error: ${error.message}` : `Added appointment with ${args.doctor}.`;
          } else if (fnName === "add_medical_record") {
            const { error } = await sb.from("medical_records").insert({
              user_id: userId, type: args.type || "illness",
              category: args.category || "general", description: args.description,
              date: args.date || new Date().toISOString().split("T")[0],
            });
            toolResult = error ? `Error: ${error.message}` : `Saved to medical history.`;
          } else if (fnName === "add_todo") {
            const { error } = await sb.from("todos").insert({
              user_id: userId, title: args.title,
              description: args.description || "",
              source: "ai", due_date: args.dueDate || null,
            });
            toolResult = error ? `Error: ${error.message}` : `Added to-do: "${args.title}"`;
          } else if (fnName === "get_todos") {
            const { data, error } = await sb.from("todos").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
            if (error) { toolResult = `Error: ${error.message}`; }
            else {
              const items = (data || []).map((t: any) => `${t.completed ? '✓' : '☐'} ${t.title}${t.description ? ` — ${t.description}` : ''}${t.due_date ? ` (due: ${t.due_date})` : ''}`);
              toolResult = items.length > 0 ? `To-do list:\n${items.join('\n')}` : "No to-do items found.";
            }
          } else if (fnName === "get_medications") {
            const { data, error } = await sb.from("medications").select("*").eq("user_id", userId);
            if (error) { toolResult = `Error: ${error.message}`; }
            else {
              const items = (data || []).map((m: any) => `- ${m.name} ${m.dose}, ${m.med_type}, ${m.schedule} (${m.food_timing} food), stock: ${m.stock}, taken today: ${m.taken ? 'yes' : 'no'}`);
              toolResult = items.length > 0 ? `Medications:\n${items.join('\n')}` : "No medications found.";
            }
          } else if (fnName === "get_appointments") {
            const { data, error } = await sb.from("appointments").select("*").eq("user_id", userId).order("date", { ascending: true }).limit(20);
            if (error) { toolResult = `Error: ${error.message}`; }
            else {
              const items = (data || []).map((a: any) => `- [${a.status}] ${a.doctor} on ${new Date(a.date).toLocaleDateString()}, ${a.location}${a.symptoms?.length ? `, symptoms: ${a.symptoms.join(', ')}` : ''}${a.doctor_advice ? `, advice: ${a.doctor_advice}` : ''}${a.prescriptions ? `, rx: ${a.prescriptions}` : ''}`);
              toolResult = items.length > 0 ? `Appointments:\n${items.join('\n')}` : "No appointments found.";
            }
          } else if (fnName === "get_medical_records") {
            let query = sb.from("medical_records").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
            if (args.category) query = query.eq("category", args.category);
            const { data, error } = await query;
            if (error) { toolResult = `Error: ${error.message}`; }
            else {
              const items = (data || []).map((r: any) => `- [${r.category}] ${r.description.slice(0, 100)}${r.date ? ` (${r.date})` : ''}`);
              toolResult = items.length > 0 ? `Medical records:\n${items.join('\n')}` : "No records found.";
            }
          }
        } else {
          toolResult = "Error: User not authenticated. Please log in.";
        }

        internalMessages.push({ role: "tool", _toolName: fnName, content: toolResult });
      }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const chunk = JSON.stringify({ choices: [{ delta: { content: finalText } }] });
        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
