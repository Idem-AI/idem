import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Message, useChat } from 'ai/react';
import { toast } from 'react-toastify';
import { uploadImage } from '@/api/chat';
import useChatStore from '../../../stores/chatSlice';
import { useFileStore } from '../../WeIde/stores/fileStore';
import { db } from '../../../utils/indexDB';
import { v4 as uuidv4 } from 'uuid';
import { eventEmitter } from '../utils/EventEmitter';
import { MessageItem } from './components/MessageItem';
import { ChatInput, ChatMode } from './components/ChatInput';
import Tips from './components/Tips';
import { parseMessage } from '../../../utils/messagepParseJson';
import useUserStore from '../../../stores/userSlice';
import { useLimitModalStore } from '../../UserModal';
import { resetFileHashes, resetWebContainer, updateFileSystemNow } from '../../WeIde/services';
import { parseMessages } from '../useMessageParser';
import { createMpIcon } from '@/utils/createWtrite';
import { useTranslation } from 'react-i18next';
import useChatModeStore from '../../../stores/chatModeSlice';
import useTerminalStore from '@/stores/terminalSlice';
import { checkExecList, checkFinish } from '../utils/checkFinish';
import { execList } from '../useMessageParser';
import { resetQualityPass, runQualityPass } from '../utils/qualityPass';
import useVersionHistory from '@/stores/versionHistory';
import CodeLoadError from '@/components/CodeLoadError';
import { useUrlData } from '@/hooks/useUrlData';
import {
  getProjectById,
  getProjectGeneration,
  saveProjectGeneration,
  getProjectCode,
  getProjectChatSession,
  saveProjectChatSession,
  deleteProjectGeneration,
} from '@/api/persistence/db';
import { createProjectMetadata } from '@/utils/zipUtils';
import { deriveAppName } from '@/utils/appName';
import useAppGenContextStore from '@/stores/appgenContextSlice';
import { cancelPendingCodeSync, pushProjectCode, waitForCodeSync } from '@/utils/codeSync';
import { compactMessagesForStorage, deriveSessionTitle } from '@/utils/chatPersistence';
import { MCPTool } from '@/types/mcp';
import useMCPTools from '@/hooks/useMCPTools';
import { ProjectTutorial } from '../../Onboarding/ProjectTutorial';
import { ProjectLogo } from '@/components/ProjectLogo';
import { useLoading } from '../../loading';
import { ProjectModel } from '@/api/persistence/models/project.model';
import { MultiChatPromptService } from './services/multiChatPromptService';
import { currentPlatform, currentProduct } from '@/utils/product';
import { fetchScaffold } from '@/api/scaffold';
import { resetWarmStart, targetFromChoice, warmStart } from '../utils/warmStart';
import { resetInstallRepair } from '../utils/ensurePreview';
import { extractFilesFromText, isEngineSite, isGeneratedSite } from '@/utils/siteEngine';
import { internalMessage } from '@/utils/stepLabels';
import {
  clearScaffold,
  hasScaffoldSignature,
  isScaffoldLocked,
  isStarterOnly,
  looksDegenerate,
  mountedScaffoldVersion,
  registerScaffold,
  settleScaffold,
  waitForScaffold,
  withoutScaffold,
} from '@/utils/scaffoldLock';
import useChatHistoryStore from '@/stores/chatHistoryStore';
import useRunStatus from '@/stores/runStatusSlice';
import { IdemLoader } from '@idem/shared-loader/react';

type WeMessages = (Message & {
  experimental_attachments?: Array<{
    id: string;
    name: string;
    type: string;
    localUrl: string;
    contentType: string;
    url: string;
  }>;
})[];
type TextUIPart = {
  type: 'text';
  /**
   * The text content.
   */
  text: string;
};
// Version web - pas d'ipcRenderer
export const excludeFiles = [
  'components/weicon/base64.js',
  'components/weicon/icon.css',
  'components/weicon/index.js',
  'components/weicon/index.json',
  'components/weicon/index.wxml',
  'components/weicon/icondata.js',
  'components/weicon/index.css',
  '/miniprogram/components/weicon/base64.js',
  '/miniprogram/components/weicon/icon.css',
  '/miniprogram/components/weicon/index.js',
  '/miniprogram/components/weicon/index.json',
  '/miniprogram/components/weicon/index.wxml',
  '/miniprogram/components/weicon/icondata.js',
  '/miniprogram/components/weicon/index.css',
];

/** Artefacts injectés pour le modèle, jamais montrés dans la conversation. */
const CONTEXT_ARTIFACTS = /<boltArtifact id="(hello-js|existing-code)"/;

const API_BASE = process.env.REACT_APP_BASE_URL;
console.log(API_BASE, 'API_BASE');

enum ModelTypes {
  /** Le modèle par défaut du serveur (OpenRouter, poids ouverts). */
  QwenCoderNext = 'qwen/qwen3-coder-next',
}

export interface IModelOption {
  value: string;
  label: string;
  useImage: boolean;
  quota: number;
  from?: string;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  provider?: string;
  functionCall?: boolean;
}

// Interface pour la configuration des modèles depuis l'API
interface ModelConfig {
  modelName: string;
  modelKey: string;
  useImage: boolean;
  description?: string;
  provider?: string;
  functionCall: boolean;
}

// Fonction pour convertir ModelConfig en IModelOption
function convertModelConfigToOption(config: ModelConfig): IModelOption {
  return {
    value: config.modelKey,
    label: config.modelName,
    useImage: config.useImage,
    quota: 2, // Valeur par défaut
    from: 'api',
    provider: config.provider,
    functionCall: config.functionCall,
  };
}

// Fonction pour récupérer la configuration des modèles depuis l'API
async function fetchModelConfig(): Promise<IModelOption[]> {
  try {
    const response = await fetch(`${process.env.REACT_APP_NEXT_API_BASE_URL}/api/model/config`);
    if (!response.ok) {
      throw new Error('Failed to fetch model config');
    }
    const configs: ModelConfig[] = await response.json();
    return configs.map(convertModelConfigToOption);
  } catch (error) {
    console.error('Error fetching model config:', error);
    // Repli hors ligne : le même modèle que le serveur, et lui seul.
    return [
      {
        value: ModelTypes.QwenCoderNext,
        label: 'Qwen3 Coder Next',
        useImage: false,
        from: 'default',
        quota: 2,
        provider: 'openrouter',
        functionCall: true,
      },
    ];
  }
}

// Fonction pour récupérer le modèle par défaut depuis l'API
async function fetchDefaultModel(): Promise<string> {
  try {
    const response = await fetch(`${process.env.REACT_APP_NEXT_API_BASE_URL}/api/model/default`);
    if (!response.ok) {
      throw new Error('Failed to fetch default model');
    }
    const data = await response.json();
    // L'API répond `{ modelKey }` : lire `defaultModel` renvoyait toujours
    // `undefined`, et le défaut retombait donc en silence sur le repli.
    return data.modelKey || ModelTypes.QwenCoderNext;
  } catch (error) {
    console.error('Error fetching default model:', error);
    return ModelTypes.QwenCoderNext;
  }
}

/**
 * Les fichiers de l'espace de travail, rendus en actions pour le contexte.
 *
 * Les fichiers du socle en sont retirés : le serveur sait déjà ce qu'ils
 * contiennent (il les a écrits), et les lui renvoyer à chaque message ajouterait
 * des milliers de jetons d'entrée pour une information qu'il possède.
 */
function convertToBoltAction(obj: Record<string, string>): string {
  return Object.entries(withoutScaffold(obj))
    .filter(([filePath]) => !excludeFiles.includes(filePath))
    .map(
      ([filePath, content]) =>
        `<boltAction type="file" filePath="${filePath}">\n${content}\n</boltAction>`
    )
    .join('\n\n');
}

export const BaseChat = ({ uuid: propUuid }: { uuid?: string }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { otherConfig, creativity: chatCreativity } = useChatStore();
  const { t, i18n } = useTranslation();
  const [checkCount, setCheckCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const [baseModal, setBaseModal] = useState<IModelOption>({
    value: ModelTypes.QwenCoderNext,
    label: 'Qwen3 Coder Next',
    useImage: false,
    from: 'default',
    quota: 2,
    functionCall: true,
  });
  const [availableModels, setAvailableModels] = useState<IModelOption[]>([]);
  const {
    files,
    isFirstSend,
    isUpdateSend,
    setIsFirstSend,
    setIsUpdateSend,
    setFiles,
    setEmptyFiles,
    errors,
    updateContent,
    clearErrors,
    setOldFiles,
  } = useFileStore();
  const { mode } = useChatModeStore();
  const { touchSession, updateSessionTitle, setActiveChatUuid } = useChatHistoryStore();
  // use global state
  const { uploadedImages, addImages, removeImage, clearImages, setModelOptions } = useChatStore();
  const { resetTerminals } = useTerminalStore();
  const filesInitObj = {} as Record<string, string>;
  const filesUpdateObj = {} as Record<string, string>;
  Object.keys(isFirstSend).forEach((key) => {
    isFirstSend[key] && (filesInitObj[key] = files[key]);
  });
  Object.keys(isUpdateSend).forEach((key) => {
    isUpdateSend[key] && (filesUpdateObj[key] = files[key]);
  });

  const initConvertToBoltAction = convertToBoltAction({
    ...filesInitObj,
    ...filesUpdateObj,
  });

  const updateConvertToBoltAction = convertToBoltAction(filesUpdateObj);

  // Charger la configuration des modèles depuis l'API
  useEffect(() => {
    const loadModelConfiguration = async () => {
      try {
        // Récupérer la liste des modèles disponibles
        const models = await fetchModelConfig();
        setAvailableModels(models);
        setModelOptions(models);

        // Récupérer le modèle par défaut
        const defaultModelKey = await fetchDefaultModel();

        // Trouver le modèle par défaut dans la liste
        const defaultModel = models.find((model) => model.value === defaultModelKey);
        if (defaultModel) {
          setBaseModal(defaultModel);
          console.log(`Default model set to: ${defaultModel.label} (${defaultModel.value})`);
        } else {
          console.warn(
            `Default model ${defaultModelKey} not found in available models, using first available`
          );
          if (models.length > 0) {
            setBaseModal(models[0]);
          }
        }
      } catch (error) {
        console.error('Failed to load model configuration:', error);
        // Fallback vers l'ancienne méthode Ollama si la nouvelle échoue
        fetch(`${API_BASE}/api/model`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
          .then((res) => res.json())
          .then((data) => {
            setModelOptions(data);
          })
          .catch((ollamaError) => {
            console.error('Failed to fetch Ollama model list:', ollamaError);
          });
      }
    };

    loadModelConfiguration();
  }, []);

  useEffect(() => {
    if (
      (messages.length === 0 && initConvertToBoltAction && mode === ChatMode.Builder) ||
      (messages.length === 1 &&
        messages[0].id === '1' &&
        initConvertToBoltAction &&
        mode === ChatMode.Builder)
    ) {
      setMessagesa([
        {
          id: '1',
          role: 'user',
          content: `<boltArtifact id="hello-js" title="the current file">\n${initConvertToBoltAction}\n</boltArtifact>\n\n`,
        },
      ]);
      setMessages([
        {
          id: '1',
          role: 'user',
          content: `<boltArtifact id="hello-js" title="the current file">\n${initConvertToBoltAction}\n</boltArtifact>\n\n`,
        },
      ]);
      scrollToBottom();
    }
  }, [initConvertToBoltAction]);

  useEffect(() => {
    if (messages.length > 1 && updateConvertToBoltAction && mode === ChatMode.Builder) {
      setMessages((list) => {
        const newList = [...list];
        if (newList[newList.length - 1].id !== '2') {
          newList.push({
            id: '2',
            role: 'user',
            content: `<boltArtifact id="hello-js" title="Currently modified files">\n${updateConvertToBoltAction}\n</boltArtifact>\n\n`,
          });
        } else if (newList[newList.length - 1].id === '2') {
          newList[newList.length - 1].content =
            `<boltArtifact id="hello-js" title="Currently modified files">\n${updateConvertToBoltAction}\n</boltArtifact>\n\n`;
        }
        scrollToBottom();
        return newList;
      });
    }
  }, [updateConvertToBoltAction]);

  // modify UUID initialization logic and message loading
  const [chatUuid, setChatUuid] = useState(() => propUuid || uuidv4());

  const refUuidMessages = useRef([]);

  // Conversation restored from the server, waiting for `chatUuid` to switch to
  // its sessionId before being injected (useChat keys its store by id).
  const pendingSessionRef = useRef<{
    sessionId: string;
    messages: Array<{ id: string; role: string; content: string }>;
  } | null>(null);
  const hasRestoredSessionRef = useRef(false);

  useEffect(() => {
    if (checkCount >= 1) {
      const isComplete = checkFinish(messages[messages.length - 1].content, append, t);
      checkExecList(messages);
      setCheckCount(0);

      // Only worth linting a finished artifact: a truncated one trips rules that
      // the continuation would have fixed on its own.
      if (isComplete) {
        // Un site vitrine généré par le serveur est montré tel qu'il a été
        // produit : ni revue de design, ni relance, ni réécriture. Une erreur
        // technique s'affiche dans l'aperçu, et c'est l'utilisateur qui demande
        // la correction.
        if (!isGeneratedSite(useFileStore.getState().files)) {
          runQualityPass(chatUuid, messages, append, t, projectData);
        }
      }
    }
  }, [checkCount]);

  // add function to load chat history
  const loadChatHistory = async (uuid: string) => {
    try {
      const records = await db.getByUuid(uuid);
      if (records.length > 0) {
        const latestRecord = records[0];
        if (latestRecord?.data?.messages) {
          const historyFiles = {};
          const oldHistoryFiles = {};
          // setEmptyFiles();
          // Version web - pas de manipulation du chemin via ipcRenderer
          console.log(latestRecord, 'latestRecord');
          latestRecord.data.messages.forEach((message) => {
            const { files: messageFiles } = parseMessage(message.content);
            Object.assign(historyFiles, messageFiles);
          });
          const assistantRecord = latestRecord.data.messages.filter((e) => e.role === 'assistant');
          if (assistantRecord.length > 1) {
            const oldRecords = assistantRecord[1];
            console.log(oldRecords, 'oldRecords');
            const { files: messageFiles } = parseMessage(oldRecords.content);
            Object.assign(oldHistoryFiles, messageFiles);
          }
          if (mode === ChatMode.Builder) {
            latestRecord.data.messages.push({
              id: uuidv4(),
              role: 'user',
              content: `<boltArtifact id="hello-js" title="the current file">\n${convertToBoltAction(historyFiles)}\n</boltArtifact>\n\n`,
            });
          }
          setMessages(latestRecord.data.messages);
          setFiles(historyFiles);
          setOldFiles(oldHistoryFiles);
          // Reset other states
          clearImages();
          setIsFirstSend();
          setIsUpdateSend();
          resetTerminals();
        }
      } else {
        // If it's a new conversation, clear all states
        setMessages([]);
        clearImages();
        setIsFirstSend();
        setIsUpdateSend();
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      toast.error(t('chat.errors.load_history_failed'));
    }
  };

  // listen to chat selection event
  useEffect(() => {
    const unsubscribe = eventEmitter.on('chat:select', (uuid: string) => {
      if (uuid !== chatUuid) {
        refUuidMessages.current = [];
        setChatUuid(uuid || uuidv4());
        if (uuid) {
          // load chat history
          loadChatHistory(uuid);
        } else {
          // new conversation, clear all states
          setMessages([]);
          setFiles({});
          clearImages();
          setIsFirstSend();
          setIsUpdateSend();
          // Version web - opérations de réinitialisation
          setEmptyFiles();
          setFiles({});
          clearImages();
          setIsFirstSend();
          setIsUpdateSend();
          resetTerminals();
          // L'espace de travail repart vide : le socle n'y est plus. Oublier le
          // verrou, sinon la conversation suivante interdirait au modèle
          // d'écrire une configuration que plus rien ne fournit — et l'aperçu
          // resterait vide. L'effet de montage le reposera.
          clearScaffold();
          setScaffoldReady(null);
        }
      }
    });

    // clean up subscription
    return () => unsubscribe();
  }, [chatUuid, files]);
  const token = useUserStore.getState().token;
  const { openModal } = useLimitModalStore();

  const [messages, setMessagesa] = useState<WeMessages>([]);
  const { enabledMCPs } = useMCPTools();
  const baseChatUrl = `${API_BASE}`;

  // Get projectId from URL - must be declared before useChat hook
  const projectId = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('projectId');
  }, []);

  // Project data state - must be declared before useChat hook
  const [projectData, setProjectData] = useState<ProjectModel | null>(null);
  const [isProjectLoaded, setIsProjectLoaded] = useState(false);
  // Version du socle monté dans cet espace de travail, `null` sans socle.
  // En état React (et pas seulement en module) parce que le corps de la
  // requête est reconstruit au rendu : sans cela le premier message partirait
  // sans le drapeau.
  const [scaffoldReady, setScaffoldReady] = useState<string | null>(null);
  // Incrémenté à chaque retour à zéro : relance le montage du socle même quand
  // `scaffoldReady` valait déjà `null` (projet d'avant le socle), cas où aucune
  // autre dépendance de l'effet ne change.
  const [scaffoldEpoch, setScaffoldEpoch] = useState(0);
  // Suppression de la génération : confirmation en deux temps, puis en cours.
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  // Vrai après une suppression : le bouton de lancement dit « Régénérer ».
  const [wasReset, setWasReset] = useState(false);
  const [showStartButton, setShowStartButton] = useState(false);
  const [hasGeneration, setHasGeneration] = useState(false);
  const [isGenerationComplete, setIsGenerationComplete] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [projectLoadError, setProjectLoadError] = useState<string | null>(null);
  // Échec de récupération du code déjà enregistré pour ce projet. Distinct de
  // `projectLoadError` : le projet existe, seul son code n'a pas pu être lu.
  const [codeLoadFailed, setCodeLoadFailed] = useState(false);
  const [retryingCodeLoad, setRetryingCodeLoad] = useState(false);

  const [mcpTools, setMcpTools] = useState<MCPTool[]>([]);
  useEffect(() => {
    if (enabledMCPs && enabledMCPs.length > 0) {
      window.myAPI.mcp.listTools().then((allMCPTools) => {
        const filteredTools = allMCPTools.filter((tool) => {
          return enabledMCPs.some((mcp) => mcp.name === tool.serverName);
        });
        setMcpTools(filteredTools);
      });
    } else {
      setMcpTools([]);
    }
  }, [enabledMCPs]);

  // Log projectData information before sending
  useEffect(() => {
    if (projectData) {
      console.log('🚀 CLIENT: ProjectData available for chat');
      console.log('📊 CLIENT: Project name:', projectData.name);
      console.log('📊 CLIENT: Project description:', projectData.description);
      console.log('📊 CLIENT: Has analysisResultModel:', !!projectData.analysisResultModel);
      console.log(
        '📊 CLIENT: Landing page config:',
        projectData.analysisResultModel?.development?.configs?.landingPageConfig
      );
      console.log('📊 CLIENT: Mode:', mode);
      console.log('📊 CLIENT: API URL:', `${baseChatUrl}/api/chat`);
    } else {
      console.log('⚠️ CLIENT: No projectData available for chat');
    }
  }, [projectData, mode, baseChatUrl]);

  // modify useChat configuration
  const {
    messages: realMessages,
    input,
    handleInputChange,
    isLoading,
    setMessages,
    append: appendRaw,
    setInput,
    stop,
    reload,
  } = useChat({
    api: `${baseChatUrl}/api/chat`,
    // Le cookie de session IDEM identifie l'utilisateur auprès du serveur AppGen.
    credentials: 'include',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: {
      // Repli d'un ancien serveur : le modèle par défaut. Le serveur suit le niveau de créativité.
      model: baseModal.value,
      creativity: chatCreativity,
      mode: mode,
      // Projet IDEM rattaché : le serveur en a besoin pour rattacher la
      // consommation de crédits au bon projet et vérifier qu'il est débloqué.
      projectId: new URLSearchParams(window.location.search).get('projectId') ?? undefined,
      // Site vitrine ou application, web ou mobile : le serveur en tire le
      // contrat de build (fichiers, mise en page, Capacitor pour le mobile).
      product: currentProduct() ?? undefined,
      platform: currentPlatform() ?? undefined,
      // Socle déjà monté : le serveur cesse alors de faire écrire la
      // configuration et se contente d'en rappeler les noms de jetons.
      ...(scaffoldReady ? { scaffold: { version: scaffoldReady } } : {}),
      // User UI language so the AI answers/generates content in the right language.
      // (Distinct from otherConfig.backendLanguage, which is the target programming language.)
      language: i18n.language,
      otherConfig: {
        ...otherConfig,
        extra: {
          ...otherConfig.extra,
          isBackEnd: otherConfig.isBackEnd,
          backendLanguage: otherConfig.backendLanguage,
        },
      },
      // if the model supports function call and there are enabled MCP tools, add tools configuration
      ...(baseModal.functionCall &&
        mcpTools.length > 0 && {
          tools: mcpTools.map((tool) => ({
            id: tool.id,
            name: `${tool.serverName}.${tool.name}`,
            description: tool.description || '',
            parameters: tool.inputSchema,
          })),
        }),
      // Send projectData to server if available (client has auth, server doesn't)
      ...(projectData && { projectData }),
      // Instantané de l'espace de travail : uniquement en mode Plan, où le
      // modèle dispose d'outils de lecture. En mode Build, les fichiers
      // voyagent déjà dans l'historique des artefacts — les envoyer deux fois
      // doublerait le coût de chaque génération pour rien.
      ...(mode === ChatMode.Chat && {
        workspace: {
          files: useFileStore.getState().files,
          logs: useFileStore
            .getState()
            .errors.map((error: { message?: string }) => error?.message ?? String(error))
            .filter(Boolean),
        },
      }),
    },
    id: chatUuid,
    onResponse: async (response) => {
      console.log('📡 CLIENT: Received response from API');
      console.log('📡 CLIENT: Response status:', response.status);
      console.log('📡 CLIENT: Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error('❌ CLIENT: API response error:', response.status, response.statusText);
      }
      if (baseModal.from === 'ollama') {
        const reader = response.body?.getReader();
        if (!reader) return;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = new TextDecoder().decode(value);
          const lines = text.split('\n').filter((line) => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.message?.content) {
                setMessages((messages) => {
                  const lastMessage = messages[messages.length - 1];
                  if (lastMessage && lastMessage.role === 'assistant') {
                    return [
                      ...messages.slice(0, -1),
                      {
                        ...lastMessage,
                        content: lastMessage.content + data.message.content,
                      },
                    ];
                  }
                  return [
                    ...messages,
                    {
                      id: uuidv4(),
                      role: 'assistant',
                      content: data.message.content,
                    },
                  ];
                });
              }
            } catch (e) {
              console.warn('Failed to parse Ollama response line:', e);
            }
          }
        }
      }
    },
    onFinish: async (message) => {
      if (message.parts) {
        console.log(message.parts);
      }
      clearImages();
      scrollToBottom();
      try {
        const needParseMessages = [...messages, message].filter(
          (m) => !refUuidMessages.current.includes(m.id)
        );

        refUuidMessages.current = [
          ...refUuidMessages.current,
          ...needParseMessages.map((m) => m.id),
        ];

        if (message) {
          const { files: messagefiles } = parseMessage(message.content);

          // Du code répondu en prose — un bloc annoncé par son chemin — plutôt
          // qu'en actions de fichier. Le tour serait entièrement perdu.
          for (const [path, content] of Object.entries(extractFilesFromText(message.content))) {
            if (messagefiles[path] === undefined) {
              console.warn(`[rattrapage] ${path} répondu en texte, enregistré comme fichier`);
              messagefiles[path] = content;
            }
          }

          for (let key in messagefiles) {
            // Le socle est posé par le code : une réécriture est au mieux
            // identique, au pire une palette amputée ou un script d'amorçage
            // manquant. On la laisse tomber ici comme pendant le flux.
            if (isScaffoldLocked(key)) {
              console.warn(`[scaffold] réécriture ignorée : ${key}`);
              continue;
            }
            if (looksDegenerate(messagefiles[key])) {
              console.warn(`[boucle] ${key} ignoré : contenu répétitif ou démesuré`);
              continue;
            }
            await updateContent(key, messagefiles[key], false, true);
          }
        }

        setIsFirstSend();
        setIsUpdateSend();

        let initMessage = [];
        initMessage = [
          {
            id: uuidv4(),
            role: 'user',
            content: input,
          },
        ];
        const autoTitle =
          [...initMessage, ...messages]
            .find((m) => m.role === 'user' && !m.content.includes('<boltArtifact'))
            ?.content?.slice(0, 60) || 'Nouvelle conversation';
        await db.insert(chatUuid, {
          messages: [...messages, ...initMessage, message],
          title: autoTitle,
        });
        // Sync with chat history store (localStorage-persisted list)
        touchSession(chatUuid);
        updateSessionTitle(chatUuid, autoTitle);
        setActiveChatUuid(chatUuid);
      } catch (error) {
        console.error('Failed to save chat history:', error);
      }
      setCheckCount((checkCount) => checkCount + 1);

      // Persist the generation: code goes to the bucket (incrementally, only
      // Point de restauration : l'état des fichiers juste après ce tour, étiqueté
      // par la demande qui l'a produit. Sans cela, revenir en arrière veut dire
      // redemander l'inverse au modèle et espérer retomber dessus.
      try {
        const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
        await useVersionHistory
          .getState()
          .capture(
            lastUserMessage?.content?.slice(0, 120) || t('versions.beforeRestore'),
            useFileStore.getState().files
          );
      } catch (error) {
        // L'historique est un confort : son échec ne doit rien interrompre.
        console.warn('[versions] instantané non enregistré', error);
      }

      // Le nom de l'application, retenu une fois, à la première génération : lu dans ses fichiers
      // (titre de la page, manifeste). Sans projet IDEM, c'est lui qui sera proposé pour la mise en
      // ligne et pour le nom de domaine ; avec un projet, le nom du projet reste prioritaire.
      try {
        const appGen = useAppGenContextStore.getState();
        if (!appGen.draft?.appName) {
          const appName = deriveAppName(useFileStore.getState().files);
          if (appName) appGen.setDraftAppName(appName);
        }
      } catch (error) {
        console.warn('[appName] nom non retenu', error);
      }

      // the files that changed), the conversation goes to the database.
      if (projectId && projectData) {
        const finalMessages = [...messages, message];

        try {
          // The workspace is the source of truth here: onFinish has already
          // applied every file from the message through updateContent.
          const workspaceFiles = useFileStore.getState().files;

          if (Object.keys(workspaceFiles).length > 0) {
            const syncResult = await pushProjectCode(projectId, workspaceFiles);
            if (syncResult) {
              console.log(
                `Code synced: ${syncResult.written} written, ${syncResult.deleted} deleted, ${syncResult.total} total`
              );
            }

            // Create and save minimal metadata (without large files)
            const metadata = createProjectMetadata(projectData, finalMessages);
            await saveProjectGeneration(projectId, metadata);
          } else {
            console.warn('No files generated to save');
          }
        } catch (error) {
          console.error('Error saving generated code:', error);
        }

        try {
          await saveProjectChatSession(projectId, {
            sessionId: chatUuid,
            title: deriveSessionTitle(finalMessages, projectData.name || 'Nouvelle conversation'),
            messages: compactMessagesForStorage(finalMessages),
          });
        } catch (error) {
          console.error('Error saving chat session:', error);
        }

        setIsGenerationComplete(true);
      }
    },
    onError: (error: any) => {
      // The server sends a readable message (model saturation, quota, ...) either
      // as the body of a non-2xx response or as a data-stream error part.
      const msg = error?.errors?.[0]?.responseBody || error?.message || String(error);
      console.log('error', error, msg);
      toast.error(msg);
      if (String(error).includes('Quota not enough')) {
        openModal('limit');
      }
      if (String(error).includes('Authentication required')) {
        openModal('login');
      }
      // add Ollama error handling
      if (baseModal.from === 'ollama') {
        toast.error(t('chat.errors.ollama_connection_failed'));
      }
    },
  });

  // Lu par l'effet de montage du socle sans le faire dépendre de `isLoading` :
  // une dépendance l'annulerait au moment même où la génération démarre.
  const isLoadingRef = useRef(false);
  isLoadingRef.current = isLoading;

  // Partagé avec l'aperçu, qui doit cesser de proposer « Générer maintenant »
  // dès que la génération a commencé.
  const setIsGenerating = useChatStore((state) => state.setIsGenerating);
  useEffect(() => {
    setIsGenerating(isLoading);
  }, [isLoading, setIsGenerating]);

  // Et la même chose pour « ce projet attend sa première génération » : c'est
  // ce qui décide du bouton au centre de l'aperçu. Une seule vérité pour les
  // deux endroits, sinon ils finissent par se contredire.
  const setCanGenerate = useChatStore((state) => state.setCanGenerate);
  useEffect(() => {
    setCanGenerate(showStartButton);
  }, [showStartButton, setCanGenerate]);

  /**
   * Le seul `append` de l'atelier : saisie, lancement automatique, « Corriger »,
   * reprise… tous passent ici.
   *
   * En mode Build il attend d'abord que le socle soit réglé (voir
   * `waitForScaffold`), puis annonce sa version DANS l'appel. Passer par le
   * corps de `useChat` ne suffit pas : il est relu au rendu, et le premier envoi
   * suit le montage de quelques microsecondes — il partirait sans le drapeau, le
   * serveur ferait écrire la configuration au modèle, et le verrou la jetterait
   * avec ses dépendances.
   */
  const append = useCallback(
    async (...args: Parameters<typeof appendRaw>) => {
      const [message, options] = args;

      if (mode === ChatMode.Builder) {
        await waitForScaffold();
      }

      const version = mountedScaffoldVersion();

      // Le niveau de créativité lu À L'ENVOI (celui qui vient d'être choisi sur le bouton) : le serveur en
      // tire le modèle. Aucun modèle n'est choisi ici.
      const creativity = useChatStore.getState().creativity;
      return appendRaw(
        message,
        { ...options, body: { ...options?.body, creativity, ...(version ? { scaffold: { version } } : {}) } }
      );
    },
    [appendRaw, mode]
  );

  // Inject the conversation restored from the server. Runs once `chatUuid` has
  // switched to the stored sessionId, otherwise useChat would write the
  // messages into the store of the throwaway uuid created at mount.
  useEffect(() => {
    const pending = pendingSessionRef.current;
    if (!pending || pending.sessionId !== chatUuid) return;

    pendingSessionRef.current = null;

    const restored = pending.messages.map((message) => ({
      id: message.id || uuidv4(),
      role: message.role as Message['role'],
      content: message.content,
    })) as Message[];

    // Mark them as already parsed: their artifacts were summarized before
    // storage, so re-parsing would find nothing and only waste work.
    refUuidMessages.current = restored.map((message) => message.id) as never[];

    setMessages(restored);
    setMessagesa(restored as WeMessages);
    setActiveChatUuid(chatUuid);
    scrollToBottom();
  }, [chatUuid]);

  // Listen for auto-prompt from AppGen landing page (placed here, after useChat, so isLoading/append are defined)
  useEffect(() => {
    const unsubscribe = eventEmitter.on('chat:autoPrompt', (prompt: string) => {
      if (prompt && !isLoading) {
        append({
          id: uuidv4(),
          role: 'user',
          content: prompt,
        });
      }
    });
    return () => unsubscribe();
  }, [isLoading, append]);

  // « Corriger automatiquement » depuis l'aperçu : l'erreur et son journal
  // partent comme un message, que l'utilisateur voit dans la conversation.
  useEffect(() => {
    return eventEmitter.on('chat:fixError', (prompt: string) => {
      if (!prompt) return;
      if (isLoading) {
        toast.info(t('preview.fix.busy'));
        return;
      }
      useRunStatus.getState().clearError();
      append({ id: uuidv4(), role: 'user', content: prompt });
    });
  }, [isLoading, append, t]);

  // « Corriger automatiquement » sous un site généré : les fichiers signalés
  // repartent au moteur de sites avec leur contenu actuel, les pages (pour les
  // y remettre à leur place), le thème (pour les couleurs) et `src/site/`.
  useEffect(() => {
    return eventEmitter.on('chat:siteRepair', (paths: string[]) => {
      if (!Array.isArray(paths) || !paths.length) return;
      if (isLoading) {
        toast.info(t('preview.fix.busy'));
        return;
      }
      const workspace = useFileStore.getState().files;
      const files: Record<string, string> = {};
      for (const [path, content] of Object.entries(workspace)) {
        if (typeof content !== 'string') continue;
        const wanted =
          paths.includes(path) ||
          /^src\/pages\/[^/]+\.tsx$/.test(path) ||
          path.startsWith('src/design-system/') ||
          // Les données, les visuels et la marque : le serveur y monte chaque composant corrigé.
          (path.startsWith('src/site/') && /\.(ts|tsx|json)$/.test(path)) ||
          path === 'idem.pages.json';
        if (wanted) files[path] = content;
      }
      append(
        { role: 'user', content: internalMessage(t('chat.siteRepair.status')) },
        { body: { siteRepair: { paths, files } } }
      );
    });
  }, [isLoading, append, t]);

  // Contexte poussé depuis l'espace de travail : sélection d'un élément,
  // annotation dessinée, thème à appliquer. On préremplit la saisie au lieu
  // d'envoyer directement — l'utilisateur a désigné *quoi*, il lui reste à dire
  // *quoi en faire*.
  useEffect(() => {
    const unsubscribe = eventEmitter.on('chat:prefill', (text: string) => {
      if (!text) return;
      setInput((current: string) => (current ? `${current}\n${text}` : text));
      eventEmitter.emit('chat:focusInput');
    });
    return () => unsubscribe();
  }, [setInput]);

  // Get status and type from URL data (projectId already obtained above)
  const { status, type } = useUrlData({ append });
  const { setLoading } = useLoading();

  // Load project data when projectId is present in URL
  // Does not automatically start generation
  useEffect(() => {
    const loadProjectData = async () => {
      if (!projectId || isProjectLoaded) {
        return;
      }

      setLoading(true);
      setProjectLoadError(null);

      try {
        console.log('Loading project data with ID:', projectId);

        const project = await getProjectById(projectId);
        if (project) {
          setProjectData(project);

          // Reopen the conversation that produced this app. It lives in the
          // database, so coming back from another machine lands in the same
          // chat instead of starting over.
          const chatSession = await getProjectChatSession(projectId);
          const hasStoredSession = !!chatSession?.messages?.length;

          if (hasStoredSession) {
            hasRestoredSessionRef.current = true;
            pendingSessionRef.current = {
              sessionId: chatSession!.sessionId,
              messages: chatSession!.messages,
            };
            setChatUuid(chatSession!.sessionId);
            console.log(
              `Restored chat session ${chatSession!.sessionId} (${chatSession!.messages.length} messages)`
            );
          }

          // Check if generation already exists
          // L'ancien marqueur de génération date d'avant les deux produits : il
          // désigne le site. L'application se fie à sa propre conversation.
          const existingGeneration =
            currentProduct() === 'app' ? null : await getProjectGeneration(projectId);
          if (existingGeneration || hasStoredSession) {
            setHasGeneration(true);
            setIsGenerationComplete(true);
            console.log('Existing generation found for project:', project.name);
          } else {
            setShowStartButton(true);
            console.log('No generation found, showing start button for:', project.name);
          }

          // Récupération du code déjà enregistré pour ce projet.
          try {
            console.log('[code] recherche du code enregistré pour', projectId);
            const existingCode = await getProjectCode(projectId);

            if (existingCode && Object.keys(existingCode).length > 0) {
              console.log('[code] chargé :', Object.keys(existingCode).length, 'fichiers');

              // Charger le code dans l'espace de travail
              setFiles(existingCode);

              // Marquer les fichiers comme étant déjà envoyés (réinitialiser d'abord)
              setIsFirstSend();

              // Créer un message initial avec le code existant si on est en mode Builder.
              // Inutile quand une conversation a été restaurée : elle porte déjà
              // son historique et le contexte fichiers est réinjecté séparément.
              // Rien à envoyer si ce code n'est que le socle : le serveur l'a
              // écrit lui-même, et le lui renvoyer coûterait des milliers de
              // jetons pour ce qu'il sait déjà.
              const boltAction = isStarterOnly(existingCode)
                ? ''
                : convertToBoltAction(existingCode);

              if (
                mode === ChatMode.Builder &&
                messages.length === 0 &&
                !hasRestoredSessionRef.current &&
                boltAction.trim()
              ) {
                setMessages([
                  {
                    id: '1',
                    role: 'user',
                    content: `<boltArtifact id="existing-code" title="Existing project code">\n${boltAction}\n</boltArtifact>\n\n`,
                  },
                ]);
                setMessagesa([
                  {
                    id: '1',
                    role: 'user',
                    content: `<boltArtifact id="existing-code" title="Existing project code">\n${boltAction}\n</boltArtifact>\n\n`,
                  },
                ]);
              }

            } else {
              console.log('[code] aucun code enregistré pour', projectId);
            }
          } catch (error) {
            console.error('Error loading existing code from object storage:', error);
            // L'espace de travail s'ouvrirait vide sans que rien ne l'explique :
            // c'est le seul cas où le stockage mérite d'être mentionné.
            setCodeLoadFailed(true);
          }
        } else {
          console.warn('Project not found with ID:', projectId);
          setProjectLoadError('Project not found. Please check the project ID and try again.');
        }
      } catch (error) {
        console.error('Error loading project data:', error);
        setProjectLoadError(
          'Failed to load project data. Please check your connection and try again.'
        );
      } finally {
        setLoading(false);
        setIsProjectLoaded(true);

        // Check if tutorial should be shown (only if project loaded successfully)
        if (projectId && projectData && !localStorage.getItem(`tutorial_completed_${projectId}`)) {
          setShowTutorial(true);
        }
      }
    };

    loadProjectData();
  }, [projectId, setLoading]);

  /**
   * Montage du socle préconfiguré.
   *
   * Avant, chaque génération commençait par faire réécrire au modèle la même
   * vingtaine de fichiers de configuration — manifeste npm, Vite, PostCSS,
   * Tailwind avec la charte du projet, `index.html`, point d'entrée, service
   * worker, cadre d'écran mobile. Des jetons de sortie, les plus chers,
   * dépensés pour un contenu connu d'avance, et une occasion ratée sur trois
   * d'écrire la palette au complet ou de ne pas oublier le script d'amorçage.
   *
   * Désormais le serveur pose ce socle (c'est du calcul pur : aucun crédit),
   * l'atelier le monte, et le modèle n'écrit plus que le produit.
   *
   * Trois situations :
   * - espace de travail vide → on monte le socle ;
   * - projet rouvert dont le code porte la signature du socle → on rétablit
   *   seulement le verrou, pour que les tours suivants ne réécrivent pas la
   *   configuration ;
   * - projet d'avant le socle → rien, l'ancien contrat de build repart.
   *
   * La reconnaissance se fait sur le code (signature en tête de
   * `tailwind.config.js`) et non sur un marqueur local : le même projet rouvert
   * depuis une autre machine garde donc son verrou.
   */
  useEffect(() => {
    if (mode !== ChatMode.Builder) return;
    if (scaffoldReady) {
      settleScaffold();
      return;
    }
    // Un projet dans l'adresse : attendre son chargement, sinon on monterait le
    // socle par-dessus le code déjà enregistré (ou l'inverse, selon la course).
    if (projectId && !isProjectLoaded) return;

    let cancelled = false;

    (async () => {
      try {
        const scaffold = await fetchScaffold(projectData, {
          product: currentProduct(),
          platform: currentPlatform(),
          language: i18n.language,
        });
        if (cancelled) return;

        const workspace = useFileStore.getState().files;

        // Une génération déjà en cours écrit dans l'espace de travail : monter le
        // socle par-dessus remplacerait la carte des fichiers au complet. La
        // porte l'interdit en temps normal ; ceci ne vaut que pour le délai
        // de secours.
        if (isLoadingRef.current) return;

        if (Object.keys(workspace).length === 0) {
          registerScaffold(scaffold.locked, scaffold.version);
          // `setFiles` ne marque pas `isFirstSend` : le socle reste donc hors
          // du contexte envoyé au modèle, ce qui est tout l'intérêt.
          await setFiles(scaffold.files);
          setScaffoldReady(scaffold.version);
          // Le manifeste du socle est figé : l'installation peut commencer
          // tout de suite, en parallèle de la génération.
          // Démarrage à chaud : dépendances en place (cache du navigateur,
          // instantané du serveur, ou `npm install` en dernier recours) puis
          // `npm run dev`, pendant que le modèle écrit. L'aperçu apparaît donc
          // avant la fin de la génération, et chaque fichier écrit y arrive par
          // HMR. Voir utils/warmStart.ts.
          void warmStart(scaffold.target, scaffold.commands);
          return;
        }

        // Projet rouvert. Le verrou s'applique toujours : ces chemins sont
        // écrits par le code, et une réécriture par le modèle ne peut que les
        // abîmer — on l'a vu avec une feuille de style transformée en boucle.
        registerScaffold(scaffold.locked, scaffold.version);
        setScaffoldReady(scaffold.version);

        // Et il démarre à chaud lui aussi. Un projet rouvert partait d'un
        // conteneur vide — donc d'une réinstallation complète — et n'affichait
        // son aperçu qu'après le tour suivant, ou après un clic sur
        // « Exécuter ». Les dépendances sont les mêmes qu'à la génération :
        // l'instantané du cache les repose en quelques secondes.
        void warmStart(scaffold.target, scaffold.commands);

        // La remise à jour, elle, demande une preuve que ce code vient bien du
        // socle : écraser le `package.json` d'un projet d'avant le socle le
        // casserait.
        //
        // Sans cela, un projet gardait indéfiniment le socle enregistré lors de
        // sa première ouverture : ancienne charte, anciennes polices, ancienne
        // configuration Vite, et kit de sections absent s'il n'existait pas
        // encore. La page affichait le bon texte dans la mauvaise identité.
        // Site vitrine : un site déjà généré garde le template de sa génération
        // (nouvelle version = migration demandée, jamais d'écrasement). Seul un
        // espace encore vierge, monté sur un ancien socle, est remplacé.
        if (scaffold.target === 'site') {
          if (isStarterOnly(workspace) && !isEngineSite(workspace)) {
            console.log('[scaffold] espace vierge : socle du site remplacé par le template actuel');
            await setFiles(scaffold.files);
          }
        } else if (hasScaffoldSignature(workspace)) {
          const refresh: Record<string, string> = {};

          for (const path of scaffold.locked) {
            if (workspace[path] !== scaffold.files[path]) refresh[path] = scaffold.files[path];
          }

          // Les fichiers non verrouillés — kit de sections, trousse de
          // composants — appartiennent au projet dès qu'il existe : on ne les
          // écrase pas, on complète seulement ce qui manque.
          for (const [path, content] of Object.entries(scaffold.files)) {
            if (workspace[path] === undefined) refresh[path] = content;
          }

          if (Object.keys(refresh).length) {
            console.log(`[scaffold] ${Object.keys(refresh).length} fichier(s) du socle remis à jour`);
            await setFiles({ ...workspace, ...refresh });
          }
        }
      } catch (error) {
        // Le socle est une optimisation, jamais un préalable : sans lui, le
        // contrat de build complet repart au modèle comme avant.
        console.warn('[scaffold] socle non monté, contrat complet conservé', error);
      } finally {
        // Réglé, quelle qu'en soit l'issue : les envois en attente peuvent partir.
        // Un montage annulé (le projet vient de changer) sera repris par le
        // passage suivant, qui rouvrira la porte lui-même.
        if (!cancelled) settleScaffold();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    mode,
    projectId,
    isProjectLoaded,
    projectData,
    scaffoldReady,
    scaffoldEpoch,
    setFiles,
    i18n.language,
  ]);

  // Function to manually start generation
  const handleStartGeneration = async () => {
    if (!projectData) return;

    try {
      console.log('🚀 CLIENT: Starting project generation');
      console.log('📊 CLIENT: Project data available:', !!projectData);
      console.log('📊 CLIENT: Mode:', mode);
      console.log('📊 CLIENT: Base modal:', baseModal.value);

      if (projectData) {
        console.log('📋 CLIENT: Project details for generation:');
        console.log('  - Name:', projectData.name);
        console.log('  - Description:', projectData.description);
        console.log('  - Type:', projectData.type);
        console.log('  - Has analysis:', !!projectData.analysisResultModel);
        console.log(
          '  - Landing config:',
          projectData.analysisResultModel?.development?.configs?.landingPageConfig
        );
      }

      // Generate the full prompt from projectData and send it as the first message
      // This message is hidden from the UI but sent to the backend
      const promptService = new MultiChatPromptService();
      const completePrompt = promptService.generatePrompt(projectData);
      append({
        id: uuidv4(),
        role: 'user',
        content: completePrompt,
      });

      setShowStartButton(false);
      setHasGeneration(true);
      console.log('Generation started for project:', projectData.name);
    } catch (error) {
      console.error('Error starting generation:', error);
      toast.error(t('chat.errors.start_generation_failed'));
    }
  };

  // Sauvegarde manuelle du code dans le bucket (delta uniquement)
  const saveCodeToStorage = async (generatedFiles: Record<string, string>) => {
    if (!projectId || !generatedFiles || Object.keys(generatedFiles).length === 0) return;

    try {
      console.log('Saving code to object storage for project:', projectId);

      await pushProjectCode(projectId, generatedFiles);

    } catch (error) {
      console.error('Error saving code to object storage:', error);
      toast.error(t('chat.errors.storage_save_failed'));
    }
  };

  // listen to url when official website jumps in
  useEffect(() => {
    if (status && type === 'sketch') {
      showGuide();
    }
  }, [status, type]);

  const parseTimeRef = useRef(0);

  useEffect(() => {
    const visibleFun = () => {
      if (isLoading) return;
      else if (!isLoading) {
        setTimeout(() => {
          updateFileSystemNow();
        }, 600);
      }
    };
    document.addEventListener('visibilitychange', visibleFun);
    return () => {
      document.removeEventListener('visibilitychange', visibleFun);
    };
  }, [isLoading, files]);

  // Keep the bucket in step with manual edits made in the IDE. Debounced, and
  // idle while streaming — the generation path syncs on its own in onFinish.
  useEffect(() => {
    if (!projectId || isLoading || !isProjectLoaded) return;
    if (Object.keys(files).length === 0) return;

    const timer = setTimeout(() => {
      pushProjectCode(projectId, files).catch((error) =>
        console.error('Incremental code sync failed:', error)
      );
    }, 5000);

    return () => clearTimeout(timer);
  }, [files, isLoading, projectId, isProjectLoaded]);

  useEffect(() => {
    if (Date.now() - parseTimeRef.current > 200 && isLoading) {
      setMessagesa(realMessages as WeMessages);
      parseTimeRef.current = Date.now();

      const needParseMessages = messages.filter((m) => !refUuidMessages.current.includes(m.id));
      parseMessages(needParseMessages);
      scrollToBottom();
    }
    if (errors.length > 0 && isLoading) {
      clearErrors();
    }
    if (!isLoading) {
      setMessagesa(realMessages as WeMessages);
      createMpIcon(files);
    }
  }, [realMessages, isLoading]);

  const [userScrolling, setUserScrolling] = useState(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout>();

  // handle user scrolling
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isScrolledToBottom =
      Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 10;

    if (!isScrolledToBottom) {
      // user is scrolling to view history messages
      setUserScrolling(true);

      // clear previous timer
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }

      // set new timer, allow auto scroll after 3 seconds
      userScrollTimeoutRef.current = setTimeout(() => {
        setUserScrolling(false);
      }, 3000);
    }
  };

  // modify scroll to bottom function
  const scrollToBottom = () => {
    if (userScrolling) return; // if user is scrolling, do not execute auto scroll

    const messageContainer = document.querySelector('.message-container');
    if (messageContainer) {
      messageContainer.scrollTop = messageContainer.scrollHeight;
    }
  };

  // clean up timer when component unmounts
  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, []);

  // add upload status tracking
  const [isUploading, setIsUploading] = useState(false);
  const firstUserMessageId =
    projectData && hasGeneration ? messages.find((m) => m.role === 'user')?.id : null;
  const filterMessages = messages.filter((e) => {
    if (e.role === 'system') return false;
    // Hide the first user message (generation trigger) from UI
    if (firstUserMessageId && e.id === firstUserMessageId) return false;
    // Les artefacts de contexte — l'état des fichiers envoyé au modèle, le code
    // déjà enregistré — sont des rouages. Les afficher montrait « Existing
    // project code » à l'ouverture d'un projet qui ne contient encore que le
    // socle : une information que l'utilisateur n'a pas demandée et qui lui
    // laisse croire qu'il a du code à lui.
    if (CONTEXT_ARTIFACTS.test(e.content ?? '')) return false;
    return true;
  });
  // modify upload handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || isUploading) return;
    setIsUploading(true);

    const selectedFiles = Array.from(e.target.files);
    const MAX_FILE_SIZE = 5 * 1024 * 1024;

    const validFiles = selectedFiles.filter((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(t('chat.errors.file_size_limit', { fileName: file.name }));
        return false;
      }
      return true;
    });

    try {
      const uploadResults = await Promise.all(
        validFiles.map(async (file) => {
          const url = await uploadImage(file);
          return {
            id: uuidv4(),
            file,
            url,
            localUrl: URL.createObjectURL(file),
            status: 'done' as const,
          };
        })
      );

      addImages(uploadResults);
      if (uploadResults.length === 1) {
        toast.success(t('chat.success.images_uploaded'));
      } else {
        toast.success(
          t('chat.success.images_uploaded_multiple', {
            count: uploadResults.length,
          })
        );
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(t('chat.errors.upload_failed'));
    } finally {
      setIsUploading(false);
    }

    e.target.value = '';
  };

  // modify submit handler
  const handleSubmitWithFiles = async (_: React.KeyboardEvent, text?: string) => {
    if (!text && !input.trim() && uploadedImages.length === 0) return;

    console.log('💬 CLIENT: Submitting message to chat');
    console.log('📝 CLIENT: Message content:', text || input);
    console.log('📊 CLIENT: Mode:', mode);
    console.log('📊 CLIENT: Has projectData:', !!projectData);
    console.log('📊 CLIENT: Uploaded images count:', uploadedImages.length);
    console.log('📡 CLIENT: API endpoint:', `${baseChatUrl}/api/chat`);

    try {
      // process file references
      // const processedInput = await processFileReferences(input);
      // if it is ollama type model, need to use separate logic, not use cloud

      // save current images attachments
      const currentAttachments = uploadedImages.map((img) => ({
        id: img.id,
        name: img.id,
        type: img.file.type,
        localUrl: img.localUrl,
        contentType: img.file.type,
        url: img.url,
      }));
      console.log(
        JSON.stringify(uploadedImages),
        JSON.stringify(currentAttachments),
        'currentAttachments'
      );
      // clear images state
      clearImages();

      append(
        {
          role: 'user',
          content: text || input,
        },
        {
          experimental_attachments: currentAttachments,
        }
      );
      setInput('');
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(t('chat.errors.upload_files_failed'));
    }
  };

  // modify keyboard submit handler
  const handleKeySubmit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitWithFiles(e);
    }
  };

  // modify paste handler
  const handlePaste = async (e: ClipboardEvent) => {
    if (isUploading) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    const hasImages = Array.from(items).some((item) => item.type.indexOf('image') !== -1);
    if (hasImages) {
      e.preventDefault();
      setIsUploading(true);

      const imageItems = Array.from(items).filter((item) => item.type.indexOf('image') !== -1);

      try {
        const uploadResults = await Promise.all(
          imageItems.map(async (item) => {
            const file = item.getAsFile();
            if (!file) throw new Error('Failed to get file from clipboard');

            const url = await uploadImage(file);
            return {
              id: uuidv4(),
              file,
              url,
              localUrl: URL.createObjectURL(file),
              status: 'done' as const,
            };
          })
        );

        addImages(uploadResults);

        if (uploadResults.length === 1) {
          toast.success(t('chat.success.image_pasted'));
        } else {
          toast.success(
            t('chat.success.images_pasted_multiple', {
              count: uploadResults.length,
            })
          );
        }
      } catch (error) {
        console.error('Failed to upload pasted images:', error);
        toast.error(t('chat.errors.paste_failed'));
      } finally {
        setIsUploading(false);
      }
    }
  };

  // add paste event listener
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.addEventListener('paste', handlePaste);
    return () => {
      textarea.removeEventListener('paste', handlePaste);
    };
  }, []);

  // add drag over handler
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isUploading) return;
    setIsUploading(true);

    try {
      const items = Array.from(e.dataTransfer.items);
      const imageItems = items.filter((item) => item.type.startsWith('image/'));

      const uploadResults = await Promise.all(
        imageItems.map(async (item) => {
          const file = item.getAsFile();
          if (!file) throw new Error('Failed to get file from drop');

          const url = await uploadImage(file);
          return {
            id: uuidv4(),
            file,
            url,
            localUrl: URL.createObjectURL(file),
            status: 'done' as const,
          };
        })
      );

      addImages(uploadResults);

      if (uploadResults.length === 1) {
        toast.success(t('chat.success.image_added'));
      } else {
        toast.success(
          t('chat.success.images_added_multiple', {
            count: uploadResults.length,
          })
        );
      }
    } catch (error) {
      console.error('Failed to process dropped images:', error);
      toast.error(t('chat.errors.process_dropped_images_failed'));
    } finally {
      setIsUploading(false);
    }
  };

  // Function to retry loading project data
  const retryLoadProject = () => {
    setIsProjectLoaded(false);
    setProjectLoadError(null);
  };

  const retryCodeLoad = () => {
    setRetryingCodeLoad(true);
    setCodeLoadFailed(false);
    setIsProjectLoaded(false);
    setProjectLoadError(null);
    // Le drapeau se lève au prochain rendu : `loadProjectData` est déclenché
    // par l'effet qui observe `isProjectLoaded`.
    setTimeout(() => setRetryingCodeLoad(false), 1200);
  };

  // Les deux fonctions ci-dessous sont recréées à chaque rendu. Passées telles
  // quelles en dépendances de `showJsx`, elles invalidaient le memo à chaque
  // frappe dans le champ et à chaque jeton reçu : toute la conversation —
  // artefacts de plusieurs milliers de lignes compris — se reconstruisait, et le
  // navigateur finissait par signaler que la page ne répondait plus. Des
  // versions stables qui appellent toujours la dernière définition suffisent.
  const handleFileSelectRef = useRef(handleFileSelect);
  handleFileSelectRef.current = handleFileSelect;
  const stableHandleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleFileSelectRef.current(e),
    []
  );
  const retryLoadProjectRef = useRef(retryLoadProject);
  retryLoadProjectRef.current = retryLoadProject;
  const stableRetryLoadProject = useCallback(() => retryLoadProjectRef.current(), []);
  /**
   * Supprime ce qui a été généré pour ce produit et remet l'atelier à zéro, prêt
   * à régénérer.
   *
   * Ce qui part : le code (bucket), la conversation, le marqueur de génération.
   * Ce qui reste : le projet, sa charte, son plan, et l'adresse publiée — une
   * régénération se redéploie au même endroit. L'autre produit (site / app) n'est
   * pas touché : chacun a ses propres dossiers et documents.
   *
   * L'ordre compte, et le serveur passe avant le local : si la suppression
   * échoue, rien ne change à l'écran. Vider l'atelier d'abord ferait revenir
   * l'ancien code à la prochaine ouverture, sans que l'on comprenne pourquoi.
   */
  const handleDeleteGeneration = async () => {
    if (!projectId || regenerating || isLoading) return;

    setRegenerating(true);

    try {
      // 1. Point de restauration : la suppression est irréversible côté serveur,
      //    celui-ci est le filet de l'utilisateur. Son échec ne doit rien bloquer.
      try {
        const current = useFileStore.getState().files;
        if (Object.keys(current).length > 0) {
          await useVersionHistory.getState().capture(t('versions.beforeDelete'), current);
        }
      } catch (error) {
        console.warn('[regenerate] point de restauration non enregistré', error);
      }

      // 2. Plus aucun envoi de code ne doit partir : un envoi en vol réécrirait
      //    l'ancien code dans le bucket après la suppression.
      cancelPendingCodeSync();
      await waitForCodeSync();

      // 3. Le serveur d'abord. S'il échoue, on s'arrête ici, atelier intact.
      await deleteProjectGeneration(projectId);

      // 4. Conteneur neuf : processus arrêtés, disque vidé, serveurs oubliés.
      //    Sans cela `npm run dev` survit, le montage n'efface rien, et la
      //    relecture du disque rapatrie l'ancien site dans le magasin.
      await resetWebContainer();
      resetFileHashes();
      execList.clear();
      resetWarmStart();
      resetInstallRepair();

      // 5. Espace de travail et conversation à zéro.
      const previousChatUuid = chatUuid;
      refUuidMessages.current = [];
      pendingSessionRef.current = null;
      hasRestoredSessionRef.current = false;
      resetQualityPass(previousChatUuid);
      setChatUuid(uuidv4());
      setMessages([]);
      setMessagesa([]);
      clearImages();
      setEmptyFiles();
      await setFiles({});
      setOldFiles({});
      clearErrors();
      setIsFirstSend();
      setIsUpdateSend();
      useRunStatus.getState().reset();
      resetTerminals();

      // 6. Le socle est retiré ; l'effet de montage le reposera (configuration,
      //    charte, trousse de composants) et lancera l'installation, puis le
      //    modèle n'aura plus que le produit à écrire.
      clearScaffold();
      setScaffoldReady(null);
      setScaffoldEpoch((epoch) => epoch + 1);

      setHasGeneration(false);
      setIsGenerationComplete(false);
      setShowStartButton(true);
      setWasReset(true);
    } catch (error) {
      console.error('[regenerate] suppression impossible', error);
      toast.error(t('chatWorkspace.regenerateFailed'));
    } finally {
      setRegenerating(false);
      setConfirmingRegenerate(false);
    }
  };

  const handleDeleteGenerationRef = useRef(handleDeleteGeneration);
  handleDeleteGenerationRef.current = handleDeleteGeneration;
  const stableDeleteGeneration = useCallback(() => handleDeleteGenerationRef.current(), []);

  const handleStartGenerationRef = useRef(handleStartGeneration);
  handleStartGenerationRef.current = handleStartGeneration;
  const stableHandleStartGeneration = useCallback(() => handleStartGenerationRef.current(), []);

  // L'aperçu propose « Générer maintenant » tant que l'espace de travail ne
  // porte que le socle : c'est la conversation qui sait le faire.
  useEffect(() => {
    return eventEmitter.on('chat:startGeneration', () => {
      if (isLoading) return;
      stableHandleStartGeneration();
    });
  }, [isLoading]);


  const showJsx = useMemo(() => {
    // Show error state if project failed to load
    if (projectLoadError) {
      return (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                Failed to Load Project
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mb-6">{projectLoadError}</p>
              <button
                onClick={stableRetryLoadProject}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2 mx-auto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {t('chatWorkspace.retry')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Suppression de la génération, proposée là où l'on peut en avoir besoin :
    // une fois terminée, et aussi quand elle reste bloquée « en cours » (sans
    // cette sortie, une génération échouée n'offrait aucun moyen de repartir).
    const regenerateControl = projectId ? (
      <div className="mt-1">
        {confirmingRegenerate ? (
          <div
            role="group"
            aria-labelledby="regenerate-title"
            className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-left"
          >
            <h4 id="regenerate-title" className="text-sm font-semibold text-text-primary mb-1">
              {t('chatWorkspace.regenerateTitle')}
            </h4>
            <p className="text-sm text-text-tertiary mb-3">{t('chatWorkspace.regenerateBody')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={stableDeleteGeneration}
                disabled={regenerating || isLoading}
                className="min-h-[40px] rounded-lg bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {regenerating
                  ? t('chatWorkspace.regenerating')
                  : t('chatWorkspace.regenerateConfirm')}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmingRegenerate(false)}
                disabled={regenerating}
                className="min-h-[40px] rounded-lg border border-primary/20 px-4 text-sm font-medium text-text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
              >
                {t('chatWorkspace.regenerateCancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingRegenerate(true)}
            disabled={isLoading}
            className="min-h-[40px] text-sm text-text-tertiary underline underline-offset-4 transition-colors hover:text-text-primary disabled:opacity-50"
          >
            {t('chatWorkspace.regenerate')}
          </button>
        )}
      </div>
    ) : null;

    // `min-h-0` : un élément flex a `min-height: auto` par défaut, donc il
    // refuse de descendre sous la hauteur de son contenu — `overflow-y-auto`
    // ne déclenche alors jamais, le bloc pousse le conteneur et la
    // conversation devient inatteignable au lieu de défiler.
    return (
      <div
        className="flex-1 min-h-0 overflow-y-auto px-1 py-2 message-container [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        onScroll={handleScroll} // add scroll event listener
      >
        {/* Project Generation Workspace Header */}
        {projectData && (
          <div className="max-w-[640px] w-full mx-auto mb-6">
            <div className="rounded-xl p-6 border border-primary/20 bg-gradient-to-br from-primary/10 to-secondary/10">
              <div className="text-center mb-4">
                <ProjectLogo
                  logo={projectData.analysisResultModel?.branding?.logo}
                  name={projectData.name}
                  size={64}
                  className="mx-auto mb-3"
                />
                <h2 className="text-2xl font-bold mb-2 text-text-primary">
                  {projectData.name}
                </h2>
                <p className="mb-4 text-text-tertiary">
                  {projectData.description || t('chatWorkspace.readyToGenerate')}
                </p>
              </div>
              {showStartButton ? (
                <div className="text-center">
                  <p className="text-sm text-text-tertiary mb-4">
                    {t('chatWorkspace.startHint')}
                  </p>
                  <button
                    onClick={stableHandleStartGeneration}
                    className="inner-button flex items-center gap-3 mx-auto px-8 py-4 text-lg font-semibold"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    {wasReset ? t('chatWorkspace.regenerateNow') : t('chatWorkspace.generateNow')}
                  </button>
                </div>
              ) : hasGeneration && !isGenerationComplete ? (
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-3 mb-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-primary/15">
                      <IdemLoader size="xs" />
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary">
                      {t('chatWorkspace.inProgress')}
                    </h3>
                  </div>
                  <p className="text-sm text-text-tertiary mb-2">
                    {t('chatWorkspace.inProgressBody')}
                  </p>
                  {!isLoading && regenerateControl}
                </div>
              ) : isGenerationComplete ? (
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-3 mb-4">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-green-500/15">
                      <svg
                        className="w-4 h-4 text-green-600 dark:text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary">
                      {t('chatWorkspace.complete')}
                    </h3>
                  </div>
                  <p className="text-sm mb-2 text-text-tertiary">
                    {t('chatWorkspace.completeBody')}
                  </p>
                  {regenerateControl}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Only show tips if no project data */}
        {!projectData && (
          <Tips append={append} setInput={setInput} handleFileSelect={stableHandleFileSelect} />
        )}
        <div className="max-w-[640px] w-full mx-auto space-y-3">
          {filterMessages.map((message, index) => (
            <MessageItem
              handleRetry={() => {
                // test
                reload();
              }}
              key={`${message.id}-${index}`}
              message={message}
              isEndMessage={filterMessages[filterMessages.length - 1].id === message.id}
              isLoading={isLoading}
              onUpdateMessage={(messageId, content) => {
                append({
                  role: 'user',
                  content: ` ${content?.[0]?.text}`,
                });
              }}
            />
          ))}

          {isLoading && (
            <div className="group" key="loading-indicator">
              <div className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-2/[0.02] transition-colors">
                <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-[rgba(45,45,45)] text-text-tertiary flex items-center justify-center text-xs border border-[var(--glass-border)]/50">
                  <IdemLoader size="xs" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-4 rounded bg-surface-3/50 animate-pulse" />
                    <div className="w-32 h-4 rounded bg-surface-3/50 animate-pulse" />
                    <div className="w-16 h-4 rounded bg-surface-3/50 animate-pulse" />
                  </div>
                  <div className="mt-2 space-y-2">
                    <div className="w-full h-3 rounded bg-surface-3/50 animate-pulse" />
                    <div className="w-4/5 h-3 rounded bg-surface-3/50 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Les boutons d'export ont été supprimés - le code est automatiquement sauvé dans le stockage IDEM */}

          <div ref={messagesEndRef} className="h-px" />
        </div>
      </div>
    );
  }, [
    messages,
    isLoading,
    setInput,
    stableHandleFileSelect,
    showStartButton,
    hasGeneration,
    isGenerationComplete,
    projectData,
    projectLoadError,
    stableRetryLoadProject,
    stableHandleStartGeneration,
    stableDeleteGeneration,
    confirmingRegenerate,
    regenerating,
    wasReset,
    projectId,
    t,
  ]);

  // show guide modal
  const showGuide = () => setVisible(true);

  // handle file selected
  const handleFileSelected = () => {
    console.log('handleFileSelected');
    // handle upload logic
    setVisible(false);
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col dark:bg-surface-1 max-w-full"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {showJsx}

      <CodeLoadError
        open={codeLoadFailed}
        retrying={retryingCodeLoad}
        onRetry={retryCodeLoad}
        onDismiss={() => setCodeLoadFailed(false)}
      />

      {/* Tutorial Modal */}
      {showTutorial && projectData && (
        <ProjectTutorial projectData={projectData} onClose={() => setShowTutorial(false)} />
      )}

      {/* Hide ChatInput when chat is empty and projectData exists (show only project description + start button) */}
      {!(projectData && filterMessages.length === 0) && (
        <ChatInput
          input={input}
          setMessages={setMessages}
          append={append}
          messages={messages}
          stopRuning={stop}
          setInput={setInput}
          isLoading={isLoading}
          isUploading={isUploading}
          uploadedImages={uploadedImages}
          baseModal={baseModal}
          handleInputChange={handleInputChange}
          handleKeySubmit={handleKeySubmit}
          handleSubmitWithFiles={handleSubmitWithFiles}
          handleFileSelect={handleFileSelect}
          removeImage={removeImage}
          addImages={addImages}
          setIsUploading={setIsUploading}
          setBaseModal={setBaseModal}
        />
      )}
    </div>
  );
};
