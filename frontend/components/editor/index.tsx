"use client"

import Editor, { OnMount } from "@monaco-editor/react"
import monaco from "monaco-editor"
import { useEffect, useRef, useState } from "react"
// import theme from "./theme.json"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  ChevronLeft,
  ChevronRight,
  FileJson,
  RotateCw,
  TerminalSquare,
} from "lucide-react"
import Tab from "../ui/tab"
import Sidebar from "./sidebar"
import { useClerk } from "@clerk/nextjs"
import { TFile, TFileData, TFolder, TTab } from "./sidebar/types"

import { io } from "socket.io-client"
import { processFileType } from "@/lib/utils"
import { toast } from "sonner"

export default function CodeEditor({
  userId,
  sandboxId,
}: {
  userId: string
  sandboxId: string
}) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
  }

  const [files, setFiles] = useState<(TFolder | TFile)[]>([])
  const [editorLanguage, setEditorLanguage] = useState("plaintext")
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [tabs, setTabs] = useState<TTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const socket = io(
    `http://localhost:4000?userId=${userId}&sandboxId=${sandboxId}`
  )

  // connection/disconnection effect
  useEffect(() => {
    console.log("connecting")
    socket.connect()

    return () => {
      socket.disconnect()
    }
  }, [])

  // event listener effect
  useEffect(() => {
    function onLoadedEvent(files: (TFolder | TFile)[]) {
      console.log("onLoadedEvent")
      setFiles(files)
    }

    function onFileEvent() {
      console.log("onFileEvent")
      // setActiveFile(file)
    }

    socket.on("loaded", onLoadedEvent)
    socket.on("file", onFileEvent)

    return () => {
      socket.off("loaded", onLoadedEvent)
      socket.off("file", onFileEvent)
    }
  }, [])

  const clerk = useClerk()

  const selectFile = (tab: TTab) => {
    setTabs((prev) => {
      const exists = prev.find((t) => t.id === tab.id)
      if (exists) {
        // console.log("exists")
        setActiveId(exists.id)
        return prev
      }
      return [...prev, tab]
    })
    socket.emit("getFile", tab.id, (response: string) => {
      setActiveFile(response)
    })
    setEditorLanguage(processFileType(tab.name))
    setActiveId(tab.id)
  }

  const closeTab = (tab: TFile) => {
    const numTabs = tabs.length
    const index = tabs.findIndex((t) => t.id === tab.id)
    const nextId =
      activeId === tab.id
        ? numTabs === 1
          ? null
          : index < numTabs - 1
          ? tabs[index + 1].id
          : tabs[index - 1].id
        : activeId
    const nextTab = tabs.find((t) => t.id === nextId)

    if (nextTab) selectFile(nextTab)
    else setActiveId(null)
    setTabs((prev) => prev.filter((t) => t.id !== tab.id))
  }

  const handleRename = (
    id: string,
    newName: string,
    oldName: string,
    type: "file" | "folder"
  ) => {
    // Validation
    if (newName === oldName) {
      return false
    }

    if (
      newName.includes("/") ||
      newName.includes("\\") ||
      newName.includes(" ") ||
      (type === "file" && !newName.includes(".")) ||
      (type === "folder" && newName.includes("."))
    ) {
      toast.error("Invalid file name.")
      return false
    }

    // Action
    socket.emit("renameFile", id, newName)
    setTabs((prev) =>
      prev.map((tab) => (tab.id === id ? { ...tab, name: newName } : tab))
    )

    return true
  }

  return (
    <>
      <Sidebar
        files={files}
        selectFile={selectFile}
        handleRename={handleRename}
      />
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel
          className="p-2 flex flex-col"
          maxSize={75}
          minSize={30}
          defaultSize={60}
        >
          <div className="h-10 w-full flex gap-2">
            {tabs.map((tab) => (
              <Tab
                key={tab.id}
                saved={tab.saved}
                selected={activeId === tab.id}
                onClick={() => {
                  selectFile(tab)
                }}
                onClose={() => closeTab(tab)}
              >
                {tab.name}
              </Tab>
            ))}
          </div>
          <div className="grow w-full overflow-hidden rounded-md">
            {activeId === null ? (
              <>
                <div className="w-full h-full flex items-center justify-center text-xl font-medium text-secondary select-none">
                  <FileJson className="w-6 h-6 mr-3" />
                  No file selected.
                </div>
              </>
            ) : clerk.loaded ? (
              <Editor
                height="100%"
                // defaultLanguage="typescript"
                language={editorLanguage}
                onMount={handleEditorMount}
                onChange={(value) => {
                  setTabs((prev) =>
                    prev.map((tab) =>
                      tab.id === activeId ? { ...tab, saved: false } : tab
                    )
                  )
                }}
                options={{
                  minimap: {
                    enabled: false,
                  },
                  padding: {
                    bottom: 4,
                    top: 4,
                  },
                  scrollBeyondLastLine: false,
                  fixedOverflowWidgets: true,
                }}
                theme="vs-dark"
                value={activeFile ?? ""}
              />
            ) : null}
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={40}>
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel
              defaultSize={50}
              minSize={20}
              className="p-2 flex flex-col"
            >
              <div className="h-10 select-none w-full flex gap-2">
                <div className="h-8 rounded-md px-3 text-xs bg-secondary flex items-center w-full justify-between">
                  Preview
                  <div className="flex space-x-1 translate-x-1">
                    <div className="p-0.5 h-5 w-5 ml-0.5 flex items-center justify-center transition-colors bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-sm">
                      <TerminalSquare className="w-4 h-4" />
                    </div>
                    <div className="p-0.5 h-5 w-5 ml-0.5 flex items-center justify-center transition-colors bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-sm">
                      <ChevronLeft className="w-4 h-4" />
                    </div>
                    <div className="p-0.5 h-5 w-5 ml-0.5 flex items-center justify-center transition-colors bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-sm">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                    <div className="p-0.5 h-5 w-5 ml-0.5 flex items-center justify-center transition-colors bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-sm">
                      <RotateCw className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full grow rounded-md bg-foreground"></div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel
              defaultSize={50}
              minSize={20}
              className="p-2 flex flex-col"
            >
              <div className="h-10 w-full flex gap-2">
                <Tab selected>Node</Tab>
                <Tab>Console</Tab>
              </div>
              <div className="w-full grow rounded-md bg-secondary"></div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </>
  )
}
