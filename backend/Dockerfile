# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

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

# Entry point is api/index.py which exports `app`
CMD ["uvicorn", "api.index:app", "--host", "0.0.0.0", "--port", "7860"]
