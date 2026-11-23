# Node 22: Prisma 7 needs 20.19+ and recommends 22.
FROM node:22-alpine
# python3/make/g++ let better-sqlite3 (Prisma 7's SQLite driver) compile if no prebuilt binary fits
RUN apk add --no-cache openssl libc6-compat python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["sh", "scripts/start.sh"]
