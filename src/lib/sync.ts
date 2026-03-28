// Cross-feature data sync utilities for MediTrack
import { store, type Medication } from "@/lib/store";

/** Log a medication dose as taken into medical_records */
export async function logMedTaken(med: Medication) {
  const now = new Date();
  await store.addRecord({
    type: "medication_log",
    category: "medication_log",
    description: JSON.stringify({
      medName: med.name,
      dose: med.dose,
      medType: med.medType,
      takenAt: now.toISOString(),
      stock: med.stock,
    }),
    date: now.toISOString().split("T")[0],
  });
}

/** Log a medication dose as un-taken (undo) */
export async function logMedUntaken(med: Medication) {
  const now = new Date();
  await store.addRecord({
    type: "medication_log",
    category: "medication_log",
    description: JSON.stringify({
      medName: med.name,
      dose: med.dose,
      action: "undo",
      at: now.toISOString(),
    }),
    date: now.toISOString().split("T")[0],
  });
}

/** Build a rich context string for AI (chat/voice) with full patient data */
export async function buildFullContext(): Promise<string> {
  const [meds, appointments, profile, records, todos] = await Promise.all([
    store.getMeds(),
    store.getAppointments(),
    store.getProfile(),
    store.getRecords(),
    store.getTodos(),
  ]);

  const parts: string[] = [];

  // Patient basics
  if (profile.name) parts.push(`Patient: ${profile.name}`);
  if (profile.age) parts.push(`Age: ${profile.age}`);
  if (profile.gender) parts.push(`Gender: ${profile.gender}`);
  if (profile.bloodGroup) parts.push(`Blood group: ${profile.bloodGroup}`);
  if (profile.dateOfBirth) parts.push(`DOB: ${profile.dateOfBirth}`);

  // Allergies
  if (profile.allergies?.length > 0) {
    parts.push("Allergies:\n" + profile.allergies.map(a =>
      `- ${a.name} (severity: ${a.severity})`
    ).join("\n"));
  }

  // Chronic conditions
  if (profile.chronicConditions?.length > 0) {
    parts.push("Chronic conditions:\n" + profile.chronicConditions.map(c =>
      `- ${c.description}${c.year ? ` (since ${c.year})` : ""}`
    ).join("\n"));
  }

  // Family history
  if (profile.familyHistory?.length > 0) {
    parts.push("Family history:\n" + profile.familyHistory.map(f =>
      `- ${f.description}`
    ).join("\n"));
  }

  // Current medications
  if (meds.length > 0) {
    parts.push("Current medications:\n" + meds.map(m => {
      const status = m.taken ? `✓ taken${m.takenAt ? ` at ${m.takenAt}` : ""}` : "not yet taken";
      return `- ${m.name} ${m.dose}, ${m.medType}, schedule: ${m.schedule} (${m.foodTiming} food), stock: ${m.stock}, today: ${status}`;
    }).join("\n"));
  }

  // Medication adherence (last 7 days from logs)
  const medLogs = records.filter(r => r.type === "medication_log");
  if (medLogs.length > 0) {
    const recent = medLogs.slice(0, 30);
    const takenCount: Record<string, number> = {};
    for (const log of recent) {
      try {
        const d = JSON.parse(log.description);
        if (d.action !== "undo") {
          takenCount[d.medName] = (takenCount[d.medName] || 0) + 1;
        }
      } catch { /* skip */ }
    }
    if (Object.keys(takenCount).length > 0) {
      parts.push("Recent adherence (doses logged):\n" + Object.entries(takenCount).map(
        ([name, count]) => `- ${name}: ${count} doses taken recently`
      ).join("\n"));
    }
  }

  // To-do items
  const incompleteTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed).slice(0, 10);
  if (incompleteTodos.length > 0) {
    parts.push("Pending to-do items:\n" + incompleteTodos.map(t =>
      `- ${t.title}${t.description ? ` — ${t.description}` : ""}${t.dueDate ? ` (due: ${t.dueDate})` : ""} [source: ${t.source}]`
    ).join("\n"));
  }
  if (completedTodos.length > 0) {
    parts.push("Recently completed to-dos:\n" + completedTodos.map(t =>
      `- ✓ ${t.title}`
    ).join("\n"));
  }

  // Pending appointments (AI-recommended)
  const pendingAppts = appointments.filter(a => a.status === "pending");
  if (pendingAppts.length > 0) {
    parts.push("Pending appointments (AI-recommended, awaiting confirmation):\n" + pendingAppts.map(a =>
      `- ${a.doctor} — ${a.symptoms?.length ? a.symptoms.join(", ") : "follow-up"}`
    ).join("\n"));
  }

  // Upcoming appointments
  const upcoming = appointments.filter(a => a.status === "upcoming");
  if (upcoming.length > 0) {
    parts.push("Upcoming appointments:\n" + upcoming.map(a =>
      `- ${a.doctor} on ${new Date(a.date).toLocaleDateString()}, location: ${a.location}${a.symptoms?.length ? `, symptoms: ${a.symptoms.join(", ")}` : ""}`
    ).join("\n"));
  }

  const completed = appointments.filter(a => a.status === "completed").slice(0, 5);
  if (completed.length > 0) {
    parts.push("Recent visits:\n" + completed.map(a =>
      `- ${a.doctor} on ${new Date(a.date).toLocaleDateString()}${a.rating ? `, rated ${a.rating}/5` : ""}${a.doctorAdvice ? `, advice: ${a.doctorAdvice}` : ""}${a.prescriptions ? `, prescriptions: ${a.prescriptions}` : ""}${a.followUpTests ? `, follow-up tests: ${a.followUpTests}` : ""}`
    ).join("\n"));
  }

  // Medical records (non-log entries)
  const medicalRecords = records.filter(r => r.type !== "medication_log").slice(0, 20);
  if (medicalRecords.length > 0) {
    parts.push("Medical records:\n" + medicalRecords.map(r => {
      // Try to parse JSON descriptions for richer context
      try {
        const d = JSON.parse(r.description);
        if (d.type === 'recording_transcription') {
          return `- [Transcription] ${d.summary || 'Voice recording'}${d.extractedItems?.length ? ` — Items: ${d.extractedItems.join('; ')}` : ''}`;
        }
        if (d.doctor) {
          return `- [Doctor Visit] ${d.doctor}${d.advice ? ` — Advice: ${d.advice}` : ''}${d.prescriptions ? ` — Rx: ${d.prescriptions}` : ''}`;
        }
      } catch { /* not JSON */ }
      return `- [${r.type}] ${r.description}${r.date ? ` (${r.date})` : ""}`;
    }).join("\n"));
  }

  // Emergency info
  if (profile.emergencyContactName) {
    parts.push(`Emergency contact: ${profile.emergencyContactName} (${profile.emergencyContactPhone})`);
  }
  if (profile.organDonor) parts.push("Organ donor: Yes");
  if (profile.jehovahWitness) parts.push("Jehovah's Witness: Yes (no blood transfusion)");
  if (profile.dnr) parts.push("DNR: Yes");

  return parts.join("\n\n");
}
