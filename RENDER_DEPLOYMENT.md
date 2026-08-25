# Deploying to Render with PDF Support

This guide explains how to deploy your Waibuk application to Render with full PDF processing support.

## Problem

PDF upload functionality requires **GraphicsMagick** and **Ghostscript** system dependencies that aren't installed on Render by default. Without these, PDF uploads will fail with errors.

## Solution

We've created a custom build script that installs the required dependencies during deployment.

## Setup Instructions

### Step 1: Configure Build Command on Render

1. Go to your Render dashboard
2. Select your web service
3. Go to **Settings** → **Build & Deploy**
4. Update the **Build Command** to:
   ```bash
   ./render-build.sh
   ```

### Step 2: Configure Start Command

Set your **Start Command** to:
```bash
npm start
```

### Step 3: Environment Variables

Make sure you have all required environment variables set in Render:

- `DATABASE_URL` - Your PostgreSQL connection string
- `SESSION_SECRET` - A secure random string for sessions
- `NODE_ENV` - Set to `production`
- Any other API keys (Resend, Paystack, etc.)

### Step 4: Deploy

Click **Manual Deploy** → **Deploy latest commit**

The build script will:
1. ✅ Install GraphicsMagick
2. ✅ Install Ghostscript  
3. ✅ Install npm dependencies
4. ✅ Push database schema

## Troubleshooting

### Build fails with "Permission denied"

If the build script isn't executable, add this to your build command:
```bash
chmod +x render-build.sh && ./render-build.sh
```

### PDF uploads still failing

Check the Render logs for specific errors:
1. Go to **Logs** in your Render dashboard
2. Look for "PDF processing error" messages
3. Verify GraphicsMagick was installed during build (look for "System dependencies installed" message)

### Alternative: Use Dockerfile

If the shell script doesn't work, you can use a Dockerfile instead:

```dockerfile
FROM node:20

# Install GraphicsMagick and Ghostscript
RUN apt-get update && apt-get install -y \
    graphicsmagick \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run db:push

EXPOSE 5000

CMD ["npm", "start"]
```

Then configure Render to use Docker deployment.

## Verifying Installation

After deployment, your PDF uploads should work. You can verify by:

1. Logging into your deployed app
2. Creating a yearbook
3. Uploading a PDF file
4. If successful, you'll see pages extracted from the PDF

If you see an error about GraphicsMagick, the system dependencies weren't installed correctly. Review the build logs.

## Important Notes

- **First deployment** may take longer due to system dependency installation (~2-3 minutes)
- **PDF processing** requires both GraphicsMagick AND Ghostscript
- **File uploads** are stored in the `/public/uploads` directory
- Consider using **cloud storage** (like AWS S3) for production file storage to handle server restarts
