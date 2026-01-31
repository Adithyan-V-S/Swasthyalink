---
description: How to build and deploy the latest frontend changes to Firebase Hosting
---

# Deploy Updates to Production

Follow these steps to update your live website.

1. Navigate to the frontend directory
   ```bash
   cd build-frontend
   ```

2. Build the project
   **Important:** This step compiles your code. If this fails, do not proceed.
   ```bash
   npm run build
   ```
   // turbo

3. Go back to project root
   ```bash
   cd ..
   ```

4. Deploy to Firebase
   Values: `swasthyalink-42535` is your project ID.
   ```bash
   firebase deploy --only hosting
   ```
   // turbo
