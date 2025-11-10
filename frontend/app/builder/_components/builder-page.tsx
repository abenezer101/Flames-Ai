"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, useMemo } from "react";
import { Maximize2, ChevronDown, ChevronRight, File, Folder, Eye, Code, Plus, X, PanelRight, PanelLeft, ChevronUp, Rocket } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MonacoEditor from "@monaco-editor/react";
import { RainbowButton } from "@/components/ui/rainbow-button";
import {
	BuilderInput,
	BuilderInputSubmit,
	BuilderInputTextArea,
} from "@/components/ui/builder-input";
import { WebContainerPreview } from "@/app/components/webcontainer-preview";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import dynamic from 'next/dynamic';
import type { Terminal } from 'xterm';
import { useBuilderStore, useHydratedStore } from "@/lib/store";

const TerminalPanel = dynamic(() => import('@/app/components/terminal-panel').then(mod => mod.TerminalPanel), {
    ssr: false,
});

interface FileItem {
	id: string;
	name: string;
	type: "file" | "folder";
	content?: string;
	language?: string;
	children?: FileItem[];
	path: string;
}

// Define the structure for the WebContainer file system
interface FileSystemTree {
    [name: string]: {
        file: {
            contents: string;
        };
    } | {
        directory: FileSystemTree;
    };
}

// View Toggle Component - Simple sliding toggle
function ViewToggle({ activeView, setActiveView }: { activeView: "preview" | "code"; setActiveView: (view: "preview" | "code") => void }) {
	return (
		<div className="bg-zinc-900 inline-flex items-center rounded-lg border border-zinc-800 relative right-4">
			<div className="relative flex">
				<div
					className="absolute inset-y-0 w-1/2 bg-zinc-700 rounded-md transition-transform duration-200 ease-in-out"
					style={{
						transform: activeView === "code" ? "translateX(100%)" : "translateX(0)",
					}}
				/>
				<button
					className={`relative z-10 flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
						activeView === "preview" ? "text-white" : "text-zinc-400 hover:text-zinc-300"
					}`}
					onClick={() => setActiveView("preview")}
				>
					<Eye className="w-3.5 h-3.5" />
					Preview
				</button>
				<button
					className={`relative z-10 flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
						activeView === "code" ? "text-white" : "text-zinc-400 hover:text-zinc-300"
					}`}
					onClick={() => setActiveView("code")}
				>
					<Code className="w-3.5 h-3.5" />
					Code
				</button>
			</div>
		</div>
	);
}

// Available AI models
const AI_MODELS = [
	{ id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Fastest, for quick tasks" },
	{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Fastest, for quick tasks" },
    { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite", description: "Lightweight, for quick tasks" },
];

// Initial empty file structure - will be populated by AI
const initialFiles: FileItem[] = [];

function FileExplorer({ 
	files, 
	activeFileId, 
	onFileSelect 
}: { 
	files: FileItem[]; 
	activeFileId: string | null;
	onFileSelect: (file: FileItem) => void;
}) {
	const [expanded, setExpanded] = useState<Record<string, boolean>>({
		"/src": true,
		"/src/components": true,
	});

	const toggleFolder = (path: string) => {
		setExpanded(prev => ({
			...prev,
			[path]: !prev[path]
		}));
	};

	const FileTreeItem = ({ item }: { item: FileItem }) => {
		const isExpanded = expanded[item.path];
		const hasChildren = item.type === "folder" && item.children && item.children.length > 0;
		const isActive = activeFileId === item.id;

		return (
			<div>
				<div 
					className={`flex items-center gap-1 px-2 py-1 cursor-pointer group rounded ${
						isActive ? 'bg-zinc-700' : 'hover:bg-zinc-800'
					}`}
					onClick={() => {
						if (item.type === "folder") {
							toggleFolder(item.path);
						} else {
							onFileSelect(item);
						}
					}}
				>
					{hasChildren ? (
						<button
							onClick={(e) => {
								e.stopPropagation();
								toggleFolder(item.path);
							}}
							className="p-0 flex items-center justify-center w-4"
						>
							{isExpanded ? (
								<ChevronDown className="w-4 h-4 text-zinc-500" />
							) : (
								<ChevronRight className="w-4 h-4 text-zinc-500" />
							)}
						</button>
					) : (
						<div className="w-4" />
					)}

					{item.type === "folder" ? (
						<Folder className="w-4 h-4 text-amber-500" />
					) : (
						<File className="w-4 h-4 text-zinc-400" />
					)}
					<span className={`text-xs ${isActive ? 'text-white' : 'text-zinc-300 group-hover:text-zinc-100'}`}>
						{item.name}
					</span>
				</div>

				{hasChildren && isExpanded && (
					<div className="pl-2 border-l border-zinc-800 ml-1">
						{item.children!.map(child => (
							<FileTreeItem key={child.id} item={child} />
						))}
					</div>
				)}
			</div>
		);
	};

	return (
		<div className="flex-1 overflow-auto p-3">
			{files.map(item => (
				<FileTreeItem key={item.id} item={item} />
			))}
		</div>
	);
}

function DeploymentModal({
	status,
	url,
	onClose,
	errorMessage,
}: {
	status: 'deploying' | 'success' | 'error';
	url: string | null;
	onClose: () => void;
	errorMessage?: string | null;
}) {
	return (
		<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
			<motion.div
				initial={{ scale: 0.95, y: 20, opacity: 0 }}
				animate={{ scale: 1, y: 0, opacity: 1 }}
				exit={{ scale: 0.95, y: 20, opacity: 0 }}
				className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-sm w-full text-center"
			>
				{status === 'deploying' && (
					<>
						<div className="w-12 h-12 mx-auto mb-4 relative">
							<div className="absolute inset-0 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
						</div>
						<h3 className="text-lg font-medium text-white">Deployment in Progress</h3>
						<p className="text-zinc-400 text-sm mt-2">
							Your application is being deployed. This may take a few minutes.
						</p>
					</>
				)}
				{status === 'success' && (
					<>
						<h3 className="text-lg font-medium text-white">Your app is live!</h3>
						<div className="my-4">
							<a href={url!} target="_blank" rel="noopener noreferrer" className="inline-block">
								<button className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2">
									Web App <ChevronRight className="w-4 h-4" />
								</button>
							</a>
						</div>
						<div className="flex items-center gap-2 bg-zinc-800 p-2 rounded-lg">
							<input
								type="text"
								value={url!}
								readOnly
								className="bg-transparent text-zinc-300 text-sm flex-1 outline-none"
							/>
							<button
								onClick={() => navigator.clipboard.writeText(url!)}
								className="text-zinc-400 hover:text-white"
							>
								<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
									<path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
									<path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
								</svg>
							</button>
						</div>
						<button
							onClick={onClose}
							className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg w-full"
						>
							Done
						</button>
					</>
				)}
				{status === 'error' && (
					<>
						<h3 className="text-lg font-medium text-red-500">Deployment Failed</h3>
						<p className="text-zinc-400 text-sm mt-2">
							{errorMessage || 'Something went wrong during deployment. Please check the logs and try again.'}
						</p>
						<button
							onClick={onClose}
							className="mt-4 bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-4 rounded-lg w-full"
						>
							Close
						</button>
					</>
				)}
			</motion.div>
		</div>
	);
}

interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: Date;
	isThinking?: boolean;
}

export default function BuilderPage() {
	const searchParams = useSearchParams();
	const jobId = searchParams.get("jobId") || "";

	const [chatValue, setChatValue] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [jobStatus, setJobStatus] = useState("building");
	const [progress, setProgress] = useState(0);
	const [activeView, setActiveView] = useState<"preview" | "code">("preview");
	
	const store = useBuilderStore(jobId);
	const files = useHydratedStore(store, (state) => state.files) as FileItem[] | undefined;
    const activeFile = useHydratedStore(store, (state) => state.activeFile) as FileItem | null | undefined;
    const openFiles = useHydratedStore(store, (state) => state.openFiles) as FileItem[] | undefined;
	
	const {
		setFiles,
		setActiveFile,
		addOpenFile,
		closeOpenFile,
		updateFileContent
	} = store();

	const [isSidebarVisible, setIsSidebarVisible] = useState(true);
	const [isGenerating, setIsGenerating] = useState(true);
	const [selectedModel, setSelectedModel] = useState("gemini-1.5-pro");
	const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
	const [isDeploying, setIsDeploying] = useState(false);
	const [deploymentStatus, setDeploymentStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle');
	const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
	const [hasBeenDeployed, setHasBeenDeployed] = useState(false);
	const [deploymentError, setDeploymentError] = useState<string | null>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const chatEndRef = useRef<HTMLDivElement>(null);
    const terminalInstance = useRef<Terminal | null>(null);

    // Initialize the terminal instance on the client side
    useEffect(() => {
        if (!terminalInstance.current && typeof window !== 'undefined') {
            import('xterm').then(xterm => {
                terminalInstance.current = new xterm.Terminal({ convertEol: true });
            });
        }
    }, []);

	// Convert file tree to the format WebContainer expects
    const getWebContainerFiles = (items: FileItem[]): FileSystemTree => {
        const fileTree: FileSystemTree = {};

        const addFileToTree = (path: string, content: string) => {
            const parts = path.replace(/\\/g, '/').split('/');
            let current: FileSystemTree = fileTree;
            parts.forEach((part, index) => {
                if (index === parts.length - 1) {
                    current[part] = { file: { contents: content } };
                } else {
                    if (!current[part]) {
                        current[part] = { directory: {} };
                    }
                    const nextNode = current[part];
                    if ('file' in nextNode) {
                        // This case should not happen in a well-formed file structure
                        return;
                    }
                    current = nextNode.directory;
                }
            });
        };

        const traverse = (items: FileItem[]) => {
            for (const item of items) {
                if (item.type === 'file' && item.path) {
                    addFileToTree(item.path, item.content || '');
                } else if (item.type === 'folder' && item.children) {
                    traverse(item.children);
                }
            }
        };

        traverse(items);
        return fileTree;
    };

    const webContainerFiles = useMemo(() => {
        if (!Array.isArray(files) || files.length === 0) {
            return {};
        }
        return getWebContainerFiles(files);
    }, [files]);

	const handleFileSelect = (file: FileItem) => {
		if (file.type === "file") {
			setActiveFile(file);
			addOpenFile(file);
		}
	};

	const handleFileClose = (fileId: string) => {
		closeOpenFile(fileId);
	};

	const handleFileContentChange = (fileId: string, newContent: string) => {
		updateFileContent(fileId, newContent);
	};

    const handleFileSystemUpdate = (path: string, content: string) => {
        const fileExists = Array.isArray(files) && files.some(file => file.path === path);
        if (fileExists) {
            handleFileContentChange(path, content);
        } else {
            const newFile: FileItem = {
                id: path,
                name: path.split('/').pop() || path,
                type: 'file',
                path: path,
                content: content,
                language: getLanguageFromExtension(path),
            };
            setFiles([...(Array.isArray(files) ? files : []), newFile]);
        }
    };

	const getLanguageFromExtension = (filename: string): string => {
		const extension = filename.split('.').pop()?.toLowerCase();
		switch (extension) {
			case 'js':
			case 'jsx':
				return 'javascript';
			case 'ts':
			case 'tsx':
				return 'typescript';
			case 'css':
				return 'css';
			case 'json':
				return 'json';
			case 'html':
				return 'html';
			case 'md':
				return 'markdown';
			default:
				return 'plaintext';
		}
	};

	// Fetch job status and files on load
	useEffect(() => {
		if (!jobId) return;

        const fetchFiles = async () => {
            try {
                console.log("🔄 Fetching files for job:", jobId);
                const response = await fetch(`/api/v1/job/${jobId}/files`, { cache: 'no-store' });
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("❌ Failed to fetch files:", response.status, errorText);
                    throw new Error(`Failed to fetch files: ${response.status}`);
                }
                let { files: fetchedFiles } = await response.json();
                console.log("✅ Files fetched successfully:", fetchedFiles.length, "items");
                const addLanguageToFiles = (items: FileItem[]): FileItem[] => {
                    return items.map(item => {
                        if (item.type === 'file') {
                            return { ...item, language: getLanguageFromExtension(item.name) };
                        }
                        if (item.children) {
                            return { ...item, children: addLanguageToFiles(item.children) };
                        }
                        return item;
                    });
                };
                fetchedFiles = addLanguageToFiles(fetchedFiles);
                setFiles(fetchedFiles);
                setIsGenerating(false);
                setIsLoading(false);
                setChatMessages(prev => [...prev, {
                    id: `generation-complete-${Date.now()}`,
                    role: 'assistant',
                    content: '✨ Your app is ready! I\'ve generated all the code based on your requirements. Feel free to ask me to make any changes!',
                    timestamp: new Date(),
                }]);
            } catch (error) {
                console.error("❌ Error fetching files:", error);
                setIsGenerating(false);
                setIsLoading(false);
                setChatMessages(prev => [...prev, {
                    id: 'fetch-failed',
                    role: 'assistant',
                    content: '❌ Sorry, I had trouble loading the generated files. Please refresh the page.',
                    timestamp: new Date(),
                }]);
            }
        };

		const pollStatus = async () => {
			try {
				const response = await fetch(`/api/v1/job/${jobId}`);
				if (response.ok) {
					const data = await response.json();
					console.log(`📊 Job status poll: ${data.status}, filesReady: ${data.filesReady}`);
					setJobStatus(data.status);
					if (data.prompt && chatMessages.length === 0) {
						setChatMessages([
							{
								id: 'initial-prompt',
								role: 'user',
								content: data.prompt,
								timestamp: new Date(data.createdAt || Date.now()),
							}
						]);
					}
                    if (data.status === 'generated') {
						console.log('✅ Status is generated! Fetching files...');
                        await fetchFiles();
                        return true;
                    }
					if (data.status === 'failed') {
						setIsLoading(false);
						setIsGenerating(false);
						setChatMessages(prev => [...prev, {
							id: `generation-failed-${Date.now()}`,
							role: 'assistant',
							content: '❌ Sorry, something went wrong while generating your app. Please try again or let me know if you need help.',
							timestamp: new Date(),
						}]);
                        return true;
					}
				}
			} catch (error) {
				console.error("Failed to fetch job status:", error);
                return true;
			}
            return false;
		};

		const intervalId = setInterval(async () => {
            const shouldStop = await pollStatus();
            if (shouldStop) {
                clearInterval(intervalId);
            }
        }, 2500);
        pollStatus();
		return () => clearInterval(intervalId);
	}, [jobId]);

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [chatMessages, isLoading]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsModelDropdownOpen(false);
			}
		};
		if (isModelDropdownOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isModelDropdownOpen]);

	const handleChatSubmit = async () => {
		if (!chatValue.trim()) return;

		const userMessage: ChatMessage = {
			id: `user-${Date.now()}`,
			role: 'user',
			content: chatValue,
			timestamp: new Date(),
		};
		setChatMessages(prev => [...prev, userMessage]);
		setChatValue("");
		setIsLoading(true);
		const assistantId = `ai-${Date.now()}`;
		const thinkingMessage: ChatMessage = {
			id: assistantId,
			role: 'assistant',
			content: '',
			timestamp: new Date(),
			isThinking: true,
		};
		setChatMessages(prev => [...prev, thinkingMessage]);

		try {
			const response = await fetch('/api/v1/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message: userMessage.content,
					files: Array.isArray(files) ? files : [], 
					activeFileId: activeFile?.id ?? null,
					model: selectedModel,
				}),
			});

			if (!response.ok || !response.body) {
				throw new Error('Failed to get streaming response');
			}
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let fullResponse = "";
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				const chunk = decoder.decode(value, { stream: true });
				fullResponse += chunk;
				setChatMessages(prev => prev.map(msg => 
					msg.id === assistantId ? { ...msg, content: fullResponse } : msg
				));
			}
			const finalJson = JSON.parse(fullResponse);
			setChatMessages(prev => prev.map(msg => 
				msg.id === assistantId ? { 
					...msg, 
					isThinking: false,
					content: finalJson.explanation || 'I have updated the code for you!',
				} : msg
			));
			if (finalJson.responseType === 'modification' && finalJson.modifiedCode && finalJson.fileId) {
				updateFileContent(finalJson.fileId, finalJson.modifiedCode);
				const findFileById = (items: FileItem[], id: string): FileItem | null => {
					for (const item of items) {
						if (item.id === id) return item;
						if (item.children) {
							const found = findFileById(item.children, id);
							if (found) return found;
						}
					}
					return null;
				};

				const modifiedFile = findFileById(files || [], finalJson.fileId);
				if (modifiedFile) {
					setActiveFile(modifiedFile);
					addOpenFile(modifiedFile);
				}
			}
		} catch (error) {
			console.error("Failed to process stream:", error);
			setChatMessages(prev => prev.map(msg => 
				msg.id === assistantId ? { 
					...msg, 
					isThinking: false,
					content: 'Sorry, I encountered an error. Please try again.',
				} : msg
			));
		} finally {
			setIsLoading(false);
		}
	};

	const handleCopyCode = () => {
		if (activeFile?.content) {
			navigator.clipboard.writeText(activeFile.content);
		}
	};

	const ModelSelector = () => {
		const selectedModelData = AI_MODELS.find(model => model.id === selectedModel);
		return (
			<div className="relative" ref={dropdownRef}>
				<button
					onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
					className="flex items-center gap-2 px-3 py-1.5 text-xs transition-colors min-w-[100px]"
				>
					<span className="text-zinc-300 hover:text-white truncate">{selectedModelData?.name}</span>
					{isModelDropdownOpen ? (
						<ChevronUp className="w-3 h-3 text-zinc-400 flex-shrink-0" />
					) : (
						<ChevronDown className="w-3 h-3 text-zinc-400 flex-shrink-0" />
					)}
				</button>
				{isModelDropdownOpen && (
					<div className="absolute bottom-full mb-2 left-0 w-full bg-zinc-800 border border-white/10 rounded-lg shadow-lg z-50">
						{AI_MODELS.map((model) => (
							<button
								key={model.id}
								onClick={() => {
									setSelectedModel(model.id);
									setIsModelDropdownOpen(false);
								}}
								className={`w-full px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors first:rounded-t-lg last:rounded-b-lg ${
									selectedModel === model.id ? 'bg-white/10 text-white' : 'text-zinc-300'
								}`}
							>
								<div className="font-medium truncate">{model.name}</div>
								<div className="text-zinc-500 text-[10px] truncate">{model.description}</div>
							</button>
						))}
					</div>
				)}
			</div>
		);
	};

	return (
		<div className="h-screen w-screen flex bg-[#1c1b1c] overflow-hidden">
			<div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.1),_transparent_45%),_radial_gradient(circle_at_bottom,_rgba(236,72,153,0.05),_transparent_40%)] pointer-events-none" />
			<div className="flex-1 flex flex-col backdrop-blur-sm">
				<div className="flex items-center justify-between p-4 border-b border-white/10">
					<h2 className="text-sm font-semibold text-white">
						{activeView === "preview" ? "Preview" : "Code Editor"}
					</h2>
					<div className="flex items-center relative right-10">
						<ViewToggle activeView={activeView} setActiveView={setActiveView}  />
						<RainbowButton
							onClick={async () => {
								if (!jobId || isDeploying) return;
								setIsDeploying(true);
								setDeploymentStatus('deploying');
								try {
									const response = await fetch(`/api/v1/job/${jobId}/deploy`, { method: 'POST' });
									if (response.ok) {
										const pollDeployStatus = setInterval(async () => {
											const statusRes = await fetch(`/api/v1/job/${jobId}`);
											if (statusRes.ok) {
												const data = await statusRes.json();
												if (data.status === 'deployed') {
													clearInterval(pollDeployStatus);
													setIsDeploying(false);
													setDeploymentStatus('success');
													setDeployedUrl(data.deployment.url);
													setHasBeenDeployed(true);
												} else if (data.status === 'failed') {
													clearInterval(pollDeployStatus);
													setIsDeploying(false);
													setDeploymentStatus('error');
													setDeploymentError(data.deployment?.error || 'An unknown error occurred.');
												}
											}
										}, 3000);
									} else {
										throw new Error('Failed to start deployment');
									}
								} catch (error) {
									console.error('Deploy error:', error);
									setIsDeploying(false);
									setDeploymentStatus('error');
								}
							}}
							disabled={isDeploying || !jobId}
							title="Deploy your app"
							className="h-8 px-4 py-1 text-xs rounded-md active:scale-95 active:brightness-110"
						>
							<Rocket className={`w-3 h-3 mr-1 transition-transform duration-200 ${isDeploying ? 'animate-bounce' : 'group-hover:translate-x-0.5 group-hover:-translate-y-0.5'}`} />
							{isDeploying ? 'Deploying...' : hasBeenDeployed ? 'Publish' : 'Deploy'}
						</RainbowButton>
					</div>
				</div>

				<div className="flex-1 overflow-hidden relative">
					<AnimatePresence mode="wait">
						<motion.div
							key="preview"
							initial={{ x: activeView === "preview" ? 0 : "-100%" }}
							animate={{ x: activeView === "preview" ? 0 : "-100%" }}
							exit={{ x: "-100%" }}
							transition={{ type: "spring", stiffness: 300, damping: 30 }}
							className="absolute inset-0 p-4"
						>
							<div className="w-full h-full rounded-lg border border-white/10 bg-white overflow-hidden">
								{isGenerating ? (
									<div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-pink-50">
										<div className="relative">
										<div className="flex items-center justify-center w-24 h-24 mb-6">
										<span className="text-6xl animate-fire-glow">🔥</span>
										</div>
										<style jsx>{`
										@keyframes fire-glow {
											0%, 100% { filter: drop-shadow(0 0 6px rgba(255, 140, 0, 0.8)) drop-shadow(0 0 12px rgba(255, 69, 0, 0.6)) drop-shadow(0 0 18px rgba(255, 0, 0, 0.4)); }
											50% { filter: drop-shadow(0 0 10px rgba(255, 200, 0, 1)) drop-shadow(0 0 20px rgba(255, 120, 0, 0.8)) drop-shadow(0 0 30px rgba(255, 0, 0, 0.6)); }
										}
										.animate-fire-glow { animation: fire-glow 1.8s ease-in-out infinite; }
										`}</style>
										</div>
										<h2 className="text-2xl font-bold text-gray-800 mb-2">
											Flames is cooking your App
										</h2>
										<p className="text-gray-600 text-center max-w-md px-4">
											Our AI chef is preparing your custom application.
										</p>
									</div>
								) : (
									<WebContainerPreview 
										files={webContainerFiles}
										onFileSystemUpdate={handleFileSystemUpdate}
										terminal={terminalInstance.current}
									/>
								)}
							</div>
						</motion.div>

						<motion.div
							key="code"
							initial={{ x: activeView === "code" ? 0 : "100%" }}
							animate={{ x: activeView === "code" ? 0 : "100%" }}
							exit={{ x: "100%" }}
							transition={{ type: "spring", stiffness: 300, damping: 30 }}
							className="absolute inset-0 flex bg-zinc-900"
						>
							<div className="w-64 flex flex-col border-r border-zinc-800 bg-zinc-900">
								<div className="p-4 border-b border-zinc-800">
									<h2 className="text-xs font-semibold text-zinc-400 uppercase">Explorer</h2>
								</div>
								{isGenerating ? (
									<div className="flex-1 flex items-center justify-center p-4">
										<div className="text-center">
											<div className="w-12 h-12 mx-auto mb-3 relative">
												<div className="absolute inset-0 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
											</div>
											<p className="text-zinc-500 text-xs">Loading files...</p>
										</div>
									</div>
								) : (
									<FileExplorer 
										files={files || []}
										activeFileId={activeFile?.id || null}
										onFileSelect={handleFileSelect}
									/>
								)}
							</div>

							<div className="flex-1 flex flex-col overflow-hidden">
								<div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
									{isGenerating ? (
										<div className="flex-1 flex items-center justify-center">
											<div className="text-center">
												<div className="w-16 h-16 mx-auto mb-4 relative">
													<div className="absolute inset-0 border-4 border-zinc-700 border-t-orange-500 rounded-full animate-spin" />
												</div>
												<p className="text-zinc-400 text-sm">Generating code files...</p>
											</div>
										</div>
									) : (
										<>
											<div className="flex items-center border-b border-zinc-800 bg-[#252526]">
												<div className="flex-1 flex overflow-x-auto">
													{openFiles?.map(file => (
														<div
															key={file.id}
															className={`flex items-center gap-2 px-3 py-2 border-r border-zinc-800 cursor-pointer ${
																activeFile?.id === file.id 
																	? 'bg-[#1e1e1e] text-white' 
																	: 'bg-[#2d2d30] text-zinc-400 hover:bg-[#1e1e1e]'
															}`}
															onClick={() => setActiveFile(file)}
														>
															<span className="text-xs">{file.name}</span>
															<button
																onClick={(e) => { e.stopPropagation(); handleFileClose(file.id); }}
																className="hover:bg-zinc-700 rounded p-0.5"
															>
																<X className="w-3 h-3" />
															</button>
														</div>
													))}
												</div>
											</div>

											{activeFile ? (
												<div className="flex-1 overflow-hidden">
													<MonacoEditor
														height="100%"
														language={activeFile.language || "javascript"}
														theme="vs-dark"
														value={activeFile.content}
														onChange={(value) => handleFileContentChange(activeFile.id, value || "")}
														options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 16 }, automaticLayout: true }}
													/>
												</div>
											) : (
												<div className="flex-1 flex items-center justify-center">
													<p className="text-zinc-500 text-sm">Select a file to edit</p>
												</div>
											)}
										</>
									)}
								</div>
								<div className="h-48 border-t border-zinc-800">
									{terminalInstance.current && <TerminalPanel terminal={terminalInstance.current} />}
								</div>
							</div>
					</motion.div>
				</AnimatePresence>
				</div>
			</div>

			<motion.div 
				initial={{ width: 320 }}
				animate={{ width: isSidebarVisible ? 320 : 0 }}
				transition={{ type: "spring", stiffness: 300, damping: 30 }}
				className="flex flex-col border-l border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl overflow-hidden rounded-l-2xl"
			>
				{/* Header */}
				<div className="p-[12px] border-b border-white/10">
					<h2 className="text-sm font-semibold text-white">AI Assistant</h2>
					<p className="text-xs text-zinc-400 mt-1">Ask me to modify your app</p>
				</div>

				{/* Chat Area */}
				<div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
					{/* Messages Display */}
					<div className="flex-1 overflow-y-auto space-y-4 pr-2">
						{chatMessages.map((message) => (
							<div 
								key={message.id} 
								className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
							>
								<div 
									className={`rounded-lg px-4 py-2 text-sm border max-w-xs transition-opacity duration-300 ${
										message.isThinking ? 'opacity-50' : 'opacity-100'
									} ${
										message.role === 'user' 
											? 'bg-blue-600/20 border-blue-500/30 text-zinc-100 rounded-br-none' 
											: 'bg-white/10 border-white/10 text-zinc-300 rounded-bl-none'
									}`}
								>
									{message.role === 'assistant' ? (
										<TextGenerateEffect 
											words={message.content}
											duration={0.3}
											filter={false}
											className="text-sm"
										/>
									) : (
										message.content
									)}
								</div>
							</div>
						))}
						
						{/* Loading animation when AI is thinking */}
						{isLoading && (
							<div className="flex justify-start">
								<div className="bg-white/10 rounded-lg rounded-bl-none px-4 py-3 border border-white/10">
									<div className="flex gap-2">
										<div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
										<div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-100" />
										<div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-200" />
									</div>
								</div>
							</div>
						)}
						
						{/* Auto-scroll anchor */}
						<div ref={chatEndRef} />
					</div>

					{/* Chat Input */}
					<BuilderInput
						variant="default"
						value={chatValue}
						onChange={(e) => setChatValue(e.target.value)}
						onSubmit={handleChatSubmit}
						loading={isLoading}
						onStop={() => setIsLoading(false)}
						rows={1}
						className="!bg-white/5 !border-white/10 !rounded-lg !p-3"
					>
						<BuilderInputTextArea
							placeholder="Ask me to modify your app..."
							className="!bg-transparent !border-none !text-zinc-100 !placeholder:text-zinc-500 !text-xs !py-1 !px-2 !min-h-fit"
						/>

						<div className="flex items-center justify-between gap-2 mt-2">
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => {
										const input = document.createElement('input');
										input.type = 'file';
										input.accept = 'image/*';
										input.onchange = (e) => {
											const file = (e.target as HTMLInputElement).files?.[0];
											if (file) {
												console.log('File selected:', file.name);
											}
										};
										input.click();
									}}
									className="p-1.5 hover:bg-white/10 rounded-md transition-colors group"
									title="Upload screenshot"
								>
									<Plus className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200" />
								</button>
								<ModelSelector />
							</div>
							<BuilderInputSubmit/>
						</div>
					</BuilderInput>
				</div>
			</motion.div>

            {/* Fixed Toggle Button */}
			<button
				onClick={() => setIsSidebarVisible(!isSidebarVisible)}
				className="fixed top-[17px] right-4 z-50 p-1 hover:bg-white/10 rounded-lg transition-colors"
				title={isSidebarVisible ? "Close sidebar" : "Open sidebar"}
			>
				{isSidebarVisible ? (
					<PanelRight className="w-5 h-5 text-zinc-400 hover:text-zinc-200" />
				) : (
					<PanelLeft className="w-5 h-5 text-zinc-400 hover:text-zinc-200" />
				)}
			</button>

			{deploymentStatus !== 'idle' && (
				<DeploymentModal
					status={deploymentStatus}
					url={deployedUrl}
					onClose={() => {
						setDeploymentStatus('idle');
						setDeploymentError(null);
					}}
					errorMessage={deploymentError}
				/>
			)}
		</div>
	);
}
