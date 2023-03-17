#!/bin/sh

./deploy/cmd.deploy.smoke.sh

# WARNING - This script is not idempotent, it has side effects, and it should
# only be ran in CI environments.

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