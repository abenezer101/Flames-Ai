import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs/promises';
import * as path from 'path';

// Helper function to call the AI with a specific prompt
async function callAI(prompt: string, isJson = false): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-pro',
        generationConfig: {
            temperature: 0.2, // Lower temperature for more focused, less creative tasks
            maxOutputTokens: 32768, // Increased token limit
            responseMimeType: isJson ? "application/json" : "text/plain",
        }
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
}

// Main chat handler
export const handleChat = async (req: Request, res: Response) => {
    const { message, jobId, activeFileId } = req.body; // Assuming jobId is passed
    if (!message || !jobId) {
        return res.status(400).json({ message: 'Message and Job ID are required.' });
    }

    const workDir = path.join(__dirname, `../../../temp_work/${jobId}`);
    const indexPath = path.join(workDir, '.flames', 'index.json');

    try {
        // --- STEP 1: Identify the file to edit ---
        console.log(`[Chat] Step 1: Identifying file to edit for job ${jobId}...`);
        const indexJsonContent = await fs.readFile(indexPath, 'utf-8');
        const identifyFilePrompt = `
            Based on the user's request and the project structure described in the JSON below, which file should be modified?
            Your response must be a single, valid JSON object containing only the file path. Example: {"filePath": "src/components/Header.jsx"}

            USER REQUEST: "${message}"

            PROJECT INDEX:
            ${indexJsonContent}
        `;
        const identifiedFileJson = await callAI(identifyFilePrompt, true);
        const { filePath } = JSON.parse(identifiedFileJson);
        console.log(`[Chat] AI identified file: ${filePath}`);

        if (!filePath) {
            throw new Error("AI failed to identify a file to modify.");
        }
        
        const fullFilePath = path.join(workDir, filePath);
        const fileContent = await fs.readFile(fullFilePath, 'utf-8');

        // --- STEP 2: Generate the code modifications ---
        console.log(`[Chat] Step 2: Generating code modifications...`);
        const generateChangesPrompt = `
            A user wants to modify a file. Based on their request, please provide the necessary code changes.
            The response must be a valid JSON object containing an array of 'modifications', following the same format as the initial code generation.
            Currently, only the "REPLACE_CONTENT" action type is supported for edits. You must replace the entire file content.

            USER REQUEST: "${message}"

            FILE PATH: "${filePath}"

            CURRENT FILE CONTENT:
            \`\`\`
            ${fileContent}
            \`\`\`
        `;
        const changesJson = await callAI(generateChangesPrompt, true);
        const { modifications } = JSON.parse(changesJson);
        console.log(`[Chat] AI generated ${modifications.length} modifications.`);

        // --- STEP 3: Apply modifications ---
        for (const mod of modifications) {
            if (mod.action.type === 'REPLACE_CONTENT') {
                await fs.writeFile(path.join(workDir, mod.filePath), mod.action.newContent);
            }
        }
        console.log(`[Chat] Modifications applied to ${filePath}.`);

        // --- STEP 4: Update the index.json descriptions ---
        console.log(`[Chat] Step 4: Updating index.json...`);
        const newIndexContent = JSON.parse(await fs.readFile(indexPath, 'utf-8'));
        const updateIndexPrompt = `
            A file in the project has been modified. Please provide an updated, brief, one-sentence description for the file based on its new content.
            Your response must be a single, valid JSON object with a "description" field. Example: {"description": "This component now includes a dark mode toggle."}

            FILE PATH: "${filePath}"

            NEW FILE CONTENT:
            \`\`\`
            ${modifications[0].action.newContent}
            \`\`\`
        `;
        const descriptionJson = await callAI(updateIndexPrompt, true);
        const { description } = JSON.parse(descriptionJson);

        // This is a simplified update. A more robust solution would traverse the JSON tree.
        // For now, assuming a flat structure for simplicity.
        // This part needs to be improved to handle nested paths correctly.
        let fileNode = newIndexContent;
        const pathParts = filePath.split('/');
        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            if (i === pathParts.length - 1) {
                if (fileNode[part]) {
                    fileNode[part].description = description;
                }
            } else {
                fileNode = fileNode[part].children;
            }
        }

        await fs.writeFile(indexPath, JSON.stringify(newIndexContent, null, 2));
        console.log(`[Chat] index.json updated with new description for ${filePath}.`);

        // Respond with the final changes
        res.status(200).json({ modifications });

    } catch (error) {
        console.error('Error during intelligent edit process:', error);
        res.status(500).json({ message: 'Failed to process edit request.' });
    }
};