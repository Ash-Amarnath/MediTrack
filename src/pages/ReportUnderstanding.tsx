import { useState, useRef } from "react";
import { Camera, CheckCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import MediTrackHeader from "@/components/MediTrackHeader";

const ReportUnderstanding = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="meditrack-container" role="main" aria-label="Medical Report Understanding">
      <MediTrackHeader />

      <div className="px-4 py-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-1"
          aria-label="Go back to home"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back
        </button>

        <h1 className="text-xl font-bold text-foreground animate-fade-up">Medical Report Understanding</h1>

        <div className="mt-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Select medical report image from gallery or camera"
          />

          <button
            onClick={handleUploadClick}
            className="meditrack-upload-zone w-full min-h-[200px]"
            aria-label="Upload or photograph your report. Tap to select from gallery or camera."
          >
            {preview ? (
              <img src={preview} alt="Preview of uploaded report" className="max-h-[180px] rounded-lg object-contain" />
            ) : (
              <>
                <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-3" aria-hidden="true">
                  <Camera className="w-6 h-6 text-primary" />
                </div>
                <p className="font-semibold text-foreground text-sm">Upload or photograph your report</p>
                <p className="text-xs text-muted-foreground mt-1">Tap to select from gallery or camera</p>
              </>
            )}
          </button>
        </div>

        <div className="mt-4 animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <Button
            className="w-full h-12 rounded-xl text-base font-semibold gap-2"
            variant="outline"
            disabled={!selectedFile}
            aria-label="Explain this report"
          >
            <CheckCircle className="w-5 h-5" aria-hidden="true" />
            Explain this report
          </Button>
        </div>

        {selectedFile && (
          <p className="text-xs text-muted-foreground text-center mt-3 animate-fade-in" aria-live="polite">
            Selected: {selectedFile.name}
          </p>
        )}
      </div>
    </div>
  );
};

export default ReportUnderstanding;
