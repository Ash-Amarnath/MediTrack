import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Heart, Phone, AlertTriangle, Droplets, Shield, Download, Share2 } from "lucide-react";

interface HealthProfile {
  name: string;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  aadhaar_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  organ_donor: boolean | null;
  jehovah_witness: boolean | null;
  dnr: boolean | null;
  allergies: { name: string; severity: string }[] | null;
  chronic_conditions: { description: string; year: string }[] | null;
  past_surgeries: { description: string; year: string }[] | null;
  vaccinations: { description: string; year: string }[] | null;
  family_history: { description: string }[] | null;
}

const HealthIdPublic = () => {
  const [params] = useSearchParams();
  const userId = params.get("user_id");
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setError("No health ID specified");
      setLoading(false);
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    fetch(`${supabaseUrl}/functions/v1/health-id-pdf?user_id=${userId}`, {
      headers: { "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    })
      .then(r => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(data => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Health ID not found");
        setLoading(false);
      });
  }, [userId]);

  const handleDownload = () => {
    window.print();
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${profile?.name || "MediTrack"} — Health ID`, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-500 text-lg">Loading Health ID…</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">{error || "Health ID not found"}</p>
        </div>
      </div>
    );
  }

  const allergies = (profile.allergies || []) as { name: string; severity: string }[];
  const conditions = (profile.chronic_conditions || []) as { description: string; year: string }[];
  const surgeries = (profile.past_surgeries || []) as { description: string; year: string }[];
  const vaccinations = (profile.vaccinations || []) as { description: string; year: string }[];
  const familyHistory = (profile.family_history || []) as { description: string }[];

  const severityColor = (s: string) => {
    switch (s) {
      case "severe": return "bg-red-100 text-red-800 border-red-200";
      case "moderate": return "bg-orange-100 text-orange-800 border-orange-200";
      default: return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Action bar — hidden on print */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-600">MediTrack Health ID</span>
        <div className="flex gap-2">
          <button onClick={handleShare} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 transition-colors active:scale-95">
            <Share2 className="w-4 h-4" /> Share
          </button>
          <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors active:scale-95">
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="bg-emerald-800 text-white rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-5 h-5" />
              <h1 className="text-xl font-bold tracking-tight">MediTrack Health ID</h1>
            </div>
            <p className="text-emerald-200 text-xs">Emergency Medical Information</p>
          </div>
          {profile.blood_group && (
            <div className="bg-red-50 text-red-700 font-bold text-lg px-3 py-1 rounded-lg border border-red-200">
              {profile.blood_group}
            </div>
          )}
        </div>

        {/* Emergency Contact Banner */}
        {profile.emergency_contact_phone && (
          <div className="bg-red-600 text-white rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              <div>
                <p className="text-xs font-medium opacity-80">EMERGENCY CONTACT</p>
                <p className="font-bold">{profile.emergency_contact_name || "Emergency"} — {profile.emergency_contact_phone}</p>
              </div>
            </div>
            <a href={`tel:${profile.emergency_contact_phone}`} className="print:hidden bg-white text-red-600 font-bold text-sm px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors active:scale-95">
              Call
            </a>
          </div>
        )}

        {/* Personal Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide text-emerald-700">Personal Information</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Full Name", profile.name],
              ["Phone", profile.phone],
              ["Date of Birth", profile.date_of_birth],
              ["Gender", profile.gender],
              ["Blood Group", profile.blood_group],
              ["Aadhaar ID", profile.aadhaar_id],
            ].map(([label, val]) => (
              <div key={label as string}>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-semibold text-gray-800">{(val as string) || "N/A"}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Critical Directives */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-sm uppercase tracking-wide text-emerald-700 mb-3 flex items-center gap-1.5">
            <Shield className="w-4 h-4" /> Critical Directives
          </h2>
          <div className="flex flex-wrap gap-2">
            {[
              ["Organ Donor", profile.organ_donor],
              ["No Blood Products (JW)", profile.jehovah_witness],
              ["DNR", profile.dnr],
            ].map(([label, val]) => (
              <span key={label as string} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${val ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                {label as string}: {val ? "YES" : "No"}
              </span>
            ))}
          </div>
        </div>

        {/* Allergies */}
        {allergies.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-sm uppercase tracking-wide text-red-600 mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Allergies
            </h2>
            <div className="space-y-2">
              {allergies.map((a, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                  <span className="text-sm font-medium text-gray-800">{a.name}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${severityColor(a.severity)}`}>
                    {a.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conditions */}
        {conditions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-sm uppercase tracking-wide text-emerald-700 mb-3">Chronic Conditions</h2>
            <div className="space-y-2">
              {conditions.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-800">{c.description}</span>
                  <span className="text-xs text-gray-500">{c.year || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Surgeries */}
        {surgeries.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-sm uppercase tracking-wide text-emerald-700 mb-3">Past Surgeries</h2>
            <div className="space-y-2">
              {surgeries.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-800">{s.description}</span>
                  <span className="text-xs text-gray-500">{s.year || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vaccinations */}
        {vaccinations.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-sm uppercase tracking-wide text-emerald-700 mb-3">Vaccinations</h2>
            <div className="space-y-2">
              {vaccinations.map((v, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-800">{v.description}</span>
                  <span className="text-xs text-gray-500">{v.year || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Family History */}
        {familyHistory.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-sm uppercase tracking-wide text-emerald-700 mb-3">Family History</h2>
            <div className="space-y-2">
              {familyHistory.map((f, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-800">{f.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-2 pb-6 border-t border-gray-100">
          <p>Generated by MediTrack Health Companion · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
          <p className="mt-0.5">This document contains sensitive medical information. Handle with care.</p>
        </div>
      </div>
    </div>
  );
};

export default HealthIdPublic;
