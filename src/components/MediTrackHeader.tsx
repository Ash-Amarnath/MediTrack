import { Heart, Languages } from "lucide-react";

interface MediTrackHeaderProps {
  language?: string;
  onLanguageToggle?: () => void;
}

const MediTrackHeader = ({ language = "English", onLanguageToggle }: MediTrackHeaderProps) => {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-card border-b border-border" role="banner">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center" aria-hidden="true">
          <Heart className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold text-primary" aria-label="MediTrack home">MediTrack</span>
      </div>
      <button
        onClick={onLanguageToggle}
        className="flex items-center gap-1 text-sm text-primary font-medium px-3 py-1.5 rounded-lg hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Current language: ${language}. Tap to change language.`}
      >
        <Languages className="w-4 h-4" aria-hidden="true" />
        {language}
      </button>
    </header>
  );
};

export default MediTrackHeader;
