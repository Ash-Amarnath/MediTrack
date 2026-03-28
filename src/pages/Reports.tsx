import { useState, useEffect, useRef } from "react";
import { Plus, Languages, Camera, Upload, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { store, type Report } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { toast } from "@/hooks/use-toast";

const Reports = () => {
  const { t } = useTranslation();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScan, setShowScan] = useState(false);
  const [text, setText] = useState("");
  const [lang, setLang] = useState("English");
  const [simplifying, setSimplifying] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    store.getReports().then(r => { setReports(r); setLoading(false); });
  }, []);

  const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: t("reports_invalid_image"), variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setOcrLoading(true);
    try {
      const base64 = await compressImage(file);
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ imageBase64: base64, mimeType: "image/jpeg" }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "OCR failed");
      }
      const data = await resp.json();
      const extracted = data.rawText || data.summary || "";
      if (!extracted.trim()) {
        toast({ title: t("reports_unreadable"), variant: "destructive" });
      } else {
        setText(extracted);
        toast({ title: t("reports_ocr_success") });
      }
    } catch {
      toast({ title: t("reports_unreadable"), variant: "destructive" });
    } finally {
      setOcrLoading(false);
    }
  };

  const simplify = async () => {
    if (!text.trim()) return;
    setSimplifying(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [
              { role: "user", content: `Simplify this medical report in ${lang}. Explain in plain language what the findings mean, what medications are for, any side effects to watch, and diet advice. Be concise:\n\n${text}` },
            ],
          }),
        }
      );
      if (!resp.ok || !resp.body) throw new Error("AI failed");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let simplified = "";
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try { const p = JSON.parse(json); simplified += p.choices?.[0]?.delta?.content || ""; } catch {}
        }
      }
      if (!simplified.trim()) simplified = "Could not simplify. Please try again.";
      const result = await store.addReport({
        title: `Report - ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
        date: new Date().toISOString(),
        originalText: text,
        simplifiedText: simplified,
      });
      if (result) setReports(prev => [result, ...prev]);
      setShowScan(false); setText(""); setImagePreview(null);
    } catch {
      toast({ title: "Simplification failed. Please try again.", variant: "destructive" });
    } finally {
      setSimplifying(false);
    }
  };

  if (loading) return <div className="p-8"><p className="text-muted-foreground">{t("loading")}</p></div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("reports_title")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t("reports_subtitle")}</p>
        </div>
        <Button className="rounded-xl gap-2" onClick={() => setShowScan(true)} aria-label={t("reports_new")}>
          <Plus className="w-4 h-4" /> {t("reports_new")}
        </Button>
      </div>

      {showScan && (
        <div className="meditrack-card mt-6 border-2 border-dashed border-primary/30 animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-foreground">{t("reports_scan_title")}</p>
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-muted-foreground" />
              <select value={lang} onChange={e => setLang(e.target.value)} className="text-sm border border-input rounded-lg px-2 py-1 bg-background" aria-label={t("reports_lang_label")}>
                <option>English</option><option>Hindi</option><option>Tamil</option><option>Telugu</option>
              </select>
            </div>
          </div>

          {/* Image upload buttons */}
          <div className="flex gap-3 mb-4">
            <Button variant="outline" className="rounded-xl gap-2 flex-1" onClick={() => cameraRef.current?.click()} disabled={ocrLoading} aria-label={t("reports_take_photo")}>
              <Camera className="w-4 h-4" /> {t("reports_take_photo")}
            </Button>
            <Button variant="outline" className="rounded-xl gap-2 flex-1" onClick={() => fileRef.current?.click()} disabled={ocrLoading} aria-label={t("reports_upload_image")}>
              <Upload className="w-4 h-4" /> {t("reports_upload_image")}
            </Button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
          </div>

          {ocrLoading && (
            <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> {t("reports_extracting")}
            </div>
          )}

          {imagePreview && (
            <img src={imagePreview} alt="Uploaded report" className="max-h-40 rounded-xl border border-border mb-3" />
          )}

          <p className="text-xs text-muted-foreground mb-1">{t("reports_or_paste")}</p>
          <Textarea value={text} onChange={e => setText(e.target.value)} placeholder={t("reports_placeholder")} className="rounded-xl min-h-[120px]" />
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => { setShowScan(false); setText(""); setImagePreview(null); }} className="rounded-xl">{t("reports_cancel")}</Button>
            <Button onClick={simplify} disabled={!text.trim() || simplifying} className="rounded-xl bg-destructive hover:bg-destructive/90">
              {simplifying ? t("reports_simplifying") : t("reports_simplify")}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {reports.map((r, i) => (
          <div key={r.id} className="meditrack-card animate-fade-up" style={{ animationDelay: `${0.05 * i}s` }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-foreground">{r.title}</p>
                <p className="text-xs text-muted-foreground">{new Date(r.date).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
              </div>
              <span className="text-xs font-bold text-primary bg-accent px-2 py-1 rounded-md">{t("reports_badge")}</span>
            </div>
            <div className="prose prose-sm prose-green max-w-none">
              <ReactMarkdown>{r.simplifiedText}</ReactMarkdown>
            </div>
          </div>
        ))}
        {reports.length === 0 && !showScan && (
          <p className="text-sm text-muted-foreground text-center py-12">{t("reports_empty")}</p>
        )}
      </div>
    </div>
  );
};

export default Reports;
