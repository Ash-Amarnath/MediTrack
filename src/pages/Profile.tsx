import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { store, type UserProfile, type AllergyEntry, type HistoryEntry } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, User, Droplets, AlertTriangle, ClipboardList, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const emptyProfile: UserProfile = {
  name: '', email: '', age: '', gender: '', bloodGroup: '', location: '',
  phone: '', dateOfBirth: '', emergencyContactName: '', emergencyContactPhone: '',
  aadhaarId: '', organDonor: false, jehovahWitness: false, dnr: false,
  allergies: [], chronicConditions: [], pastSurgeries: [], vaccinations: [], familyHistory: [],
};

const Profile = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    store.getProfile().then(p => { setProfile(p); setLoading(false); });
    if (user) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(`${user.id}/avatar`);
      fetch(data.publicUrl, { method: 'HEAD' }).then(r => {
        if (r.ok) setAvatarUrl(data.publicUrl + '?t=' + Date.now());
      }).catch(() => {});
    }
  }, [user]);

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const path = `${user.id}/avatar`;
      await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(data.publicUrl + '?t=' + Date.now());
      toast({ title: "✓", description: t("prof_avatar_change") });
    } catch {
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    }
    setUploading(false);
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.[0] || "U").toUpperCase();
  };

  const update = (field: keyof UserProfile, value: unknown) => {
    setProfile(p => ({ ...p, [field]: value }));
  };

  const save = async () => {
    await store.setProfile(profile);
    toast({ title: t("profile_saved"), description: t("profile_saved_desc") });
  };

  // --- List helpers ---
  const addAllergy = () => update("allergies", [...profile.allergies, { name: "", severity: "mild" as const }]);
  const removeAllergy = (i: number) => update("allergies", profile.allergies.filter((_, idx) => idx !== i));
  const updateAllergy = (i: number, field: keyof AllergyEntry, val: string) => {
    const copy = [...profile.allergies];
    copy[i] = { ...copy[i], [field]: val };
    update("allergies", copy);
  };

  const addEntry = (field: 'chronicConditions' | 'pastSurgeries' | 'vaccinations' | 'familyHistory') => {
    update(field, [...(profile[field] as HistoryEntry[]), { description: "", year: "" }]);
  };
  const removeEntry = (field: 'chronicConditions' | 'pastSurgeries' | 'vaccinations' | 'familyHistory', i: number) => {
    update(field, (profile[field] as HistoryEntry[]).filter((_, idx) => idx !== i));
  };
  const updateEntry = (field: 'chronicConditions' | 'pastSurgeries' | 'vaccinations' | 'familyHistory', i: number, key: keyof HistoryEntry, val: string) => {
    const copy = [...(profile[field] as HistoryEntry[])];
    copy[i] = { ...copy[i], [key]: val };
    update(field, copy);
  };

  if (loading) return <div className="p-8"><p className="text-muted-foreground">{t("loading")}</p></div>;

  const fieldClass = "mt-1 rounded-xl";
  const labelClass = "text-sm font-medium text-foreground";
  const sectionCard = "meditrack-card mt-4 animate-fade-up";

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="animate-fade-up flex items-center gap-4">
        <div className="relative group">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-muted-foreground">{getInitials(profile.name || "U")}</span>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors active:scale-95"
            aria-label={t("prof_avatar_upload")}
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("profile_title")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t("profile_subtitle")}</p>
        </div>
      </div>

      <Tabs defaultValue="personal" className="mt-6">
        <TabsList className="grid grid-cols-4 w-full rounded-xl" aria-label={t("profile_title")}>
          <TabsTrigger value="personal" className="rounded-xl gap-1 text-xs sm:text-sm" aria-label={t("prof_tab_personal")}>
            <User className="h-4 w-4 hidden sm:inline" /> {t("prof_tab_personal")}
          </TabsTrigger>
          <TabsTrigger value="blood" className="rounded-xl gap-1 text-xs sm:text-sm" aria-label={t("prof_tab_blood")}>
            <Droplets className="h-4 w-4 hidden sm:inline" /> {t("prof_tab_blood")}
          </TabsTrigger>
          <TabsTrigger value="allergies" className="rounded-xl gap-1 text-xs sm:text-sm" aria-label={t("prof_tab_allergies")}>
            <AlertTriangle className="h-4 w-4 hidden sm:inline" /> {t("prof_tab_allergies")}
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl gap-1 text-xs sm:text-sm" aria-label={t("prof_tab_history")}>
            <ClipboardList className="h-4 w-4 hidden sm:inline" /> {t("prof_tab_history")}
          </TabsTrigger>
        </TabsList>

        {/* ===== PERSONAL BASICS ===== */}
        <TabsContent value="personal">
          <div className={sectionCard}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="p-name" className={labelClass}>{t("profile_name")}</label>
                <Input id="p-name" value={profile.name} onChange={e => update("name", e.target.value)} className={fieldClass} aria-label={t("profile_name")} />
              </div>
              <div>
                <label htmlFor="p-email" className={labelClass}>{t("profile_email")}</label>
                <Input id="p-email" value={profile.email} readOnly className={`${fieldClass} bg-muted`} aria-label={t("profile_email")} />
              </div>
              <div>
                <label htmlFor="p-phone" className={labelClass}>{t("prof_phone")}</label>
                <Input id="p-phone" type="tel" placeholder="+91 98765 43210" value={profile.phone} onChange={e => update("phone", e.target.value)} className={fieldClass} aria-label={t("prof_phone")} />
              </div>
              <div>
                <label htmlFor="p-dob" className={labelClass}>{t("prof_dob")}</label>
                <Input id="p-dob" type="date" value={profile.dateOfBirth} onChange={e => update("dateOfBirth", e.target.value)} className={fieldClass} aria-label={t("prof_dob")} />
              </div>
              <div>
                <label htmlFor="p-age" className={labelClass}>{t("profile_age")}</label>
                <Input id="p-age" placeholder="e.g. 35" value={profile.age} onChange={e => update("age", e.target.value)} className={fieldClass} aria-label={t("profile_age")} />
              </div>
              <div>
                <label htmlFor="p-gender" className={labelClass}>{t("profile_gender")}</label>
                <select id="p-gender" value={profile.gender} onChange={e => update("gender", e.target.value)} className="mt-1 w-full h-10 px-3 rounded-xl border border-input bg-background text-sm" aria-label={t("profile_gender")}>
                  <option value="">{t("profile_gender_select")}</option>
                  <option value="male">{t("profile_gender_male")}</option>
                  <option value="female">{t("profile_gender_female")}</option>
                  <option value="other">{t("profile_gender_other")}</option>
                </select>
              </div>
              <div>
                <label htmlFor="p-location" className={labelClass}>{t("profile_location")}</label>
                <Input id="p-location" value={profile.location} onChange={e => update("location", e.target.value)} className={fieldClass} aria-label={t("profile_location")} />
              </div>
              <div>
                <label htmlFor="p-aadhaar" className={labelClass}>{t("prof_aadhaar")}</label>
                <Input id="p-aadhaar" maxLength={12} placeholder="xxxx xxxx xxxx" value={profile.aadhaarId} onChange={e => update("aadhaarId", e.target.value.replace(/[^0-9]/g, '').slice(0, 12))} className={fieldClass} aria-label={t("prof_aadhaar")} />
              </div>
            </div>

            <h3 className="text-sm font-semibold text-foreground mt-6 mb-2">{t("prof_emergency_contact")}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="p-ec-name" className={labelClass}>{t("prof_ec_name")}</label>
                <Input id="p-ec-name" value={profile.emergencyContactName} onChange={e => update("emergencyContactName", e.target.value)} className={fieldClass} aria-label={t("prof_ec_name")} />
              </div>
              <div>
                <label htmlFor="p-ec-phone" className={labelClass}>{t("prof_ec_phone")}</label>
                <Input id="p-ec-phone" type="tel" placeholder="+91 98765 43210" value={profile.emergencyContactPhone} onChange={e => update("emergencyContactPhone", e.target.value)} className={fieldClass} aria-label={t("prof_ec_phone")} />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ===== BLOOD & EMERGENCY ===== */}
        <TabsContent value="blood">
          <div className={sectionCard}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="p-blood" className={labelClass}>{t("profile_blood")}</label>
                <select id="p-blood" value={profile.bloodGroup} onChange={e => update("bloodGroup", e.target.value)} className="mt-1 w-full h-10 px-3 rounded-xl border border-input bg-background text-sm" aria-label={t("profile_blood")}>
                  <option value="">{t("prof_blood_select")}</option>
                  {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("prof_organ_donor")}</p>
                  <p className="text-xs text-muted-foreground">{t("prof_organ_donor_note")}</p>
                </div>
                <Switch checked={profile.organDonor} onCheckedChange={v => update("organDonor", v)} aria-label={t("prof_organ_donor")} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("prof_jw")}</p>
                  <p className="text-xs text-muted-foreground">{t("prof_jw_note")}</p>
                </div>
                <Switch checked={profile.jehovahWitness} onCheckedChange={v => update("jehovahWitness", v)} aria-label={t("prof_jw")} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("prof_dnr")}</p>
                  <p className="text-xs text-muted-foreground">{t("prof_dnr_note")}</p>
                </div>
                <Switch checked={profile.dnr} onCheckedChange={v => update("dnr", v)} aria-label={t("prof_dnr")} />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ===== ALLERGIES ===== */}
        <TabsContent value="allergies">
          <div className={sectionCard}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">{t("prof_allergies_title")}</h3>
              <Button size="sm" variant="outline" className="rounded-xl gap-1" onClick={addAllergy} aria-label={t("prof_add_allergy")}>
                <Plus className="h-4 w-4" /> {t("prof_add_allergy")}
              </Button>
            </div>
            {profile.allergies.length === 0 && <p className="text-sm text-muted-foreground">{t("prof_no_allergies")}</p>}
            <div className="space-y-3">
              {profile.allergies.map((a, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">{t("prof_allergy_name")}</label>
                    <Input value={a.name} onChange={e => updateAllergy(i, "name", e.target.value)} placeholder={t("prof_allergy_placeholder")} className="rounded-xl" aria-label={`${t("prof_allergy_name")} ${i + 1}`} />
                  </div>
                  <div className="w-32">
                    <label className="text-xs text-muted-foreground">{t("prof_severity")}</label>
                    <select value={a.severity} onChange={e => updateAllergy(i, "severity", e.target.value)} className="w-full h-10 px-2 rounded-xl border border-input bg-background text-sm" aria-label={`${t("prof_severity")} ${i + 1}`}>
                      <option value="mild">{t("prof_mild")}</option>
                      <option value="moderate">{t("prof_moderate")}</option>
                      <option value="severe">{t("prof_severe")}</option>
                    </select>
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => removeAllergy(i)} aria-label={t("prof_remove_allergy")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ===== MEDICAL HISTORY ===== */}
        <TabsContent value="history">
          <div className={sectionCard}>
            {(['chronicConditions', 'pastSurgeries', 'vaccinations', 'familyHistory'] as const).map(field => (
              <div key={field} className="mb-6 last:mb-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">{t(`prof_${field}`)}</h3>
                  <Button size="sm" variant="outline" className="rounded-xl gap-1" onClick={() => addEntry(field)} aria-label={t(`prof_add_${field}`)}>
                    <Plus className="h-4 w-4" /> {t("prof_add")}
                  </Button>
                </div>
                {(profile[field] as HistoryEntry[]).length === 0 && <p className="text-sm text-muted-foreground">{t("prof_none_yet")}</p>}
                <div className="space-y-2">
                  {(profile[field] as HistoryEntry[]).map((entry, i) => (
                    <div key={i} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Input value={entry.description} onChange={e => updateEntry(field, i, "description", e.target.value)} placeholder={t(`prof_${field}_placeholder`)} className="rounded-xl" aria-label={`${t(`prof_${field}`)} ${i + 1}`} />
                      </div>
                      <div className="w-24">
                        <Input value={entry.year || ''} onChange={e => updateEntry(field, i, "year", e.target.value)} placeholder={t("prof_year")} className="rounded-xl" aria-label={`${t("prof_year")} ${i + 1}`} />
                      </div>
                      <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => removeEntry(field, i)} aria-label={t("prof_remove")}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-4 flex justify-end animate-fade-up" style={{ animationDelay: "0.15s" }}>
        <Button onClick={save} className="rounded-xl px-8" aria-label={t("profile_save")}>{t("profile_save")}</Button>
      </div>
    </div>
  );
};

export default Profile;
