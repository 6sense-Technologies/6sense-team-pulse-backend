Build

```
docker build --no-cache -t nestjs-app .
```

Run

```
docker run --memory=512m --memory-swap=512m -p 8000:8000 --env-file .env --name nestjs-app nestjs-app
```
