---
name: notion-manager
description: Use when creating, reading, updating, searching, querying, or managing Notion pages, databases, table rows, and blocks using the DSH Notion plugin endpoints or direct API.
---

# Notion 知识库与数据库管理指南

本技能指导如何在 DSH 环境下对已连接的 Notion 工作区进行页面（Page）、数据库表（Database）、表行数据（Row）以及块内容（Block/Markdown）的完整增删改查（CRUD）操作。

---

## 1. 核心凭据与网络基准

所有 Notion API 请求遵循 Notion 官方 REST API 协议规范：

* **API Base URL**: `https://api.notion.com/v1`
* **Notion-Version**: `2022-06-28`
* **认证方式**: HTTP Header `Authorization: Bearer <API_KEY>`
* **Content-Type**: `application/json`

### 本地持久化配置路径
* **配置文件**: `~/.dsh/notion/config.json`
* **本地缓存**: `~/.dsh/notion/cache/page_<id>.json`
* **DSH 根页面 ID**: `defaultParentPageId`（所有的独立文档页面、所有的多结构数据表均统一直接挂载在此 DSH 根页面下）

---

## 2. DSH 内置本地 HTTP 服务接口 (最推荐)

DSH Notion 插件通过 `webServer` 暴露本地代理接口。路由使用精确路径匹配，并在服务端校验 HTTP 方法；页面编辑支持本地草稿缓存、后台防抖同步、失败保留和重启后恢复。

| 端点路径 | 方法 | 功能描述 | 请求 Body 关键字段 |
| :--- | :--- | :--- | :--- |
| `/api/dsh-notion/resources` | `GET` | 列出默认根页面下的直属页面与数据库 | 无（过滤根页面、数据库行及非直属资源） |
| `/api/dsh-notion/page-content?pageId={id}` | `GET` | 读取页面详情与正文 Blocks/Markdown | `pageId` (Query 参数) |
| `/api/dsh-notion/sync-page-markdown` | `POST` | 保存并同步页面 Markdown 内容 | `{ pageId, title, markdown, immediate }` |
| `/api/dsh-notion/create-page` | `POST` | 新建独立文档页面 | `{ title, content, parentId }` |
| `/api/dsh-notion/delete-page` | `POST` | 删除/归档页面或数据行 | `{ pageId }` |
| `/api/dsh-notion/query-database` | `POST` | 查询表格所有列 Schema 与行数据 | `{ databaseId, pageSize }` |
| `/api/dsh-notion/create-database` | `POST` | 新建独立数据库表 | `{ title, initialColumns, parentPageId }` |
| `/api/dsh-notion/add-database-column` | `POST` | 为现有表扩展新增字段列 | `{ databaseId, name, type }` |
| `/api/dsh-notion/update-database-row` | `POST` | 新增或编辑单条表格数据行 | `{ rowId (可选), databaseId, properties }` |

---

## 3. 标准操作工作流示例

### A. 新建文档页面并写入 Markdown
向目标父页面挂载一篇新文档：
```bash
curl -X POST http://127.0.0.1:3080/api/dsh-notion/create-page \
  -H "Content-Type: application/json" \
  -d '{
    "title": "项目部署与运维手册",
    "content": "# 部署文档\n\n- 环境要求: Node.js 18+\n- 步骤: npm install"
  }'
```

### B. 编辑页面与同步
通过 `sync-page-markdown` 接口提交：
```bash
curl -X POST http://127.0.0.1:3080/api/dsh-notion/sync-page-markdown \
  -H "Content-Type: application/json" \
  -d '{
    "pageId": "3d257d82742c8152919cce21d4a7b686",
    "title": "新标题",
    "markdown": "# 核心配置\n\n更新后的正文内容...",
    "immediate": true
  }'
```

`immediate: false` 会先写入 `~/.dsh/notion/cache/page_<id>.json`，再由后台队列防抖同步；同步失败时缓存保留，并在页面读取或重启后恢复重试。`immediate: true` 会等待远端同步完成后再返回成功。

页面同步采用增量更新：相同类型块尽量原位更新，新增块先追加，多余旧块最后清理，并带有限退避重试。Notion API 本身没有事务，极端中断时仍可能短暂出现新旧块并存，成功重试后会收敛。

### C. 新建独立数据库表（Database）
在 DSH 根页面下创建新表，并声明自定义字段列：
```bash
curl -X POST http://127.0.0.1:3080/api/dsh-notion/create-database \
  -H "Content-Type: application/json" \
  -d '{
    "title": "服务器资产清单",
    "initialColumns": [
      { "name": "IP地址", "type": "rich_text" },
      { "name": "运行状态", "type": "select" },
      { "name": "端口", "type": "number" },
      { "name": "标签", "type": "multi_select" }
    ]
  }'
```

### D. 表格数据增删改查（CRUD）
1. **查 (Query)**:
   ```bash
   curl -X POST http://127.0.0.1:3080/api/dsh-notion/query-database \
     -H "Content-Type: application/json" \
     -d '{ "databaseId": "<DATABASE_ID>" }'
   ```
2. **增 (Insert)**:
   ```bash
   curl -X POST http://127.0.0.1:3080/api/dsh-notion/update-database-row \
     -H "Content-Type: application/json" \
     -d '{
       "databaseId": "<DATABASE_ID>",
       "properties": {
         "名称": "Prod-Server-01",
         "IP地址": "192.168.1.100",
         "运行状态": "运行中",
         "端口": 8080
       }
     }'
   ```
3. **改 (Update)**:
   带上 `rowId` 参数，即可原地更新该行的指定列。
4. **删 (Delete / Archive)**:
   ```bash
   curl -X POST http://127.0.0.1:3080/api/dsh-notion/delete-page \
     -H "Content-Type: application/json" \
     -d '{ "pageId": "<ROW_PAGE_ID>" }'
   ```

---

## 4. 注意事项与防错指南
1. **主键列（Title Property）命名兼容**：中文 Notion 默认主键列通常为 `名称`，英文版为 `Name`。新增/更新记录时应动态识别或同时兼容二者。
2. **表格行对象保护**：Notion 中 Database 的每一行数据底层也是 `page` 对象。搜索/列出资源时，必须过滤掉 `parent.type === "database_id"` 的项，避免单行污染文档列表。
3. **数据库建表不是幂等操作**：`/api/dsh-notion/create-database` 每次有效请求都会创建新表，不会自动按名称复用；调用方应避免重复提交，并在请求中提供非空 `title`。`initialColumns` 必须是数组。
4. **页面同步与恢复**：页面缓存位于 `~/.dsh/notion/cache/`；后台同步采用 revision 队列和有限退避重试。大页面创建和读取按 Notion 的 100 块分页限制处理。
5. **根目录误删防护**：`DSH`（根页面，ID: `defaultParentPageId`）是整个工作区的总挂载根基，插件已做防护，禁止作为普通子项提供删除操作。所有的文档页面与数据表均独立挂载于此根页面下。
