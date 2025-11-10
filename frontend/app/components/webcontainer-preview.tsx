"use client";

import { WebContainer } from '@webcontainer/api';
import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import { getCache, setCache } from '@/lib/idb-cache';

// Simple hash function for creating a key from package.json
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    }
    return hash.toString();
}

interface FileSystemTree {
    [name: string]: { file: { contents: string } } | { directory: FileSystemTree };
}

interface WebContainerPreviewProps {
    files: FileSystemTree;
    onFileSystemUpdate: (path: string, content: string) => void;
    terminal: Terminal | null;
    className?: string;
}

const CACHE_KEY_PREFIX = 'node_modules_cache_';

export function WebContainerPreview({ files, onFileSystemUpdate, terminal, className }: WebContainerPreviewProps) {
    const webcontainerInstance = useRef<WebContainer | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [serverUrl, setServerUrl] = useState<string | null>(null);
    const [isBooted, setIsBooted] = useState(false);
    const isRunning = useRef(false);

    useEffect(() => {
        if (webcontainerInstance.current) return;

        const bootWebContainer = async () => {
            try {
                if (terminal) terminal.writeln('Booting WebContainer...');
                const wc = await WebContainer.boot();
                webcontainerInstance.current = wc;

                wc.on('server-ready', (port, url) => {
                    console.log(`Server ready at ${url}`);
                    setServerUrl(url);
                    if (terminal) terminal.writeln(`✅ Live preview ready at ${url}`);
                });

                wc.on('error', ({ message }) => {
                    console.error('WebContainer error:', message);
                    if (terminal) terminal.writeln(`❌ WebContainer error: ${message}`);
                });

                setIsBooted(true);
            } catch (error) {
                console.error("WebContainer boot error:", error);
                if (terminal) terminal.writeln(`❌ Boot error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        };

        bootWebContainer();
    }, [terminal]);

    useEffect(() => {
        if (!isBooted || !files || Object.keys(files).length === 0 || isRunning.current) {
            return;
        }

        const runProcess = async () => {
            isRunning.current = true;
            const wc = webcontainerInstance.current;
            if (!wc || !terminal) {
                isRunning.current = false;
                return;
            }

            try {
                terminal.reset();
                terminal.writeln('🚀 Initializing development environment...');
                terminal.writeln('📦 Mounting files...');
                await wc.mount(files);
                terminal.writeln('✅ Files mounted.');

                const packageJson = await wc.fs.readFile('package.json', 'utf-8');
                const packageHash = simpleHash(packageJson);
                const cacheKey = `${CACHE_KEY_PREFIX}${packageHash}`;

                const cachedNodeModules = await getCache<Uint8Array>(cacheKey);

                if (cachedNodeModules) {
                    terminal.writeln('\n✅ Found cached dependencies in browser storage.');
                    terminal.writeln('📦 Unpacking...');
                    await wc.fs.writeFile('node_modules.tar.gz', cachedNodeModules);
                    const unpackProcess = await wc.spawn('tar', ['-xzf', 'node_modules.tar.gz']);
                    unpackProcess.output.pipeTo(new WritableStream({ write(data) { terminal.write(data); } }));
                    const exitCode = await unpackProcess.exit;
                    if (exitCode !== 0) {
                        terminal.writeln('❌ Failed to unpack cached dependencies. Running fresh install...');
                        await runNpmInstall(wc, terminal, onFileSystemUpdate);
                    } else {
                        terminal.writeln('✅ Dependencies restored from cache.');
                    }
                    await wc.fs.rm('node_modules.tar.gz');
                } else {
                    terminal.writeln('\nℹ️ No cached dependencies found. Starting fresh install...');
                    await runNpmInstall(wc, terminal, onFileSystemUpdate, cacheKey);
                }

                terminal.writeln('\n> npm run dev');
                const serverProcess = await wc.spawn('npm', ['run', 'dev']);
                serverProcess.output.pipeTo(new WritableStream({ write(data) { terminal.write(data); } }));

            } catch (error) {
                console.error("WebContainer run error:", error);
                terminal.writeln(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                isRunning.current = false;
            }
        };
        
        runProcess();

    }, [files, isBooted, terminal, onFileSystemUpdate]);

    return (
        <div className={`w-full h-full flex flex-col bg-white text-black ${className || ''}`}>
            {serverUrl ? (
                <iframe
                    ref={iframeRef}
                    src={serverUrl}
                    className="w-full h-full border-none"
                    title="WebContainer Preview"
                />
            ) : (
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
                        Booting Environment...
                    </h2>
                    <p className="text-gray-600 text-center max-w-md px-4">
                        Logs will appear in the terminal below the code editor.
                    </p>
                </div>
            )}
        </div>
    );
}

async function runNpmInstall(
    wc: WebContainer, 
    terminal: Terminal, 
    onFileSystemUpdate: (path: string, content: string) => void,
    cacheKey?: string
) {
    terminal.writeln('\n> npm install');
    const installProcess = await wc.spawn('npm', ['install']);
    installProcess.output.pipeTo(new WritableStream({ write(data) { terminal.write(data); } }));
    const exitCode = await installProcess.exit;
    if (exitCode !== 0) throw new Error(`npm install failed with exit code ${exitCode}`);
    terminal.writeln('✅ Dependencies installed.');

    try {
        const lockFileContent = await wc.fs.readFile('package-lock.json', 'utf-8');
        onFileSystemUpdate('package-lock.json', lockFileContent);
        terminal.writeln('📄 Synced package-lock.json.');
    } catch (readError) {
        terminal.writeln('⚠️ Could not read package-lock.json.');
    }

    if (cacheKey) {
        terminal.writeln('\n💾 Caching dependencies to browser storage...');
        const packProcess = await wc.spawn('tar', ['-czf', 'node_modules.tar.gz', 'node_modules']);
        const packExitCode = await packProcess.exit;
        if (packExitCode !== 0) {
            terminal.writeln(`❌ Failed to create node_modules.tar.gz (exit code: ${packExitCode}). Skipping cache.`);
            return; // Do not proceed with caching if tar failed
        }
        terminal.writeln('📦 node_modules.tar.gz created.');

        // Verify file existence before reading
        const rootFiles = await wc.fs.readdir('/');
        if (!rootFiles.includes('node_modules.tar.gz')) {
            terminal.writeln('❌ Error: node_modules.tar.gz not found in root after creation. Skipping cache.');
            return;
        }

        const packedData = await wc.fs.readFile('node_modules.tar.gz');
        await setCache(cacheKey, packedData);
        
        await wc.fs.rm('node_modules.tar.gz');
        terminal.writeln('✅ Dependencies cached.');
    }
}
