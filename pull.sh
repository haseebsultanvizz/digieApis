git pull
sh docker-build.sh
sh docker-deploy.sh latest 0
docker logs -f digieapis-vizz_0