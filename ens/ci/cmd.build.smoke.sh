#!/bin/sh

if [ -z "$GIT_COMMIT_SHORT" ]; then
  echo "GIT_COMMIT_SHORT is not set"
  exit 1
fi
