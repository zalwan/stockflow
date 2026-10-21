FROM golang:1.25-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /out/api ./cmd/api && CGO_ENABLED=0 go build -trimpath -o /out/migrate ./cmd/migrate

FROM alpine:3.20 AS base
WORKDIR /app
RUN adduser -D -u 10001 stockflow
USER stockflow

FROM base AS migrator
COPY --from=build /out/migrate /app/migrate
ENTRYPOINT ["/app/migrate"]

FROM base AS api
COPY --from=build /out/api /app/api
EXPOSE 8080
ENTRYPOINT ["/app/api"]
