FROM python:3.12-slim
WORKDIR /app
COPY tools ./tools
COPY relay ./relay
EXPOSE 8788
ENTRYPOINT ["python3", "relay/server.py", "--port", "8788"]
