import { useEffect, useState } from "react";
import { authService } from "../api/appInfo";
import { useTranslation } from "react-i18next";

interface VersionInfo {
  version: string;
  content: string;
  date: string;
}

export const UpdateTip: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const fetchAppInfo = async () => {
      try {
        const data = await authService.appInfo();
        const verison = data.versionInfo.version;
        const localVersion = localStorage.getItem("version");
        if (!localVersion) {
          localStorage.setItem("version", verison);
        } else if (verison !== localVersion) {
          localStorage.setItem("version", verison);
          setVersionInfo(data.versionInfo);
          setIsVisible(true);
        }
      } catch (error) {
        console.error("get error:", error);
      }
    };

    fetchAppInfo();
  }, []);

  if (!isVisible || !versionInfo) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="relative w-[90%] max-w-md p-6 rounded-lg shadow-xl bg-surface-1">
        <button
          onClick={() => setIsVisible(false)}
          className="absolute top-3 right-3 text-2xl text-text-tertiary hover:opacity-70 transition-opacity"
        >
          ×
        </button>

        <h2 className="text-xl font-semibold mb-4 text-text-secondary">
          {t('update.version_update')} {versionInfo.version}
        </h2>

        <div className="mb-10 leading-relaxed text-text-tertiary whitespace-pre-line">
          {versionInfo.content}
        </div>

        <div className="text-sm text-text-tertiary">
          {t('update.release_date')}：{versionInfo.date}
        </div>
      </div>
    </div>
  );
};

export default UpdateTip;
