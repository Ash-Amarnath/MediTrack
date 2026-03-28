import { useState, useRef } from "react";
import { X, Camera, Upload, Loader2, Check, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { store, type MedType, type MedSchedule, type FoodTiming } from "@/lib/store";
import { toast } from "@/hooks/use-toast";

interface ScanResult {
  documentType: string;
  summary: string;
  medications: {
    name: string; dose: string; medType: MedType; schedule: string;
    foodTiming: FoodTiming; time: string; startDate: string; endDate: string;
  }[];
  diagnoses: string[];
  labResults: { testName: string; value: string; normalRange: string; status: string }[];
  followUpTests: string[];
  doctorName: string;
  date: string;
  allergiesNoted: string[];
  rawText: string;
}

interface Props { onClose: () => void }

const ScanOverlay = ({ onClose }: Props) => {
  const { t } = useTranslation();
  const [stage, setStage] = useState<"upload" | "analyzing" | "results">("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl.split(",")[1]); // return base64 only
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast({ title: t("scan_invalid_file"), variant: "destructive" });
      return;
    }

    // Show preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    setStage("analyzing");

    try {
      let base64: string;
      let mimeType = file.type;

      if (file.type.startsWith("image/")) {
        // Compress image to reduce payload size
        base64 = await compressImage(file);
        mimeType = "image/jpeg";
      } else {
        // PDF: send as-is
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        base64 = btoa(binary);
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Analysis failed" }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const data: ScanResult = await resp.json();
      setResult(data);
      setStage("results");

      // Auto-save results immediately
      await saveExtractedData(data);
    } catch (err: any) {
      toast({ title: err.message || "Scan failed", variant: "destructive" });
      setStage("upload");
    }
  };

  const saveExtractedData = async (data: ScanResult) => {
    try {
      let medsAdded = 0;
      for (const med of data.medications) {
        await store.addMed({
          name: med.name, dose: med.dose, medType: med.medType as MedType,
          schedule: (med.schedule || "morning") as MedSchedule,
          foodTiming: (med.foodTiming || "after") as FoodTiming,
          time: med.time || "", startDate: med.startDate || undefined,
          endDate: med.endDate || undefined, stock: 0, taken: false,
        });
        medsAdded++;
      }
      if (medsAdded > 0) toast({ title: t("sync_scan_meds_added", { count: medsAdded }) });

      for (const diag of data.diagnoses) {
        await store.addRecord({ type: "illness", category: "diagnosis", description: diag, date: data.date || new Date().toISOString().split("T")[0] });
      }
      for (const lab of data.labResults) {
        await store.addRecord({ type: "illness", category: "lab_test", description: `${lab.testName}: ${lab.value} (Normal: ${lab.normalRange}) - ${lab.status}`, date: data.date || new Date().toISOString().split("T")[0] });
      }
      for (const test of data.followUpTests) {
        await store.addRecord({ type: "illness", category: "general", description: `Follow-up recommended: ${test}`, date: data.date || new Date().toISOString().split("T")[0] });
      }

      await store.addReport({
        title: `${data.documentType === "prescription" ? "Prescription" : data.documentType === "lab_report" ? "Lab Report" : "Medical Document"}${data.doctorName ? ` - Dr. ${data.doctorName}` : ""}`,
        date: data.date || new Date().toISOString().split("T")[0],
        originalText: data.rawText || "", simplifiedText: data.summary || "",
      });

      setSaved(true);
      toast({ title: t("scan_all_saved") });
    } catch (err: any) {
      toast({ title: err.message || "Auto-save failed", variant: "destructive" });
    }
  };



  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground">{t("scan_title")}</h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-accent" aria-label={t("scan_close")}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Upload stage */}
        {stage === "upload" && (
          <div className="flex flex-col items-center justify-center gap-6 min-h-[60vh]">
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Camera className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t("scan_upload_title")}</h3>
              <p className="text-muted-foreground text-sm">{t("scan_upload_desc")}</p>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button
                className="rounded-xl gap-2 h-14 text-base"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="w-5 h-5" /> {t("scan_take_photo")}
              </Button>
              <Button
                variant="outline"
                className="rounded-xl gap-2 h-14 text-base"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-5 h-5" /> {t("scan_upload_file")}
              </Button>
            </div>

            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
              aria-label={t("scan_take_photo")}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
              aria-label={t("scan_upload_file")}
            />
          </div>
        )}

        {/* Analyzing stage */}
        {stage === "analyzing" && (
          <div className="flex flex-col items-center justify-center gap-6 min-h-[60vh]">
            {preview && (
              <img src={preview} alt="Document preview" className="max-h-48 rounded-xl border border-border shadow-sm" />
            )}
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-foreground font-medium">{t("scan_analyzing")}</p>
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-xs">{t("scan_analyzing_desc")}</p>
          </div>
        )}

        {/* Results stage */}
        {stage === "results" && result && (
          <div className="space-y-4 max-w-lg mx-auto">
            {/* Summary */}
            <div className="meditrack-card">
              <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-1">
                {result.documentType.replace("_", " ")}
              </p>
              <p className="text-foreground">{result.summary}</p>
              {result.doctorName && (
                <p className="text-sm text-muted-foreground mt-1">Dr. {result.doctorName}</p>
              )}
            </div>

            {/* Medications found */}
            {result.medications.length > 0 && (
              <div className="meditrack-card">
                <h4 className="font-semibold text-foreground mb-2">{t("scan_meds_found", { count: result.medications.length })}</h4>
                <div className="space-y-2">
                  {result.medications.map((m, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium">{m.name}</span>
                        <span className="text-muted-foreground"> — {m.dose}, {m.schedule}, {m.foodTiming} food</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lab results */}
            {result.labResults.length > 0 && (
              <div className="meditrack-card">
                <h4 className="font-semibold text-foreground mb-2">{t("scan_labs_found", { count: result.labResults.length })}</h4>
                <div className="space-y-2">
                  {result.labResults.map((l, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${l.status === "normal" ? "bg-green-500" : l.status === "high" ? "bg-red-500" : "bg-yellow-500"}`} />
                      <div>
                        <span className="font-medium">{l.testName}:</span>
                        <span className="text-foreground"> {l.value}</span>
                        <span className="text-muted-foreground"> (Normal: {l.normalRange})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Diagnoses */}
            {result.diagnoses.length > 0 && (
              <div className="meditrack-card">
                <h4 className="font-semibold text-foreground mb-2">{t("scan_diagnoses")}</h4>
                <ul className="list-disc list-inside text-sm text-foreground space-y-1">
                  {result.diagnoses.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}

            {/* Follow-up tests */}
            {result.followUpTests.length > 0 && (
              <div className="meditrack-card border-l-4 border-l-yellow-500">
                <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-500" /> {t("scan_followups")}
                </h4>
                <ul className="list-disc list-inside text-sm text-foreground space-y-1">
                  {result.followUpTests.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
                <p className="text-xs text-muted-foreground mt-3 bg-accent/50 p-2 rounded-lg">
                  💡 {t("scan_followup_guidance")}
                </p>
              </div>
            )}

            {/* Auto-saved status */}
            <div className="pt-2">
              <div className="flex items-center justify-center gap-2 text-primary font-medium py-3">
                <Check className="w-5 h-5" /> {t("scan_all_saved")}
              </div>
            </div>

            {/* Scan another */}
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => { setStage("upload"); setResult(null); setPreview(null); setSaved(false); }}
            >
              {t("scan_another")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanOverlay;
