
FROM node:20-alpine AS build
WORKDIR /app


COPY package*.json ./
RUN npm ci


COPY . .
RUN npm run build


FROM nginx:alpine-slim
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Drop privileges (Security best practice for Edge/Cloud Native)
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

USER nginx

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
