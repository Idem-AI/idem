import { useEffect, useMemo, useRef, useState } from 'react';
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
import { updateFileSystemNow } from '../../WeIde/services';
import { parseMessages } from '../useMessageParser';
import { createMpIcon } from '@/utils/createWtrite';
import { useTranslation } from 'react-i18next';
import useChatModeStore from '../../../stores/chatModeSlice';
import useTerminalStore from '@/stores/terminalSlice';
import { checkExecList, checkFinish } from '../utils/checkFinish';
import { useUrlData } from '@/hooks/useUrlData';
import {
  getProjectById,
  getProjectGeneration,
  saveProjectGeneration,
  sendZipToBackend,
  sendToGitHub,
  getProjectCodeFromFirebase,
} from '@/api/persistence/db';
import {
  createZipFromFiles,
  createProjectMetadata,
  extractFilesFromMessages,
} from '@/utils/zipUtils';
import { MCPTool } from '@/types/mcp';
import useMCPTools from '@/hooks/useMCPTools';
import { ProjectTutorial } from '../../Onboarding/ProjectTutorial';
import { useLoading } from '../../loading';
import { ProjectModel } from '@/api/persistence/models/project.model';

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

const API_BASE = process.env.REACT_APP_BASE_URL;
console.log(API_BASE, 'API_BASE');

enum ModelTypes {
  Gemini3Flash = 'gemini-3-flash-preview',
  Claude37sonnet = 'claude-3-7-sonnet-20250219',
  Claude35sonnet = 'claude-3-5-sonnet-20240620',
  gpt4oMini = 'gpt-4o-mini',
  DeepseekR1 = 'DeepSeek-R1',
  DeepseekV3 = 'deepseek-chat',
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
    // Fallback vers la configuration par défaut
    return [
      {
        value: ModelTypes.Gemini3Flash,
        label: 'Gemini 3 Flash',
        useImage: true,
        from: 'default',
        quota: 2,
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
    return data.defaultModel || ModelTypes.Gemini3Flash;
  } catch (error) {
    console.error('Error fetching default model:', error);
    return ModelTypes.Gemini3Flash;
  }
}

function convertToBoltAction(obj: Record<string, string>): string {
  return Object.entries(obj)
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
  const { otherConfig } = useChatStore();
  const { t } = useTranslation();
  const [checkCount, setCheckCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const [baseModal, setBaseModal] = useState<IModelOption>({
    value: ModelTypes.Gemini3Flash,
    label: 'Gemini 3.5 Flash',
    useImage: true,
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

  useEffect(() => {
    if (checkCount >= 1) {
      checkFinish(messages[messages.length - 1].content, append, t);
      checkExecList(messages);
      setCheckCount(0);
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
      toast.error('Failed to load chat history');
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
  const [showStartButton, setShowStartButton] = useState(false);
  const [hasGeneration, setHasGeneration] = useState(false);
  const [isGenerationComplete, setIsGenerationComplete] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [projectLoadError, setProjectLoadError] = useState<string | null>(null);

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
    append,
    setInput,
    stop,
    reload,
  } = useChat({
    api: `${baseChatUrl}/api/chat`,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: {
      model: baseModal.value,
      mode: mode,
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
          for (let key in messagefiles) {
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
        await db.insert(chatUuid, {
          messages: [...messages, ...initMessage, message],
          title:
            [...initMessage, ...messages]
              .find((m) => m.role === 'user' && !m.content.includes('<boltArtifact'))
              ?.content?.slice(0, 50) || 'New Chat',
        });
      } catch (error) {
        console.error('Failed to save chat history:', error);
      }
      setCheckCount((checkCount) => checkCount + 1);

      // Save generation data after completion using ZIP upload
      if (projectId && projectData) {
        try {
          // Extract files from the latest message
          const generatedFiles = extractFilesFromMessages([...messages, message]);

          if (Object.keys(generatedFiles).length > 0) {
            // Create ZIP from generated files
            const zipBlob = await createZipFromFiles(generatedFiles);

            // Upload ZIP to backend
            await sendZipToBackend(projectId, zipBlob);

            // Create and save minimal metadata (without large files)
            const metadata = createProjectMetadata(projectData, [...messages, message]);
            await saveProjectGeneration(projectId, metadata);

            console.log('Generation saved as ZIP for project:', projectData.name);
          } else {
            console.warn('No files generated to save');
          }

          setIsGenerationComplete(true);
          // Ne plus afficher les boutons GitHub - le code est automatiquement sauvé sur Firebase
        } catch (error) {
          console.error('Error saving generation:', error);
        }
      }
    },
    onError: (error: any) => {
      const msg = error?.errors?.[0]?.responseBody || String(error);
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
        toast.error('Ollama server connection failed, please check configuration');
      }
    },
  });

  // Get status and type from URL data (projectId already obtained above)
  const { status, type } = useUrlData({ append });
  const { setLoading } = useLoading();

  // Extract project colors for theming
  const projectColors = useMemo(() => {
    const colors = projectData?.analysisResultModel?.branding?.colors?.colors;
    if (colors) {
      return {
        primary: colors.primary || '#3B82F6',
        secondary: colors.secondary || '#8B5CF6',
        accent: colors.accent || '#10B981',
        background: colors.background || '#F3F4F6',
        text: colors.text || '#1F2937',
      };
    }
    // Fallback colors
    return {
      primary: '#3B82F6',
      secondary: '#8B5CF6',
      accent: '#10B981',
      background: '#F3F4F6',
      text: '#1F2937',
    };
  }, [projectData]);

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

          // Check if generation already exists
          const existingGeneration = await getProjectGeneration(projectId);
          if (existingGeneration) {
            setHasGeneration(true);
            setIsGenerationComplete(true);
            console.log('Existing generation found for project:', project.name);
          } else {
            setShowStartButton(true);
            console.log('No generation found, showing start button for:', project.name);
          }

          // Vérifier et charger le code existant depuis Firebase Storage
          try {
            console.log('Checking for existing code in Firebase Storage for project:', projectId);
            const existingCode = await getProjectCodeFromFirebase(projectId);

            if (existingCode && Object.keys(existingCode).length > 0) {
              console.log(
                'Found existing code in Firebase Storage, loading into workspace:',
                Object.keys(existingCode).length,
                'files'
              );

              // Charger le code dans l'espace de travail
              setFiles(existingCode);

              // Marquer les fichiers comme étant déjà envoyés (réinitialiser d'abord)
              setIsFirstSend();

              // Créer un message initial avec le code existant si on est en mode Builder
              if (mode === ChatMode.Builder && messages.length === 0) {
                const boltAction = convertToBoltAction(existingCode);
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

              toast.success(
                `Code existant chargé depuis Firebase Storage (${Object.keys(existingCode).length} fichiers)`
              );
            } else {
              console.log('No existing code found in Firebase Storage for project:', projectId);
            }
          } catch (error) {
            console.error('Error loading existing code from Firebase Storage:', error);
            // Ne pas afficher d'erreur à l'utilisateur car ce n'est pas critique
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

      // Send a short display message - the server will rebuild the full prompt from projectData in the body
      append({
        id: uuidv4(),
        role: 'user',
        content: `Starting generation of "${projectData.name}"`,
      });

      setShowStartButton(false);
      setHasGeneration(true);
      console.log('Generation started for project:', projectData.name);
    } catch (error) {
      console.error('Error starting generation:', error);
      toast.error('Error starting generation');
    }
  };

  // Fonction pour sauvegarder automatiquement le code sur Firebase Storage
  const saveCodeToFirebase = async (generatedFiles: Record<string, string>) => {
    if (!projectId || !generatedFiles || Object.keys(generatedFiles).length === 0) return;

    try {
      console.log('Saving code to Firebase Storage for project:', projectId);

      // Create ZIP from generated files
      const zipBlob = await createZipFromFiles(generatedFiles);

      // Upload ZIP to backend (Firebase Storage)
      await sendZipToBackend(projectId, zipBlob);

      console.log('Code successfully saved to Firebase Storage');
      toast.success(
        `Code sauvegardé sur Firebase Storage (${Object.keys(generatedFiles).length} fichiers)`
      );
    } catch (error) {
      console.error('Error saving code to Firebase Storage:', error);
      toast.error('Erreur lors de la sauvegarde sur Firebase Storage');
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
  const filterMessages = messages.filter((e) => e.role !== 'system');
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
      toast.error('Failed to upload files');
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
        toast.success('Image added to input box');
      } else {
        toast.success(`${uploadResults.length} images added to input box`);
      }
    } catch (error) {
      console.error('Failed to process dropped images:', error);
      toast.error('Failed to process dropped images');
    } finally {
      setIsUploading(false);
    }
  };

  // Function to retry loading project data
  const retryLoadProject = () => {
    setIsProjectLoaded(false);
    setProjectLoadError(null);
  };

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
                onClick={retryLoadProject}
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
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="flex-1 overflow-y-auto px-1 py-2 message-container [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        onScroll={handleScroll} // add scroll event listener
      >
        {/* Project Generation Workspace Header */}
        {projectData && (
          <div className="max-w-[640px] w-full mx-auto mb-6">
            <div
              className="rounded-xl p-6"
              style={{
                background: `linear-gradient(135deg, ${projectColors.primary}15 0%, ${projectColors.secondary}15 100%)`,
                border: `1px solid ${projectColors.primary}30`,
              }}
            >
              <div className="text-center mb-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 bg-zinc-100">
                  {projectData.analysisResultModel?.branding?.logo?.variations?.iconOnly
                    ?.lightBackground ? (
                    <img
                      src={
                        projectData.analysisResultModel.branding.logo.variations.iconOnly
                          .lightBackground
                      }
                      alt="Project Logo"
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  )}
                </div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: projectColors.primary }}>
                  {projectData.name}
                </h2>
                <p className="mb-4" style={{ color: `${projectColors.text}CC` }}>
                  {projectData.description || 'Ready to generate your application'}
                </p>
              </div>
              {showStartButton ? (
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Click the button below to start generating your application code
                  </p>
                  <button
                    onClick={handleStartGeneration}
                    className="text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center gap-3 mx-auto shadow-lg hover:shadow-xl transform hover:scale-105 hover:opacity-90"
                    style={{
                      background: `linear-gradient(135deg, ${projectColors.primary} 0%, ${projectColors.secondary} 100%)`,
                    }}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Generate Now
                  </button>
                </div>
              ) : hasGeneration && !isGenerationComplete ? (
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-3 mb-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${projectColors.accent}20` }}
                    >
                      <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                        style={{ color: projectColors.accent }}
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold" style={{ color: projectColors.accent }}>
                      Generation in Progress
                    </h3>
                  </div>
                  <p className="text-sm" style={{ color: `${projectColors.accent}CC` }}>
                    Your application is being generated. Please wait...
                  </p>
                </div>
              ) : isGenerationComplete ? (
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-3 mb-4">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${projectColors.accent}20` }}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke={projectColors.accent}
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
                    <h3 className="text-lg font-semibold" style={{ color: projectColors.accent }}>
                      Generation Complete
                    </h3>
                  </div>
                  <p className="text-sm mb-4" style={{ color: `${projectColors.accent}CC` }}>
                    Your application has been successfully generated and is ready for export.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Only show tips if no project data */}
        {!projectData && (
          <Tips append={append} setInput={setInput} handleFileSelect={handleFileSelect} />
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
              <div className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                <div className="w-6 h-6 rounded-md bg-[rgba(45,45,45)] text-gray-400 flex items-center justify-center text-xs border border-gray-700/50">
                  <svg
                    className="w-4 h-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-4 rounded bg-gray-700/50 animate-pulse" />
                    <div className="w-32 h-4 rounded bg-gray-700/50 animate-pulse" />
                    <div className="w-16 h-4 rounded bg-gray-700/50 animate-pulse" />
                  </div>
                  <div className="mt-2 space-y-2">
                    <div className="w-full h-3 rounded bg-gray-700/50 animate-pulse" />
                    <div className="w-4/5 h-3 rounded bg-gray-700/50 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Les boutons d'export ont été supprimés - le code est automatiquement sauvé sur Firebase Storage */}

          <div ref={messagesEndRef} className="h-px" />
        </div>
      </div>
    );
  }, [
    messages,
    isLoading,
    setInput,
    handleFileSelect,
    showStartButton,
    hasGeneration,
    isGenerationComplete,
    projectData,
    projectLoadError,
    retryLoadProject,
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
      className="flex h-full flex-col dark:bg-[#18181a] max-w-full"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {showJsx}

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
