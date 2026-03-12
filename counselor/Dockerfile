# --- Build frontend ---
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Production ---
FROM node:20-alpine
WORKDIR /app

# Install backend deps
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/src ./src
COPY backend/tsconfig.json ./

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./public

# Install tsx for running TypeScript directly
RUN npm install tsx

# Expose port
EXPOSE 3001

CMD ["npx", "tsx", "src/server.ts"]
