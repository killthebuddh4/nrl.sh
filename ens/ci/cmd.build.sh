#!/bin/sh

./deploy/cmd.build.smoke.sh

docker compose -f ./deploy/docker-compose.yml build