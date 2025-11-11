# 🔥 Flames - System Architecture

This document outlines the major components and data flows of the Flames application, an AI-powered tool that generates and deploys web applications from natural language prompts.

## Core Philosophy

Flames is built on a modern, scalable, microservices-style architecture. The frontend (the user's interface and in-browser IDE) is completely decoupled from the backend (the AI orchestration and code generation engine). This separation allows for independent development, scaling, and deployment. The entire system is designed to run in a serverless environment on Google Cloud.

## Architecture Diagrams

The following diagram illustrates the relationship between the user, the frontend service, the backend service, and the supporting Google Cloud infrastructure. It should render as a graph in most modern Markdown viewers.

```
+---------------------------------------------------------------------------------+
| User Browser                                                                    |
| +-----------------------------------------------------------------------------+ |
| | Flames Frontend (Next.js on Cloud Run)                                      | |
| | - UI Workspace (Editor, Preview, Chat)                                      | |
| +-----------------------------------------------------------------------------+ |
+------------------|-----------------------------^--------------------------------+
                   | (REST API Calls)            |
                   v                             |
+------------------+-----------------------------|---------------------------------+
| Backend API (Node/Express on Cloud Run)                                         |
| +-----------------------------------------------------------------------------+ |
| | Endpoints:                                                                  | |
| | - /generate -> Triggers Generation Worker                                   | |
| | - /chat     -> Triggers Intelligent Edit Workflow                           | |
| | - /deploy   -> Triggers Cloud Build for a specific Job ID                   | |
| | - /job/*    -> Reads job status and files from Firestore & Temp Storage     | |
| +-----------------------------------------------------------------------------+ |
+------------------|-----------------------------|--------------------------------+
                   |                             |
(Triggers)         v                             v (Triggers)
+------------------+-----------------------------+---------------------------------+
| Core Logic & Workers (Running on Backend Server)                                |
| +---------------------------------------------+-------------------------------+ |
| | Generation Worker                           | Intelligent Edit Workflow     | |
| | 1. Calls Gemini (Full Generation)           | 1. Reads .flames/index.json   | |
| | 2. Saves code to /temp_work                 | 2. Gemini: Identify File      | |
| | 3. Calls Gemini (to create index.json)      | 3. Reads the single file      | |
| | 4. Saves .flames/index.json                 | 4. Gemini: Generate Changes   | |
| | 5. Uploads final code to Cloud Storage      | 5. Applies changes locally    | |
| |                                             | 6. Gemini: Updates index.json | |
| +---------------------------------------------+-------------------------------+ |
+------------------|-----------------------------|-----------------|---------------+
(Updates Status)   v                             v (Uploads)       v (Triggers)
+------------------+-------------+---------------+-----------------+---------------+
| Google Cloud Platform Services                                                  |
| +----------------+-------------+---------------+-----------------+-------------+ |
| | Firestore    |               | Cloud Storage |                 | Cloud Build | |
| | - Job Status |               | - code.tar.gz |                 | - Builds    | |
| | - Metadata   |               |   Artifacts   |                 |   Container | |
| +----------------+             +---------------+                 +-------------+ |
|                                                                        |       | |
|                                                                        |       | |
|                                                                        v       | |
|                                                                +---------------+ |
|                                                                | Cloud Run     | |
|                                                                | - Deployed    | |
|                                                                |   User App    | |
|                                                                +---------------+ |
+----------------------------------------------------------------------------------+
```

## Component Breakdown

-   **Frontend (Next.js on Cloud Run)**: The user's complete interface. It's a powerful client-side application that provides an IDE-like experience, including a file explorer, code editor, terminal, and a WebContainer-based live preview. It is responsible for all UI rendering and state management.

-   **Backend (Node.js/Express on Cloud Run)**: The stateless "brain" of the operation. Its sole responsibility is to handle API requests from the frontend. It manages the AI interaction, file system operations, and job status updates. It has no frontend rendering logic.

-   **Google Gemini API**: The external generative AI service that takes a detailed prompt (including template files and user instructions) and returns structured JSON describing the necessary code modifications.

-   **Firestore**: A NoSQL database used to store and manage the state of each generation `job`. The frontend polls this database (via the backend) to know when the code generation is complete.

-   **Cloud Storage**: Used as a durable object store for application artifacts, such as the `.tar.gz` packages of generated code, although this is less critical for the interactive generation flow.

## Detailed Flows

### 1. Code Generation Flow (The Core Loop)

1.  **User Submits Prompt**: The user types a description of the application they want to build into the **Frontend** UI.
2.  **Initiate Generation**: The **Frontend** sends a `POST /api/v1/generate` request to the **Backend API**, containing the user's prompt.
3.  **Job Creation**: The **Backend** creates a new job document in **Firestore** with a unique ID and a `processing` status.
4.  **AI Invocation**: The **Backend** constructs a detailed prompt for the **Gemini API**. This prompt includes system instructions, the user's request, and the contents of a base template project.
5.  **Receive Modifications**: The **Gemini API** processes the request and returns a JSON object containing an array of file modifications (e.g., `CREATE_FILE`, `REPLACE_CONTENT`).
6.  **Apply Changes**: The **Backend** applies these modifications to a temporary copy of the template files in its local file system.
7.  **Finalize Job**: The **Backend** updates the job's status in **Firestore** to `generated`.
8.  **Fetch & Display**: The **Frontend**, which has been polling the job status endpoint, sees the `generated` status. It then makes a final request to the **Backend** to fetch the complete tree of generated files, which are then displayed in the file explorer and code editor.

### 2. Deployment Flow (As Implemented)

The current deployment process is handled manually via the `gcloud` CLI, providing a robust and direct path to production on Google Cloud Run.

1.  **Containerization**: The `Dockerfile` in the root and the `frontend/Dockerfile` are used by **Google Cloud Build** to package the backend and frontend services into immutable container images.
2.  **Backend Deployment**: An administrator runs `gcloud builds submit` and `gcloud run deploy` for the backend service. This creates a live, public URL for the API.
3.  **Frontend Deployment**: The administrator runs `gcloud builds submit` for the frontend. Then, they run `gcloud run deploy`, passing the backend's public URL as an environment variable (`NEXT_PUBLIC_API_BASE_URL`). This securely connects the two services.
4.  **Live Application**: Cloud Run manages both services, scaling them up and down as needed. The frontend serves the UI to users, and it makes API calls to the backend's public endpoint.
