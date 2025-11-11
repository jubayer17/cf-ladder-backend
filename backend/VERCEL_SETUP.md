# 🚨 CRITICAL: Vercel Environment Variable Issue Detected

## Problem

The MongoDB connection is failing on Vercel with error:

```
connect ECONNREFUSED 127.0.0.1:27017
```

This means the `MONGODB_URI` environment variable in Vercel is set to `mongodb://localhost:27017/cf-ladder` (local development URL) instead of your MongoDB Atlas URL.

## Solution

### Step 1: Go to Vercel Dashboard

1. Visit https://vercel.com/dashboard
2. Click on your project: **cf-ladder-backend**
3. Click on **Settings** tab
4. Click on **Environment Variables** in the left sidebar

### Step 2: Update MONGODB_URI

1. Find the existing `MONGODB_URI` variable
2. **DELETE** the old value or click Edit
3. Replace with your **MongoDB Atlas connection string**:
   ```
   mongodb+srv://jubayer17:4321jubu4321@cluster0.52j8x0j.mongodb.net/cf-ladder
   ```

### Step 3: Apply to All Environments

Make sure the variable is checked for:

- ✅ Production
- ✅ Preview
- ✅ Development

### Step 4: Redeploy

1. After saving the environment variable, go to **Deployments** tab
2. Click on the latest deployment
3. Click the **three dots menu** (⋯)
4. Click **Redeploy**
5. Select "Use existing build cache" (faster) or rebuild (slower but safer)
6. Click **Redeploy**

### Step 5: Wait and Test

1. Wait 1-2 minutes for deployment to complete
2. Test the health endpoint:

   ```bash
   curl https://cf-ladder-backend.vercel.app/api/health
   ```

   Should show:

   ```json
   {
     "status": "ok",
     "mongodb": "connected", // ← Should be "connected"
     "env": {
       "hasMongoUri": true,
       "nodeEnv": "production"
     }
   }
   ```

3. Test the contests endpoint:

   ```bash
   curl https://cf-ladder-backend.vercel.app/api/contests/by-category?limit=5
   ```

   Should return contest data with status 200

## Common Mistakes to Avoid

- ❌ Using `localhost` or `127.0.0.1` in production
- ❌ Forgetting to redeploy after changing environment variables
- ❌ Not selecting all environments (Production, Preview, Development)
- ❌ Including quotes around the MongoDB URI (just paste the raw string)

## Current Status

- ✅ Code is deployed correctly
- ✅ Health check endpoint is working
- ✅ CORS is configured properly
- ✅ Error handling is in place
- ❌ **MONGODB_URI points to localhost instead of Atlas**

## After Fixing

Once you've updated the environment variable and redeployed:

1. Run the test script:

   ```bash
   node test-vercel-health.mjs
   ```

2. Update your frontend to use the Vercel URL:
   In `frontend/src/app/contests/page.tsx`, change line 12:
   ```typescript
   const BACKEND_API = "https://cf-ladder-backend.vercel.app";
   ```

## MongoDB Atlas Connection String Format

```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
```

Your specific connection string:

```
mongodb+srv://jubayer17:4321jubu4321@cluster0.52j8x0j.mongodb.net/cf-ladder
```

## Need Help?

If you still see issues after updating:

1. Check Vercel deployment logs for errors
2. Verify your MongoDB Atlas cluster allows connections from anywhere (0.0.0.0/0)
3. Make sure your MongoDB Atlas user has read/write permissions
4. Try accessing MongoDB Atlas dashboard to confirm the cluster is running
