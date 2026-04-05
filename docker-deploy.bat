@echo off
REM Docker Build and Push Script for Crowd Detection System
REM Username: rjrohan

echo ========================================
echo Crowd Detection - Docker Deployment
echo ========================================
echo.

:menu
echo Choose an option:
echo 1. Login to DockerHub
echo 2. Build Backend Image
echo 3. Build Frontend Image
echo 4. Build All Images
echo 5. Push Backend to DockerHub
echo 6. Push Frontend to DockerHub
echo 7. Push All Images
echo 8. Run with Docker Compose
echo 9. Stop Docker Compose
echo 10. View Logs
echo 11. Complete Build and Push (All)
echo 0. Exit
echo.

set /p choice="Enter your choice: "

if "%choice%"=="1" goto login
if "%choice%"=="2" goto build_backend
if "%choice%"=="3" goto build_frontend
if "%choice%"=="4" goto build_all
if "%choice%"=="5" goto push_backend
if "%choice%"=="6" goto push_frontend
if "%choice%"=="7" goto push_all
if "%choice%"=="8" goto run_compose
if "%choice%"=="9" goto stop_compose
if "%choice%"=="10" goto view_logs
if "%choice%"=="11" goto complete
if "%choice%"=="0" goto end

echo Invalid choice!
goto menu

:login
echo.
echo Logging in to DockerHub...
docker login
echo.
pause
goto menu

:build_backend
echo.
echo Building Backend Image...
cd backend
docker build -t rjrohan/crowd-detection-backend:latest .
cd ..
echo Backend image built successfully!
echo.
pause
goto menu

:build_frontend
echo.
echo Building Frontend Image...
cd frontend
docker build -t rjrohan/crowd-detection-frontend:latest .
cd ..
echo Frontend image built successfully!
echo.
pause
goto menu

:build_all
echo.
echo Building All Images...
docker-compose build
echo All images built successfully!
echo.
pause
goto menu

:push_backend
echo.
echo Pushing Backend Image to DockerHub...
docker push rjrohan/crowd-detection-backend:latest
echo Backend image pushed successfully!
echo.
pause
goto menu

:push_frontend
echo.
echo Pushing Frontend Image to DockerHub...
docker push rjrohan/crowd-detection-frontend:latest
echo Frontend image pushed successfully!
echo.
pause
goto menu

:push_all
echo.
echo Pushing All Images to DockerHub...
docker push rjrohan/crowd-detection-backend:latest
docker push rjrohan/crowd-detection-frontend:latest
echo All images pushed successfully!
echo.
pause
goto menu

:run_compose
echo.
echo Starting Docker Compose...
docker-compose up -d
echo.
echo Services started!
echo Frontend: http://localhost
echo Backend: http://localhost:5000
echo.
pause
goto menu

:stop_compose
echo.
echo Stopping Docker Compose...
docker-compose down
echo Services stopped!
echo.
pause
goto menu

:view_logs
echo.
echo Viewing logs (Press Ctrl+C to exit)...
docker-compose logs -f
pause
goto menu

:complete
echo.
echo ========================================
echo Complete Build and Push Process
echo ========================================
echo.
echo Step 1: Logging in to DockerHub...
docker login
echo.
echo Step 2: Building Backend Image...
cd backend
docker build -t rjrohan/crowd-detection-backend:latest .
cd ..
echo.
echo Step 3: Building Frontend Image...
cd frontend
docker build -t rjrohan/crowd-detection-frontend:latest .
cd ..
echo.
echo Step 4: Pushing Backend Image...
docker push rjrohan/crowd-detection-backend:latest
echo.
echo Step 5: Pushing Frontend Image...
docker push rjrohan/crowd-detection-frontend:latest
echo.
echo ========================================
echo All Done! Images are on DockerHub
echo ========================================
echo.
echo Your images:
echo - rjrohan/crowd-detection-backend:latest
echo - rjrohan/crowd-detection-frontend:latest
echo.
pause
goto menu

:end
echo.
echo Goodbye!
exit
