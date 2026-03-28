import { useState, useEffect, useRef } from "react";
import { Plus, Upload, Camera, Pill, TestTube, ScanLine, FileText, Clock, Image as ImageIcon, Stethoscope, Star, Mic, Square, Play, Pause, Loader2, ChevronDown, ChevronRight, ArrowUpDown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { store, type MedicalRecord } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

type TabCategory = "all" | "medication_log" | "lab_test" | "lab_scan" | "diagnosis" | "doctor_visit" | "general";
type SortOption = "newest" | "oldest" | "type";

const MedicalHistory = () => {
  const { t } = useTranslation();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<TabCategory>("all");
  const [form, setForm] = useState({ type: 'illness' as MedicalRecord['type'], category: 'general' as MedicalRecord['category'], date: '', description: '' });
  const [uploading, setUploading] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Sort, filter, search
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    store.getRecords().then(r => { setRecords(r); setLoading(false); });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await uploadAndTranscribe(blob);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      toast({ title: "Microphone access denied", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const uploadAndTranscribe = async (blob: Blob) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const path = `${user.id}/voice_${Date.now()}.webm`;
    const { error } = await supabase.storage.from('medical-attachments').upload(path, blob, { contentType: 'audio/webm' });
    if (error) { console.error('Upload error:', error); toast({ title: "Upload failed", variant: "destructive" }); return; }

    setTranscribing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-recording`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ recordingPath: path, source: "medical-history" }),
        }
      );
      if (!resp.ok) throw new Error("Transcription failed");
      const data = await resp.json();
      toast({
        title: "Voice note processed!",
        description: `${data.actions?.length || 0} items extracted and saved.`,
      });
      const refreshed = await store.getRecords();
      setRecords(refreshed);
    } catch {
      toast({ title: "Transcription failed", description: "Recording saved but couldn't be processed.", variant: "destructive" });
    } finally {
      setTranscribing(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handleFileSelect = (file: File) => {
    setAttachmentFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setAttachmentPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(null);
    }
  };

  const uploadAttachment = async (file: File): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('medical-attachments').upload(path, file);
    if (error) { console.error('Upload error:', error); return null; }
    const { data: urlData } = supabase.storage.from('medical-attachments').getPublicUrl(path);
    return urlData?.publicUrl || path;
  };

  const save = async () => {
    if (!form.description.trim()) return;
    setUploading(true);
    let attachmentUrl: string | undefined;
    if (attachmentFile) {
      const url = await uploadAttachment(attachmentFile);
      if (url) attachmentUrl = url;
    }
    const result = await store.addRecord({ ...form, attachmentUrl });
    if (result) {
      setRecords(prev => [result, ...prev]);
      setShowForm(false);
      setForm({ type: 'illness', category: 'general', date: '', description: '' });
      setAttachmentFile(null);
      setAttachmentPreview(null);
      toast({ title: t("history_saved_toast") });
    }
    setUploading(false);
  };

  // Filter by tab
  let filtered = activeTab === "all" ? records : records.filter(r => r.category === activeTab);

  // Search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(r => {
      const desc = r.description.toLowerCase();
      const cat = r.category.toLowerCase();
      const type = r.type.toLowerCase();
      return desc.includes(q) || cat.includes(q) || type.includes(q);
    });
  }

  // Sort
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === "oldest") {
      return (a.date || '').localeCompare(b.date || '');
    }
    if (sortBy === "type") {
      return a.category.localeCompare(b.category);
    }
    // newest (default) — already sorted by created_at desc from DB
    return 0;
  });

  const categoryIcon = (cat: string) => {
    switch (cat) {
      case 'medication_log': return <Pill className="w-3.5 h-3.5" />;
      case 'lab_test': return <TestTube className="w-3.5 h-3.5" />;
      case 'lab_scan': return <ScanLine className="w-3.5 h-3.5" />;
      case 'diagnosis': return <FileText className="w-3.5 h-3.5" />;
      case 'doctor_visit': return <Stethoscope className="w-3.5 h-3.5" />;
      default: return <Clock className="w-3.5 h-3.5" />;
    }
  };

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case 'medication_log': return t("history_cat_med_log");
      case 'lab_test': return t("history_cat_lab_test");
      case 'lab_scan': return t("history_cat_lab_scan");
      case 'diagnosis': return t("history_cat_diagnosis");
      case 'doctor_visit': return t("history_cat_doc_visit");
      default: return t("history_cat_general");
    }
  };

  const getSummary = (record: MedicalRecord): string => {
    if (record.category === 'medication_log') {
      try {
        const d = JSON.parse(record.description);
        if (d.action === 'undo') return `↩ Undo: ${d.medName}`;
        return `${d.medName} — ${d.dose}`;
      } catch { return record.description.slice(0, 60); }
    }
    if (record.category === 'doctor_visit') {
      try {
        const d = JSON.parse(record.description);
        if (d.type === 'recording_transcription') return d.summary || 'Voice Transcription';
        return `${d.doctor || 'Doctor Visit'}${d.notes ? ` — ${d.notes.slice(0, 40)}` : ''}`;
      } catch { return record.description.slice(0, 60); }
    }
    try {
      const d = JSON.parse(record.description);
      if (d.type === 'recording_transcription') return d.summary || 'Voice Note';
      if (d.doctor) return `${d.doctor} visit`;
    } catch { /* not JSON */ }
    return record.description.slice(0, 80);
  };

  const renderFullDescription = (record: MedicalRecord) => {
    if (record.category === 'medication_log') {
      try {
        const d = JSON.parse(record.description);
        if (d.action === 'undo') return <span className="text-muted-foreground italic">{t("history_med_undo", { name: d.medName })}</span>;
        return (
          <div className="space-y-1">
            <p><span className="font-medium">{d.medName}</span> — {d.dose}, {d.medType}</p>
            {d.takenAt && <p className="text-xs text-primary">Taken at {new Date(d.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
            {d.stock !== undefined && <p className="text-xs text-muted-foreground">Stock remaining: {d.stock}</p>}
          </div>
        );
      } catch { return <span>{record.description}</span>; }
    }
    if (record.category === 'doctor_visit') {
      try {
        const d = JSON.parse(record.description);
        if (d.type === 'recording_transcription') {
          return (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-primary font-semibold">
                <Mic className="w-3.5 h-3.5" /> Voice Transcription
              </div>
              {d.summary && <p className="text-sm text-foreground">{d.summary}</p>}
              {d.extractedItems?.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {d.extractedItems.map((item: string, i: number) => (
                    <p key={i}>• {item}</p>
                  ))}
                </div>
              )}
              {d.transcription && (
                <details className="mt-1">
                  <summary className="text-xs text-primary cursor-pointer hover:underline">View full transcription</summary>
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{d.transcription}</p>
                </details>
              )}
            </div>
          );
        }
        return (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-medium">{d.doctor}</span>
              {d.location && <span className="text-muted-foreground text-xs">— {d.location}</span>}
            </div>
            {d.rating > 0 && (
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map((s: number) => (
                  <Star key={s} className={`w-3.5 h-3.5 ${s <= d.rating ? 'fill-amber-400 text-amber-400' : 'text-border'}`} />
                ))}
              </div>
            )}
            {d.notes && <p className="text-sm text-foreground">{d.notes}</p>}
            {d.advice && <p className="text-xs text-muted-foreground"><span className="font-semibold">{t("appt_advice")}:</span> {d.advice}</p>}
            {d.prescriptions && <p className="text-xs text-muted-foreground"><span className="font-semibold">{t("appt_prescriptions")}:</span> {d.prescriptions}</p>}
            {d.followUp && <p className="text-xs text-muted-foreground"><span className="font-semibold">{t("appt_followup")}:</span> {d.followUp}</p>}
          </div>
        );
      } catch { return <span>{record.description}</span>; }
    }
    // General / transcription records
    try {
      const d = JSON.parse(record.description);
      if (d.type === 'recording_transcription') {
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-primary font-semibold">
              <Mic className="w-3.5 h-3.5" /> Voice Note — AI Processed
            </div>
            {d.summary && <p className="text-sm text-foreground">{d.summary}</p>}
            {d.extractedItems?.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                {d.extractedItems.map((item: string, i: number) => (
                  <p key={i}>• {item}</p>
                ))}
              </div>
            )}
            {d.transcription && (
              <details className="mt-1">
                <summary className="text-xs text-primary cursor-pointer hover:underline">View full transcription</summary>
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{d.transcription}</p>
              </details>
            )}
          </div>
        );
      }
    } catch { /* not JSON */ }
    return <span className="whitespace-pre-wrap">{record.description}</span>;
  };

  if (loading) return <div className="p-8"><p className="text-muted-foreground">{t("loading")}</p></div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("history_title")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t("history_subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {transcribing ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> AI Processing...
            </div>
          ) : isRecording ? (
            <Button variant="destructive" className="rounded-xl gap-2 animate-pulse" onClick={stopRecording}>
              <Square className="w-4 h-4" /> {formatTime(recordingTime)}
            </Button>
          ) : (
            <Button variant="outline" className="rounded-xl gap-2" onClick={startRecording} title="Record voice note">
              <Mic className="w-4 h-4" /> Record
            </Button>
          )}
          <Button className="rounded-xl gap-2" onClick={() => setShowForm(true)} aria-label={t("history_add")}>
            <Plus className="w-4 h-4" /> {t("history_add")}
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="meditrack-card mt-6 border-2 border-dashed border-primary/30 animate-fade-up">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">{t("history_type")}</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value as MedicalRecord['type']})} className="mt-1 w-full h-10 px-3 rounded-xl border border-input bg-background text-sm" aria-label={t("history_type")}>
                <option value="illness">{t("history_illness")}</option>
                <option value="surgery">{t("history_surgery")}</option>
                <option value="vaccination">{t("history_vaccination")}</option>
                <option value="allergy">{t("history_allergy")}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">{t("history_category")}</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value as MedicalRecord['category']})} className="mt-1 w-full h-10 px-3 rounded-xl border border-input bg-background text-sm" aria-label={t("history_category")}>
                <option value="general">{t("history_cat_general")}</option>
                <option value="lab_test">{t("history_cat_lab_test")}</option>
                <option value="lab_scan">{t("history_cat_lab_scan")}</option>
                <option value="diagnosis">{t("history_cat_diagnosis")}</option>
                <option value="prescription">{t("history_cat_prescription")}</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="text-sm font-medium">{t("history_date")}</label>
            <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="mt-1 rounded-xl" />
          </div>
          <div className="mt-3">
            <label className="text-sm font-medium">{t("history_description")}</label>
            <Textarea placeholder={t("history_description_placeholder")} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="mt-1 rounded-xl" />
          </div>

          <div className="mt-3">
            <label className="text-sm font-medium">{t("history_attachment")}</label>
            <div className="flex gap-2 mt-1">
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => cameraRef.current?.click()}>
                <Camera className="w-4 h-4" /> {t("history_take_photo")}
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4" /> {t("history_upload_file")}
              </Button>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
            {attachmentFile && (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="w-4 h-4" />
                <span>{attachmentFile.name}</span>
              </div>
            )}
            {attachmentPreview && (
              <img src={attachmentPreview} alt="Preview" className="mt-2 max-h-32 rounded-xl border border-border" />
            )}
          </div>

          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => { setShowForm(false); setAttachmentFile(null); setAttachmentPreview(null); }} className="rounded-xl">{t("history_cancel")}</Button>
            <Button onClick={save} disabled={!form.description.trim() || uploading} className="rounded-xl">
              {uploading ? t("history_uploading") : t("history_save")}
            </Button>
          </div>
        </div>
      )}

      {/* Search & Sort Controls */}
      <div className="flex items-center gap-3 mt-6 animate-fade-up">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search records..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortOption)}
          className="h-10 px-3 rounded-xl border border-input bg-background text-sm"
          aria-label="Sort by"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="type">By category</option>
        </select>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabCategory)} className="mt-4">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="all" className="gap-1.5 text-xs"><Clock className="w-3.5 h-3.5" /> {t("history_tab_all")}</TabsTrigger>
          <TabsTrigger value="medication_log" className="gap-1.5 text-xs"><Pill className="w-3.5 h-3.5" /> {t("history_cat_med_log")}</TabsTrigger>
          <TabsTrigger value="lab_test" className="gap-1.5 text-xs"><TestTube className="w-3.5 h-3.5" /> {t("history_cat_lab_test")}</TabsTrigger>
          <TabsTrigger value="lab_scan" className="gap-1.5 text-xs"><ScanLine className="w-3.5 h-3.5" /> {t("history_cat_lab_scan")}</TabsTrigger>
          <TabsTrigger value="diagnosis" className="gap-1.5 text-xs"><FileText className="w-3.5 h-3.5" /> {t("history_cat_diagnosis")}</TabsTrigger>
          <TabsTrigger value="doctor_visit" className="gap-1.5 text-xs"><Stethoscope className="w-3.5 h-3.5" /> {t("history_cat_doc_visit")}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-2">
          {filtered.map((r, i) => {
            const isExpanded = expandedIds.has(r.id);
            return (
              <div key={r.id} className="meditrack-card animate-fade-up p-0 overflow-hidden" style={{ animationDelay: `${0.03 * i}s` }}>
                {/* Collapsed summary row */}
                <button
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/30 transition-colors"
                  onClick={() => toggleExpanded(r.id)}
                  aria-expanded={isExpanded}
                >
                  <span className="text-xs font-bold text-primary uppercase bg-accent px-2 py-1 rounded-md flex items-center gap-1 flex-shrink-0">
                    {categoryIcon(r.category)} {categoryLabel(r.category)}
                  </span>
                  <span className="text-sm text-foreground flex-1 truncate">{getSummary(r)}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {r.date && <span className="text-xs text-muted-foreground hidden sm:inline">{new Date(r.date).toLocaleDateString()}</span>}
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-border animate-fade-up">
                    <div className="flex items-center gap-2 mb-2 mt-3">
                      <span className="text-xs font-medium text-muted-foreground bg-accent/50 px-2 py-1 rounded-md">{t(`history_${r.type}`)}</span>
                      {r.date && <span className="text-xs text-muted-foreground">{new Date(r.date).toLocaleDateString()}</span>}
                    </div>
                    <div className="text-sm text-foreground">{renderFullDescription(r)}</div>
                    {r.attachmentUrl && (
                      <div className="mt-3">
                        {r.attachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                          <img src={r.attachmentUrl} alt="Attachment" className="max-h-40 rounded-xl border border-border" />
                        ) : (
                          <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" /> {t("history_view_attachment")}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && !showForm && (
            <p className="text-sm text-muted-foreground text-center py-12">{t("history_empty")}</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MedicalHistory;
