import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, BellOff, Clock, CalendarDays, Volume2, VolumeX, Minus, Plus, X, BellRing, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { store, type Medication, type Appointment } from "@/lib/store";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// --- Types ---
interface ReminderSettings {
  enabled: boolean;
  type: "both" | "appointments" | "prescriptions";
  frequency: number;
  leadTime: number;
  volume: number;
  tone: string;
  disabledMedIds: string[];
}

const defaultSettings: ReminderSettings = {
  enabled: true, type: "both", frequency: 10, leadTime: 10, volume: 70, tone: "gentle", disabledMedIds: [],
};

function getSettings(): ReminderSettings {
  try {
    const v = localStorage.getItem("meditrack_reminder_settings");
    const parsed = v ? JSON.parse(v) : defaultSettings;
    return { ...defaultSettings, ...parsed };
  } catch { return defaultSettings; }
}
function saveSettings(s: ReminderSettings) {
  localStorage.setItem("meditrack_reminder_settings", JSON.stringify(s));
}

// --- Notification Permission ---
function getNotifPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

// --- Parse med time string to today's Date objects ---
function parseMedTimes(timeStr: string): { label: string; date: Date }[] {
  const now = new Date();
  const results: { label: string; date: Date }[] = [];
  // Format: "morning:08:00,evening:19:00" or legacy "8:00 AM"
  if (timeStr.includes(":") && timeStr.includes(",")) {
    timeStr.split(",").forEach(part => {
      const [label, hhmm] = part.split(":");
      if (label && hhmm) {
        const [h, m] = [parseInt(part.split(":")[1]), parseInt(part.split(":")[2])];
        if (!isNaN(h) && !isNaN(m)) {
          const d = new Date(now);
          d.setHours(h, m, 0, 0);
          results.push({ label, date: d });
        }
      }
    });
  } else if (timeStr.includes(":")) {
    // single entry like "morning:08:00"
    const parts = timeStr.split(":");
    if (parts.length >= 3) {
      const [label, hStr, mStr] = parts;
      const h = parseInt(hStr), m = parseInt(mStr);
      if (!isNaN(h) && !isNaN(m)) {
        const d = new Date(now);
        d.setHours(h, m, 0, 0);
        results.push({ label, date: d });
      }
    } else {
      // Legacy "HH:MM" or "H:MM AM/PM"
      const [timePart, ampm] = timeStr.split(" ");
      const [hStr, mStr] = timePart.split(":");
      let h = parseInt(hStr), m = parseInt(mStr);
      if (ampm?.toUpperCase() === "PM" && h !== 12) h += 12;
      if (ampm?.toUpperCase() === "AM" && h === 12) h = 0;
      if (!isNaN(h) && !isNaN(m)) {
        const d = new Date(now);
        d.setHours(h, m, 0, 0);
        results.push({ label: "dose", date: d });
      }
    }
  }
  return results;
}

function formatTimeShort(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// --- Tone player (reused from old code) ---
function playTone(tone: string, volume: number) {
  try {
    const ctx = new AudioContext();
    const vol = volume / 100;
    const playNote = (freq: number, start: number, dur: number, type: OscillatorType = "sine", gainVal?: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      g.gain.setValueAtTime((gainVal ?? vol) * 0.5, ctx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    switch (tone) {
      case "cuckoo": playNote(784,0,0.3); playNote(523,0.35,0.4); playNote(784,0.9,0.3); playNote(523,1.25,0.4); break;
      case "parrot": playNote(1200,0,0.08,"sawtooth"); playNote(1600,0.1,0.08,"sawtooth"); playNote(2000,0.2,0.12,"sawtooth"); playNote(1400,0.35,0.06,"sawtooth"); playNote(1800,0.42,0.1,"sawtooth"); playNote(2200,0.55,0.15,"sawtooth"); break;
      case "bell_chime": [523,659,784,1047].forEach((f,i)=>playNote(f,i*0.25,1.2-i*0.2)); break;
      case "music_box": [523,523,784,784,880,880,784,0,698,698,659,659,587,587,523].forEach((f,i)=>{if(f>0)playNote(f,i*0.18,0.25)}); break;
      case "temple_bell": playNote(220,0,2.5); playNote(440,0,2,"sine",vol*0.25); playNote(660,0,1.5,"sine",vol*0.12); break;
      case "flute": [523,587,659,784,880,784,659,587,523].forEach((f,i)=>playNote(f,i*0.22,0.35)); break;
      case "gentle": playNote(330,0,0.6); playNote(392,0.3,0.6); playNote(440,0.6,0.8); break;
      case "urgent": for(let i=0;i<6;i++) playNote(880,i*0.15,0.1,"square"); break;
      default: playNote(440,0,0.5,"triangle");
    }
  } catch {}
}

// --- Component ---
const Reminders = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<ReminderSettings>(getSettings);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">(getNotifPermission);
  const firedRef = useRef<Set<string>>(new Set());

  const TONES = [
    { id: "cuckoo", label: t("rem_tone_cuckoo") || "Cuckoo Bird" },
    { id: "parrot", label: t("rem_tone_parrot") || "Parrot Call" },
    { id: "bell_chime", label: t("rem_tone_bell_chime") || "Bell Chime" },
    { id: "music_box", label: t("rem_tone_music_box") || "Music Box" },
    { id: "temple_bell", label: t("rem_tone_temple_bell") || "Temple Bell" },
    { id: "flute", label: t("rem_tone_flute") || "Flute Melody" },
    { id: "gentle", label: t("rem_tone_gentle") || "Gentle Hum" },
    { id: "urgent", label: t("rem_tone_urgent") || "Urgent Alert" },
  ];

  const FREQUENCY_OPTIONS = [
    { value: 5, label: t("rem_every_5") },
    { value: 10, label: t("rem_every_10") },
    { value: 15, label: t("rem_every_15") },
    { value: 30, label: t("rem_every_30") },
  ];

  const LEAD_TIME_OPTIONS = [
    { value: 5, label: t("rem_before_5") },
    { value: 10, label: t("rem_before_10") },
    { value: 15, label: t("rem_before_15") },
    { value: 30, label: t("rem_before_30") },
  ];

  useEffect(() => {
    Promise.all([store.getMeds(), store.getAppointments()]).then(([m, a]) => {
      setMeds(m);
      setAppointments(a.filter(ap => ap.status === "upcoming"));
      setLoading(false);
    });
  }, []);

  const update = useCallback((patch: Partial<ReminderSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const adjustVolume = useCallback((delta: number) => {
    setSettings(prev => {
      const next = { ...prev, volume: Math.max(0, Math.min(100, prev.volume + delta)) };
      saveSettings(next);
      return next;
    });
  }, []);

  const toggleMedReminder = useCallback((medId: string) => {
    setSettings(prev => {
      const disabled = new Set(prev.disabledMedIds);
      if (disabled.has(medId)) disabled.delete(medId); else disabled.add(medId);
      const next = { ...prev, disabledMedIds: Array.from(disabled) };
      saveSettings(next);
      return next;
    });
  }, []);

  // Request notification permission
  const requestPermission = async () => {
    if (!("Notification" in window)) { setNotifPerm("unsupported"); return; }
    const result = await Notification.requestPermission();
    setNotifPerm(result);
  };

  // Send a browser notification
  const sendNotification = (title: string, body: string) => {
    if (notifPerm !== "granted") return;
    try {
      new Notification(title, { body, icon: "/placeholder.svg", tag: title, requireInteraction: true });
    } catch {}
  };

  // Test notification for a specific med
  const testMedNotification = (med: Medication) => {
    playTone(settings.tone, settings.volume);
    if (notifPerm === "granted") {
      sendNotification(
        t("rem_notif_test_title"),
        t("rem_notif_test_msg", { name: med.name })
      );
    } else {
      toast.info(t("rem_notif_test_msg", { name: med.name }));
    }
  };

  // Mark medication as taken
  const markTaken = async (med: Medication) => {
    await store.updateMed(med.id, { taken: true, takenAt: new Date().toISOString() });
    setMeds(prev => prev.map(m => m.id === med.id ? { ...m, taken: true, takenAt: new Date().toISOString() } : m));
    toast.success(`${med.name} — ${t("rem_mark_taken")}`);
  };

  // --- Real-time notification checker with repeating alerts ---
  useEffect(() => {
    if (!settings.enabled) return;

    const check = () => {
      const now = new Date();
      const leadMs = settings.leadTime * 60 * 1000;
      const freqMs = settings.frequency * 60 * 1000;
      const disabledSet = new Set(settings.disabledMedIds);

      if (settings.type !== "appointments") {
        meds.forEach(med => {
          if (disabledSet.has(med.id) || med.taken) return;
          const times = parseMedTimes(med.time);
          times.forEach(({ date: medTime }) => {
            const diff = now.getTime() - medTime.getTime();
            // Fire from leadTime before through 2 hours after
            const windowStart = -leadMs;
            const windowEnd = 2 * 60 * 60 * 1000; // 2 hours after scheduled time
            
            if (diff >= windowStart && diff <= windowEnd) {
              // Calculate which repeat cycle we're in
              const cycleOffset = diff + leadMs; // ms since first possible alert
              const cycleNum = Math.floor(cycleOffset / freqMs);
              const key = `med-${med.id}-${medTime.getHours()}-${medTime.getMinutes()}-${now.toDateString()}-cycle${cycleNum}`;
              
              if (!firedRef.current.has(key)) {
                firedRef.current.add(key);
                playTone(settings.tone, settings.volume);
                if (notifPerm === "granted") {
                  sendNotification(
                    `💊 ${med.name}`,
                    `${med.dose} — ${t("rem_notif_take_now")}`
                  );
                }
                toast.info(`💊 ${med.name} — ${med.dose}`, {
                  description: t("rem_notif_take_now"),
                  duration: 10000,
                  action: {
                    label: t("rem_mark_taken"),
                    onClick: () => markTaken(med),
                  },
                });
              }
            }
          });
        });
      }

      if (settings.type !== "prescriptions") {
        appointments.forEach(a => {
          const apptTime = new Date(a.date);
          const diff = apptTime.getTime() - now.getTime();
          const key = `appt-${a.id}-${now.toDateString()}`;
          if (diff > 0 && diff <= leadMs && !firedRef.current.has(key)) {
            firedRef.current.add(key);
            playTone(settings.tone, settings.volume);
            if (notifPerm === "granted") {
              sendNotification(
                t("rem_notif_appt"),
                t("rem_notif_appt_msg", { doctor: a.doctor })
              );
            }
          }
        });
      }
    };

    check();
    const interval = setInterval(check, 15000); // Check every 15 seconds for better responsiveness
    return () => clearInterval(interval);
  }, [settings, meds, appointments, notifPerm, t]);

  if (loading) return <div className="p-8"><p className="text-muted-foreground">{t("loading")}</p></div>;

  const disabledSet = new Set(settings.disabledMedIds);

  return (
    <div className="p-8 max-w-4xl">
      {/* Title */}
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold text-foreground">{t("rem_title")}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t("rem_subtitle")}</p>
      </div>

      {/* Notification Permission Banner */}
      {notifPerm !== "granted" && (
        <div className="mt-4 rounded-2xl border border-border bg-accent/30 p-4 animate-fade-up" style={{ animationDelay: "0.03s" }}>
          <div className="flex items-start gap-3">
            <BellRing className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {notifPerm === "unsupported" ? t("rem_notif_unsupported") : notifPerm === "denied" ? t("rem_notif_denied") : t("rem_notif_permission")}
              </p>
            </div>
            {notifPerm === "default" && (
              <Button size="sm" onClick={requestPermission} className="rounded-xl shrink-0">
                {t("rem_allow_notifications")}
              </Button>
            )}
          </div>
        </div>
      )}

      {notifPerm === "granted" && (
        <div className="mt-4 flex items-center gap-2 text-sm text-primary animate-fade-up" style={{ animationDelay: "0.03s" }}>
          <CheckCircle2 className="w-4 h-4" />
          <span>{t("rem_notif_granted")}</span>
        </div>
      )}

      {/* Global Toggle */}
      <div className="meditrack-card mt-4 animate-fade-up" style={{ animationDelay: "0.05s" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-primary" />
            <div>
              <p className="font-semibold text-foreground">{t("rem_enable")}</p>
              <p className="text-xs text-muted-foreground">{t("rem_enable_desc")}</p>
            </div>
          </div>
          <Switch checked={settings.enabled} onCheckedChange={v => update({ enabled: v })} />
        </div>
      </div>

      {settings.enabled && (
        <>
          {/* Remind For */}
          <div className="meditrack-card mt-4 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <p className="font-semibold text-foreground mb-3">{t("rem_for")}</p>
            <div className="flex flex-col gap-2">
              {(["both", "appointments", "prescriptions"] as const).map(val => (
                <button key={val} onClick={() => update({ type: val })} className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all active:scale-[0.98] ${settings.type === val ? "border-primary bg-primary/5 text-primary" : "border-border bg-background text-foreground hover:bg-accent/50"}`}>
                  {t(val === "both" ? "rem_both" : val === "appointments" ? "rem_appt_only" : "rem_presc_only")}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div className="meditrack-card mt-4 animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <p className="font-semibold text-foreground mb-3">{t("rem_freq_title")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t("rem_freq_label")}</label>
                <select value={settings.frequency} onChange={e => update({ frequency: Number(e.target.value) })} className="mt-1.5 w-full h-10 px-3 rounded-xl border border-input bg-background text-sm">
                  {FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t("rem_lead_label")}</label>
                <select value={settings.leadTime} onChange={e => update({ leadTime: Number(e.target.value) })} className="mt-1.5 w-full h-10 px-3 rounded-xl border border-input bg-background text-sm">
                  {LEAD_TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">{t("rem_freq_desc", { freq: settings.frequency, lead: settings.leadTime })}</p>
          </div>

          {/* Volume */}
          <div className="meditrack-card mt-4 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <p className="font-semibold text-foreground mb-3">{t("rem_volume")}</p>
            <div className="flex items-center gap-4">
              <button onClick={() => adjustVolume(-5)} className="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-accent transition-colors active:scale-95"><Minus className="w-4 h-4" /></button>
              <div className="flex-1"><Slider value={[settings.volume]} onValueChange={v => update({ volume: v[0] })} min={0} max={100} step={5} /></div>
              <button onClick={() => adjustVolume(5)} className="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-accent transition-colors active:scale-95"><Plus className="w-4 h-4" /></button>
              <span className="text-sm font-semibold text-foreground w-12 text-center">{settings.volume}%</span>
              {settings.volume === 0 ? <VolumeX className="w-5 h-5 text-muted-foreground" /> : <Volume2 className="w-5 h-5 text-primary" />}
            </div>
          </div>

          {/* Tone */}
          <div className="meditrack-card mt-4 animate-fade-up" style={{ animationDelay: "0.25s" }}>
            <p className="font-semibold text-foreground mb-3">{t("rem_tone")}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TONES.map(tone => (
                <button key={tone.id} onClick={() => update({ tone: tone.id })} className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all active:scale-[0.98] ${settings.tone === tone.id ? "border-primary bg-primary/5 text-primary" : "border-border bg-background text-foreground hover:bg-accent/50"}`}>
                  {tone.label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => playTone(settings.tone, settings.volume)} className="mt-3 rounded-xl">{t("rem_preview")}</Button>
          </div>

          {/* Per-Medication Reminders */}
          {settings.type !== "appointments" && (
            <div className="mt-6 space-y-3 animate-fade-up" style={{ animationDelay: "0.3s" }}>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("rem_med_reminders")}</p>
              {meds.length === 0 && <p className="text-sm text-muted-foreground">{t("rem_no_meds")}</p>}
              {meds.map(med => {
                const times = parseMedTimes(med.time);
                const isEnabled = !disabledSet.has(med.id);
                return (
                  <div key={med.id} className="meditrack-card">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isEnabled ? "bg-primary/10" : "bg-muted"}`}>
                        {isEnabled ? <Bell className="w-5 h-5 text-primary" /> : <BellOff className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground">{med.name} — {med.dose}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {times.map(({ label, date }, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-xs bg-accent rounded-lg px-2 py-0.5">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              {formatTimeShort(date)}
                            </span>
                          ))}
                        </div>
                        {med.taken && (
                          <span className="text-xs text-primary mt-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> {t("rem_mark_taken")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => testMedNotification(med)} className="rounded-xl text-xs h-8 px-2">
                          {t("rem_test_notification")}
                        </Button>
                        {!med.taken && (
                          <Button variant="outline" size="sm" onClick={() => markTaken(med)} className="rounded-xl text-xs h-8 px-2">
                            {t("rem_mark_taken")}
                          </Button>
                        )}
                        <Switch checked={isEnabled} onCheckedChange={() => toggleMedReminder(med.id)} aria-label={isEnabled ? t("rem_med_enabled") : t("rem_med_disabled")} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Appointment Reminders */}
          {settings.type !== "prescriptions" && (
            <div className="mt-6 space-y-3 animate-fade-up" style={{ animationDelay: "0.35s" }}>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("rem_appt_reminders")}</p>
              {appointments.length === 0 && <p className="text-sm text-muted-foreground">{t("rem_no_appts")}</p>}
              {appointments.map(a => (
                <div key={a.id} className="meditrack-card flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0"><CalendarDays className="w-5 h-5 text-[hsl(220,60%,60%)]" /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{a.doctor}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.date).toLocaleDateString(undefined, { dateStyle: "long" })}</p>
                  </div>
                  <Bell className="w-4 h-4 text-[hsl(220,60%,60%)]" />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reminders;
