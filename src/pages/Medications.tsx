import { useState, useEffect } from "react";
import { Plus, X, Clock, Check, Pill } from "lucide-react";
import { useTranslation } from "react-i18next";
import { store, type Medication, type MedType, type MedSchedule, type FoodTiming } from "@/lib/store";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const MED_TYPES: { value: MedType; labelKey: string }[] = [
  { value: "tablet", labelKey: "med_type_tablet" },
  { value: "capsule", labelKey: "med_type_capsule" },
  { value: "syrup", labelKey: "med_type_syrup" },
  { value: "injection", labelKey: "med_type_injection" },
  { value: "drops", labelKey: "med_type_drops" },
  { value: "inhaler", labelKey: "med_type_inhaler" },
  { value: "cream", labelKey: "med_type_cream" },
  { value: "powder", labelKey: "med_type_powder" },
  { value: "patch", labelKey: "med_type_patch" },
  { value: "other", labelKey: "med_type_other" },
];

const SCHEDULES: { value: MedSchedule; labelKey: string }[] = [
  { value: "morning", labelKey: "med_sched_morning" },
  { value: "afternoon", labelKey: "med_sched_afternoon" },
  { value: "evening", labelKey: "med_sched_evening" },
  { value: "night", labelKey: "med_sched_night" },
];

const FOOD_TIMINGS: { value: FoodTiming; labelKey: string }[] = [
  { value: "before", labelKey: "med_food_before" },
  { value: "after", labelKey: "med_food_after" },
];

const Medications = () => {
  const { t } = useTranslation();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '', dose: '',
    medType: 'tablet' as MedType,
    customMedType: '',
    schedules: ['morning'] as MedSchedule[],
    scheduleTimes: { morning: '08:00', afternoon: '14:00', evening: '18:00', night: '21:00' } as Record<MedSchedule, string>,
    foodTiming: 'after' as FoodTiming,
    startDate: '', endDate: '',
  });

  useEffect(() => {
    store.getMeds().then(m => { setMeds(m); setLoading(false); });
  }, []);

  const toggleSchedule = (val: MedSchedule) => {
    setForm(prev => {
      const has = prev.schedules.includes(val);
      const next = has ? prev.schedules.filter(s => s !== val) : [...prev.schedules, val];
      return { ...prev, schedules: next.length ? next : [val] };
    });
  };

  const addMed = async () => {
    const timeStr = form.schedules.map(s => `${s}:${form.scheduleTimes[s]}`).join(',');
    const result = await store.addMed({
      name: form.name, dose: form.dose, time: timeStr,
      medType: form.medType, schedule: form.schedules.join(',') as MedSchedule, foodTiming: form.foodTiming,
      startDate: form.startDate || undefined, endDate: form.endDate || undefined,
      stock: 0, taken: false,
    });
    if (result) {
      setMeds(prev => [...prev, result]);
      setShowAdd(false);
      setForm({ name: '', dose: '', medType: 'tablet', customMedType: '', schedules: ['morning'], scheduleTimes: { morning: '08:00', afternoon: '14:00', evening: '18:00', night: '21:00' }, foodTiming: 'after', startDate: '', endDate: '' });
      toast({ title: t("meds_added_toast") });
    }
  };

  const removeMed = async (id: string) => {
    await store.deleteMed(id);
    setMeds(prev => prev.filter(m => m.id !== id));
  };

  if (loading) return <div className="p-8"><p className="text-muted-foreground">{t("loading")}</p></div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("meds_title")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t("meds_subtitle")}</p>
        </div>
        <Button className="rounded-xl gap-2" onClick={() => setShowAdd(true)} aria-label={t("meds_add")}>
          <Plus className="w-4 h-4" /> {t("meds_add")}
        </Button>
      </div>

      {showAdd && (
        <div className="meditrack-card mt-6 border-2 border-dashed border-primary/30 animate-fade-up">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">{t("meds_name")}</label>
              <Input placeholder="e.g. Paracetamol" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="mt-1 rounded-xl" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("meds_dose")}</label>
              <Input placeholder="e.g. 500mg, 5ml" value={form.dose} onChange={e => setForm({...form, dose: e.target.value})} className="mt-1 rounded-xl" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("med_type_label")}</label>
              <select value={form.medType} onChange={e => setForm({...form, medType: e.target.value as MedType, customMedType: e.target.value === 'other' ? form.customMedType : ''})} className="mt-1 w-full h-10 px-3 rounded-xl border border-input bg-background text-sm" aria-label={t("med_type_label")}>
                {MED_TYPES.map(mt => <option key={mt.value} value={mt.value}>{t(mt.labelKey)}</option>)}
              </select>
              {form.medType === 'other' && (
                <Input
                  placeholder={t("med_type_other_placeholder")}
                  value={form.customMedType}
                  onChange={e => setForm({...form, customMedType: e.target.value})}
                  className="mt-2 rounded-xl"
                  aria-label={t("med_type_other_placeholder")}
                />
              )}
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">{t("med_schedule_label")}</label>
              <div className="mt-2 space-y-2">
                {SCHEDULES.map(s => (
                  <div key={s.value} className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer min-w-[120px]">
                      <Checkbox
                        checked={form.schedules.includes(s.value)}
                        onCheckedChange={() => toggleSchedule(s.value)}
                        aria-label={t(s.labelKey)}
                      />
                      <span className="text-sm">{t(s.labelKey)}</span>
                    </label>
                    {form.schedules.includes(s.value) && (
                      <Input
                        type="time"
                        value={form.scheduleTimes[s.value]}
                        onChange={e => setForm(prev => ({ ...prev, scheduleTimes: { ...prev.scheduleTimes, [s.value]: e.target.value } }))}
                        className="rounded-xl w-32"
                        aria-label={`${t(s.labelKey)} ${t("meds_time")}`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t("med_food_label")}</label>
              <select value={form.foodTiming} onChange={e => setForm({...form, foodTiming: e.target.value as FoodTiming})} className="mt-1 w-full h-10 px-3 rounded-xl border border-input bg-background text-sm" aria-label={t("med_food_label")}>
                {FOOD_TIMINGS.map(ft => <option key={ft.value} value={ft.value}>{t(ft.labelKey)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">{t("med_start_date")}</label>
              <Input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} className="mt-1 rounded-xl" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("med_end_date")}</label>
              <Input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} className="mt-1 rounded-xl" />
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowAdd(false)} className="rounded-xl">{t("meds_cancel")}</Button>
            <Button onClick={addMed} disabled={!form.name.trim()} className="rounded-xl">{t("meds_save")}</Button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {meds.map((m, i) => (
          <div key={m.id} className="meditrack-card flex items-center justify-between animate-fade-up" style={{ animationDelay: `${0.05 * i}s` }}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.taken ? 'bg-primary/10' : 'bg-accent'}`}>
                {m.taken ? <Check className="w-5 h-5 text-primary" /> : <Pill className="w-5 h-5 text-primary" />}
              </div>
              <div>
                <p className="font-semibold text-foreground">{m.name}</p>
                <p className="text-xs text-muted-foreground">
                  {m.dose} · {t(`med_type_${m.medType}`)} · {t(`med_food_${m.foodTiming}`)}
                </p>
                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {m.time.includes(':') && m.time.includes(',') ? (
                    m.time.split(',').map((entry, i) => {
                      const [sched, time] = entry.split(':').length > 2 
                        ? [entry.split(':')[0], entry.split(':').slice(1).join(':')]
                        : [entry.split(':')[0], entry.split(':')[1]];
                      return (
                        <span key={i} className="text-primary font-medium">
                          {t(`med_sched_${sched?.trim()}`) || sched} {time}{i < m.time.split(',').length - 1 ? ' · ' : ''}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-primary font-medium">
                      {m.schedule.split(',').map(s => t(`med_sched_${s}`)).join(', ')} · {m.time}
                    </span>
                  )}
                  {m.startDate && (
                    <span className="ml-1">· {new Date(m.startDate).toLocaleDateString()} → {m.endDate ? new Date(m.endDate).toLocaleDateString() : '...'}</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={() => removeMed(m.id)} className="text-muted-foreground hover:text-destructive transition-colors" aria-label={t("meds_remove", { name: m.name })}>
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        {meds.length === 0 && !showAdd && (
          <p className="text-sm text-muted-foreground text-center py-12">{t("meds_empty")}</p>
        )}
      </div>
    </div>
  );
};

export default Medications;
