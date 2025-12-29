# BeyondChats Article Management System

A comprehensive full-stack application for scraping, optimizing, and managing articles using AI-powered content enhancement.

## 🚀 Features

### Phase 1: Web Scraping & CRUD APIs
- Scrapes articles from BeyondChats blog (last page, 5 oldest articles)
- MongoDB database storage with Mongoose ORM
- RESTful CRUD API endpoints
- Express.js backend server

### Phase 2: AI-Powered Content Optimization
- Automated Google search for similar articles
- Web scraping of top-ranking articles
- Google Gemini AI integration for content optimization
- Reference citation system
- Version control (original vs optimized content)

### Phase 3: React Frontend
- Modern, responsive UI with TailwindCSS
- Article listing with filtering (All/Original/Optimized)
- Detailed article view with multiple viewing modes
- Side-by-side comparison of original and optimized content
- Reference source display

## 📋 Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or Atlas)
- Google Custom Search API credentials (optional, has Puppeteer fallback)
- Google Gemini API key (free tier available)

## 🛠️ Installation

### 1. Clone the Repository

```bash
cd c:\Users\ujjwa\beyondchats
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
copy .env.example .env
```

Edit `backend/.env` with your configuration:

```env
MONGODB_URI=mongodb://localhost:27017/beyondchats
PORT=5000
NODE_ENV=development

# Google Custom Search API (Optional - will fallback to Puppeteer)
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here

# Google Gemini API (Required for Phase 2)
GEMINI_API_KEY=your_gemini_api_key_here

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Create .env file
copy .env.example .env
```

Edit `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## 🚀 Usage

### Step 1: Start MongoDB

Make sure MongoDB is running on your system:

```bash
# Windows (if installed as service)
net start MongoDB

# Or use MongoDB Atlas connection string in .env
```

### Step 2: Start Backend Server

```bash
cd backend
npm run dev
```

Server will start on http://localhost:5000

### Step 3: Run Phase 1 - Scrape Articles

In a new terminal:

```bash
cd backend
npm run scrape
```

This will:
- Navigate to BeyondChats blog
- Find the last page
- Scrape 5 oldest articles
- Store them in MongoDB

### Step 4: Run Phase 2 - Optimize Articles (Optional)

```bash
cd backend
npm run optimize
```

This will:
- Fetch unoptimized articles from database
- Search Google for similar articles
- Scrape top 2 results
- Use OpenAI GPT-4 to optimize content
- Add reference citations
- Update articles in database

**Note:** This requires GEMINI_API_KEY in your .env file.

### Step 5: Start Frontend

In a new terminal:

```bash
cd frontend
npm run dev
```

Frontend will start on http://localhost:5173

## 📡 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Endpoints

#### Get All Articles
```http
GET /articles?page=1&limit=10&isUpdated=true
```

**Query Parameters:**
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Items per page (default: 50)
- `isUpdated` (optional): Filter by updated status ("true" or "false")

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "pages": 1
  }
}
```

#### Get Single Article
```http
GET /articles/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "title": "Article Title",
    "content": "...",
    "url": "...",
    "isUpdated": false,
    "references": [],
    "createdAt": "2025-12-29T...",
    "updatedAt": "2025-12-29T..."
  }
}
```

#### Create Article
```http
POST /articles
Content-Type: application/json

{
  "title": "Article Title",
  "content": "Article content...",
  "url": "https://example.com/article",
  "source": "BeyondChats"
}
```

#### Update Article
```http
PUT /articles/:id
Content-Type: application/json

{
  "content": "Updated content...",
  "isUpdated": true,
  "references": [...]
}
```

#### Delete Article
```http
DELETE /articles/:id
```

## 🏗️ Project Structure

```
beyondchats/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js          # MongoDB connection
│   │   ├── models/
│   │   │   └── Article.js           # Article schema
│   │   ├── routes/
│   │   │   └── articles.js          # CRUD API routes
│   │   ├── scripts/
│   │   │   ├── scrape-beyondchats.js   # Phase 1 scraper
│   │   │   └── optimize-articles.js    # Phase 2 optimizer
│   │   └── server.js                # Express server
│   ├── .env.example
│   ├── .gitignore
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Header.jsx           # Navigation header
    │   │   ├── ArticleList.jsx      # Article listing
    │   │   └── ArticleDetail.jsx    # Article detail view
    │   ├── services/
    │   │   └── api.js               # API client
    │   ├── App.jsx                  # Main app component
    │   ├── App.css
    │   ├── index.css                # Tailwind styles
    │   └── main.jsx                 # Entry point
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── .env.example
    └── package.json
```

## 🔧 Technologies Used

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **Puppeteer** - Web scraping
- **Axios** - HTTP client
- **Google Gemini API** - Content optimization

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **React Router** - Routing
- **TailwindCSS** - Styling
- **Axios** - API requests

## 🎨 Features Breakdown

### Frontend Features

1. **Article List View**
   - Grid layout with responsive design
   - Filter by status (All/Original/Optimized)
   - Pagination support
   - Article previews with metadata
   - Status badges

2. **Article Detail View**
   - Three viewing modes:
     - Current/Optimized version
     - Original version
     - Side-by-side comparison
   - Markdown rendering
   - Reference citations with links
   - Metadata display (date, author, source)

3. **UI/UX**
   - Professional, modern design
   - Fully responsive (mobile, tablet, desktop)
   - Loading states
   - Error handling
   - Smooth transitions

### Backend Features

1. **Scraping Engine**
   - Robust selector fallbacks
   - Error handling
   - Rate limiting
   - Full content extraction
   - Duplicate detection

2. **Optimization Engine**
   - Google Search integration (API + fallback)
   - Multi-source content analysis
   - Gemini AI-powered rewriting
   - Citation management
   - Version control

3. **API Server**
   - RESTful design
   - CORS support
   - Error handling
   - Pagination
   - Filtering

## 🔑 Getting API Keys

### Google Gemini API Key (Required for Phase 2) - FREE!

1. **Go to Google AI Studio:** https://makersuite.google.com/app/apikey
2. **Sign in** with your Google account
3. **Click "Create API Key"**
4. **Select or create a project**
5. **Copy the API key** and add to `backend/.env`:
   ```env
   GEMINI_API_KEY=your_actual_key_here
   ```

**Gemini Free Tier:**
- ✅ 60 requests per minute
- ✅ Completely FREE
- ✅ No credit card required
- ✅ Perfect for this project!

### Google Custom Search API (Optional)
1. Go to https://developers.google.com/custom-search/v1/introduction
2. Get an API key
3. Create a Custom Search Engine at https://cse.google.com/
4. Get the Search Engine ID
5. Add to .env file

**Note:** If you don't provide Google API credentials, the system will automatically use Puppeteer to scrape Google search results.

## 📝 Scripts

### Backend Scripts

```bash
# Start development server (with auto-reload)
npm run dev

# Start production server
npm start

# Run article scraper (Phase 1)
npm run scrape

# Run article optimizer (Phase 2)
npm run optimize
```

### Frontend Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🐛 Troubleshooting

### Backend Issues

**MongoDB Connection Error**
```bash
# Check if MongoDB is running
mongosh

# Or use MongoDB Atlas connection string
```

**Puppeteer Installation Issues**
```bash
# Windows: Install Chrome/Chromium manually
# Set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true before npm install
```

**Scraping Fails**
- Check internet connection
- Website structure may have changed (update selectors)
- Add delays between requests
- Check for CAPTCHA or bot detection

### Frontend Issues

**API Connection Error**
- Ensure backend server is running on port 5000
- Check VITE_API_BASE_URL in .env
- Verify CORS settings in backend

**Build Errors**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 🚀 Deployment

### Backend Deployment (Example: Heroku)

```bash
# Add Procfile
echo "web: node src/server.js" > Procfile

# Deploy
heroku create beyondchats-api
heroku addons:create mongolab
git push heroku main
```

### Frontend Deployment (Example: Vercel)

```bash
# Build
npm run build

# Deploy to Vercel
vercel --prod
```

## 📄 License

MIT License

## 👥 Author

Your Name

## 🙏 Acknowledgments

- BeyondChats for the source articles
- OpenAI for GPT-4 API
- Google Custom Search API
- All open-source libraries used

## 📧 Support

For issues or questions, please create an issue in the repository.

---

**Happy Coding! 🎉**
