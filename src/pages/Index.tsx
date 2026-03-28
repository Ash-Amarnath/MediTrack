import { FileText, CalendarCheck, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MediTrackHeader from "@/components/MediTrackHeader";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="meditrack-container" role="main" aria-label="MediTrack home dashboard">
      <MediTrackHeader />

      <div className="px-4 py-6">
        <div className="animate-fade-up">
          <h1 className="text-2xl font-bold text-foreground">Namaste!</h1>
          <p className="text-muted-foreground text-sm mt-1">How can MediTrack help you today?</p>
        </div>

        <div className="mt-6 space-y-3">
          <button
            onClick={() => navigate("/report")}
            className="meditrack-card w-full flex items-center gap-4 text-left animate-fade-up"
            style={{ animationDelay: "0.15s" }}
            aria-label="Understand Medical Report. Upload a report or prescription to get a simple explanation."
          >
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center shrink-0" aria-hidden="true">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-[15px]">Understand Medical Report</p>
              <p className="text-muted-foreground text-xs mt-0.5">Upload a report or prescription to get a simple explanation.</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden="true" />
          </button>

          <button
            onClick={() => navigate("/appointment")}
            className="meditrack-card w-full flex items-center gap-4 text-left animate-fade-up"
            style={{ animationDelay: "0.25s" }}
            aria-label="Prepare for Appointment. Create a summary for your doctor visit."
          >
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center shrink-0" aria-hidden="true">
              <CalendarCheck className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-[15px]">Prepare for Appointment</p>
              <p className="text-muted-foreground text-xs mt-0.5">Create a summary for your doctor visit.</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-8 text-center animate-fade-up" style={{ animationDelay: "0.35s" }}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">About MediTrack</p>
          <p className="text-xs text-muted-foreground mt-2 max-w-[300px] mx-auto leading-relaxed">
            MediTrack helps you understand your medical reports and prepare for doctor visits. This is a prototype and not a substitute for professional medical advice.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
