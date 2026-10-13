import { create } from "zustand";
import { IModelOption } from "@/components/AiChat/chat";

export interface FilePreview {
  id: string;
  file: File;
  url: string;
  localUrl: string;
  status?: "uploading" | "done" | "error";
}

interface OtherConfig {
  isBackEnd: boolean;
  backendLanguage: string;
  extra: {
    isOpenDataBase: boolean;
    database: string;
    databaseConfig: {
      url: string;
      username: string;
      password: string;
    };
    isOpenCache: boolean;
    cache: string;
  };
}

interface ChatState {
  /**
   * Une génération est en cours dans la conversation.
   *
   * L'aperçu en a besoin : tant que rien n'est généré, il propose « Générer
   * maintenant » — mais pendant la génération, ce bouton n'a plus de sens et
   * doit laisser la place à l'état d'avancement.
   */
  isGenerating: boolean;
  setIsGenerating: (isGenerating: boolean) => void;
  /**
   * Ce projet n'a encore jamais été généré.
   *
   * C'est la même vérité que le bouton de la conversation : elle vient du
   * projet (aucune génération enregistrée, aucune conversation stockée), pas
   * d'une devinette sur les fichiers présents. Un repère tiré du contenu de
   * `src/App.jsx` ratait tous les projets créés avant qu'il existe.
   */
  canGenerate: boolean;
  setCanGenerate: (canGenerate: boolean) => void;
  isDeepThinking: boolean;
  setIsDeepThinking: (isDeepThinking: boolean) => void;
  modelOptions: IModelOption[];
  setModelOptions: (v: IModelOption[]) => void;
  uploadedImages: FilePreview[];
  setUploadedImages: (images: FilePreview[]) => void;
  addImages: (images: FilePreview[]) => void;
  updateImageStatus: (id: string, status: FilePreview["status"]) => void;
  removeImage: (id: string) => void;
  clearImages: () => void;
  otherConfig: OtherConfig;
  setOtherConfig: (config: OtherConfig | ((prev: OtherConfig) => OtherConfig)) => void;
}
const useChatStore = create<ChatState>((set) => ({
  isGenerating: false,
  setIsGenerating: (isGenerating: boolean) => set({ isGenerating }),
  canGenerate: false,
  setCanGenerate: (canGenerate: boolean) => set({ canGenerate }),
  isDeepThinking: false,

  setIsDeepThinking: (isDeepThinking: boolean) => set({ isDeepThinking }),
  uploadedImages: [],
  setModelOptions: (options) => set({ modelOptions: options }),
  setUploadedImages: (images) => set({ uploadedImages: images }),
  addImages: (images) =>
    set((state) => ({
      uploadedImages: [...state.uploadedImages, ...images],
    })),
  updateImageStatus: (id, status) =>
    set((state) => ({
      uploadedImages: state.uploadedImages.map((img) =>
        img.id === id ? { ...img, status } : img
      ),
    })),
  removeImage: (id) =>
    set((state) => ({
      uploadedImages: state.uploadedImages.filter((img) => img.id !== id),
    })),
  clearImages: () => set({ uploadedImages: [] }),
  modelOptions: [],
   otherConfig: {
    isBackEnd: false,
    backendLanguage: "",
    extra: {
      isOpenDataBase: false,
      database: "",
      databaseConfig: {
        url: "",
        username: "",
        password: "",
      },
      isOpenCache: false,
      cache: "",
    }
  },
  setOtherConfig: (config) => {
    if (typeof config === 'function') {
      set((state) => ({ otherConfig: config(state.otherConfig) }));
    } else {
      set({ otherConfig: config });
    }
  },
}));

export default useChatStore;
