## Flames - System Architecture Diagram (Text-Based)

This diagram outlines the major components and data flows of the Flames application.

```
+--------------------------------------------------------------------+
| User Browser                                                       |
| +----------------------------------------------------------------+ |
| | Frontend (Next.js on Cloud Run or Vercel)                      | |
| |                                                                | |
| | [UI Workspace] -> Auth (Google Sign-In)                        | |
| |   - Prompt, Editor, Code Preview                               | |
| +----------------------------------------------------------------+ |
+-----------------|------------------^----------------|--------------+
                  | (REST API Calls) |                | (OAuth Flow) 
                  v                  |                v
+-----------------+------------------|----------------+--------------+
| Backend API (Node/Express on Cloud Run)                            |
| +----------------------------------------------------------------+ |
| | - /generate -> [Generation Worker]                             | |
| | - /job/:id  -> [Firestore]                                     | |
| | - /deploy   -> [Cloud Build API]                               | |
| | - /webhook  <- [Cloud Build]                                   | |
| +----------------------------------------------------------------+ |
+-----------------|------------------^----------------|--------------+
                  |                  |                |
    (CRUD Jobs)   v                  | (CRUD Projects)| (Trigger/Status)
+-----------------+------------------|----------------+--------------+
| Data & Services |                  |                |              |
| +---------------+  +---------------+  +-------------+  +-----------+ |
| | Firestore     |  | Cloud Storage |  | Cloud Build |  | Cloud Run | |
| | - Jobs        |  | - Artifacts   |  | - Build/Push|  | - Deployed| |
| | - Projects    |  | (.tar.gz)     |  | - Dockerfile|  |   App     | |
| +---------------+  +---------------+  +-------------+  +-----------+ |
+--------------------------------------------------------------------+

```

### Flows:

1.  **Generation Flow:**
    - User enters a prompt in the **Frontend**.
    - Frontend sends a `POST /api/v1/generate` request to the **Backend API**.
    - Backend creates a job in **Firestore** and triggers the **Generation Worker**.
    - The worker fetches a template, modifies it, packages it into a `.tar.gz` artifact, and uploads it to **Cloud Storage**.
    - The worker updates the job status in **Firestore**.

2.  **Deployment Flow:**
    - User clicks "Deploy" in the **Frontend**.
    - Frontend sends a `POST /api/v1/deploy` request.
    - **Backend API** authenticates and validates the request.
    - Backend makes an API call to **Cloud Build**, pointing to the artifact in **Cloud Storage**.
    - **Cloud Build** pulls the artifact, builds the Docker image, and pushes it to Google Container Registry.
    - **Cloud Build** then issues a command to deploy the new image to a new or existing **Cloud Run** service.
    - **Cloud Build** sends a notification to the `/webhook/cloudbuild` endpoint on the **Backend API**, which updates the deployment status in **Firestore**.
