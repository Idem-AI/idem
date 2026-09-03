import { useState, useEffect, useRef } from "react";
import { ActivityBar } from "./components/ActivityBar";
import { Terminal } from "./components/Terminal"
import { Editor } from "./components/Editor"
import { EditorTabs } from "./components/EditorTabs"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { useEditorStore } from "./stores/editorStore"
import { FileExplorer } from "./components/IDEContent/FileExplorer"
import { Search } from "./components/IDEContent/Search"
import { TeamExample } from "../Role"

/**
 * Niveau de détail de l'éditeur.
 *
 * `minimal` — arborescence des fichiers et éditeur, rien d'autre. C'est la vue
 * par défaut : un profil non technique qui ouvre « Code » veut lire ce que l'IA
 * a écrit, pas hériter d'un IDE avec barre d'activité, recherche plein texte et
 * terminal ouvert.
 * `full` — l'atelier complet, pour qui sait s'en servir. Le choix est mémorisé.
 */
export type IdeDetail = "minimal" | "full";

interface WeIdeProps {
  detail?: IdeDetail;
}

export default function WeIde({ detail = "minimal" }: WeIdeProps) {
  const isFull = detail === "full";
  const [activeTab, setActiveTab] = useState("");
  const [showTerminal, setShowTerminal] = useState(true);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const { setDirty } = useEditorStore();
  const [activeView, setActiveView] = useState<"files" | "search">("files");
  const [currentLine, setCurrentLine] = useState<number | undefined>();

  useEffect(() => {
    const handleEmit = (
      event: CustomEvent<{ path: string; line?: number }>
    ) => {
      handleFileSelectAiFile(event.detail.path, event.detail.line);
    };

    window.addEventListener("openFile", handleEmit as EventListener);
    return () => {
      window.removeEventListener("openFile", handleEmit as EventListener);
    };
  }, [openTabs]);


  const handleFileSelectAiFile = (path: string, line?: number) => {
    setActiveTab(path);
    setCurrentLine(line);
    if (!openTabs.includes(path)) {
      const newTabs = [...openTabs];
      newTabs[0] = path;
      setOpenTabs(newTabs);
    }
    setDirty(path, false);
  };

  const handleFileSelect = (path: string, line?: number) => {
    setActiveTab(path);
    setCurrentLine(line);
    if (!openTabs.includes(path)) {
      setOpenTabs([...openTabs, path]);
    }
  };

  const handleTabClose = (tab: string) => {
    const newTabs = openTabs.filter((t) => t !== tab);
    setOpenTabs(newTabs);
    if (activeTab === tab && newTabs.length > 0) {
      setActiveTab(newTabs[0]);
    }
  };

  const handleCloseAll = () => {
    setOpenTabs([]);
    setActiveTab("");
  };

  const terminalVisible = isFull && showTerminal;

  return (
    <div className="h-full w-full motif-pass-through text-text-primary flex overflow-hidden">
      {isFull && (
        <ActivityBar
          activeView={activeView}
          onViewChange={setActiveView}
          onToggleTerminal={() => setShowTerminal(!showTerminal)}
          showTerminal={showTerminal}
        />
      )}


      <PanelGroup direction="horizontal">
        {/* File List */}
        <Panel
          defaultSize={25}
          minSize={16}
          maxSize={30}
          className="shrink-0 border-r border-[var(--glass-border)]"
        >
          {isFull && activeView === "search" ? (
            <Search onFileSelect={handleFileSelect} />
          ) : (
            <FileExplorer onFileSelect={handleFileSelect} />
          )}
        </Panel>

        <PanelResizeHandle className="w-px bg-[var(--glass-border)] hover:bg-primary transition-colors cursor-col-resize" />
      
        {/* Coding Area and Terminal */}
        <Panel className="min-w-0 ml-[-1px]">
          <PanelGroup direction="vertical">
            {/* Coding Area */}
            <Panel className="flex flex-col min-h-0">
              <EditorTabs
                openTabs={openTabs}
                activeTab={activeTab}
                onTabSelect={setActiveTab}
                onTabClose={handleTabClose}
                onCloseAll={handleCloseAll}
              />
              <div className="flex-1 overflow-hidden bg-surface-1">
                {activeTab && (
                  <Editor fileName={activeTab} initialLine={currentLine} />
                )}
              </div>
            </Panel>

            {/* Terminal — mode complet uniquement. */}
            {isFull && (
              <>
                <PanelResizeHandle
                  style={{ display: terminalVisible ? "flex" : "none" }}
                  className="h-px bg-[var(--glass-border)] hover:bg-primary transition-colors cursor-row-resize"
                />
                <Panel
                  defaultSize={30}
                  minSize={10}
                  maxSize={80}
                  style={{
                    display: terminalVisible ? "flex" : "none",
                    flexDirection: "column",
                  }}
                  className="bg-surface-2 border-t border-[var(--glass-border)]"
                >
                  <Terminal />
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
}
