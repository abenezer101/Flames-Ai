import fetch from 'node-fetch';
import * as fs from 'fs/promises';
import * as path from 'path';

interface FileItem {
    filePath: string;
    action: {
        newContent: string;
    };
}

interface VectorIndex {
    [filePath: string]: number[];
}

function cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) {
        return 0;
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const getWorkDir = (jobId: string) => path.join(__dirname, `../../temp_work/${jobId}`);
const getIndexPath = (jobId: string) => path.join(getWorkDir(jobId), '.flames', 'index.json');

const HF_API_KEY = process.env.HF_API_KEY;
const EMBEDDING_MODEL_URL = 'https://router.huggingface.co/hf-inference/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2';

async function getEmbeddings(texts: string[]): Promise<number[][]> {
    if (!HF_API_KEY) {
        throw new Error("HF_API_KEY environment variable not set.");
    }
    try {
        const response = await fetch(
            EMBEDDING_MODEL_URL,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HF_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: texts,
                    options: {
                        wait_for_model: true
                    }
                })
            }
        );

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Hugging Face API Error Response:", {
                status: response.status,
                statusText: response.statusText,
                body: errorBody,
            });
            throw new Error(`Hugging Face API request failed with status ${response.status}`);
        }

        const embeddings = await response.json();
        return embeddings as number[][];

    } catch (error: any) {
        console.error("Error during fetch to Hugging Face:", error);
        throw new Error("Failed to get embeddings.");
    }
}


async function ensureIndexDirExists(jobId: string): Promise<void> {
    const dirPath = path.dirname(getIndexPath(jobId));
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, { recursive: true });
    }
}

export async function generateAndStoreEmbeddings(jobId: string, files: FileItem[]): Promise<void> {
    console.log(`[Indexing] Starting embedding generation for job ${jobId}`);
    
    // 1. Filter out files with no content to avoid sending empty data to the API
    const filesWithContent = files.filter(file => file.action.newContent && file.action.newContent.trim() !== '');

    if (filesWithContent.length === 0) {
        console.log("[Indexing] No new content to embed. Skipping.");
        return;
    }
    
    const contents = filesWithContent.map(file => file.action.newContent);
    const vectors = await getEmbeddings(contents);

    const newIndex: VectorIndex = {};
    filesWithContent.forEach((file, i) => {
        newIndex[file.filePath] = vectors[i];
    });

    await ensureIndexDirExists(jobId);
    const indexPath = getIndexPath(jobId);

    // 2. Merge with existing index if it exists, otherwise create a new one
    try {
        const existingIndexData = await fs.readFile(indexPath, 'utf-8');
        const existingIndex = JSON.parse(existingIndexData);
        Object.assign(existingIndex, newIndex); // Merge new vectors, overwriting if files changed
        await fs.writeFile(indexPath, JSON.stringify(existingIndex, null, 2));
        console.log(`[Indexing] Updated embeddings for ${filesWithContent.length} files in ${indexPath}`);
    } catch (error) {
        // index.json doesn't exist, so write the new one
        await fs.writeFile(indexPath, JSON.stringify(newIndex, null, 2));
        console.log(`[Indexing] Stored initial embeddings for ${filesWithContent.length} files in ${indexPath}`);
    }
}

export async function retrieveRelevantChunks(jobId: string, query: string, topK = 5): Promise<string[]> {
    console.log(`[Indexing] Retrieving relevant chunks for query: "${query}"`);
    const indexPath = getIndexPath(jobId);
    
    let index: VectorIndex;
    try {
        const indexData = await fs.readFile(indexPath, 'utf-8');
        index = JSON.parse(indexData);
    } catch (error) {
        console.error(`[Indexing] Failed to load index for job ${jobId}. Has it been generated?`, error);
        return [];
    }

    const [queryVector] = await getEmbeddings([query]);

    const similarities = Object.entries(index).map(([filePath, vector]) => ({
        filePath,
        similarity: cosineSimilarity(queryVector, vector),
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);

    const topKFiles = similarities.slice(0, topK);
    console.log(`[Indexing] Top ${topK} relevant files:`, topKFiles.map(f => f.filePath));

    const workDir = getWorkDir(jobId);
    const relevantContents = await Promise.all(
        topKFiles.map(async file => {
            const content = await fs.readFile(path.join(workDir, file.filePath), 'utf-8');
            return `--- FILE: ${file.filePath} ---\n${content}`;
        })
    );

    return relevantContents;
}
