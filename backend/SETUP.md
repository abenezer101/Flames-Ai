# Backend Setup Guide

## Fixing the Firestore "NOT_FOUND" Error

You're getting this error because Firestore hasn't been initialized. Choose one of these options:

---

## ✅ Option A: Cloud Firestore (Production)

**Best for:** Production deployment or testing with real Google Cloud services

### Steps:

1. **Enable Firestore:**
   - Visit: https://console.cloud.google.com/firestore?project=flames-477116
   - Click **"Create Database"**
   - Choose **Native Mode**
   - Select location: `us-central1` (or closest to you)
   - Choose **Production mode** or **Test mode**

2. **Use the production `.env` file:**
   ```bash
   # Make sure backend/.env has GOOGLE_APPLICATION_CREDENTIALS set
   ```

3. **Restart your server:**
   ```bash
   cd backend
   npm run dev
   ```

---

## ✅ Option B: Firestore Emulator (Local Development - RECOMMENDED)

**Best for:** Local development without using cloud resources

### Steps:

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Initialize Firebase in the backend folder:**
   ```bash
   cd backend
   firebase init emulators
   ```
   - Select **Firestore Emulator**
   - Accept default ports (Firestore: 8080)
   - Download emulators when prompted

3. **Create a `firebase.json` file:**
   The init command creates this, but ensure it has:
   ```json
   {
     "emulators": {
       "firestore": {
         "port": 8081
       },
       "ui": {
         "enabled": true,
         "port": 4000
       }
     }
   }
   ```

4. **Use the `.env.local` file for local development:**
   ```bash
   # Copy .env.local to .env for local development
   cp .env.local .env
   ```

5. **Start the emulator** (in a separate terminal):
   ```bash
   cd backend
   npm run dev:local
   ```

6. **Start your backend server** (in another terminal):
   ```bash
   cd backend
   npm run dev
   ```

7. **Access Emulator UI:**
   - Open: http://localhost:4000
   - View Firestore data in real-time

---

## 🔍 Verify It's Working

After choosing an option and starting the server, you should see:
```
Server is listening on port 8080
```

**Without** the error:
```
Failed to create generation job: Error: 5 NOT_FOUND
```

---

## 💡 Tips

- **For local development:** Use the emulator (Option B) - it's free and faster
- **For production:** Use Cloud Firestore (Option A)
- **Switch between them:** Just change your `.env` file
  - Emulator: Set `FIRESTORE_EMULATOR_HOST=localhost:8081`
  - Production: Remove `FIRESTORE_EMULATOR_HOST` and set `GOOGLE_APPLICATION_CREDENTIALS`

---

## 🐛 Still Having Issues?

Check that:
1. Your service account key file exists: `backend/flames-477116-6f96d5f23bf7.json`
2. The file has proper permissions
3. Your GCP project ID is correct: `flames-477116`
4. If using emulator, it's running before starting the backend server

