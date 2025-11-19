#!/bin/bash

# Start both frontend and backend development servers
echo "Starting Rivelya development servers..."

# Function to handle cleanup on script exit
cleanup() {
    echo "Stopping development servers..."
    kill $(jobs -p) 2>/dev/null
    exit
}

# Set up trap to cleanup on script exit
trap cleanup SIGINT SIGTERM EXIT

# Start backend server
echo "Starting backend server..."
cd backend && npm run dev &

# Start frontend server
echo "Starting frontend server..."
cd frontend && npm run dev &

# Wait for all background processes
wait