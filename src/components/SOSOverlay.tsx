import { X, Phone, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { store } from "@/lib/store";

interface Props {
  onClose: () => void;
}

const SOSOverlay = ({ onClose }: Props) => {
  const { t } = useTranslation();
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    store.getProfile().then((p) => {
      setEmergencyName(p.emergencyContactName || "");
      setEmergencyPhone(p.emergencyContactPhone || "");
      setLoading(false);
    });
  }, []);

  const callEmergency = () => {
    if (emergencyPhone) {
      window.open(`tel:${emergencyPhone}`, "_self");
    }
  };

  const callAmbulance = () => {
    window.open("tel:108", "_self");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl w-[90vw] max-w-sm animate-in zoom-in-95 duration-300 overflow-hidden">
        {/* Red header */}
        <div className="bg-destructive text-destructive-foreground p-5 flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 animate-pulse" />
          <div>
            <h2 className="text-lg font-bold">SOS Emergency</h2>
            <p className="text-sm opacity-90">Quick access to emergency help</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
            aria-label="Close SOS"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {/* Call Ambulance */}
          <button
            onClick={callAmbulance}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 transition-colors active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-full bg-destructive flex items-center justify-center">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="font-bold text-foreground">Call Ambulance</p>
              <p className="text-sm text-muted-foreground">Dial 108</p>
            </div>
          </button>

          {/* Call Emergency Contact */}
          {!loading && emergencyPhone && (
            <button
              onClick={callEmergency}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-accent border border-border hover:bg-accent/80 transition-colors active:scale-[0.98]"
            >
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                <Phone className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="text-left">
                <p className="font-bold text-foreground">Call {emergencyName || "Emergency Contact"}</p>
                <p className="text-sm text-muted-foreground">{emergencyPhone}</p>
              </div>
            </button>
          )}

          {!loading && !emergencyPhone && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No emergency contact set. Add one in your Profile.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SOSOverlay;
