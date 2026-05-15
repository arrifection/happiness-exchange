# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /code

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port FastAPI will run on
# Hugging Face Spaces uses port 7860 by default
EXPOSE 7860

# Command to run the application
# We use 0.0.0.0 to allow external connections
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
