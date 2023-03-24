#!//usr/bin/env sh

app=robot-server

docker run \
  --name=${app} \
  -d \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -p 9000:9000 \
  ${app}
