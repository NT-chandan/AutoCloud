#!/bin/bash
# Enables use of Heroku Exec on Docker containers.
# See https://devcenter.heroku.com/articles/exec#using-with-docker. Really uses bash but named .sh as per doc.
[ -z "$SSH_CLIENT" ] && source <(curl --fail --retry 3 -sSL "$HEROKU_EXEC_URL")
