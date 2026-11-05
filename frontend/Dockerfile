# Stage 1: Build
FROM node:20.18-alpine AS build
WORKDIR /app

# Install dependencies with exact lockfile versions
COPY package.json package-lock.json ./
RUN npm ci

# Copy sources and create production build
COPY . .
RUN npm run build

# Stage 2: Runtime server
FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

# Replace default files with compiled frontend and custom SPA config
RUN rm -rf ./*
COPY --from=build /app/dist .
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
