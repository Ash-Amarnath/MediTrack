import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getUserIdFromJwt(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || null;
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { recordingPath, appointmentId, source } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const userId = getUserIdFromJwt(req.headers.get("authorization"));
    if (!userId) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Determine bucket based on source
    const bucket = source === "medical-history" ? "medical-attachments" : "appointment-recordings";

    // Download the audio file
    const { data: fileData, error: dlError } = await sb.storage.from(bucket).download(recordingPath);
    if (dlError || !fileData) {
      console.error("Download error:", dlError);
      return new Response(JSON.stringify({ error: "Could not download recording" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert to base64
    const arrayBuf = await fileData.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));

    // Send to Gemini for transcription + extraction
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const extractionPrompt = `You are a medical transcription and data extraction AI. You will receive an audio recording from a medical context (doctor visit, lab report discussion, etc.).

Your tasks:
1. **Transcribe** the audio accurately
2. **Extract actionable items** into structured JSON

Return ONLY valid JSON in this exact format:
{
  "transcription": "Full transcription of the audio...",
  "summary": "Brief 2-3 sentence summary of key points",
  "extracted": {
    "medications": [
      { "name": "Medicine Name", "dose": "500mg", "medType": "tablet", "schedule": "morning,evening", "foodTiming": "after", "notes": "any special instructions" }
    ],
    "diagnoses": [
      { "condition": "Condition name", "details": "Any details mentioned" }
    ],
    "labTests": [
      { "test": "Test name", "reason": "Why it was recommended", "urgency": "routine|urgent" }
    ],
    "followUpAppointments": [
      { "doctor": "Doctor/Specialty", "reason": "Why follow-up needed", "timeframe": "in 2 weeks", "location": "if mentioned" }
    ],
    "advice": [
      "Any lifestyle, diet, or general medical advice given"
    ]
  }
}

If any category has no items, use empty arrays. Be thorough — capture every medication, test, diagnosis, and follow-up mentioned.`;

    const geminiResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: extractionPrompt },
            {
              inlineData: {
                mimeType: "audio/webm",
                data: base64Audio,
              },
            },
          ],
        }],
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini error:", geminiResponse.status, errText);
      return new Response(JSON.stringify({ error: "Transcription failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiResult = await geminiResponse.json();
    const rawText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from response (handle markdown code blocks)
    let parsed: any;
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawText];
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch {
      console.error("Failed to parse Gemini JSON:", rawText);
      parsed = { transcription: rawText, summary: "", extracted: { medications: [], diagnoses: [], labTests: [], followUpAppointments: [], advice: [] } };
    }

    const { transcription, summary, extracted } = parsed;

    // Now auto-save extracted data to appropriate tables
    const results: string[] = [];

    // Save medications
    if (extracted.medications?.length > 0) {
      for (const med of extracted.medications) {
        const { error } = await sb.from("medications").insert({
          user_id: userId,
          name: med.name,
          dose: med.dose || "",
          med_type: med.medType || "tablet",
          schedule: med.schedule?.split(",")[0] || "morning",
          food_timing: med.foodTiming || "after",
          time: "",
          stock: 0,
          taken: false,
        });
        if (!error) results.push(`Added medication: ${med.name}`);
      }
    }

    // Save diagnoses to medical records
    if (extracted.diagnoses?.length > 0) {
      for (const diag of extracted.diagnoses) {
        await sb.from("medical_records").insert({
          user_id: userId,
          type: "illness",
          category: "diagnosis",
          description: `${diag.condition}${diag.details ? ` — ${diag.details}` : ""}`,
          date: new Date().toISOString().split("T")[0],
        });
        results.push(`Saved diagnosis: ${diag.condition}`);
      }
    }

    // Save lab test recommendations as pending appointments
    if (extracted.labTests?.length > 0) {
      for (const test of extracted.labTests) {
        await sb.from("appointments").insert({
          user_id: userId,
          doctor: `Lab Test: ${test.test}`,
          location: "",
          date: new Date(Date.now() + 7 * 86400000).toISOString(), // default 1 week out
          symptoms: [test.reason || "Recommended by doctor"],
          status: "pending",
        });
        results.push(`Pending lab test: ${test.test}`);

        // Also save to medical records
        await sb.from("medical_records").insert({
          user_id: userId,
          type: "illness",
          category: "lab_test",
          description: `Recommended: ${test.test} — ${test.reason || "Doctor recommendation"}${test.urgency === "urgent" ? " (URGENT)" : ""}`,
          date: new Date().toISOString().split("T")[0],
        });
      }
    }

    // Save follow-up appointments as pending + todos
    if (extracted.followUpAppointments?.length > 0) {
      for (const appt of extracted.followUpAppointments) {
        await sb.from("appointments").insert({
          user_id: userId,
          doctor: appt.doctor,
          location: appt.location || "",
          date: new Date(Date.now() + 14 * 86400000).toISOString(),
          symptoms: [appt.reason || "Follow-up"],
          status: "pending",
        });
        results.push(`Pending follow-up: ${appt.doctor}`);

        // Also add as todo
        await sb.from("todos").insert({
          user_id: userId,
          title: `Follow-up: ${appt.doctor}`,
          description: `${appt.reason || 'Follow-up appointment'}${appt.timeframe ? ` — ${appt.timeframe}` : ''}`,
          source: "transcription",
          due_date: null,
        });
      }
    }

    // Save advice to medical records
    if (extracted.advice?.length > 0) {
      await sb.from("medical_records").insert({
        user_id: userId,
        type: "illness",
        category: "general",
        description: `Doctor's Advice:\n${extracted.advice.join("\n• ")}`,
        date: new Date().toISOString().split("T")[0],
      });
      results.push("Saved doctor's advice");
    }

    // Save lab test todos
    if (extracted.labTests?.length > 0) {
      for (const test of extracted.labTests) {
        await sb.from("todos").insert({
          user_id: userId,
          title: `Get test: ${test.test}`,
          description: `${test.reason || 'Doctor recommended'}${test.urgency === 'urgent' ? ' — URGENT' : ''}`,
          source: "transcription",
          due_date: null,
        });
      }
    }

    // Save medication todos
    if (extracted.medications?.length > 0) {
      for (const med of extracted.medications) {
        if (med.notes) {
          await sb.from("todos").insert({
            user_id: userId,
            title: `Buy ${med.name} ${med.dose || ''}`.trim(),
            description: med.notes || '',
            source: "transcription",
            due_date: null,
          });
        }
      }
    }

    // Save transcription as a medical record too
    await sb.from("medical_records").insert({
      user_id: userId,
      type: "illness",
      category: source === "medical-history" ? "general" : "doctor_visit",
      description: JSON.stringify({
        type: "recording_transcription",
        transcription,
        summary,
        appointmentId: appointmentId || null,
        extractedItems: results,
      }),
      date: new Date().toISOString().split("T")[0],
    });

    // If linked to an appointment, update its notes
    if (appointmentId) {
      const updateData: any = {};
      if (summary) updateData.notes = summary;
      if (extracted.advice?.length) updateData.doctor_advice = extracted.advice.join("; ");
      if (extracted.medications?.length) updateData.prescriptions = extracted.medications.map((m: any) => `${m.name} ${m.dose}`).join(", ");
      if (extracted.labTests?.length) updateData.follow_up_tests = extracted.labTests.map((t: any) => t.test).join(", ");
      if (Object.keys(updateData).length > 0) {
        await sb.from("appointments").update(updateData).eq("id", appointmentId);
      }
    }

    return new Response(JSON.stringify({
      transcription,
      summary,
      extracted,
      actions: results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Transcribe error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
