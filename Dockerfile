FROM node:24-alpine

LABEL org.opencontainers.image.source="https://github.com/6sense-Technologies/6sense-team-pulse-backend"

WORKDIR /6sense-team-pulse-backend

COPY package*.json ./
RUN yarn install

COPY . .

RUN yarn build

EXPOSE 3000
CMD ["yarn", "start:prod"]
