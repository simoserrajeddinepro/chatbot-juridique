# ============================================
# Frontend Dockerfile - React + Vite (Multi-stage)
# Build context: project root
# ============================================

# --- Stage 1: Install dependencies ---
FROM node:20-alpine AS deps

WORKDIR /app
COPY fastapi_v2/package.json fastapi_v2/package-lock.json ./
RUN npm ci

# --- Stage 2: Development (Vite dev server with HMR) ---
FROM node:20-alpine AS dev

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY fastapi_v2/ ./

EXPOSE 5173

CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]

# --- Stage 3: Build production assets ---
FROM node:20-alpine AS build

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY fastapi_v2/ ./
RUN npm run build

# --- Stage 4: Production (nginx serving static + reverse proxy) ---
FROM nginx:1.27-alpine AS production

RUN rm /etc/nginx/conf.d/default.conf
COPY docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
