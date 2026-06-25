import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { HealthProfileContent } from "@/components/HealthProfileContent";

export default function HealthProfile() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t("hp.health_profile")}</h1>
          <p className="text-sm text-muted-foreground mt-1">معلوماتك الصحية الشخصية، متاحة لأطبائك المعتمدين</p>
        </div>
        <HealthProfileContent />
      </div>
    </div>
  );
}
