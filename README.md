<div align="center">
  <img src="public/images/flames-logo.png" alt="Flames Logo" width="200"/>
  <p><b>Your AI-powered partner for building and deploying web applications on the fly.</b></p>
</div>

---

Flames is a generative AI application that creates entire web applications from a single prompt. Describe the app 
you want to build, and watch as Flames writes the code, structures the files, and prepares it for deployment. It 
features a comprehensive in-browser IDE, including a file explorer, code editor, and live preview, allowing you to 
iterate and modify your creation with AI assistance.

For a detailed explanation of the project's structure, see the [Architecture Overview](ARCHITECTURE.md).

## Table of Contents

-   [Overview](#overview)
-   [Key Features](#key-features)
-   [How It Works](#how-it-works)
-   [Tech Stack](#tech-stack)
-   [Deployment](#deployment)

## ✨ Key Features

-   **AI-Powered Code Generation**: Leverages Google's Gemini 2.5 Pro to generate React applications based on a simple prompt.
-   **In-Browser IDE**: A complete development environment in your browser, featuring:
    -   A **chat interface** to communicate with the AI.
    -   A **file explorer** to navigate the generated project.
    -   A **live code editor** (Monaco) to view and modify the code.
-   **Live Previews**: Uses WebContainers to instantly boot up the generated React app for a real-time preview.
-   **Iterative Development**: Chat with the AI assistant to request changes and watch it modify the code in real-time.
-   **Cloud-Native Architecture**: Built as a scalable, two-part system (frontend and backend) designed for serverless platforms.
-   **One-Click Deployment**: (Future-proof) The architecture is set up for easy deployment to Google Cloud Run.

## 🚀 How It Works

Flames operates as a sophisticated monorepo with two primary services:

1.  **The Frontend (`/frontend`)**: A Next.js application that provides the entire user experience. It's the user's window into the generation process, allowing them to issue prompts, view the results, and interact with the generated application.
2.  **The Backend (`/backend`)**: A Node.js and Express server that acts as the brain. It receives requests from the frontend, constructs detailed prompts for the Gemini API, processes the AI's response, and manages the file generation and modification logic. Job statuses and artifacts are managed using Google Firestore and Cloud Storage.

The process is as follows:
1.  A user submits a prompt in the frontend UI.
2.  The frontend sends the request to the backend API.
3.  The backend creates a generation job, builds a context from template files, and calls the Gemini API.
4.  The AI returns a set of file modifications as a JSON object.
5.  The backend applies these modifications to a temporary workspace.
6.  The frontend polls for the job status and, once complete, fetches and displays the generated files to the user.
7.  The user can then preview the app in a WebContainer or request further changes from the AI.

## 🛠️ Tech Stack

### Frontend
-   **Framework**: [Next.js](https://nextjs.org/)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **UI Components**: [Shadcn UI](https://ui.shadcn.com/), [Framer Motion](https://www.framer.com/motion/)
-   **State Management**: [Zustand](https://github.com/pmndrs/zustand)
-   **In-Browser Dev Tools**:
    -   [WebContainers](https://webcontainers.io/) for live previews.
    -   [Monaco Editor](https://microsoft.github.io/monaco-editor/) for code editing.
    -   [Xterm.js](https://xtermjs.org/) for terminal output.

### Backend
-   **Framework**: [Node.js](https://nodejs.org/) with [Express](https://expressjs.com/)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **Generative AI**: [Google Gemini 2.5 Pro](https://deepmind.google/technologies/gemini/)
-   **Google Cloud Services**:
    -   **Firestore**: For managing job status and metadata.
    -   **Cloud Storage**: For storing generated code artifacts.
    -   **Cloud Build**: For building container images.
    -   **Cloud Run**: For serverless deployment.

## ☁️ Deployment to Google Cloud Run

This project is configured for deployment on Google Cloud Run. Both the frontend and backend run as separate, containerized services.

### Prerequisites
-   [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed and authenticated.
-   A Google Cloud Project with the Cloud Build and Cloud Run APIs enabled.
-   Docker installed locally (for building images).

### 1. Deploy the Backend

The backend must be deployed first to get its public URL.

1.  **Set your project ID:**
    ```bash
    gcloud config set project YOUR_PROJECT_ID
    ```

2.  **Build the backend container image (run from the project root):**
    ```bash
    gcloud builds submit . --tag gcr.io/YOUR_PROJECT_ID/flames-backend
    ```

3.  **Deploy to Cloud Run:**
    ```bash
    gcloud run deploy flames-backend --image gcr.io/YOUR_PROJECT_ID/flames-backend --platform managed --region us-central1 --allow-unauthenticated --port 8080
    ```
    **➡️ Important:** Copy the `Service URL` provided after deployment.

### 2. Deploy the Frontend

Now, deploy the frontend and provide it with the backend's URL.

1.  **Build the frontend container image (run from the project root):**
    ```bash
    gcloud builds submit ./frontend --tag gcr.io/YOUR_PROJECT_ID/flames-frontend
    ```

2.  **Deploy to Cloud Run, connecting it to the backend:**
    Replace `BACKEND_SERVICE_URL` with the URL you copied from the backend deployment.
    ```bash
    gcloud run deploy flamesbuilder --image gcr.io/YOUR_PROJECT_ID/flames-frontend --platform managed --region us-central1 --allow-unauthenticated --port 3000 --set-env-vars "NEXT_PUBLIC_API_BASE_URL=BACKEND_SERVICE_URL"
    ```

After this step, your Flames application will be live!

---
<div align="center">
  <p>Built with 🔥 by abeni</p>
</div>