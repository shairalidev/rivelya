@echo off
echo Starting Rivelya development servers...

start "Backend" cmd /k "cd backend && npm run dev"
start "Frontend" cmd /k "cd frontend && npm run dev"

echo Both servers started in separate windows.
pause