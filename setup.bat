@echo off
echo ========================================
echo BeyondChats Setup Script
echo ========================================
echo.

REM Check if Node.js is installed
echo [1/6] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo ✓ Node.js is installed
echo.

REM Check if MongoDB is running
echo [2/6] Checking MongoDB...
mongosh --eval "db.version()" >nul 2>&1
if errorlevel 1 (
    echo WARNING: MongoDB is not running or not installed
    echo You can:
    echo   1. Install MongoDB locally, or
    echo   2. Use MongoDB Atlas ^(cloud^) and update MONGODB_URI in .env
) else (
    echo ✓ MongoDB is running
)
echo.

REM Install backend dependencies
echo [3/6] Installing backend dependencies...
cd backend
if not exist node_modules (
    echo Installing packages... This may take a few minutes.
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install backend dependencies
        pause
        exit /b 1
    )
    echo ✓ Backend dependencies installed
) else (
    echo ✓ Backend dependencies already installed
)
echo.

REM Setup backend .env
echo [4/6] Setting up backend environment...
if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env >nul
    echo ✓ Created backend/.env - PLEASE EDIT THIS FILE WITH YOUR API KEYS!
    echo.
    echo IMPORTANT: Edit backend/.env and add:
    echo   - MONGODB_URI (if using Atlas)
    echo   - GEMINI_API_KEY (FREE from https://makersuite.google.com/app/apikey)
    echo   - GOOGLE_API_KEY (optional - has fallback)
    echo.
) else (
    echo ✓ backend/.env already exists
)
echo.

REM Install frontend dependencies
echo [5/6] Installing frontend dependencies...
cd ..\frontend
if not exist node_modules (
    echo Installing packages... This may take a few minutes.
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install frontend dependencies
        cd ..
        pause
        exit /b 1
    )
    echo ✓ Frontend dependencies installed
) else (
    echo ✓ Frontend dependencies already installed
)
echo.

REM Setup frontend .env
echo [6/6] Setting up frontend environment...
if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env >nul
    echo ✓ Created frontend/.env
) else (
    echo ✓ frontend/.env already exists
)
echo.

cd ..

echo ========================================
echo Setup Complete! ✓
echo ========================================
echo.
echo Next Steps:
echo.
echo 1. Edit backend/.env with your API keys:
echo    - MONGODB_URI (your database connection)
echo    - GEMINI_API_KEY (FREE: https://makersuite.google.com/app/apikey)
echo.
echo 2. Start MongoDB (if local):
echo    net start MongoDB
echo.
echo 3. Open THREE terminal windows and run:
echo.
echo    Terminal 1 - Backend:
echo    cd backend
echo    npm run dev
echo.
echo    Terminal 2 - Scraper:
echo    cd backend
echo    npm run scrape
echo.
echo    Terminal 3 - Frontend:
echo    cd frontend
echo    npm run dev
echo.
echo 4. Open browser: http://localhost:5173
echo.
echo For detailed instructions, see QUICKSTART.md
echo.
pause
