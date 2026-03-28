import { Heart, ArrowLeft, User, Pill, CalendarDays, MapPin, ClipboardList, FileText, Bell, Languages, LogOut, ChevronDown, X, Camera } from "lucide-react";
import { NavLink as RouterNavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { store } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { languages } from "@/i18n/languages";
import { supabase } from "@/integrations/supabase/client";
import FloatingActions from "./FloatingActions";

const menuItems = [
  { to: "/profile", labelKey: "nav_profile", icon: User },
  { to: "/medications", labelKey: "nav_medications", icon: Pill },
  { to: "/appointments", labelKey: "nav_appointments", icon: CalendarDays },
  { to: "/find-care", labelKey: "nav_find_care", icon: MapPin },
  { to: "/medical-history", labelKey: "nav_history", icon: ClipboardList },
  { to: "/reports", labelKey: "nav_reports", icon: FileText },
  { to: "/reminders", labelKey: "nav_reminders", icon: Bell },
];

const AppLayout = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profileName, setProfileName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const isDashboard = location.pathname === "/dashboard";

  useEffect(() => {
    store.getProfile().then(p => {
      setProfileName(p.name);
      if ((p as any).avatarUrl) setAvatarUrl((p as any).avatarUrl);
    });
    // Also check for avatar in storage
    if (user) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(`${user.id}/avatar`);
      // Check if the file exists by trying to fetch
      fetch(data.publicUrl, { method: 'HEAD' }).then(r => {
        if (r.ok) setAvatarUrl(data.publicUrl + '?t=' + Date.now());
      }).catch(() => {});
    }
  }, [user]);

  // Close sidebar on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [sidebarOpen]);

  const handleLangChange = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("meditrack_language", JSON.stringify(code));
    setLangOpen(false);
  };

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];
  const displayName = profileName || user?.user_metadata?.full_name || "User";

  // Generate initials
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.[0] || "U").toUpperCase();
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 h-14 border-b border-border bg-card flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          {!isDashboard && (
            <button
              onClick={() => navigate("/dashboard")}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors mr-1"
              aria-label={t("nav_back")}
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
          )}
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate("/dashboard")}
            role="button"
            aria-label="Go to dashboard"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center" aria-hidden="true">
              <Heart className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">
              <span className="text-primary">Medi</span>
              <span className="text-foreground">Track</span>
            </span>
          </div>
        </div>

        {/* Avatar button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-9 h-9 rounded-full overflow-hidden border-2 border-border hover:border-primary transition-colors flex items-center justify-center bg-muted active:scale-95"
          aria-label={t("nav_open_menu")}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">{getInitials(displayName)}</span>
          )}
        </button>
      </header>

      {/* Right sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 animate-in fade-in duration-200" />
          <div
            ref={sidebarRef}
            className="absolute right-0 top-0 h-full w-[280px] bg-card border-l border-border shadow-xl animate-in slide-in-from-right duration-300 flex flex-col"
          >
            {/* Sidebar header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">{getInitials(displayName)}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email || ""}</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
                aria-label={t("nav_close_menu")}
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Menu items */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
              {menuItems.map(({ to, labelKey, icon: Icon }) => {
                const isActive = location.pathname === to;
                return (
                  <button
                    key={to}
                    onClick={() => { navigate(to); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                      isActive
                        ? "bg-accent text-primary font-semibold"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    }`}
                    aria-label={t(labelKey)}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    {t(labelKey)}
                  </button>
                );
              })}
            </nav>

            {/* Language picker */}
            <div className="px-4 pb-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Languages className="w-3.5 h-3.5" /> {t("nav_language")}
              </p>
              <div className="relative">
                <button
                  onClick={() => setLangOpen(!langOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border text-sm bg-background hover:bg-accent/50 transition-colors"
                  aria-label={t("nav_language")}
                >
                  {currentLang.native}
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                {langOpen && (
                  <div className="absolute bottom-full left-0 w-full mb-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50 max-h-[200px] overflow-y-auto">
                    {languages.map(l => (
                      <button
                        key={l.code}
                        onClick={() => handleLangChange(l.code)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors ${l.code === i18n.language ? 'bg-accent text-primary font-medium' : 'text-foreground'}`}
                        aria-label={l.label}
                      >
                        {l.native} <span className="text-muted-foreground text-xs ml-1">({l.label})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sign out */}
            <div className="px-4 py-3 border-t border-border">
              <button
                onClick={signOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                aria-label={t("nav_sign_out")}
              >
                <LogOut className="w-[18px] h-[18px]" />
                {t("nav_sign_out")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-h-0">
        <Outlet />
      </main>

      <FloatingActions />
    </div>
  );
};

export default AppLayout;
