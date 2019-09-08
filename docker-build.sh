#!/bin/bash
set -x

# This script builds the docker image and pushes it to the docker hub.

# This script assumes the user running has the following set up:
# 1. Docker commands are allowed. (the user is in the docker group)
# 2. The AWS command line tools are installed and configured (aws configure) for this user.

# This script also assumes the maven build was already run before it.
DOCKER_REPO=941319116360.dkr.ecr.us-east-1.amazonaws.com
DOCKER_IMAGE=digieapis
DOCKER_TAG=latest

if [ $1 ]; then
# Bamboo should pass a build number or something here.
    DOCKER_TAG=$1
fi

npm install
ng build 
tar -czvf  docker/dist.tar.gz dist/*

DOCKER_FULL_IMAGE=$DOCKER_REPO/$DOCKER_IMAGE:$DOCKER_TAG


# Log into docker
eval `aws ecr get-login --region us-east-1`
docker build -t $DOCKER_FULL_IMAGE docker
docker push $DOCKER_FULL_IMAGE
sleep 5
docker rmi -f $DOCKER_FULL_IMAGE
echo "#####################";
echo "######--END--########";
echo "#####################";

