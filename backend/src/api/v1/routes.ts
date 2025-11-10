import { Router } from 'express';
import * as handlers from './handlers';
import { handleChat } from './chatHandler';

const router = Router();

// Job and Project Endpoints
router.post('/generate', handlers.generateCode);
router.get('/job/:id', handlers.getJobStatus);
router.get('/job/:id/files', handlers.getJobFiles);
router.post('/job/:id/deploy', handlers.deployJob);
router.post('/deploy', handlers.deployProject);
router.get('/projects', handlers.getUserProjects);

// AI Chat Endpoint
router.post('/chat', handleChat);

// Webhook for Cloud Build
router.post('/webhook/cloudbuild', handlers.cloudBuildWebhook);

export { router as v1Router };
