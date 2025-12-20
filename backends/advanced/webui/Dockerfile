# Multi-stage build for React app
FROM node:22-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (with legacy-peer-deps for react-gantt-timeline compatibility)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Accept build arguments
ARG VITE_ALLOWED_HOSTS
ENV VITE_ALLOWED_HOSTS=${VITE_ALLOWED_HOSTS}

ARG VITE_BASE_PATH
ENV VITE_BASE_PATH=${VITE_BASE_PATH:-/}

ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

# Debug: Print BASE_PATH value (forces cache invalidation when changed)
RUN echo "Building with VITE_BASE_PATH=${VITE_BASE_PATH}"

# Build the application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine AS production

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built app from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]