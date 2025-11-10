import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface FileItem {
	id: string;
	name: string;
	type: "file" | "folder";
	content?: string;
	language?: string;
	children?: FileItem[];
	path: string;
}

interface BuilderState {
    files: FileItem[];
    activeFile: FileItem | null;
    openFiles: FileItem[];
    setFiles: (files: FileItem[]) => void;
    setActiveFile: (file: FileItem | null) => void;
    setOpenFiles: (files: FileItem[]) => void;
    addOpenFile: (file: FileItem) => void;
    closeOpenFile: (fileId: string) => void;
    updateFileContent: (fileId: string, content: string) => void;
}

const storeMap = new Map<string, ReturnType<typeof createStore>>();

const createStore = (jobId: string) => {
    return create<BuilderState>()(
        persist(
            (set, get) => ({
                files: [],
                activeFile: null,
                openFiles: [],
                setFiles: (files) => set({ files }),
                setActiveFile: (file) => set({ activeFile: file }),
                setOpenFiles: (files) => set({ openFiles: files }),
                addOpenFile: (file) => {
                    if (!get().openFiles.find(f => f.id === file.id)) {
                        set(state => ({ openFiles: [...state.openFiles, file] }));
                    }
                },
                closeOpenFile: (fileId) => {
                    const newOpenFiles = get().openFiles.filter(f => f.id !== fileId);
                    set({ openFiles: newOpenFiles });

                    if (get().activeFile?.id === fileId) {
                        set({ activeFile: newOpenFiles[0] || null });
                    }
                },
                updateFileContent: (fileId, newContent) => {
                    const updateRecursive = (items: FileItem[]): FileItem[] => {
                        return items.map(item => {
                            if (item.id === fileId) {
                                return { ...item, content: newContent };
                            }
                            if (item.children) {
                                return { ...item, children: updateRecursive(item.children) };
                            }
                            return item;
                        });
                    };
                    set(state => ({ files: updateRecursive(state.files) }));
                },
            }),
            {
                name: `builder-storage-${jobId}`, 
                storage: createJSONStorage(() => localStorage),
            }
        )
    )
};

export const useBuilderStore = (jobId: string) => {
    if (!jobId) {
        // Return a non-persistent, dummy store if there's no jobId
        return create<BuilderState>(() => ({
            files: [],
            activeFile: null,
            openFiles: [],
            setFiles: () => {},
            setActiveFile: () => {},
            setOpenFiles: () => {},
            addOpenFile: () => {},
            closeOpenFile: () => {},
            updateFileContent: () => {},
        }));
    }
    
    if (!storeMap.has(jobId)) {
        storeMap.set(jobId, createStore(jobId));
    }
    return storeMap.get(jobId)!;
};

import { useState, useEffect } from 'react';

export const useHydratedStore = <T, F>(
    store: (callback: (state: T) => F) => F,
    callback: (state: T) => F
) => {
    const result = store(callback);
    const [data, setData] = useState<F>();

    useEffect(() => {
        setData(result);
    }, [result]);

    return data ?? result;
};
