import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Loader2, Share2, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { UserProfile } from "@/lib/store";

interface HealthQRProps {
  profile: UserProfile;
  size?: number;
}

/** Build the public URL that renders the health ID as a page in the app */
function getHealthIdUrl(userId: string): string {
  const origin = window.location.origin;
  return `${origin}/health-id?user_id=${userId}`;
}

/** Small QR badge for dashboard header */
export function QRBadge({ profile, onClick }: { profile: UserProfile; onClick: () => void }) {
  const [url, setUrl] = useState<string>("MediTrack");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUrl(getHealthIdUrl(data.user.id));
    });
  }, []);

  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-accent transition-colors active:scale-95 bg-background"
      aria-label="Health QR Code"
    >
      <QRCodeSVG value={url} size={24} level="L" />
    </button>
  );
}

/** Full-screen QR modal */
export function QRModal({ profile, open, onClose }: { profile: UserProfile; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    if (open) {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) setUrl(getHealthIdUrl(data.user.id));
      });
    }
  }, [open]);

  const handleShare = async () => {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${profile.name || "MediTrack"} — Health ID`, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  const handleDownload = () => {
    if (url) window.open(url, "_blank");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl p-6 max-w-sm w-[90vw] animate-in zoom-in-95 duration-300 flex flex-col items-center gap-4">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
          aria-label={t("close")}
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <h2 className="text-lg font-bold text-foreground">Health ID</h2>

        <div className="bg-white p-4 rounded-xl">
          {url ? (
            <QRCodeSVG value={url} size={200} level="M" />
          ) : (
            <div className="w-[200px] h-[200px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="text-center space-y-1">
          {profile.name && <p className="font-semibold text-foreground">{profile.name}</p>}
          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
            {profile.bloodGroup && (
              <span className="px-2 py-0.5 rounded-lg bg-destructive/10 text-destructive font-semibold text-xs">
                {profile.bloodGroup}
              </span>
            )}
            {profile.phone && <span>{profile.phone}</span>}
          </div>
          {profile.emergencyContactPhone && (
            <p className="text-xs text-muted-foreground">
              Emergency: {profile.emergencyContactName} {profile.emergencyContactPhone}
            </p>
          )}
        </div>

        {/* Share & Download buttons */}
        <div className="flex gap-3 w-full">
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold border border-border bg-background hover:bg-accent transition-colors active:scale-95"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors active:scale-95"
          >
            <Download className="w-4 h-4" /> View / Download
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-1">
          Scan this QR code to view emergency health information
        </p>
      </div>
    </div>
  );
}
