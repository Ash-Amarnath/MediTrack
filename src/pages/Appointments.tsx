import { useState, useEffect, useRef } from "react";
import { CalendarDays, Plus, CheckCircle, ChevronRight, ChevronDown, Star, X, Mic, Square, Play, Pause, Loader2, Clock, FileText, Upload, Camera, Image as ImageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { store, type Appointment } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const Appointments = () => {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogVisit, setShowLogVisit] = useState<string | null>(null);
  const [showNewVisit, setShowNewVisit] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logData, setLogData] = useState({ rating: 0, experience: '', advice: '', prescriptions: '', followUp: '' });
  const [logAttachment, setLogAttachment] = useState<File | null>(null);
  const [logAttachmentPreview, setLogAttachmentPreview] = useState<string | null>(null);
  const logFileRef = useRef<HTMLInputElement>(null);
  const logCameraRef = useRef<HTMLInputElement>(null);
  const [newVisit, setNewVisit] = useState({ doctor: '', location: '', date: '', symptoms: '' });

  // Recording state
  const [recordingApptId, setRecordingApptId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcribing, setTranscribing] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    store.getAppointments().then(a => { setAppointments(a); setLoading(false); });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  const upcoming = appointments.filter(a => a.status === 'upcoming');
  const pending = appointments.filter(a => a.status === 'pending');
  const completed = appointments.filter(a => a.status === 'completed');

  const startRecording = async (apptId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await uploadRecording(apptId, blob);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setRecordingApptId(apptId);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      alert(t("appt_mic_denied") || "Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const uploadRecording = async (apptId: string, blob: Blob) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const path = `${user.id}/${apptId}_${Date.now()}.webm`;
    const { error } = await supabase.storage.from('appointment-recordings').upload(path, blob, { contentType: 'audio/webm' });
    if (error) { console.error('Upload error:', error); return; }
    await store.updateAppointment(apptId, { recording_url: path });
    const refreshed = await store.getAppointments();
    setAppointments(refreshed);
    setRecordingApptId(null);

    // Auto-transcribe
    transcribeRecording(path, apptId);
  };

  const transcribeRecording = async (recordingPath: string, apptId: string) => {
    setTranscribing(apptId);
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
          body: JSON.stringify({ recordingPath, appointmentId: apptId, source: "appointment" }),
        }
      );
      if (!resp.ok) throw new Error("Transcription failed");
      const data = await resp.json();
      toast({
        title: "Recording transcribed!",
        description: `${data.actions?.length || 0} items extracted and saved automatically.`,
      });
      const refreshed = await store.getAppointments();
      setAppointments(refreshed);
    } catch (err) {
      console.error("Transcription error:", err);
      toast({ title: "Transcription failed", description: "Recording saved. You can retry later.", variant: "destructive" });
    } finally {
      setTranscribing(null);
    }
  };

  const playRecording = async (recordingPath: string) => {
    if (isPlaying && playingUrl) { audioRef.current?.pause(); setIsPlaying(false); setPlayingUrl(null); return; }
    const { data } = await supabase.storage.from('appointment-recordings').createSignedUrl(recordingPath, 3600);
    if (!data?.signedUrl) return;
    const audio = new Audio(data.signedUrl);
    audioRef.current = audio;
    audio.onended = () => { setIsPlaying(false); setPlayingUrl(null); };
    audio.play();
    setIsPlaying(true);
    setPlayingUrl(recordingPath);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const confirmPendingAppointment = async (apptId: string) => {
    await store.updateAppointment(apptId, { status: 'upcoming' });
    const refreshed = await store.getAppointments();
    setAppointments(refreshed);
    toast({ title: "Appointment confirmed as upcoming!" });
  };

  const handleLogFileSelect = (file: File) => {
    setLogAttachment(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setLogAttachmentPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setLogAttachmentPreview(null);
    }
  };

  const saveLogVisit = async () => {
    if (!showLogVisit) return;
    
    // Upload attachment if any
    let attachmentUrl: string | undefined;
    if (logAttachment) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const ext = logAttachment.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('medical-attachments').upload(path, logAttachment);
        if (!error) {
          const { data: urlData } = supabase.storage.from('medical-attachments').getPublicUrl(path);
          attachmentUrl = urlData?.publicUrl || path;
        }
      }
    }

    await store.updateAppointment(showLogVisit, {
      status: 'completed', rating: logData.rating, notes: logData.experience,
      doctor_advice: logData.advice, prescriptions: logData.prescriptions, follow_up_tests: logData.followUp,
    });
    const appt = appointments.find(a => a.id === showLogVisit);
    if (appt) {
      await store.addRecord({
        type: 'illness', category: 'doctor_visit',
        date: new Date(appt.date).toISOString().split('T')[0],
        description: JSON.stringify({
          doctor: appt.doctor, location: appt.location,
          rating: logData.rating, notes: logData.experience,
          advice: logData.advice, prescriptions: logData.prescriptions,
          followUp: logData.followUp, hasRecording: !!appt.recordingUrl,
        }),
        attachmentUrl,
      });
    }
    const refreshed = await store.getAppointments();
    setAppointments(refreshed);
    setShowLogVisit(null);
    setLogData({ rating: 0, experience: '', advice: '', prescriptions: '', followUp: '' });
    setLogAttachment(null);
    setLogAttachmentPreview(null);
  };

  const addNewVisit = async () => {
    await store.addAppointment({
      doctor: newVisit.doctor, location: newVisit.location, date: newVisit.date,
      symptoms: newVisit.symptoms.split(',').map(s => s.trim()).filter(Boolean), status: 'upcoming',
    });
    const refreshed = await store.getAppointments();
    setAppointments(refreshed);
    setShowNewVisit(false);
    setNewVisit({ doctor: '', location: '', date: '', symptoms: '' });
  };

  const logAppt = appointments.find(a => a.id === showLogVisit);

  if (loading) return <div className="p-8"><p className="text-muted-foreground">{t("loading")}</p></div>;

  const renderApptCard = (appt: Appointment, type: 'upcoming' | 'pending' | 'completed') => {
    const isExpanded = expandedId === appt.id;
    const isPending = type === 'pending';
    const isUpcoming = type === 'upcoming';
    const isCompleted = type === 'completed';
    const borderColor = isPending ? 'border-l-amber-500' : isUpcoming ? 'border-l-[hsl(220,60%,60%)]' : '';

    return (
      <div key={appt.id} className={`meditrack-card ${isUpcoming || isPending ? `border-l-4 ${borderColor}` : ''}`}>
        <div className={isCompleted ? "w-full" : ""}>
          <button
            className={`w-full flex items-center justify-between text-left ${!isCompleted ? 'cursor-default' : ''}`}
            onClick={() => isCompleted ? setExpandedId(isExpanded ? null : appt.id) : undefined}
            aria-expanded={isCompleted ? isExpanded : undefined}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isPending ? 'bg-amber-100 dark:bg-amber-900/30' : isCompleted ? 'bg-muted' : 'bg-accent'}`}>
                {isPending ? <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" /> :
                 isCompleted ? <CheckCircle className="w-5 h-5 text-muted-foreground" /> :
                 <CalendarDays className="w-5 h-5 text-[hsl(220,60%,60%)]" />}
              </div>
              <div>
                <p className={`font-semibold ${isCompleted ? 'text-muted-foreground' : 'text-foreground'}`}>{appt.doctor}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(appt.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} {new Date(appt.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </p>
                {appt.location && <p className="text-xs text-muted-foreground">{appt.location}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isPending && (
                <>
                  <Button size="sm" className="rounded-lg text-xs" onClick={(e) => { e.stopPropagation(); confirmPendingAppointment(appt.id); }}>
                    Confirm
                  </Button>
                </>
              )}
              {isUpcoming && (
                <>
                  {transcribing === appt.id ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI Processing...
                    </div>
                  ) : isRecording && recordingApptId === appt.id ? (
                    <Button size="sm" variant="destructive" className="rounded-lg text-xs gap-1.5 animate-pulse" onClick={stopRecording}>
                      <Square className="w-3 h-3" /> {formatTime(recordingTime)}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1.5" onClick={() => startRecording(appt.id)} title="Record Visit">
                      <Mic className="w-3.5 h-3.5" /> Record
                    </Button>
                  )}
                  <Button size="sm" className="rounded-lg text-xs" onClick={() => setShowLogVisit(appt.id)}>{t("appt_mark_completed")}</Button>
                </>
              )}
              {isCompleted && (isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />)}
            </div>
          </button>
        </div>

        {/* Symptoms */}
        {(isUpcoming || isPending) && appt.symptoms && appt.symptoms.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[11px] font-bold text-primary uppercase tracking-wider">{isPending ? "Reason" : t("appt_symptoms")}</p>
            <p className="text-sm text-foreground mt-0.5">{appt.symptoms.join(', ')}</p>
          </div>
        )}

        {/* Recording for upcoming */}
        {isUpcoming && appt.recordingUrl && (
          <div className="mt-3 pt-3 border-t border-border">
            <button onClick={() => playRecording(appt.recordingUrl!)} className="flex items-center gap-2 text-xs text-primary hover:underline">
              {isPlaying && playingUrl === appt.recordingUrl ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying && playingUrl === appt.recordingUrl ? "Pause Recording" : "Play Recording"}
            </button>
          </div>
        )}

        {/* Completed expanded details */}
        {isCompleted && isExpanded && (
          <div className="mt-3 pt-3 border-t border-border space-y-3 animate-fade-up">
            {appt.rating && appt.rating > 0 && (
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t("appt_rate")}</p>
                <div className="flex gap-1 mt-1">
                  {[1,2,3,4,5].map(s => <Star key={s} className={`w-4 h-4 ${s <= (appt.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-border'}`} />)}
                </div>
              </div>
            )}
            {appt.notes && (
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t("appt_experience")}</p>
                <p className="text-sm text-foreground mt-0.5">{appt.notes}</p>
              </div>
            )}
            {appt.doctorAdvice && (
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t("appt_advice")}</p>
                <p className="text-sm text-foreground mt-0.5">{appt.doctorAdvice}</p>
              </div>
            )}
            {appt.prescriptions && (
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t("appt_prescriptions")}</p>
                <p className="text-sm text-foreground mt-0.5">{appt.prescriptions}</p>
              </div>
            )}
            {appt.followUpTests && (
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t("appt_followup")}</p>
                <p className="text-sm text-foreground mt-0.5">{appt.followUpTests}</p>
              </div>
            )}
            {appt.recordingUrl && (
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Visit Recording</p>
                <button onClick={() => playRecording(appt.recordingUrl!)} className="mt-1 flex items-center gap-2 text-sm text-primary hover:underline">
                  {isPlaying && playingUrl === appt.recordingUrl ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying && playingUrl === appt.recordingUrl ? "Pause" : "Play Recording"}
                </button>
              </div>
            )}
            {!appt.notes && !appt.doctorAdvice && !appt.prescriptions && !appt.followUpTests && !appt.recordingUrl && (
              <p className="text-sm text-muted-foreground italic">{t("appt_no_details")}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-2 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("appt_title")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t("appt_subtitle")}</p>
        </div>
        <Button className="rounded-xl gap-2 font-semibold" onClick={() => setShowNewVisit(true)} aria-label={t("appt_new")}>
          <Plus className="w-4 h-4" /> {t("appt_new")}
        </Button>
      </div>

      {/* Pending (AI-recommended) */}
      {pending.length > 0 && (
        <div className="mt-6 animate-fade-up" style={{ animationDelay: '0.05s' }}>
          <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Pending — AI Recommendations
          </p>
          <div className="space-y-4">
            {pending.map(appt => renderApptCard(appt, 'pending'))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className="mt-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t("appt_upcoming")}</p>
        <div className="space-y-4">
          {upcoming.map(appt => renderApptCard(appt, 'upcoming'))}
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">{t("appt_no_upcoming")}</p>}
        </div>
      </div>

      {/* Completed */}
      <div className="mt-8 animate-fade-up" style={{ animationDelay: '0.2s' }}>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t("appt_completed")}</p>
        <div className="space-y-4">
          {completed.map(appt => renderApptCard(appt, 'completed'))}
        </div>
      </div>

      {/* Log Visit Modal */}
      {showLogVisit && logAppt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold">{t("appt_log_title", { doctor: logAppt.doctor })}</h2>
              <button onClick={() => setShowLogVisit(null)} aria-label={t("close")}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-6">{t("appt_log_subtitle")}</p>
            <div className="bg-accent/50 rounded-xl p-4 text-center mb-5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t("appt_rate")}</p>
              <div className="flex justify-center gap-2">
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setLogData({...logData, rating: s})} className="transition-transform active:scale-90">
                    <Star className={`w-7 h-7 ${s <= logData.rating ? 'fill-amber-400 text-amber-400' : 'text-border'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium text-foreground">{t("appt_experience")}</label>
                <Textarea placeholder={t("appt_experience_placeholder")} className="mt-1 rounded-xl" value={logData.experience} onChange={e => setLogData({...logData, experience: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{t("appt_advice")}</label>
                <Textarea placeholder={t("appt_advice_placeholder")} className="mt-1 rounded-xl" value={logData.advice} onChange={e => setLogData({...logData, advice: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium text-foreground">{t("appt_prescriptions")}</label>
                <Textarea placeholder={t("appt_prescriptions_placeholder")} className="mt-1 rounded-xl" value={logData.prescriptions} onChange={e => setLogData({...logData, prescriptions: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{t("appt_followup")}</label>
                <Textarea placeholder={t("appt_followup_placeholder")} className="mt-1 rounded-xl" value={logData.followUp} onChange={e => setLogData({...logData, followUp: e.target.value})} />
              </div>
            </div>
            {/* Document upload */}
            <div className="mb-4">
              <label className="text-sm font-medium text-foreground">Attach Document</label>
              <div className="flex gap-2 mt-1">
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => logCameraRef.current?.click()}>
                  <Camera className="w-4 h-4" /> Photo
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => logFileRef.current?.click()}>
                  <Upload className="w-4 h-4" /> Upload
                </Button>
              </div>
              <input ref={logCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && handleLogFileSelect(e.target.files[0])} />
              <input ref={logFileRef} type="file" accept="image/*,application/pdf,.doc,.docx" className="hidden" onChange={e => e.target.files?.[0] && handleLogFileSelect(e.target.files[0])} />
              {logAttachment && (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <ImageIcon className="w-4 h-4" />
                  <span>{logAttachment.name}</span>
                  <button onClick={() => { setLogAttachment(null); setLogAttachmentPreview(null); }} className="text-destructive text-xs">Remove</button>
                </div>
              )}
              {logAttachmentPreview && (
                <img src={logAttachmentPreview} alt="Preview" className="mt-2 max-h-24 rounded-xl border border-border" />
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { setShowLogVisit(null); setLogAttachment(null); setLogAttachmentPreview(null); }} className="rounded-xl">{t("appt_cancel")}</Button>
              <Button onClick={saveLogVisit} className="rounded-xl">{t("appt_save_log")}</Button>
            </div>
          </div>
        </div>
      )}

      {/* New Visit Modal */}
      {showNewVisit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{t("appt_new_title")}</h2>
              <button onClick={() => setShowNewVisit(false)} aria-label={t("close")}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">{t("appt_doctor")}</label>
                <Input placeholder="e.g. Dr. Sharma" className="mt-1 rounded-xl" value={newVisit.doctor} onChange={e => setNewVisit({...newVisit, doctor: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">{t("appt_location")}</label>
                <Input placeholder="e.g. Sonipat" className="mt-1 rounded-xl" value={newVisit.location} onChange={e => setNewVisit({...newVisit, location: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">{t("appt_datetime")}</label>
                <Input type="datetime-local" className="mt-1 rounded-xl" value={newVisit.date} onChange={e => setNewVisit({...newVisit, date: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">{t("appt_symptoms_input")}</label>
                <Input placeholder="e.g. Headache, Fever" className="mt-1 rounded-xl" value={newVisit.symptoms} onChange={e => setNewVisit({...newVisit, symptoms: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <Button variant="outline" onClick={() => setShowNewVisit(false)} className="rounded-xl">{t("appt_cancel")}</Button>
              <Button onClick={addNewVisit} disabled={!newVisit.doctor || !newVisit.date} className="rounded-xl">{t("appt_add_visit")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
