FROM node:20-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /usr/src/app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache openssl libc6-compat
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://postgres:postgres123@postgres:5432/hotel_db?schema=public"
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --omit=dev
RUN npx prisma generate
COPY --from=builder /usr/src/app/dist ./dist
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
