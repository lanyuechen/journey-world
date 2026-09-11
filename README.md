# Journey World

可嵌套的旅游攻略 / 人生旅程 Web 应用（MVP）。

## 功能

- 单根「我的旅程」，行程树可嵌套
- 录入页：下方添加为后续子行程；右侧并列卡组；编辑按钮进入卡片的内部行程（独立于子行程）
- 有内部行程时类型为「行程」且不可改，清空内部后恢复普通类型
- 查看页：瀑布流阅读，内部行程与并行行程分别展示
- 数据保存在浏览器 `localStorage`

## 开发

```bash
npm install
npm run dev
```

## 构建 / 预览

```bash
npm run build          # 本地 / 根路径
npm run build:gh       # GitHub Pages：base=/journey-world/
npm run preview        # 预览；若用了 build:gh，请打开 /journey-world/
```

生产构建会：

- 通过 import map 从 jsDelivr 加载 React / ReactDOM
- 生成 Service Worker（`vite-plugin-pwa`），预缓存静态资源，并 CacheFirst 缓存字体与 CDN
- 复制 `404.html` 以支持 GitHub Pages SPA 深链

## GitHub Pages

推送到 `main` / `master` 后，Actions 会自动构建并部署。仓库需开启：

**Settings → Pages → Source: GitHub Actions**

站点地址：`https://<user>.github.io/journey-world/`

## 路由

- `/view` 行程查看（默认）
- `/edit` 录入编辑（根旅程）
- `/edit/:nodeId` 编辑指定行程卡片
