import React from "react";
import { create } from "zustand";
import { IdemLoader } from "@idem/shared-loader/react";

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

  return <IdemLoader fullscreen size="lg" label="Loading..." />;
};
