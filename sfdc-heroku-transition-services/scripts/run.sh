#!/bin/sh
# Main entry point for running on prod Docker containers, i.e. Heroku, to permit debugging.
if [ "$DEBUG" = "1" ]; then
  npm run serve-debug-prod
else
  npm run start
fi
