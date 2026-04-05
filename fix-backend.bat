@echo off
echo Fixing Backend Container...
echo.

echo Step 1: Stopping containers...
docker-compose down

echo.
echo Step 2: Removing old backend image...
docker rmi crowd-backend 2>nul
docker rmi rjrohan/crowd-detection-backend:latest 2>nul

echo.
echo Step 3: Rebuilding backend...
cd backend
docker build -t rjrohan/crowd-detection-backend:latest .
cd ..

echo.
echo Step 4: Starting containers...
docker-compose up -d

echo.
echo Step 5: Checking backend logs...
timeout /t 5 >nul
docker logs crowd-detection-backend

echo.
echo Done! Check if backend is running above.
echo If you see "Model ready for detection!" then it's working.
pause
