#!/bin/bash
echo "Starting TiTiler on http://localhost:8000"
uvicorn titiler.application.main:app --host 0.0.0.0 --port 8000
