import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, mimeType } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const extractionPrompt = `You are a medical document analyzer. Analyze this medical document image carefully.

Extract ALL information and return a JSON object with these fields:
{
  "documentType": "prescription" | "lab_report" | "discharge_summary" | "medical_certificate" | "other",
  "summary": "Brief 1-2 sentence summary of the document",
  "medications": [
    {
      "name": "Medicine name",
      "dose": "e.g. 500mg, 5ml",
      "medType": "tablet" | "capsule" | "syrup" | "injection" | "drops" | "inhaler" | "cream" | "powder" | "patch",
      "schedule": "comma-separated: morning,afternoon,evening,night",
      "foodTiming": "before" | "after",
      "time": "HH:MM format if specified, else empty string",
      "startDate": "YYYY-MM-DD if specified, else empty string",
      "endDate": "YYYY-MM-DD if specified, else empty string"
    }
  ],
  "diagnoses": ["List of diagnosed conditions"],
  "labResults": [
    {
      "testName": "e.g. Blood Glucose, Hemoglobin",
      "value": "e.g. 120 mg/dL",
      "normalRange": "e.g. 70-100 mg/dL",
      "status": "normal" | "high" | "low"
    }
  ],
  "followUpTests": ["List of recommended tests or follow-ups"],
  "doctorName": "Doctor's name if visible",
  "date": "Document date in YYYY-MM-DD if visible, else empty string",
  "allergiesNoted": ["Any allergies mentioned"],
  "rawText": "Full readable text extracted from the document"
}

IMPORTANT:
- Extract EVERY medication with full details. If schedule is not mentioned, default to "morning".
- If food timing is not mentioned, default to "after".
- For lab reports, extract every test result.
- Return ONLY the JSON object, no markdown or explanation.`;

    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: extractionPrompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Gemini API error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    let content = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Strip markdown code fences if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Could not parse document. Please try a clearer image." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
