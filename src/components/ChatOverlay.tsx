import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Sparkles, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { store, type ChatMessage } from "@/lib/store";
import { streamChat } from "@/lib/ai-stream";
import ReactMarkdown from "react-markdown";

interface Props {
  onClose: () => void;
}

const ChatOverlay = ({ onClose }: Props) => {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>(store.getChatHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (abortRef.current) abortRef.current.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speakText = (text: string) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*#_`]/g, "").replace(/\n+/g, ". ");
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.lang = i18n.language === "en" ? "en-IN" : i18n.language;
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setInput(prev => prev + " [Voice not supported in this browser]");
      return;
    }
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = i18n.language === "en" ? "en-IN" : i18n.language;
    recognitionRef.current = recognition;
    let finalTranscript = input;
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += (finalTranscript ? " " : "") + transcript;
        else interim = transcript;
      }
      setInput(finalTranscript + (interim ? " " + interim : ""));
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };

  const buildContext = useCallback(async () => {
    const { buildFullContext } = await import("@/lib/sync");
    return buildFullContext();
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(), role: "user", content: input.trim(), timestamp: new Date().toISOString()
    };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    const context = await buildContext();
    const apiMessages = updated.map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    let assistantContent = "";
    const aiMsgId = (Date.now() + 1).toString();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat({
        messages: apiMessages,
        context,
        onDelta: (chunk) => {
          assistantContent += chunk;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && last.id === aiMsgId) {
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
            }
            return [...prev, { id: aiMsgId, role: "assistant", content: assistantContent, timestamp: new Date().toISOString() }];
          });
        },
        onDone: () => {
          setLoading(false);
          setMessages(prev => {
            store.setChatHistory(prev);
            return prev;
          });
          if (assistantContent) speakText(assistantContent);
        },
        signal: controller.signal,
      });
    } catch (err: any) {
      setLoading(false);
      if (err.name === "AbortError") return;
      // Fallback to a friendly error message
      const errorMsg: ChatMessage = {
        id: aiMsgId, role: "assistant",
        content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
      store.setChatHistory([...updated, errorMsg]);
    }
  };

  return (
    <div className="fixed bottom-24 right-6 w-[380px] h-[520px] bg-card rounded-2xl shadow-2xl border border-border flex flex-col z-50 animate-fade-up overflow-hidden">
      <div className="bg-[hsl(153,45%,22%)] px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center" aria-hidden="true">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">{t("chat_title")}</p>
          <p className="text-green-200 text-xs">{t("chat_online")}</p>
        </div>
        <button onClick={() => setTtsEnabled(!ttsEnabled)} className="text-white/70 hover:text-white transition-colors mr-1" aria-label={t(ttsEnabled ? "chat_tts_on" : "chat_tts_off")}>
          {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
        <button onClick={onClose} className="text-white/70 hover:text-white transition-colors" aria-label={t("chat_close")}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm mt-8">
            <Sparkles className="w-8 h-8 mx-auto mb-3 text-primary" aria-hidden="true" />
            <p className="font-medium">{t("chat_hello")}</p>
            <p className="text-xs mt-1">{t("chat_hello_sub")}</p>
            <p className="text-xs mt-2 text-primary font-medium">{t("chat_mic_hint")}</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"}`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-green max-w-none [&_p]:m-0 [&_ul]:my-1 [&_li]:my-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : msg.content}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
              <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border flex gap-2">
        <button onClick={toggleListening} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 shrink-0 ${isListening ? "bg-destructive text-white animate-pulse" : "bg-muted hover:bg-accent"}`} aria-label={t(isListening ? "chat_voice_stop" : "chat_voice_start")}>
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} placeholder={isListening ? t("chat_listening") : t("chat_placeholder")} className="flex-1 bg-muted rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" aria-label={t("chat_placeholder")} />
        <button onClick={sendMessage} disabled={!input.trim() || loading} className="w-10 h-10 rounded-full bg-muted-foreground/20 flex items-center justify-center hover:bg-primary hover:text-white transition-colors disabled:opacity-40 active:scale-95" aria-label={t("chat_send")}>
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ChatOverlay;
