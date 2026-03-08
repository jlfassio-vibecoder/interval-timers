# Use Node.js LTS version (non-Alpine for better compatibility with native modules)
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies and optional dependencies for build)
RUN npm ci --include=optional

# Copy source code
COPY . .

# Build the Astro application
RUN npm run build

# Expose port (Cloud Run will set PORT env var)
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
