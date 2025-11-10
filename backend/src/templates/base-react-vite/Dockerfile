FROM node:18-alpine

WORKDIR /app

# Copy package files and install all dependencies, including express
COPY package*.json ./
RUN npm install

# Copy the rest of the source code, including the new server.cjs
COPY . .

# Build the Vite app
RUN npm run build

# Expose the port Cloud Run will use
EXPOSE $PORT

# Start the server
CMD ["node", "server.cjs"]
