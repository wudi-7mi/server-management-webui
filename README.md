# server-management-webui

对前端页面修改并部署：

```shell
cd frontend
# npm i
npm run build
```

对后端修改并部署：

```shell
# sudo env "PATH=$PATH" pm2 start ecosystem.config.js
sudo env "PATH=$PATH" pm2 restart model-server
```
