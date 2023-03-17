#!/bin/sh

if [ -z "$ROBOT_ENS_PROD_DROPLET_PK" ]; then
  echo "ROBOT_ENS_PROD_DROPLET_PK is not set"
  exit 1
fi

if [ -z "$ROBOT_ENS_PROD_DROPLET_IP" ]; then
  echo "ROBOT_ENS_PROD_DROPLET_IP is not set"
  exit 1
fi

mkdir -p ~/.ssh
echo "${ROBOT_ENS_PROD_DROPLET_PK}" > ~/.ssh/robot-ens-prod-v0
chmod 400 ~/.ssh/robot-ens-prod-v0
cat >>~/.ssh/config <<END
Host robot-ens-prod-v0
  HostName ${ROBOT_ENS_PROD_DROPLET_IP}
  User root
  IdentityFile ~/.ssh/robot-ens-prod-v0
  StrictHostKeyChecking no
END
DOCKER_HOST=ssh://robot-ens-prod-v0 docker compose -f ./deploy/docker-compose.yml up --pull -d