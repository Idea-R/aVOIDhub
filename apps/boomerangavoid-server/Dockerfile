FROM node:22.23.2-bookworm-slim
WORKDIR /app
COPY . .
RUN npm ci --ignore-scripts
ENV NODE_ENV=production BAV_BIND=0.0.0.0 PORT=2777
EXPOSE 2777
USER node
CMD ["npm","run","start","--workspace=@avoid/boomerangavoid-server"]
