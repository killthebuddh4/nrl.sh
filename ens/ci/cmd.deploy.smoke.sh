#!/bin/sh

if [ -z "$ROBOT_ENS_PROD_DROPLET_PK" ]; then
  echo "ROBOT_ENS_PROD_DROPLET_PK is not set"
  exit 1
fi

if [ -z "$ROBOT_ENS_PROD_DROPLET_IP" ]; then
  echo "ROBOT_ENS_PROD_DROPLET_IP is not set"
  exit 1
fi

if [ -z "$GIT_COMMIT_SHORT" ]; then
  echo "GIT_COMMIT_SHORT is not set"
  exit 1
fi

if [ -z "$FRONT_API_KEY" ]; then
  echo "FRONT_API_KEY is not set"
  exit 1
fi

if [ -z "$XMTP_CLIENT_PK" ]; then
  echo "XMTP_CLIENT_PK is not set"
  exit 1
fi

if [ -z "$SUPABASE_KEY" ]; then
  echo "SUPABASE_KEY is not set"
  exit 1
fi

if [ -z "$SUPABASE_URL" ]; then
  echo "SUPABASE_URL is not set"
  exit 1
fi

if [ -z "$ROBOT_DOMAIN" ]; then
  echo "ROBOT_DOMAIN is not set"
  exit 1
fi

if [ -z "$EXPRESS_HOST" ]; then
  echo "EXPRESS_HOST is not set"
  exit 1
fi

if [ -z "$EXPRESS_PORT" ]; then
  echo "EXPRESS_PORT is not set"
  exit 1
fi

if [ -z "$VIRTUAL_HOST" ]; then
  echo "VIRTUAL_HOST is not set"
  exit 1
fi

if [ -z "$OPEN_AI_API_KEY" ]; then
  echo "OPEN_AI_API_KEY is not set"
  exit 1
fi
