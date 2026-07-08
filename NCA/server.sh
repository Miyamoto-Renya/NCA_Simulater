#!/bin/bash

PORT=8000
PID_FILE=".server.pid"

start_server() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null; then
            echo "Server is already running on port $PORT (PID $PID)."
            return
        else
            echo "Previous PID file found. Deleting..."
            rm "$PID_FILE"
        fi
    fi

    echo "Starting server on port $PORT..."
    # Run Python built-in HTTP server in background
    python3 -m http.server $PORT > server.log 2>&1 &
    PID=$!
    echo $PID > "$PID_FILE"
    echo "Server started (PID $PID)."
    echo "Access URL: http://localhost:$PORT"
}

stop_server() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null; then
            echo "Stopping server (PID $PID)..."
            kill $PID
            rm "$PID_FILE"
            echo "Server stopped."
        else
            echo "Server is not running (no process with PID $PID). Deleting PID file."
            rm "$PID_FILE"
        fi
    else
        echo "PID file not found. Please verify if the server is running."
        # We could kill any running python3 http.server processes,
        # but we manage it strictly based on the PID file to avoid affecting other projects.
    fi
}

status_server() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null; then
            echo "Server is running on port $PORT (PID $PID)."
        else
            echo "Server is not running (stale PID file exists)."
        fi
    else
        echo "Server is not running."
    fi
}

clear_log() {
    if [ -f "server.log" ]; then
        > "server.log"
        echo "Contents of server.log have been cleared."
    else
        echo "server.log file does not exist."
    fi
}

case "$1" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    status)
        status_server
        ;;
    restart)
        stop_server
        sleep 1
        start_server
        ;;
    clear-log)
        clear_log
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart|clear-log}"
        exit 1
esac
