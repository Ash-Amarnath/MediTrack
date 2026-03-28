import { Phone, MessageSquare, ScanLine, X, HelpCircle, AlertTriangle } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import ChatOverlay from "./ChatOverlay";
import VoiceOverlay from "./VoiceOverlay";
import ScanOverlay from "./ScanOverlay";
import SOSOverlay from "./SOSOverlay";

const FloatingActions = () => {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);

  // SOS long-press
  const sosTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sosProgress, setSosProgress] = useState(0);
  const sosIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const closeAll = () => {
    setChatOpen(false);
    setVoiceOpen(false);
    setScanOpen(false);
    setMenuOpen(false);
  };

  const openFeature = (setter: (v: boolean) => void) => {
    closeAll();
    setter(true);
  };

  const startSosHold = useCallback(() => {
    setSosProgress(0);
    let progress = 0;
    sosIntervalRef.current = setInterval(() => {
      progress += 2;
      setSosProgress(progress);
      if (progress >= 100) {
        clearInterval(sosIntervalRef.current!);
        sosIntervalRef.current = null;
      }
    }, 100);
    sosTimerRef.current = setTimeout(() => {
      setSosProgress(0);
      closeAll();
      setSosOpen(true);
    }, 5000);
  }, []);

  const cancelSosHold = useCallback(() => {
    if (sosTimerRef.current) {
      clearTimeout(sosTimerRef.current);
      sosTimerRef.current = null;
    }
    if (sosIntervalRef.current) {
      clearInterval(sosIntervalRef.current);
      sosIntervalRef.current = null;
    }
    setSosProgress(0);
  }, []);

  const actions = [
    {
      id: "sos",
      icon: AlertTriangle,
      label: "SOS",
      color: "bg-destructive",
      isSos: true,
    },
    {
      id: "scan",
      icon: ScanLine,
      label: t("scan_title"),
      color: "bg-[hsl(160,50%,30%)]",
      action: () => openFeature(setScanOpen),
    },
    {
      id: "voice",
      icon: Phone,
      label: t("voice_title"),
      color: "bg-[hsl(230,60%,28%)]",
      action: () => openFeature(setVoiceOpen),
    },
    {
      id: "chat",
      icon: MessageSquare,
      label: t("chat_title"),
      color: "bg-[hsl(220,20%,20%)]",
      action: () => openFeature(setChatOpen),
    },
  ];

  return (
    <>
      {/* Floating Help button + expanded menu */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2.5 z-40">
        {menuOpen &&
          actions.map((a, i) => (
            <div
              key={a.id}
              className="flex items-center gap-2.5 animate-in slide-in-from-bottom-2 fade-in duration-200"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="text-xs font-semibold text-foreground bg-card border border-border px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap">
                {a.label}
                {a.isSos && <span className="text-[10px] text-muted-foreground ml-1">(hold 5s)</span>}
              </span>
              {a.isSos ? (
                <button
                  onMouseDown={startSosHold}
                  onMouseUp={cancelSosHold}
                  onMouseLeave={cancelSosHold}
                  onTouchStart={startSosHold}
                  onTouchEnd={cancelSosHold}
                  onTouchCancel={cancelSosHold}
                  className={`relative w-12 h-12 rounded-full ${a.color} text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all active:scale-95 overflow-hidden`}
                  aria-label="SOS - Hold for 5 seconds"
                >
                  {sosProgress > 0 && (
                    <div
                      className="absolute inset-0 bg-white/30 origin-bottom transition-none"
                      style={{ height: `${sosProgress}%` }}
                    />
                  )}
                  <a.icon className="w-5 h-5 relative z-10" aria-hidden="true" />
                </button>
              ) : (
                <button
                  onClick={a.action}
                  className={`w-12 h-12 rounded-full ${a.color} text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all active:scale-95`}
                  aria-label={a.label}
                >
                  <a.icon className="w-5 h-5" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}

        {/* Main Help toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all active:scale-95 ${
            menuOpen ? "bg-foreground text-background" : "bg-primary text-primary-foreground"
          }`}
          aria-label={menuOpen ? "Close help menu" : "Open help menu"}
        >
          {menuOpen ? (
            <X className="w-6 h-6" aria-hidden="true" />
          ) : (
            <HelpCircle className="w-6 h-6" aria-hidden="true" />
          )}
        </button>
      </div>

      {chatOpen && <ChatOverlay onClose={() => setChatOpen(false)} />}
      {voiceOpen && <VoiceOverlay onClose={() => setVoiceOpen(false)} />}
      {scanOpen && <ScanOverlay onClose={() => setScanOpen(false)} />}
      {sosOpen && <SOSOverlay onClose={() => setSosOpen(false)} />}
    </>
  );
};

export default FloatingActions;
