import { useEffect } from "react";
import useUserStore from "@/stores/userSlice";

export const AuthSync = () => {
  const { logout, isAuthenticated } = useUserStore();

  useEffect(() => {
    const checkGlobalLogout = () => {
      const cookies = document.cookie.split(";");
      let isActive = null;
      
      for (const cookie of cookies) {
        const [name, value] = cookie.split("=").map((c) => c.trim());
        if (name === "idem_session_active") {
          isActive = value;
          break;
        }
      }

      // If we are locally authenticated but the global sentinel says we should be logged out
      if (isAuthenticated && isActive === "0") {
        console.log("AuthSync: Global logout detected from cookie, logging out locally...");
        logout();
      }
    };

    // Check every 3 seconds
    const interval = setInterval(checkGlobalLogout, 3000);

    return () => clearInterval(interval);
  }, [isAuthenticated, logout]);

  return null;
};
