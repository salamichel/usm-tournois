# Server Dockerfile - Express + TypeScript
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose API port
EXPOSE 3000

# Start development server with tsx watch
CMD ["npm", "run", "dev"]
