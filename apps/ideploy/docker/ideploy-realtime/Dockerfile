FROM node:24-alpine

RUN apk add --no-cache git

RUN npm install -g @soketi/soketi@1.x

WORKDIR /terminal

COPY docker/ideploy-realtime/terminal-server.js ./

RUN printf '#!/bin/sh\nnode /terminal/terminal-server.js &\nexec soketi start\n' \
    > /soketi-entrypoint.sh && chmod +x /soketi-entrypoint.sh

EXPOSE 6001 6002
