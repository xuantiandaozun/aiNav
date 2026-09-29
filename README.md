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
| `npm run logos` | 从各工具官网抓取图标到 `public/logos/`，并更新 `data/logos.json`；抓不到的工具自动显示首字母头像 |

工具图标版权归各产品方所有，仅用于标识所链接的工具；如需下架，删除 `public/logos/` 对应文件和 `data/logos.json` 里的条目即可。

## 数据怎么改

| 文件 | 谁改 | 说明 |
| --- | --- | --- |
| `data/tools.json` | 站长 | 工具；`status` 为 `公开` 才出现在列表 |
| `data/cases.json` | 站长 | 案例；草稿不会在公开列表出现，但详情地址会显示「还没有公开」 |
| `data/news.json` | 定时任务 | 不要手改；由 `npm run collect` 更新 |
| `data/sources.json` | 站长 | RSS 来源开关 |

## 热点怎么自动更新

热点不写在云函数里，而是写在仓库的 `data/news.json`。

流程：

1. GitHub Actions（`.github/workflows/collect-news.yml`）每天跑两次（也可在 Actions 页手动 Run）。
2. 脚本抓公开 RSS，去重后写回 `data/news.json`。
3. 有变更就 commit + push 到 `master`。
4. EdgeOne Pages 检测到推送后自动重新构建，线上热点更新。

本地也可以先试：`npm run collect`。

首次使用请打开仓库的 [Actions](https://github.com/xuantiandaozun/aiNav/actions) 页，如提示启用工作流请点允许，再手动跑一次 **Collect AI news**。

## 部署（0 元方案）

1. 把仓库推到 GitHub（建议公开，Actions 分钟不计费）。
2. 在 EdgeOne Pages 导入该仓库，构建命令 `npm run build:ci`，输出目录 `dist`。
3. 加速区域选「全球（不含中国大陆）」——自定义域名可不备案。
4. 在 Pages 项目设置里打开「代码推送触发构建」（或配置 Deploy Hook）。GitHub Actions 每天两次采集并推送 `data/news.json` 后，才会重新发版到站点。
5. 第一次推送仓库后，在 GitHub → Actions 里允许 workflow 运行；也可手动跑一次 `Collect AI news`。

第一期不要接对话模型，也不要开中国大陆加速（需备案）。
