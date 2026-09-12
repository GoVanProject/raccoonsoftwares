FROM golang:1.23-alpine AS builder

WORKDIR /src
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/taskboard ./cmd/server

FROM alpine:3.21

RUN apk add --no-cache ca-certificates wget \
  && addgroup -S taskboard \
  && adduser -S -G taskboard taskboard \
  && mkdir -p /data \
  && chown -R taskboard:taskboard /data

COPY --from=builder /out/taskboard /usr/local/bin/taskboard

USER taskboard
WORKDIR /data
ENV DATA_FILE=/data/taskboard.json
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/taskboard"]
