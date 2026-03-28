import { useState } from "react";
import { ArrowLeft, Plus, FileDown, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import MediTrackHeader from "@/components/MediTrackHeader";

interface Symptom {
  name: string;
  duration: string;
  severity: number;
}

const AppointmentPrep = () => {
  const navigate = useNavigate();
  const [symptoms, setSymptoms] = useState<Symptom[]>([{ name: "", duration: "", severity: 5 }]);
  const [medications, setMedications] = useState<string[]>([""]);
  const [allergies, setAllergies] = useState<string[]>([""]);

  const addSymptom = () => setSymptoms([...symptoms, { name: "", duration: "", severity: 5 }]);
  const addMedication = () => setMedications([...medications, ""]);
  const addAllergy = () => setAllergies([...allergies, ""]);

  const updateSymptom = (index: number, field: keyof Symptom, value: string | number) => {
    const updated = [...symptoms];
    (updated[index] as any)[field] = value;
    setSymptoms(updated);
  };

  const SectionHeader = ({ number, title, extra }: { number: number; title: string; extra?: React.ReactNode }) => (
    <div className="flex items-center gap-3 mt-6 mb-3">
      <div className="meditrack-section-indicator h-6" aria-hidden="true" />
      <h2 className="text-base font-bold text-foreground">{number}. {title}</h2>
      {extra && <div className="ml-auto">{extra}</div>}
    </div>
  );

  return (
    <div className="meditrack-container" role="main" aria-label="Appointment Preparation form">
      <MediTrackHeader />

      <div className="px-4 py-4 pb-8">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-1"
          aria-label="Go back to home"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back
        </button>

        <h1 className="text-xl font-bold text-foreground animate-fade-up">Appointment Preparation</h1>

        {/* 1. Visit Details */}
        <div className="animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <SectionHeader number={1} title="Visit Details" />
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" htmlFor="doctor-name">
                Doctor / Clinic Name
              </label>
              <Input id="doctor-name" placeholder="e.g. Dr. Sharma, Apollo Clinic" className="mt-1 rounded-xl" aria-label="Doctor or clinic name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" htmlFor="specialty">
                  Specialty
                </label>
                <Input id="specialty" placeholder="e.g. Cardiologist" className="mt-1 rounded-xl" aria-label="Doctor specialty" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" htmlFor="visit-date">
                  Date
                </label>
                <Input id="visit-date" type="date" className="mt-1 rounded-xl" aria-label="Visit date" />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Main Concern */}
        <div className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <SectionHeader number={2} title="Main Concern" />
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" htmlFor="main-concern">
              Why are you visiting today?
            </label>
            <Textarea
              id="main-concern"
              placeholder="Describe your primary reason for the visit..."
              className="mt-1 rounded-xl min-h-[80px]"
              aria-label="Describe your primary reason for the visit"
            />
          </div>
        </div>

        {/* 3. Symptoms */}
        <div className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <SectionHeader number={3} title="Symptoms" />
          <div className="space-y-4">
            {symptoms.map((symptom, i) => (
              <div key={i} className="meditrack-card space-y-3" role="group" aria-label={`Symptom ${i + 1}`}>
                <Input
                  placeholder="Symptom (e.g. Chest pain)"
                  value={symptom.name}
                  onChange={(e) => updateSymptom(i, "name", e.target.value)}
                  className="rounded-xl"
                  aria-label={`Symptom ${i + 1} name`}
                />
                <Input
                  placeholder="Duration (e.g. 2 days)"
                  value={symptom.duration}
                  onChange={(e) => updateSymptom(i, "duration", e.target.value)}
                  className="rounded-xl"
                  aria-label={`Symptom ${i + 1} duration`}
                />
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-primary">Severity</span>
                    <span className="text-muted-foreground">{symptom.severity}/10</span>
                  </div>
                  <Slider
                    value={[symptom.severity]}
                    onValueChange={(v) => updateSymptom(i, "severity", v[0])}
                    max={10}
                    min={1}
                    step={1}
                    className="w-full"
                    aria-label={`Symptom ${i + 1} severity, currently ${symptom.severity} out of 10`}
                  />
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={addSymptom} className="w-full rounded-xl gap-1" aria-label="Add another symptom">
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add Symptom
            </Button>
          </div>
        </div>

        {/* 4. Current Medications */}
        <div className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <SectionHeader
            number={4}
            title="Current Medications"
            extra={
              <button className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline" aria-label="Import medications from uploaded report">
                <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />
                Import from Report
              </button>
            }
          />
          <div className="space-y-2">
            {medications.map((med, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Add medication..."
                  value={med}
                  onChange={(e) => {
                    const updated = [...medications];
                    updated[i] = e.target.value;
                    setMedications(updated);
                  }}
                  className="rounded-xl"
                  aria-label={`Medication ${i + 1}`}
                />
                {i === medications.length - 1 && (
                  <Button size="icon" onClick={addMedication} className="shrink-0 rounded-xl" aria-label="Add another medication">
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 5. Known Allergies */}
        <div className="animate-fade-up" style={{ animationDelay: "0.25s" }}>
          <SectionHeader number={5} title="Known Allergies" />
          <div className="space-y-2">
            {allergies.map((allergy, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Add allergy..."
                  value={allergy}
                  onChange={(e) => {
                    const updated = [...allergies];
                    updated[i] = e.target.value;
                    setAllergies(updated);
                  }}
                  className="rounded-xl"
                  aria-label={`Allergy ${i + 1}`}
                />
                {i === allergies.length - 1 && (
                  <Button size="icon" onClick={addAllergy} className="shrink-0 rounded-xl" aria-label="Add another allergy">
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 6. Past History */}
        <div className="animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <SectionHeader number={6} title="Past History" />
          <Textarea
            placeholder="Any past illnesses, surgeries, or conditions?"
            className="rounded-xl min-h-[80px]"
            aria-label="Past medical history, surgeries, or conditions"
          />
        </div>

        {/* Generate Button */}
        <div className="mt-8 animate-fade-up" style={{ animationDelay: "0.35s" }}>
          <Button className="w-full h-14 rounded-2xl text-base font-bold gap-2" aria-label="Generate my doctor summary">
            <FileDown className="w-5 h-5" aria-hidden="true" />
            Generate My Doctor Summary
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AppointmentPrep;
