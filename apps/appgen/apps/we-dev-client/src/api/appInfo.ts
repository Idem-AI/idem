import { resolveInitialLocale } from "../utils/localeCookie";

export const authService = {
  async appInfo() {
    // Shared cross-app cookie is the source of truth; falls back to browser lang.
    const language = resolveInitialLocale();

    const res = await fetch(
      `${process.env.REACT_APP_BASE_URL}/api/appInfo?language=${language}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  },
};
