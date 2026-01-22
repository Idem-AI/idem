import React from "react";
import { create } from "zustand";
import { cn } from "@/lib/utils";

interface LoadingStore {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

const useLoadingStore = create<LoadingStore>((set) => ({
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),
}));

export const useLoading = () => {
  const { isLoading, setLoading } = useLoadingStore();
  return { isLoading, setLoading };
};

export const Loading: React.FC = () => {
  const { isLoading } = useLoading();

  if (!isLoading) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-background/80 backdrop-blur-sm"
      )}
    >
      <div className="flex flex-col items-center space-y-4">
        <div className="flex justify-center items-center h-64 flex-col gap-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-2 border-blue-500/30 border-t-blue-500"></div>
            <div className="absolute inset-0 rounded-full animate-pulse bg-blue-500/10 backdrop-blur-sm"></div>
          </div>
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
        
      </div>
    </div>
  );
};
