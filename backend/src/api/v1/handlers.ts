import { Request, Response } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import * as tar from 'tar';
import * as path from 'path';
import * as fs from 'fs/promises';
import { GenerationJob, FileItem } from '../../core/types';
import { runGeneration, packageAndUpload } from '../../workers/generateWorker';
import { CloudBuildClient } from '@google-cloud/cloudbuild';

const firestore = new Firestore({
    projectId: process.env.GCP_PROJECT_ID,
});
const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
});
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'flames-generated-apps';
const cloudBuildClient = new CloudBuildClient();

export const generateCode = async (req: Request, res: Response) => {
    const { prompt, template } = req.body;

    if (!prompt || !template) {
        return res.status(400).json({ message: 'Prompt and template are required.' });
    }

    try {
        // 1. Create a new job in Firestore
        const jobRef = firestore.collection('jobs').doc();
        const jobId = jobRef.id;

        const newJob: GenerationJob = {
            id: jobId,
            prompt,
            template,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        await jobRef.set(newJob);

        // 2. Respond to the client immediately
        res.status(202).json({ jobId });

        // 3. Trigger the generation worker asynchronously
        console.log(`Starting generation worker for job: ${jobId}`);
        runGeneration(newJob).catch((error: Error) => {
            console.error(`[Worker] Generation failed for job ${jobId}:`, error);
            // The worker itself handles updating the job status to 'failed'
        });

    } catch (error) {
        console.error('Failed to create generation job:', error);
        res.status(500).json({ message: 'Failed to start generation job.' });
    }
};

export const getJobStatus = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        console.log(`[API] Fetching job status for: ${id}`);
        const jobDoc = await firestore.collection('jobs').doc(id).get();
        if (!jobDoc.exists) {
            console.log(`[API] ❌ Job ${id} not found in Firestore`);
            return res.status(404).json({ message: 'Job not found.' });
        }
        const data = jobDoc.data();
        console.log(`[API] ✅ Job ${id} status: ${data?.status}, filesReady: ${data?.filesReady}`);
        res.json(data);
    } catch (error) {
        console.error(`Failed to fetch status for job ${id}:`, error);
        res.status(500).json({ message: 'Failed to fetch job status.' });
    }
};

// ... (other handlers remain the same for now) ...

export const deployProject = async (req: Request, res: Response) => {
    const { jobId } = req.body;
    if (!jobId) {
        return res.status(400).json({ message: 'Job ID is required.' });
    }

    try {
        // 1. Fetch job details from Firestore
        const jobDoc = await firestore.collection('jobs').doc(jobId).get();
        if (!jobDoc.exists) {
            return res.status(404).json({ message: 'Job not found.' });
        }
        const job = jobDoc.data() as GenerationJob;

        if (job.status !== 'generated' || !job.artifactUrl) {
            return res.status(400).json({ message: 'Job is not ready for deployment or has no artifact.' });
        }

        // 2. Get project details and define build configuration
        const [project] = await cloudBuildClient.getProjectId();
        const region = 'us-central1'; // AI: This could be made configurable
        const serviceName = `flames-${jobId.substring(0, 8)}`; // A unique name for the Cloud Run service
        const imageName = `gcr.io/${project}/${serviceName}:${jobId}`;

        // 3. Define the Cloud Build steps
        const buildRequest = {
            projectId: project,
            build: {
                source: {
                    storageSource: {
                        bucket: job.artifactUrl.split('/')[2],
                        object: job.artifactUrl.split('/').slice(3).join('/'),
                    },
                },
                steps: [
                    // Step 1: Build the Docker image
                    {
                        name: 'gcr.io/cloud-builders/docker',
                        args: ['build', '-t', imageName, '.'],
                    },
                    // Step 2: Push the image to Google Container Registry
                    {
                        name: 'gcr.io/cloud-builders/docker',
                        args: ['push', imageName],
                    },
                    // Step 3: Deploy to Cloud Run (will be private by default)
                    {
                        name: 'gcr.io/google.com/cloudsdktool/cloud-sdk',
                        entrypoint: 'gcloud',
                        args: [
                            'run', 'deploy', serviceName,
                            '--image', imageName,
                            '--region', region,
                            '--platform', 'managed',
                            '--no-allow-unauthenticated', // Explicitly deploy as private first
                        ],
                    },
                    // Step 4: Force the service to be public
                    {
                        name: 'gcr.io/google.com/cloudsdktool/cloud-sdk',
                        entrypoint: 'gcloud',
                        args: [
                            'run', 'services', 'add-iam-policy-binding', serviceName,
                            '--member=allUsers',
                            '--role=roles/run.invoker',
                            '--region', region,
                            '--platform', 'managed',
                        ],
                    }
                ],
                images: [imageName],
            },
        };

        // 4. Trigger the build
        const [operation] = await cloudBuildClient.createBuild(buildRequest);
        console.log(`Started Cloud Build operation: ${operation.name}`);

        // Update job status
        await firestore.collection('jobs').doc(jobId).set({ 
            status: 'deploying', 
            details: `Cloud Build started. Operation: ${operation.name}`,
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        res.status(202).json({ message: 'Deployment started', buildId: operation.name });

    } catch (error) {
        console.error(`Failed to start deployment for job ${jobId}:`, error);
        res.status(500).json({ message: 'Failed to start deployment.' });
    }
};

export const getUserProjects = async (req: Request, res: Response) => {
  try {
    console.log('[API] 🔍 Fetching user projects from Firestore...');
    
    // First, let's see what jobs exist in general
    const allJobsSnapshot = await firestore
      .collection('jobs')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    console.log(`[API] 📋 Total jobs in database: ${allJobsSnapshot.size}`);
    allJobsSnapshot.docs.forEach(doc => {
      const job = doc.data();
      console.log(`[API] Job ${doc.id}: status="${job.status}", template="${job.template}"`);
    });

    // Fetch ALL jobs (including failed ones for debugging)
    const jobsSnapshot = await firestore
      .collection('jobs')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const projects = jobsSnapshot.docs.map(doc => {
      const job = doc.data() as GenerationJob;
      console.log(`[API] ✅ Including job ${job.id} (status: ${job.status})`);
      return {
        id: job.id,
        prompt: job.prompt,
        template: job.template,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      };
    });

    console.log(`[API] 🎯 Returning ${projects.length} successful projects`);
    res.json({ projects });

  } catch (error) {
    console.error('[API] ❌ Failed to fetch user projects:', error);
    res.status(500).json({ 
      message: 'Failed to fetch projects',
      projects: [] 
    });
  }
};

export const cloudBuildWebhook = async (req: Request, res: Response) => {
  // TODO: Implement webhook logic
  console.log('Received Cloud Build webhook:', req.body);
  res.status(204).send();
};

// Helper function to recursively read directories and build the file tree
const buildFileTree = async (dir: string, basePath: string = dir): Promise<FileItem[]> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const fileItems: FileItem[] = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        if (entry.isDirectory()) {
            fileItems.push({
                id: relativePath,
                name: entry.name,
                type: 'folder',
                path: relativePath,
                children: await buildFileTree(fullPath, basePath),
            });
        } else {
            const content = await fs.readFile(fullPath, 'utf-8');
            const language = path.extname(entry.name).substring(1);
            fileItems.push({
                id: relativePath,
                name: entry.name,
                type: 'file',
                path: relativePath,
                content,
                language,
            });
        }
    }
    return fileItems.sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
    });
};

export const getJobFiles = async (req: Request, res: Response) => {
    const { id } = req.params;
    console.log(`[API] Received request to get files for job: ${id}`);
    const tempWorkPath = path.join(__dirname, `../../../temp_work/${id}`);

    try {
        // 1. Get job data from Firestore
        console.log(`[API] Fetching job doc from Firestore...`);
        const jobDoc = await firestore.collection('jobs').doc(id).get();
        if (!jobDoc.exists) {
            console.error(`[API] Job ${id} not found in Firestore.`);
            return res.status(404).json({ message: 'Job not found.' });
        }
        const job = jobDoc.data() as GenerationJob;
        console.log(`[API] Job status: ${job.status}`);

        // Check if files are ready
        if (job.status !== 'generated' && job.status !== 'packaged') {
            return res.status(400).json({ message: 'Job files are not ready yet.' });
        }

        // For backward compatibility: if filesReady is undefined, allow if status is 'generated' or 'packaged'
        // New jobs will have filesReady explicitly set to true
        if (job.filesReady === false) {
            return res.status(400).json({ message: 'Files are not ready for fetching.' });
        }

        // Check if temp directory exists
        try {
            await fs.access(tempWorkPath);
        } catch {
            // If temp directory doesn't exist but we have artifact URL, download and extract
            if (job.artifactUrl) {
                console.log(`[API] Temp directory not found, downloading from GCS...`);
                const artifactFileName = `${id}.tar.gz`;
                const localArtifactPath = path.join(__dirname, `../../../temp_artifacts/downloaded_${artifactFileName}`);
                
                await fs.mkdir(path.dirname(localArtifactPath), { recursive: true });
                await storage.bucket(BUCKET_NAME).file(artifactFileName).download({ destination: localArtifactPath });
                
                await fs.mkdir(tempWorkPath, { recursive: true });
                await tar.extract({ file: localArtifactPath, cwd: tempWorkPath });
                await fs.rm(localArtifactPath, { force: true }).catch(() => {});
            } else {
                return res.status(404).json({ message: 'Generated files not found.' });
            }
        }

        // Read the file structure from temp_work directory
        console.log(`[API] Building file tree from: ${tempWorkPath}`);
        const files = await buildFileTree(tempWorkPath);
        console.log(`[API] File tree built. Found ${files.length} top-level items.`);

        // 5. Send the file structure to the client
        res.json({ files });

    } catch (error) {
        console.error(`[API] FATAL: Failed to get files for job ${id}:`, error);
        res.status(500).json({ message: 'Failed to retrieve and process job files.' });
    }
    // Note: We don't clean up tempWorkPath here since it might be needed for packaging later
};

/**
 * Triggers packaging, upload, and deployment of the generated code.
 * Called when user clicks Deploy button.
 */
export const deployJob = async (req: Request, res: Response) => {
    const { id } = req.params;
    console.log(`[API] Received deploy request for job: ${id}`);

    try {
        const jobDocRef = firestore.collection('jobs').doc(id);
        const jobDoc = await jobDocRef.get();
        if (!jobDoc.exists) {
            return res.status(404).json({ message: 'Job not found.' });
        }
        const job = jobDoc.data() as GenerationJob;

        if (!['generated', 'packaged', 'deploying', 'deployed'].includes(job.status)) {
            return res.status(400).json({ message: 'Job is not ready for deployment.' });
        }

        res.status(202).json({ message: 'Deployment process initiated.' });

        // Run this in the background
        (async () => {
            try {
                // Step 1: Package and Upload if not already done
                let artifactUrl = job.artifactUrl;
                if (job.status === 'generated') {
                    await jobDocRef.update({ status: 'packaging', updatedAt: new Date().toISOString() });
                    artifactUrl = await packageAndUpload(id);
                    await jobDocRef.update({ status: 'packaged', artifactUrl, updatedAt: new Date().toISOString() });
                }

                if (!artifactUrl) {
                    throw new Error("Artifact URL is missing after packaging.");
                }

                // Step 2: Trigger Cloud Build
                await jobDocRef.update({ status: 'deploying', updatedAt: new Date().toISOString() });
                const project = await cloudBuildClient.getProjectId();
                const region = 'us-central1';
                const serviceName = `flames-${id.substring(0, 8)}`.toLowerCase();
                const imageName = `gcr.io/${project}/${serviceName}:${id}`;

                const buildRequest = {
                    projectId: project,
                    build: {
                        source: {
                            storageSource: {
                                bucket: BUCKET_NAME,
                                object: `${id}.tar.gz`,
                            },
                        },
                        steps: [
                            // Step 1: Build the Docker image
                            {
                                name: 'gcr.io/cloud-builders/docker',
                                args: ['build', '-t', imageName, '.']
                            },
                            // Step 2: Push the image to Google Container Registry
                            {
                                name: 'gcr.io/cloud-builders/docker',
                                args: ['push', imageName]
                            },
                            // Step 3: Deploy to Cloud Run (will be private by default)
                            {
                                name: 'gcr.io/google.com/cloudsdktool/cloud-sdk',
                                entrypoint: 'gcloud',
                                args: [
                                    'run', 'deploy', serviceName,
                                    '--image', imageName,
                                    '--region', region,
                                    '--platform', 'managed',
                                    '--no-allow-unauthenticated',
                                    '--quiet',
                                ],
                            },
                            // Step 4: Force the service to be public
                            {
                                name: 'gcr.io/google.com/cloudsdktool/cloud-sdk',
                                entrypoint: 'gcloud',
                                args: [
                                    'run', 'services', 'add-iam-policy-binding', serviceName,
                                    '--member=allUsers',
                                    '--role=roles/run.invoker',
                                    '--region', region,
                                    '--platform', 'managed',
                                ],
                            }
                        ],
                        images: [imageName],
                    },
                };

                const [operation] = await cloudBuildClient.createBuild(buildRequest);
                console.log(`Started Cloud Build operation for job ${id}: ${operation.name}`);
                await jobDocRef.update({ 'deployment.buildId': operation.name });

                // Step 3: Poll for Cloud Run URL
                // This is a simplified polling mechanism. A robust implementation would use webhooks.
                const checkUrl = async () => {
                    const url = `https://run.googleapis.com/v1/projects/${project}/locations/${region}/services/${serviceName}`;
                    const headers = { 'Authorization': `Bearer ${await cloudBuildClient.auth.getAccessToken()}` };
                    
                    try {
                        const response = await fetch(url, { headers });
                        if (!response.ok) {
                            console.log(`[Polling] Service not ready yet (status: ${response.status})`);
                            return false;
                        }
                        
                        const service = await response.json();
                        if (service && service.status && service.status.address && service.status.address.url) {
                            await jobDocRef.update({ 
                                status: 'deployed', 
                                'deployment.url': service.status.address.url,
                                updatedAt: new Date().toISOString() 
                            });
                            console.log(`✅ Job ${id} deployed successfully. URL: ${service.status.address.url}`);
                            return true;
                        }
                    } catch (error) {
                        console.error(`[Polling] Error checking service URL:`, error);
                        return false;
                    }
                    return false;
                };
                
                let attempts = 0;
                const pollInterval = setInterval(async () => {
                    attempts++;
                    const success = await checkUrl();
                    if (success || attempts > 60) { // Timeout after 5 minutes
                        clearInterval(pollInterval);
                        if (!success) {
                            console.error(`🚨 Timeout waiting for Cloud Run URL for job ${id}`);
                             await jobDocRef.update({ status: 'failed', 'deployment.error': 'Timeout waiting for service URL' });
                        }
                    }
                }, 5000);

            } catch (error: any) {
                console.error(`[API Background] Deployment failed for job ${id}:`, error);
                let errorMessage = 'An unknown error occurred during deployment.';
                if (error.code === 7 && error.details?.includes('Cloud Build API has not been used')) {
                    const projectIdMatch = error.details.match(/project=(\d+)/);
                    const projectId = projectIdMatch ? projectIdMatch[1] : 'your-gcp-project';
                    const url = `https://console.developers.google.com/apis/api/cloudbuild.googleapis.com/overview?project=${projectId}`;
                    errorMessage = `The Cloud Build API is not enabled. Please enable it by visiting this URL: ${url}`;
                } else if (error.code === 3 && error.details?.includes('storage.objects.get')) {
                    const serviceAccountMatch = error.details.match(/(\S+@\S+gserviceaccount.com)/);
                    const serviceAccount = serviceAccountMatch ? serviceAccountMatch[1] : 'the service account';
                    errorMessage = `The Cloud Build service account (${serviceAccount}) does not have permission to access the storage bucket. Please grant the "Storage Object Viewer" role to this service account in your project's IAM settings.`;
                } else if (error.message) {
                    errorMessage = error.message;
                }
                await jobDocRef.update({ status: 'failed', 'deployment.error': errorMessage });
            }
        })();

    } catch (error) {
        console.error(`[API] Failed to initiate deployment for job ${id}:`, error);
        res.status(500).json({ message: 'Failed to start deployment.' });
    }
};