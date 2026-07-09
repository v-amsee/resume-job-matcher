# Base stage: install dependencies once, shared by dev and build stages
FROM node:18-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# used by docker-compose for local dev -- bind-mounts source, runs the vite dev server
FROM deps AS development

WORKDIR /app

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Build stage: compile static assets for production
FROM deps AS build

WORKDIR /app

# Vite inlines these at build time, not runtime, so they have to come in as
# build args (Railway: set as "Build Variables" on the frontend service)
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

COPY . .
RUN npm run build

# Production stage: minimal image that just serves the compiled assets
FROM node:18-alpine AS production

WORKDIR /app

# Install serve to run the app
RUN npm install -g serve

# Copy built assets from build stage
COPY --from=build /app/dist ./dist

EXPOSE 3000

# shell form so $PORT expands -- defaults to 3000 outside Railway
CMD serve -s dist -l ${PORT:-3000}
