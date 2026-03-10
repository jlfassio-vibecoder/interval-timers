# Use Node.js LTS version (non-Alpine for better compatibility with native modules)
# Build context must be the monorepo root (e.g. docker build -f apps/app/Dockerfile .)
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files (root package.json + package-lock.json for workspaces)
COPY package*.json ./

# Install all dependencies (including devDependencies and optional dependencies for build)
RUN npm ci --include=optional

# Copy source code
COPY . .

# Build the Astro application (target app workspace in monorepo)
RUN npm run build -w app

# Expose port (Cloud Run will set PORT env var)
EXPOSE 8080

# Start the server
CMD ["npm", "run", "start", "-w", "app"]
