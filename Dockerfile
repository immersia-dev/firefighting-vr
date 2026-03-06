# ---- Stage 1: Build with Vite ----
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.mjs ./
COPY public ./public

RUN npm run build

# ---- Stage 2: Serve with nginx (HTTPS for WebXR) ----
FROM nginx:alpine

# Generate self-signed certificate for WebXR HTTPS requirement
RUN apk add --no-cache openssl && \
    mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 3650 \
      -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/selfsigned.key \
      -out /etc/nginx/ssl/selfsigned.crt \
      -subj "/CN=localhost" && \
    apk del openssl

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 443 80

CMD ["nginx", "-g", "daemon off;"]
