import { Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { lovable } from "@/integrations/lovable";

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleGoogleSignIn = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (error) {
      console.error("Sign in error:", error);
    }
  };

  return (
    <div className="meditrack-container flex flex-col items-center justify-center px-6 min-h-screen bg-background" role="main" aria-label="Login page">
      <div className="flex flex-col items-center gap-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
        <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center" aria-hidden="true">
          <Heart className="w-10 h-10 text-primary" />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            <span className="text-primary">{t("login_title_1")}</span>{t("login_title_2")}
          </h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-[280px]">
            {t("login_subtitle")}
          </p>
        </div>

        <Button
          onClick={handleGoogleSignIn}
          className="w-full max-w-[280px] h-12 rounded-xl text-base font-semibold"
          aria-label={t("login_google")}
          disabled={loading}
        >
          {t("login_google")}
        </Button>

        <p className="text-xs text-muted-foreground">
          {t("login_footer")}
        </p>
      </div>
    </div>
  );
};

export default Login;
