# Stage 1: Build the application
FROM node:18-slim AS builder

WORKDIR /usr/src/app

# First, copy over the package.json and package-lock.json
# and install dependencies to leverage Docker layer caching.
COPY backend/package*.json ./
RUN npm install

# Copy the rest of the backend source code
COPY backend/ ./

# Build the TypeScript code
RUN npm run build

# Stage 2: Create the production image
FROM node:18-slim

WORKDIR /usr/src/app

# Copy over the built application and dependencies from the builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY backend/package*.json ./

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application
CMD [ "npm", "run", "start" ]
