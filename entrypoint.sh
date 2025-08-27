#!/bin/sh
ROOT_DIR=/usr/share/nginx/html
VITE_API_URL=${VITE_API_URL:-"http://localhost:8080/api/cheese-auth"}
VITE_SANDBOX_URL=${VITE_SANDBOX_URL:-"http://localhost:8080/api/sandbox"}
VITE_SANDBOX_URL=${ENABLE_USERNAME_LOGIN:-"true"}

echo "window.runtimeConfig = { VITE_API_URL: '${VITE_API_URL}', VITE_SANDBOX_URL: '${VITE_SANDBOX_URL}', ENABLE_USERNAME_LOGIN: ${ENABLE_USERNAME_LOGIN} };" > ${ROOT_DIR}/config.js
echo "Generated ${ROOT_DIR}/config.js with API URL: ${VITE_API_URL}"

exec "$@"
