# Flames: AI-Powered Cloud Run App Generator

This repository contains the full-stack application for **Flames**, a web tool that converts natural-language specifications into runnable, deployable web applications on Google Cloud Run.

## Project Status

**Status:** Initial scaffold complete. Core UI, backend API, and deployment infrastructure are in place. Ready for feature implementation and testing.

## Getting Started (Local Development)

**Prerequisites:**
- Node.js (v18+)
- npm (or yarn/pnpm)
- Docker Desktop
- `gcloud` CLI (authenticated to a Google Cloud project)

1.  **Clone & Install:**
    ```bash
    git clone <repository_url>
    cd flames
    npm install
    ```

2.  **Set up Environment:**
    - Create a `.env` file in the `backend` directory. You will need to populate it with Google Cloud project details and service account credentials.

3.  **Run the Services:**
    ```bash
    # In one terminal, run the backend
    npm run dev:backend

    # In another terminal, run the frontend
    npm run dev:frontend
    ```

## Structure

- `/frontend`: The Next.js user interface.
- `/backend`: The Node.js/Express API for code generation and deployment.
- `/Dockerfile`: Container definition for the backend service.
- `/cloudbuild.yaml`: CI/CD pipeline for deploying the backend to Cloud Run.
- `/ARCHITECTURE.md`: High-level system design.
- `/BUILD_PLAN.md`: The 10-day development plan.
- `/DEMO_SCRIPT.md`: Script for a 3-minute product demo.
- `/SECURITY_CHECKLIST.md`: Essential security hardening steps.

## Packaging an Example App

To manually package one of the generated application templates into a `.tar.gz` artifact (simulating what the backend worker does), you can use the `tar` command.

This command packages the `simple-blog-express` template into an artifact ready for Cloud Storage.

```bash
# From the project root
cd backend/src/templates/simple-blog-express
tar -czvf ../../../../../simple-blog-artifact.tar.gz .
```

This will create `simple-blog-artifact.tar.gz` in the root of the Flames project directory.