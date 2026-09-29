# AI 用法入口

中文静态站：AI 热点、工具导航、副业案例，三条线共用写作 / 绘图 / 视频 / 编程 / 办公场景。

## 文档

- [需求文档](docs/需求文档.md)

## 本地开发

需要 Node.js 22+。

```bash
npm install
npm run collect
npm run dev
```

常用命令：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地预览 |
| `npm run collect` | 抓取公开 RSS，写入 `data/news.json` |
| `npm run build` | 构建静态站到 `dist/` |
| `npm run build:ci` | 先采集再构建（给 Pages / CI 用） |
| `npm run preview` | 预览构建结果 |

## 数据怎么改

| 文件 | 谁改 | 说明 |
| --- | --- | --- |
| `data/tools.json` | 站长 | 工具；`status` 为 `公开` 才出现在列表 |
| `data/cases.json` | 站长 | 案例；草稿不会在公开列表出现，但详情地址会显示「还没有公开」 |
| `data/news.json` | 定时任务 | 不要手改；由 `npm run collect` 更新 |
| `data/sources.json` | 站长 | RSS 来源开关 |

## 部署（0 元方案）

1. 把仓库推到 GitHub（建议公开，Actions 分钟不计费）。
2. 在 EdgeOne Pages 导入该仓库，构建命令 `npm run build:ci`，输出目录 `dist`。
3. 加速区域选「全球（不含中国大陆）」——自定义域名可不备案。
4. 在 Pages 项目设置里打开「代码推送触发构建」（或配置 Deploy Hook）。GitHub Actions 每天两次采集并推送 `data/news.json` 后，才会重新发版到站点。
5. 第一次推送仓库后，在 GitHub → Actions 里允许 workflow 运行；也可手动跑一次 `Collect AI news`。

第一期不要接对话模型，也不要开中国大陆加速（需备案）。
