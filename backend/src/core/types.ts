/**
 * Represents a generation job stored in Firestore.
 */
export interface FileModification {
  filePath: string;
  action: {
    type: 'REPLACE_CONTENT' | 'CREATE_FILE';
    newContent?: string;
    content?: string;
  };
}

export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  language?: string;
  children?: FileItem[];
  path: string;
}

export interface GenerationJob {
  id: string;
  userId?: string; // User who initiated the job, optional for now
  status: 'pending' | 'processing' | 'generated' | 'packaged' | 'failed';
  prompt: string;
  template: string; // The name of the template to use
  createdAt: string;
  updatedAt: string;
  details?: string; // Log messages or current status details
  artifactUrl?: string; // URL to the generated .tar.gz in Cloud Storage
  modifications?: FileModification[]; // AI-generated modifications stored for frontend
  filesReady?: boolean; // Indicates if modifications are ready to be fetched by frontend
}

// The ProjectManifest is for a more advanced, AI-driven implementation.
// We will use it later when we integrate the AI model.
export type AppStack = 'nextjs' | 'express' | 'fastapi';
export type DbType = 'sqlite' | 'postgres' | 'none';
export type AuthType = 'none' | 'google' | 'email';

export interface ProjectManifest {
  name: string;
  stack: AppStack;
  routes: Array<{ path: string; methods: string[]; }>;
  db: {
    type: DbType;
    url?: string;
  };
  auth: AuthType;
  env: Record<string, string>;
  buildCommand: string;
  startCommand: string;
}