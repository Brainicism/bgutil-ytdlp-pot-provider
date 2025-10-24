FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:22-bullseye
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive && apt-get -y install python3 ffmpeg python3-pip
COPY --from=denoland/deno:bin-2.5.4 /deno /usr/local/bin/deno
