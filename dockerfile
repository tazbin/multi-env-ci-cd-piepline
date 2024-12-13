FROM node:20-alpine as base
WORKDIR /app
COPY package*.json ./

FROM base as development
RUN npm ci
COPY . .
EXPOSE 3000
CMD [ "npm", "run", "dev" ]

FROM base as production
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD [ "npm", "run", "start" ]