# 🚀 Quick Start Guide

Follow these steps to get the BeyondChats Article Management System up and running.

## Prerequisites Checklist

- [ ] Node.js installed (v18+)
- [ ] MongoDB installed or MongoDB Atlas account
- [ ] Google Gemini API key (FREE - for Phase 2)
- [ ] Text editor (VS Code recommended)

## 5-Minute Setup

### 1. Install Backend Dependencies

```bash
cd c:\Users\ujjwa\beyondchats\backend
npm install
```

### 2. Configure Backend Environment

```bash
# Copy example env file
copy .env.example .env
```

**Edit `.env` file** - Minimum required:
```env
MONGODB_URI=mongodb://localhost:27017/beyondchats
PORT=5000
GEMINI_API_KEY=your_gemini_key_here
```

**Get FREE Gemini API Key:**
1. Visit: https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy and paste into .env

### 3. Install Frontend Dependencies

```bash
cd ..\frontend
npm install
```

### 4. Start MongoDB

```bash
# If MongoDB is installed as Windows service
net start MongoDB

# Or use MongoDB Atlas connection string in .env
```

### 5. Start Backend Server

```bash
cd ..\backend
npm run dev
```

✅ Backend running at http://localhost:5000

### 6. Scrape Initial Articles (in new terminal)

```bash
cd c:\Users\ujjwa\beyondchats\backend
npm run scrape
```

⏳ Wait 1-2 minutes for scraping to complete

### 7. Start Frontend (in new terminal)

```bash
cd c:\Users\ujjwa\beyondchats\frontend
npm run dev
```

✅ Frontend running at http://localhost:5173

### 8. Open Browser

Navigate to: **http://localhost:5173**
Gemini API key (FREE!)
You should see the article listing page!

## Optional: Run Article Optimization (Phase 2)

**Important:** Requires OpenAI API key

```bash
cd c:\Users\ujjwa\beyondchats\backend
npm run optimize
```

This will:
- Search Google for similar articles
- Scrape top 2 results
- Use AI to optimize content
- Takes 5-10 minutes depending on number of articles

## Testing the System

### 1. Test Backend API

Open browser or use curl:
```bash
# Get all articles
curl http://localhost:5000/api/articles

# Or just visit in browser
http://localhost:5000/api/articles
```

### 2. Test Frontend

- Visit http://localhost:5173
- Click on an article
- Try the filter buttons (All/Original/Optimized)
- After running optimizer, test the "Side-by-Side" comparison view

## Common Issues

### Issue: MongoDB Connection Failed
**Solution:** 
```bash
# Check MongoDB is running
mongosh

# Or update MONGODB_URI in .env to use Atlas
```

### Issue: Scraper finds no articles
**Solution:** 
- Check internet connection
- Website structure may have changed
- Look at console logs for specific errors

### Issue: Frontend shows "Failed to fetch"
**Solution:**
- Ensure backend is running on port 5000
- Check browser console for CORS errors
- Verify VITE_API_BASE_URL in frontend/.env

### Issue: Gemini API Error
**Solution:**
- Verify API key is correct in .env
- Get free key at: https://makersuite.google.com/app/apikey
- Check you have internet connection

## Next Steps

1. ✅ **Phase 1 Complete:** You can now view scraped articles
2. ✅ **Phase 2 Complete:** Run optimizer to enhance articles with AI
3. ✅ **Phase 3 Complete:** Browse articles in the beautiful UI

## Useful Commands

```bash
# Backend
cd backend
npm run dev        # Start with auto-reload
npm run scrape     # Scrape new articles
npm run optimize   # Run AI optimization

# Frontend
cd frontend
npm run dev        # Start dev server
npm run build      # Build for production
npm run preview    # Preview production build
```

## Project Structure Overview

```
beyondchats/
├── backend/          # Node.js + Express API
│   ├── src/
│   │   ├── models/          # MongoDB schemas
│   │   ├── routes/          # API endpoints
│   │   ├── scripts/         # Scraper & optimizer
│   │   └── server.js        # Main server file
│   └── package.json
│
└── frontend/         # React + Vite UI
    ├── src/
    │   ├── components/      # React components
    │   ├── services/        # API client
    │   └── App.jsx          # Main app
    └── package.json
```

## Getting Help

- Check [README.md](README.md) for detailed documentation
- Review error messages in terminal
- Check browser console for frontend errors
- Verify all environment variables are set

---

**Enjoy building with BeyondChats! 🎉**
