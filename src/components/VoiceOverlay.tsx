import { useState, useRef, useEffect, useCallback } from "react";
import { X, Mic, MicOff, Phone, PhoneOff, Volume2, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { store } from "@/lib/store";
import { chatComplete } from "@/lib/ai-stream";

interface Props {
  onClose: () => void;
}

type CallState = "idle" | "connecting" | "active" | "ended";

interface Transcript {
  id: string;
  role: "user" | "assistant";
  text: string;
}

function playTone(type: "start" | "end") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === "start") {
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } else {
      osc.frequency.setValueAtTime(659, ctx.currentTime);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // Audio not available
  }
}

// Pick the best female voice available
function pickFemaleVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() || [];
  const langPrefix = lang.split("-")[0].toLowerCase();

  // Preferred female voice names (most human-sounding across platforms)
  const preferred = [
    "Microsoft Zira",
    "Google UK English Female",
    "Google हिन्दी",
    "Samantha", // macOS
    "Karen",    // macOS Australian
    "Moira",    // macOS Irish
    "Tessa",    // macOS South African
    "Victoria",
    "Zira",
    "Female",
  ];

  // Try preferred voices first
  for (const pref of preferred) {
    const match = voices.find(v =>
      v.name.toLowerCase().includes(pref.toLowerCase()) &&
      v.lang.toLowerCase().startsWith(langPrefix)
    );
    if (match) return match;
  }

  // Fallback: any female-sounding voice in the right language
  const langVoices = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));
  const femaleKeywords = ["female", "woman", "zira", "samantha", "karen", "tessa", "moira", "victoria", "alice", "lily", "sara"];
  const female = langVoices.find(v => femaleKeywords.some(k => v.name.toLowerCase().includes(k)));
  if (female) return female;

  // Fallback: any voice in the language
  return langVoices[0] || null;
}

const VoiceOverlay = ({ onClose }: Props) => {
  const { t, i18n } = useTranslation();
  const [callState, setCallState] = useState<CallState>("idle");
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentPartial, setCurrentPartial] = useState("");
  const recognitionRef = useRef<any>(null);
  const conversationRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(false);
  const speakingRef = useRef(false); // tracks TTS state synchronously

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcripts, currentPartial]);

  // Preload voices
  useEffect(() => {
    window.speechSynthesis?.getVoices();
    const handler = () => window.speechSynthesis?.getVoices();
    window.speechSynthesis?.addEventListener?.("voiceschanged", handler);
    return () => {
      activeRef.current = false;
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
      window.speechSynthesis?.removeEventListener?.("voiceschanged", handler);
    };
  }, []);

  const buildContext = useCallback(async () => {
    const { buildFullContext } = await import("@/lib/sync");
    return buildFullContext();
  }, []);

  const speakResponse = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) { resolve(); return; }
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*#_`]/g, "").replace(/\n+/g, ". ");
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.0;
      utterance.pitch = 1.12;
      utterance.volume = 1.0;

      const langTag = i18n.language === "en" ? "en-IN" : i18n.language;
      utterance.lang = langTag;

      const voice = pickFemaleVoice(langTag);
      if (voice) utterance.voice = voice;

      utterance.onstart = () => { setIsSpeaking(true); speakingRef.current = true; };
      utterance.onend = () => { setIsSpeaking(false); speakingRef.current = false; resolve(); };
      utterance.onerror = () => { setIsSpeaking(false); speakingRef.current = false; resolve(); };
      window.speechSynthesis.speak(utterance);
    });
  }, [i18n.language]);

  const getAIResponse = useCallback(async (userText: string) => {
    conversationRef.current.push({ role: "user", content: userText });
    const context = await buildContext();

    try {
      const response = await chatComplete(
        conversationRef.current.map(m => ({ role: m.role, content: m.content })),
        context
      );

      if (!activeRef.current) return;

      conversationRef.current.push({ role: "assistant", content: response });
      setTranscripts(prev => [...prev, { id: Date.now().toString(), role: "assistant", text: response }]);

      await speakResponse(response);

      // After speaking, resume listening if still active
      if (activeRef.current && !muted) startListening();
    } catch {
      if (!activeRef.current) return;
      const errorText = "I'm having trouble connecting. Please try again.";
      setTranscripts(prev => [...prev, { id: Date.now().toString(), role: "assistant", text: errorText }]);
      await speakResponse(errorText);
      if (activeRef.current && !muted) startListening();
    }
  }, [buildContext, speakResponse, muted]);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || !activeRef.current) return;

    // Stop any previous recognition
    try { recognitionRef.current?.abort(); } catch {}

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = i18n.language === "en" ? "en-IN" : i18n.language;
    recognitionRef.current = recognition;

    let finalText = "";
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let hasSpoken = false;

    const finishUtterance = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = null;
      if (finalText.trim() && activeRef.current) {
        hasSpoken = true;
        const text = finalText.trim();
        finalText = "";
        setCurrentPartial("");
        try { recognition.abort(); } catch {}
        setIsListening(false);

        setTranscripts(prev => [...prev, { id: Date.now().toString(), role: "user", text }]);
        getAIResponse(text);
      }
    };

    recognition.onresult = (event: any) => {
      // Auto-interrupt: if AI is speaking and user starts talking, cancel TTS
      if (speakingRef.current) {
        window.speechSynthesis?.cancel();
        setIsSpeaking(false);
        speakingRef.current = false;
      }

      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += (finalText ? " " : "") + transcript;
        } else {
          interim = transcript;
        }
      }
      setCurrentPartial(finalText + (interim ? " " + interim : ""));

      // Reset silence timer — after 1.5s of silence, treat as end of utterance
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(finishUtterance, 1500);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (silenceTimer) clearTimeout(silenceTimer);

      if (finalText.trim() && activeRef.current && !hasSpoken) {
        finishUtterance();
      } else if (activeRef.current && !muted && !hasSpoken) {
        // Restart listening if no speech was processed
        setTimeout(() => { if (activeRef.current) startListening(); }, 200);
      }
    };

    recognition.onerror = (e: any) => {
      if (silenceTimer) clearTimeout(silenceTimer);
      setIsListening(false);
      if (e.error === "no-speech" && activeRef.current && !muted) {
        setTimeout(() => { if (activeRef.current) startListening(); }, 300);
      }
    };

    recognition.start();
    setIsListening(true);
  }, [i18n.language, getAIResponse, muted]);

  const startCall = useCallback(async () => {
    setCallState("connecting");
    playTone("start");

    const profile = await store.getProfile();
    const greeting = profile.name
      ? `Hello ${profile.name}! I'm your MediTrack health assistant. How can I help you today?`
      : "Hello! I'm your MediTrack health assistant. How can I help you today?";

    conversationRef.current = [];
    setTranscripts([{ id: "greeting", role: "assistant", text: greeting }]);
    setCallState("active");
    activeRef.current = true;

    await speakResponse(greeting);

    if (activeRef.current) startListening();
  }, [speakResponse, startListening]);

  const endCall = useCallback(() => {
    activeRef.current = false;
    setCallState("ended");
    setIsListening(false);
    setIsSpeaking(false);
    speakingRef.current = false;
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
    playTone("end");
    setTimeout(() => onClose(), 1500);
  }, [onClose]);

  const toggleMute = () => {
    if (muted) {
      setMuted(false);
      if (callState === "active" && !speakingRef.current) startListening();
    } else {
      setMuted(true);
      recognitionRef.current?.abort();
      setIsListening(false);
    }
  };

  const ringColor = isSpeaking
    ? "bg-primary/30"
    : isListening
    ? "bg-destructive/20"
    : "bg-primary/10";

  return (
    <div className="fixed inset-0 bg-[hsl(220,20%,10%,0.95)] z-50 flex flex-col animate-fade-in">
      {/* Close button */}
      <button
        onClick={callState === "active" ? endCall : onClose}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors active:scale-95 z-10"
        aria-label={t("voice_close")}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Transcript area — takes up most of the screen */}
      {callState === "active" && transcripts.length > 0 ? (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pt-16 pb-4 space-y-2">
          {transcripts.map(tr => (
            <div key={tr.id} className={`flex ${tr.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                tr.role === "user"
                  ? "bg-white/15 text-white/90 rounded-br-md"
                  : "bg-primary/20 text-white rounded-bl-md"
              }`}>
                {tr.text}
              </div>
            </div>
          ))}
          {currentPartial && (
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl px-4 py-2 text-sm bg-white/10 text-white/60 rounded-br-md italic">
                {currentPartial}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          {callState === "idle" && (
            <div className="text-center">
              <div className="relative w-28 h-28 mx-auto mb-6">
                <div className="w-28 h-28 rounded-full bg-primary/70 flex items-center justify-center">
                  <Sparkles className="w-12 h-12 text-white" />
                </div>
              </div>
              <h2 className="text-white text-xl font-bold mb-1">{t("voice_title")}</h2>
              <p className="text-white/40 text-sm mb-2">{t("voice_subtitle")}</p>
              <p className="text-white/30 text-xs mt-6 max-w-[280px] mx-auto">{t("voice_languages")}</p>
              <p className="text-white/20 text-xs italic mt-1">{t("voice_hint")}</p>
            </div>
          )}
          {callState === "connecting" && (
            <div className="text-center">
              <div className="w-28 h-28 rounded-full bg-primary/70 flex items-center justify-center mx-auto mb-6 animate-pulse">
                <Sparkles className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-white text-xl font-bold">{t("loading") || "Connecting..."}</h2>
            </div>
          )}
          {callState === "ended" && (
            <div className="text-center">
              <h2 className="text-white text-xl font-bold mb-1">{t("voice_ended") || "Call ended"}</h2>
              <p className="text-white/40 text-sm">{t("voice_thank_you") || "Thank you for using MediTrack"}</p>
            </div>
          )}
        </div>
      )}

      {/* Bottom controls — phone-call style */}
      <div className="pb-12 pt-4 px-6">
        {/* Status text */}
        {callState === "active" && (
          <p className="text-center text-white/50 text-xs mb-4">
            {isSpeaking
              ? (t("voice_ai_speaking") || "AI is speaking...")
              : isListening
              ? (t("chat_listening") || "Listening...")
              : (t("voice_ai_thinking") || "Thinking...")}
          </p>
        )}

        <div className="flex items-center justify-center gap-6">
          {callState === "idle" && (
            <button
              onClick={startCall}
              className="w-18 h-18 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30 hover:brightness-110 transition-all active:scale-95"
              style={{ width: 72, height: 72 }}
              aria-label={t("voice_call") || "Start call"}
            >
              <Phone className="w-8 h-8" />
            </button>
          )}

          {callState === "active" && (
            <>
              {/* Mute */}
              <button
                onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
                  muted ? "bg-destructive text-white" : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                }`}
                aria-label={muted ? (t("voice_unmute") || "Unmute") : (t("voice_mute") || "Mute")}
              >
                {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              {/* Speaker status indicator */}
              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                isSpeaking ? "bg-primary text-white" : isListening ? "bg-white/15 text-white/70" : "bg-white/10 text-white/40"
              }`}>
                {isSpeaking ? (
                  <Volume2 className="w-6 h-6 animate-pulse" />
                ) : isListening ? (
                  <Mic className="w-6 h-6 animate-pulse" />
                ) : (
                  <Sparkles className="w-6 h-6" />
                )}
              </div>

              {/* End call */}
              <button
                onClick={endCall}
                className="w-14 h-14 rounded-full bg-destructive flex items-center justify-center text-white shadow-lg hover:brightness-110 transition-all active:scale-95"
                aria-label={t("voice_end") || "End call"}
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceOverlay;
