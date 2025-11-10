import { GenerationJob } from '../core/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as tar from 'tar';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateAndStoreEmbeddings } from '../core/indexingService';

// Initialize Google Cloud clients
const firestore = new Firestore({
    projectId: process.env.GCP_PROJECT_ID,
});
const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
});

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'flames-generated-apps';

/**
 * Calls the Gemini API to generate code modifications based on the prompt.
 * The prompt contains the system instructions, user request, and template files.
 * Returns a JSON object with a 'modifications' array.
 */
async function callAI(prompt: string): Promise<any> {
    console.log('--- CALLING REAL GEMINI API ---');

    // 1. Initialize the client with your API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-pro', // Corrected to a valid, powerful model
        generationConfig: {
            temperature: 0.5, // Slightly lower temperature for more predictable JSON
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 32768, // Increased token limit
            responseMimeType: "application/json",
        }
    });

    // 2. Call the model and stream the response
    const result = await model.generateContentStream(prompt);

    // Add more robust response handling
    let text = '';
    try {
        for await (const chunk of result.stream) {
            text += chunk.text();
        }
    } catch (e) {
        console.error("Error while streaming AI response:", e);
        throw new Error("Failed to stream AI response.");
    }
    
    // Check for finish reason for more detailed debugging
    const response = await result.response;
    const finishReason = response.promptFeedback?.blockReason || response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
         console.error(`AI response stream finished for a non-standard reason: ${finishReason}`);
         if (response.promptFeedback?.blockReason) {
             console.error(`Prompt was blocked due to: ${response.promptFeedback.blockReason}`);
             console.error('Safety ratings:', response.promptFeedback.safetyRatings);
         }
    }


    console.log('--- RAW AI RESPONSE (first 500 chars) ---');
    console.log(text.substring(0, 500));

    // Add a check for an empty response before parsing
    if (!text.trim()) {
        console.error('AI returned an empty response.');
        throw new Error('AI returned an empty or invalid response.');
    }

    // 3. Extract and parse the JSON from the response
    // Try multiple extraction strategies
    let jsonString = text;

    // Strategy 1: Check for markdown JSON fences
    const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
    if (jsonMatch) {
        jsonString = jsonMatch[1];
    } else {
        // Strategy 2: Check for plain markdown fences
        const plainMatch = text.match(/```\s*\n([\s\S]*?)\n```/);
        if (plainMatch) {
            jsonString = plainMatch[1];
        }
    }

    // Trim whitespace
    jsonString = jsonString.trim();

    try {
        const parsed = JSON.parse(jsonString);
        console.log('--- AI RESPONSE PARSED SUCCESSFULLY ---');
        console.log(`Modifications count: ${parsed.modifications?.length || 0}`);
        return parsed;
    } catch (error) {
        console.error('AI did not return valid JSON:', error);
        console.error('Attempted to parse (first 1000 chars):', jsonString.substring(0, 1000));
        console.error('Last 500 chars:', jsonString.substring(jsonString.length - 500));
        throw new Error(`Failed to parse AI response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Analyzes the generated file structure and calls the AI to create a descriptive index.json file.
 * This file acts as a manifest for the project, enabling intelligent edits later.
 */
async function generateIndexJson(workDir: string): Promise<void> {
    console.log('[Worker] Building file tree for indexing...');
    
    // Helper to recursively build file tree, ignoring common junk files
    async function buildTree(dir: string): Promise<any> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const tree: any = {};
        for (const entry of entries) {
            // Ignore node_modules, .dotfiles, and other non-source files
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
                continue;
            }
            if (entry.isDirectory()) {
                tree[entry.name] = {
                    type: 'folder',
                    children: await buildTree(path.join(dir, entry.name)),
                };
            } else {
                tree[entry.name] = { type: 'file' };
            }
        }
        return tree;
    }

    try {
        const fileTree = await buildTree(workDir);

        const prompt = `
            Given the following file structure of a web application, please provide a brief, one-sentence description for each file and folder explaining its purpose.
            Your response must be a valid JSON object that mirrors the file structure. For each item (file or folder), add a "description" field.
            Do not include any other text or markdown fences in your response. Just the raw JSON.

            Example Input:
            {
              "src": {
                "type": "folder",
                "children": { "App.jsx": { "type": "file" } }
              },
              "package.json": { "type": "file" }
            }

            Example Output:
            {
              "src": {
                "type": "folder",
                "description": "Contains the main application source code.",
                "children": {
                  "App.jsx": { "type": "file", "description": "The main React component for the application." }
                }
              },
              "package.json": { "type": "file", "description": "Defines project metadata and dependencies." }
            }

            File Structure to Describe:
            ${JSON.stringify(fileTree, null, 2)}
        `;

        // AI Call to generate descriptions
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY not set');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-pro',
            generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        const indexJson = JSON.parse(responseText);
        const flamesDir = path.join(workDir, '.flames');
        await fs.mkdir(flamesDir, { recursive: true });
        await fs.writeFile(path.join(flamesDir, 'index.json'), JSON.stringify(indexJson, null, 2));
        
        console.log('[Worker] ✅ .flames/index.json created successfully.');

    } catch (e) {
        console.error("[Worker] Warning: Failed to create index.json. The AI response was not valid JSON or another error occurred. Edits may be less accurate.", e);
        // We log the error but don't fail the entire job, as the code itself was generated successfully.
    }
}


async function updateJobStatus(jobId: string, status: GenerationJob['status'], details: string, artifactUrl?: string, modifications?: any[], filesReady?: boolean) {
    const data: Partial<GenerationJob> = { status, details, updatedAt: new Date().toISOString() };
    if (artifactUrl) data.artifactUrl = artifactUrl;
    if (modifications) data.modifications = modifications;
    if (filesReady !== undefined) data.filesReady = filesReady;

    console.log(`[updateJobStatus] Writing to Firestore: jobId=${jobId}, status=${status}, filesReady=${filesReady}`);
    await firestore.collection('jobs').doc(jobId).set(data, { merge: true });
    console.log(`[updateJobStatus] Firestore write completed for jobId=${jobId}`);
}

async function applyModifications(workDir: string, modifications: any[]) {
    for (const mod of modifications) {
        const filePath = path.join(workDir, mod.filePath);
        if (mod.action.type === 'REPLACE_CONTENT') {
            await fs.writeFile(filePath, mod.action.newContent);
        } else if (mod.action.type === 'CREATE_FILE') {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, mod.action.content);
        }
    }
}

// This function is now obsolete as we have a single, robust template.
// Keeping it here but comment out to avoid breaking references in case we need it later.
// async function selectTemplate(userPrompt: string): Promise<string> {
//     console.log('[Worker] Selecting appropriate template based on user prompt...');

//     const apiKey = process.env.GEMINI_API_KEY;
//     if (!apiKey) {
//         throw new Error('GEMINI_API_KEY environment variable is not set');
//     }

//     const genAI = new GoogleGenerativeAI(apiKey);
//     const model = genAI.getGenerativeModel({
//         model: gemini-2.5-pro',
//         generationConfig: {
//             temperature: 0.3,
//             responseMimeType: "application/json",
//         }
//     });

//     const selectionPromptPath = path.join(__dirname, 'prompts', 'template-selection-prompt.md');
//     const selectionPrompt = await fs.readFile(selectionPromptPath, 'utf-8');

//     const fullPrompt = `${selectionPrompt}\n\n## User's Prompt\n${userPrompt}\n\nAnalyze this prompt and select the most appropriate template.`;

//     const result = await model.generateContent(fullPrompt);
//     const response = await result.response;
//     const text = response.text();

//     try {
//         const selection = JSON.parse(text);
//         console.log(`[Worker] ✅ Selected template: ${selection.selectedTemplate} (confidence: ${selection.confidence}%)`);
//         console.log(`[Worker] Reason: ${selection.reason}`);
//         return selection.selectedTemplate;
//     } catch (error) {
//         console.error('[Worker] Failed to parse template selection, defaulting to landing-page');
//         return 'landing-page';
//     }
// }

async function buildPrompt(userPrompt: string, templatePath: string): Promise<string> {
    const systemPromptPath = path.join(__dirname, 'prompts', 'system-prompt.md');
    const systemPrompt = await fs.readFile(systemPromptPath, 'utf-8');

    let filesContent = '';
    const templateFiles = await fs.readdir(templatePath, { recursive: true, withFileTypes: true });
    for (const file of templateFiles) {
        if (file.isFile()) {
            const filePath = path.relative(templatePath, path.join(file.path, file.name));
            const content = await fs.readFile(path.join(file.path, file.name), 'utf-8');
            filesContent += `--- FILE: ${filePath} ---\n${content}\n\n`;
        }
    }

    return `${systemPrompt}\n\n--- USER PROMPT ---\n${userPrompt}\n\n--- TEMPLATE FILES ---\n${filesContent}`;
}

export async function runGeneration(job: GenerationJob): Promise<void> {
    const { id: jobId, prompt, template: userSelectedTemplate } = job;
    const tempDir = path.join(__dirname, `../../temp_work/${jobId}`);

    try {
        // Step 1: Always use the new, robust base template
        await updateJobStatus(jobId, 'processing', 'Initializing project structure...');
        const selectedTemplate = 'base-react-vite';

        await updateJobStatus(jobId, 'processing', `Using ${selectedTemplate} template. Preparing...`);
        const templateDir = path.join(__dirname, '../templates', selectedTemplate);

        // Check if template directory exists
        try {
            await fs.access(templateDir);
        } catch (error) {
            console.error(`[Worker] Template directory not found: ${templateDir}`);
            throw new Error(`Template "${selectedTemplate}" not found. Please check template installation.`);
        }

        // Check if a working directory already exists. If not, create it from the template.
        try {
            await fs.access(tempDir);
            console.log(`[Worker] Found existing work directory for job ${jobId}. Reusing it.`);
        } catch (error) {
            console.log(`[Worker] No work directory for job ${jobId}. Creating from template...`);
        await fs.mkdir(tempDir, { recursive: true });
        await fs.cp(templateDir, tempDir, { recursive: true });
            console.log(`[Worker] Copied template '${selectedTemplate}' to '${tempDir}'`);
        }

        await updateJobStatus(jobId, 'processing', 'Building AI prompt...');
        const fullPrompt = await buildPrompt(prompt, tempDir);

        let retries = 3;
        let delay = 1000; // Start with 1 second

        while (retries > 0) {
            try {
                const aiResponse = await callAI(fullPrompt);
                console.log('[Worker] AI response received. Proceeding with modifications...');

                await updateJobStatus(jobId, 'processing', 'Applying AI modifications...');
                console.log('[Worker] Status updated in Firestore. Applying changes to local files...');

                await applyModifications(tempDir, aiResponse.modifications);
                console.log('[Worker] File modifications applied. Storing in Firestore...');

                // Generate the project index for future edits
                await generateIndexJson(tempDir);

                // REMOVED: The embedding step will now be triggered by the frontend
                // console.log('[Worker] 🧠 Generating codebase embeddings...');
                // await generateAndStoreEmbeddings(jobId, aiResponse.modifications);
                // console.log('[Worker] ✅ Embeddings generated and stored.');

                await updateJobStatus(jobId, 'generated', 'Your app is ready! Modifications applied.', undefined, aiResponse.modifications, true);
                console.log(`[Worker] ✅ Job ${jobId} status updated to "generated". Frontend can now fetch the files.`);
                console.log(`[Worker] 📦 Stored ${aiResponse.modifications?.length || 0} modifications in Firestore`);

                return; // Success, exit the function

            } catch (error: any) {
                // Check for a specific 503 "Service Unavailable" error to retry
                if (error.status === 503 && retries > 0) {
                    console.warn(`[Worker] AI model is overloaded. Retrying in ${delay / 1000}s... (${retries} retries left)`);
                    await new Promise(res => setTimeout(res, delay));
                    delay *= 2; // Double the delay for the next retry
                    retries--;
                } else {
                    // For all other errors, or if retries are exhausted, fail the job
                    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
                    await updateJobStatus(jobId, 'failed', errorMessage);
                    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
                    throw error; // Re-throw the original error
                }
            }
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        await updateJobStatus(jobId, 'failed', errorMessage);
        // Clean up on error
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        throw error;
    }
}

/**
 * Packages and uploads the generated code to GCS.
 * This is called separately after the frontend has displayed the files.
 */
export async function packageAndUpload(jobId: string): Promise<string> {
    const tempDir = path.join(__dirname, `../../temp_work/${jobId}`);
    const localArtifactPath = path.join(__dirname, `../../temp_artifacts/${jobId}.tar.gz`);
    const artifactFileName = `${jobId}.tar.gz`;

    try {
        console.log(`[Worker] Starting packaging for job: ${jobId}`);

        // Check if tempDir exists
        try {
            await fs.access(tempDir);
        } catch {
            throw new Error('Generated files not found. Please regenerate the project.');
        }

        await updateJobStatus(jobId, 'processing', 'Packaging artifact...');

        console.log('[Worker] Creating tarball...');
        await fs.mkdir(path.dirname(localArtifactPath), { recursive: true });
        await tar.create({ gzip: true, file: localArtifactPath, cwd: tempDir }, ['.']);

        console.log('[Worker] Tarball created successfully.');

        await updateJobStatus(jobId, 'processing', 'Uploading to Cloud Storage...');

        console.log(`[Worker] Uploading '${localArtifactPath}' to bucket '${BUCKET_NAME}'...`);

        const bucket = storage.bucket(BUCKET_NAME);
        await bucket.upload(localArtifactPath, { destination: artifactFileName });
        console.log('[Worker] GCS upload successful.');

        const gcsArtifactUrl = `gs://${BUCKET_NAME}/${artifactFileName}`;

        await updateJobStatus(jobId, 'packaged', 'Artifact ready for deployment.', gcsArtifactUrl);

        // Clean up after successful upload
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        await fs.rm(localArtifactPath, { force: true }).catch(() => {});

        return gcsArtifactUrl;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        await updateJobStatus(jobId, 'failed', errorMessage);
        throw error;
    }
}