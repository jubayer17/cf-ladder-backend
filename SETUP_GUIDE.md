# 🚀 Complete Setup Guide - Fixing Vercel Deployment

## 📊 Current Status

| Component                  | Status        | Issue                                              |
| -------------------------- | ------------- | -------------------------------------------------- |
| Local Backend (port 4000)  | ✅ Working    | None                                               |
| Local Frontend (port 3001) | ✅ Working    | None                                               |
| Vercel Backend             | ❌ 503 Error  | MongoDB connection failing                         |
| MongoDB Atlas              | ✅ Working    | 2,051 contests stored                              |
| Root Cause                 | 🔍 Identified | `MONGODB_URI` points to localhost instead of Atlas |

---

## 🎯 Root Cause Analysis

**Error from Vercel:**

```
connect ECONNREFUSED 127.0.0.1:27017
```

**What this means:**

- Vercel's `MONGODB_URI` environment variable is set to `mongodb://localhost:27017/cf-ladder`
- This is your **local development** database URL
- It should be your **MongoDB Atlas cloud** URL: `mongodb+srv://jubayer17:4321jubu4321@cluster0.52j8x0j.mongodb.net/cf-ladder`

---

## 🔧 Fix Steps (MUST DO NOW)

### Step 1: Update Vercel Environment Variable

1. **Open Vercel Dashboard:**

   - Go to: https://vercel.com/dashboard
   - Click on: `cf-ladder-backend` project

2. **Navigate to Settings:**

   - Click **Settings** tab
   - Click **Environment Variables** in the left sidebar

3. **Find and Edit MONGODB_URI:**

   - Look for the variable named `MONGODB_URI`
   - Current value: `mongodb://localhost:27017/cf-ladder` ❌
   - Click **Edit** or **Delete** then **Add New**

4. **Enter Correct MongoDB Atlas URL:**
   ```
   mongodb+srv://jubayer17:4321jubu4321@cluster0.52j8x0j.mongodb.net/cf-ladder
   ```
5. **Select ALL Environments:**

   - ✅ Production
   - ✅ Preview
   - ✅ Development

6. **Save Changes**

### Step 2: Redeploy on Vercel

1. Go to **Deployments** tab
2. Click on the **most recent deployment**
3. Click **⋯ menu** (three dots button)
4. Click **Redeploy**
5. Confirm by clicking **Redeploy** again
6. **Wait 1-2 minutes** for deployment to complete

### Step 3: Test Vercel Deployment

After redeployment completes, run this from your backend folder:

```bash
node test-vercel-health.mjs
```

**Expected output:**

```json
{
  "status": "ok",
  "mongodb": "connected", // ← Should say "connected"
  "env": {
    "hasMongoUri": true,
    "nodeEnv": "production"
  }
}
```

**If you see `"mongodb": "connected"` ✅ - Vercel is fixed!**

### Step 4: Update Frontend to Use Vercel

Once Vercel backend is working, update your frontend:

**Edit:** `frontend/.env.local`

```bash
# Change from:
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# To:
NEXT_PUBLIC_API_BASE_URL=https://cf-ladder-backend.vercel.app
```

**Restart your frontend:**

```bash
# Stop the frontend (Ctrl+C)
# Then restart:
npm run dev
```

---

## 🧪 Testing Checklist

After fixing Vercel:

- [ ] Health check returns "connected"

  ```bash
  curl https://cf-ladder-backend.vercel.app/api/health
  ```

- [ ] Contests endpoint works

  ```bash
  curl https://cf-ladder-backend.vercel.app/api/contests/by-category?limit=5
  ```

- [ ] Frontend loads contests from Vercel

  - Open browser console (F12)
  - Should see: `🔗 Backend API URL: https://cf-ladder-backend.vercel.app`
  - Should NOT see any CORS or 503 errors

- [ ] "Update contests" button works
  - Click the button
  - Should sync successfully
  - New contests should appear

---

## 📋 What We Fixed

### Backend Changes (Already Deployed to GitHub):

1. ✅ Added MongoDB connection validation
2. ✅ Added health check endpoint (`/api/health`)
3. ✅ Improved error handling with detailed messages
4. ✅ Added connection retry logic
5. ✅ Fixed CORS configuration
6. ✅ Added connection state checking before queries

### Frontend Changes (Local):

1. ✅ Made backend URL configurable via environment variable
2. ✅ Added console logging for debugging
3. ✅ Set to use localhost temporarily (until Vercel is fixed)

---

## 🔍 Verification Commands

### Test Local Backend:

```bash
# In backend folder:
npm run dev

# In another terminal:
curl http://localhost:4000/api/health
curl http://localhost:4000/api/contests/by-category?limit=5
```

### Test Vercel Backend (after fix):

```bash
curl https://cf-ladder-backend.vercel.app/api/health
curl https://cf-ladder-backend.vercel.app/api/contests/by-category?limit=5
```

### Test Frontend:

```bash
# In frontend folder:
npm run dev

# Open browser: http://localhost:3001/contests
# Check browser console (F12) for:
# - Backend API URL being used
# - Any error messages
```

---

## ⚠️ Common Mistakes to Avoid

1. **❌ Don't use quotes around MongoDB URI**

   - Wrong: `"mongodb+srv://..."`
   - Right: `mongodb+srv://...`

2. **❌ Don't forget to select all environments**

   - Must check: Production, Preview, Development

3. **❌ Don't forget to redeploy after changing env vars**

   - Environment variable changes require redeployment

4. **❌ Don't use localhost in production**
   - `127.0.0.1` or `localhost` won't work on Vercel

---

## 🎯 Quick Summary

**What's wrong:** Vercel can't connect to MongoDB because `MONGODB_URI` points to localhost

**What to do:**

1. Update `MONGODB_URI` in Vercel to MongoDB Atlas URL
2. Redeploy on Vercel
3. Test with `node test-vercel-health.mjs`
4. If working, update frontend `.env.local` to use Vercel URL

**Time to fix:** 2-3 minutes (mostly waiting for Vercel to redeploy)

---

## 📞 Need Help?

If you still see errors after following these steps:

1. **Check Vercel deployment logs:**

   - Vercel Dashboard → Deployments → Click deployment → View Function Logs

2. **Verify MongoDB Atlas:**

   - Log into MongoDB Atlas
   - Check if cluster is running
   - Verify Network Access allows `0.0.0.0/0` (allow from anywhere)

3. **Test MongoDB connection string locally:**
   ```bash
   # In backend folder, create test-mongo.mjs:
   node test-mongo.mjs
   ```

---

## ✅ Success Indicators

You'll know everything is working when:

- ✅ No more 503 errors in browser console
- ✅ Contests page loads instantly
- ✅ "Update contests" button works
- ✅ Health check shows `"mongodb": "connected"`
- ✅ No CORS errors
- ✅ Frontend console shows Vercel URL being used
