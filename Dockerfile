FROM python:3-alpine

WORKDIR /app

VOLUME /app

EXPOSE 8000

CMD ["python", "server.py", "8000"]
