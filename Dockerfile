FROM python:3.10-slim

WORKDIR /app

# Copy all project files into the container
COPY . .

# Expose port 8000 (which is the default port the server runs on)
EXPOSE 8000

# Start the Python server in unbuffered mode to see logs immediately
CMD ["python", "-u", "server.py"]
