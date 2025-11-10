import { Request, Response } from 'express';
import { Storage } from '@google-cloud/storage';
import { Firestore } from '@google-cloud/firestore';
import * as tar from 'tar';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
});

const firestore = new Firestore({
    projectId: process.env.GCP_PROJECT_ID,
});

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'flames-generated-apps';

/**
 * Fetch generated files for a job and return them as JSON
 */
export const getGeneratedFiles = async (req: Request, res: Response) => {
    const { jobId } = req.params;

    if (!jobId) {
        return res.status(400).json({ error: 'Job ID is required' });
    }

    try {
        // The definitive source of truth is the local temp directory
        // where the files were generated and indexed.
        const workDir = path.join(__dirname, `../../../temp_work/${jobId}`);

        // Check if the directory exists
        try {
            await fs.access(workDir);
        } catch (error) {
            // This can happen if the server restarted or the temp dir was cleaned up.
            // We should ideally fall back to GCS, but for simplicity, we'll just error for now.
             console.error(`Work directory not found for job ${jobId}. It might have been cleaned up.`);
            return res.status(404).json({ 
                error: 'Generated files not found. They may have been cleaned up by the server. Please generate the project again.' 
            });
        }
        
        // Read all files recursively from the local work directory
        const files = await readDirectoryRecursive(workDir, workDir);

        res.json({ files });

    } catch (error) {
        console.error('Failed to fetch generated files:', error);
        res.status(500).json({ 
            error: 'Failed to fetch generated files',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Recursively read directory and build file tree
 */
async function readDirectoryRecursive(dirPath: string, basePath: string): Promise<any[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: any[] = [];

    for (const entry of entries) {
        // Skip node_modules, but allow dotfiles like .flames
        if (entry.name === 'node_modules') {
            continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
            const children = await readDirectoryRecursive(fullPath, basePath);
            files.push({
                id: relativePath,
                name: entry.name,
                type: 'folder',
                path: `/${relativePath}`,
                children,
            });
        } else {
            const content = await fs.readFile(fullPath, 'utf-8');
            const ext = path.extname(entry.name).toLowerCase();
            const language = getLanguageFromExtension(ext);

            files.push({
                id: relativePath,
                name: entry.name,
                type: 'file',
                path: `/${relativePath}`,
                content,
                language,
            });
        }
    }

    return files;
}

/**
 * Map file extension to Monaco editor language
 */
function getLanguageFromExtension(ext: string): string {
    const languageMap: Record<string, string> = {
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.json': 'json',
        '.css': 'css',
        '.scss': 'scss',
        '.html': 'html',
        '.md': 'markdown',
        '.py': 'python',
        '.yml': 'yaml',
        '.yaml': 'yaml',
        '.xml': 'xml',
        '.sh': 'shell',
    };

    return languageMap[ext] || 'plaintext';
}

