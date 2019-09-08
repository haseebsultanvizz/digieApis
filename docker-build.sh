#!/bin/bash

# This script builds the docker image and pushes it to the docker hub.

# This script assumes the user running has the following set up:
# 1. Docker commands are allowed. (the user is in the docker group)
# 2. The AWS command line tools are installed and configured (aws configure) for this user.

set -e

DOCKER_REPO=941319116360.dkr.ecr.us-east-1.amazonaws.com
DOCKER_IMAGE=digieapis
DOCKER_TAG=latest

if [ $1 ]; then
    # Bamboo should pass a build number or something here.
    DOCKER_TAG=$1
fi


# Docker build
docker build -t $DOCKER_IMAGE:$DOCKER_TAG .
# Tag and push to ECR
docker tag $DOCKER_IMAGE:$DOCKER_TAG $DOCKER_REPO/$DOCKER_IMAGE:$DOCKER_TAG

# Log into docker
eval $(aws ecr get-login --no-include-email --region us-east-1)
docker push $DOCKER_REPO/$DOCKER_IMAGE:$DOCKER_TAG

