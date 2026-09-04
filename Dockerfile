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
RUN apk add --no-cache openssl libc6-compat tzdata
WORKDIR /usr/src/app
ENV NODE_ENV=production
# Container mặc định chạy UTC. Mọi mốc "hôm nay / theo ngày" của báo cáo doanh thu
# phải theo giờ khách sạn, nếu không tiền thu từ 00:00–07:00 sẽ rơi vào ngày hôm trước.
ENV TZ=Asia/Ho_Chi_Minh
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --omit=dev
RUN npx prisma generate
COPY --from=builder /usr/src/app/dist ./dist
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
