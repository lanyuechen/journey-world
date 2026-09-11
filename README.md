# Journey World

可嵌套的旅游攻略 / 人生旅程 Web 应用（MVP）。

## 功能

- 单根「我的旅程」，行程可无限嵌套（旅行是节点，内部再挂安排）
- 查看页：时间轴瀑布流、日期/类型筛选、叶子进度、支线并列弱化、切换主线、钻入子行程
- 录入页：新增叶子/子行程、编辑删除、主支线连线
- 数据保存在浏览器 `localStorage`

## 开发

```bash
npm install
npm run dev
```

## 路由

- `/view` · `/view/:nodeId` 查看
- `/edit` · `/edit/:nodeId` 录入
