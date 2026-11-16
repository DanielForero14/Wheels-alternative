# syntax=docker/dockerfile:1

# Etapa 1: instalar solo las dependencias de producción (las pruebas corren en el pipeline de CI)
FROM node:24.22.2-bookworm-slim AS dependencias
WORKDIR /src
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# Etapa 2: imagen final solo con Node, las dependencias y el código
FROM node:24.22.2-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencias --chown=node:node /src/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

# Carpeta de la base de datos SQLite; en Compose se monta un volumen aquí
RUN mkdir /app/datos && chown node:node /app/datos
ENV RUTA_BD=/app/datos/wheels.db

# Usuario sin privilegios que ya trae la imagen oficial de Node
USER node
EXPOSE 3000

# La ruta "/" responde sin depender de servicios externos. La imagen slim no trae curl: se usa fetch de Node
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
