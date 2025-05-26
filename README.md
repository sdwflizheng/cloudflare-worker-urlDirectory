# Cloudflare Worker 网址导航页

## 项目简介

本项目是基于 Cloudflare Worker 的网址导航与管理系统，支持公开区和隐藏区网址的增删查改，具备管理密码验证功能。前端自适应美观，后端安全校验，适合自用或小范围分享。

---

## 依赖说明

### 1. Cloudflare KV (Key-Value 存储)
- **用途**：存储管理密码（如 `urlshow_pass`）。
- **绑定名建议**：`urlshow_pass`
- **Key**：`password`
- **Value**：你的管理密码（如 `123456`）。

### 2. Cloudflare D1 (SQLite 数据库)
- **用途**：存储网址数据。
- **绑定名建议**：`web_links`
- **表结构**：
  - `urls`：公开区网址表，字段：`name`（名称）、`url`（网址）
  - `hide_urls`：隐藏区网址表，字段：`name`（名称）、`url`（网址）

---

## Cloudflare 资源创建与绑定

### 1. 创建 KV 命名空间
1. 登录 Cloudflare Dashboard。
2. 进入 Workers & Pages → KV。
3. 创建命名空间，名称如 `urlshow_pass`。
4. 进入命名空间，添加一条 Key-Value：
   - Key: `password`
   - Value: 你的管理密码（如 `123456`）

### 2. 创建 D1 数据库
1. 进入 Cloudflare Dashboard → Workers & Pages → D1。
2. 创建数据库，名称如 `web_links`。
3. 进入数据库，执行如下 SQL 初始化表结构：
   ```sql
   CREATE TABLE IF NOT EXISTS urls (
     name TEXT PRIMARY KEY,
     url TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS hide_urls (
     name TEXT PRIMARY KEY,
     url TEXT NOT NULL
   );
   ```

### 3. 通过 Cloudflare Dashboard 绑定 KV 和 D1 到 Worker
1. 进入 Workers & Pages → Workers，选择你的 Worker 或新建一个 Worker。
2. 在 Worker 编辑页面，点击左侧"设置（Settings）"。
3. 下拉找到"KV 命名空间绑定"，点击"添加绑定"，选择你刚刚创建的 KV 命名空间，绑定名填写 `urlshow_pass`。
4. 下拉找到"D1 数据库绑定"，点击"添加绑定"，选择你刚刚创建的 D1 数据库，绑定名填写 `web_links`。
5. 保存设置。

---

## 部署步骤（全部通过 Cloudflare Dashboard 完成）

1. **准备源码**：将本项目的 `index.js` 文件内容复制到 Cloudflare Dashboard 的 Worker 编辑器中（可新建 Worker，粘贴代码）。
2. **完成 KV 和 D1 绑定**：按上方说明在 Dashboard 设置页面完成绑定。
3. **初始化数据库**：在 D1 控制台（Cloudflare Dashboard → D1 → 你的数据库 → 控制台）执行上方 SQL，确保表结构存在。
4. **设置管理密码**：在 KV 控制台（Cloudflare Dashboard → KV → 你的命名空间）设置 `password` 键值。
5. **保存并部署 Worker**：点击"保存并部署"按钮。
6. **访问你的 Worker 域名**，即可使用网址导航页。

### 国内用户：自定义域名路由说明

由于 Cloudflare Worker 默认分配的域名在中国大陆可能无法访问，建议绑定你自己的域名并设置自定义路由：

1. 在 Cloudflare Dashboard → Workers & Pages → Workers，选择你的 Worker。
2. 点击左侧"触发器（Triggers）"或"路由（Routes）"。
3. 点击"添加路由（Add route）"。
4. 输入你自己的域名（如 `https://nav.yourdomain.com/*`），选择对应 Worker。
5. 确保你的域名已接入 Cloudflare 并 DNS 解析到 Cloudflare。
6. 保存后，访问你的自定义域名即可正常使用。

这样可以大幅提升国内访问速度和可用性。

---

## 常见问题

- **Q: 密码忘记怎么办？**
  - 直接在 Cloudflare KV 控制台修改 `password` 键值即可。
- **Q: 数据库表丢失或损坏？**
  - 重新执行 SQL 初始化即可。
- **Q: 绑定名可以自定义吗？**
  - 可以，但需同步修改源码和 Dashboard 绑定名。

---

## 其它说明
- 本项目无用户系统，不收集任何个人信息。
- 所有管理操作均需密码验证，安全性由后端保障。
- 本项目全部内容均通过 Cursor 智能提示词自动生成，便于高效开发与维护。

如有疑问或建议，欢迎提交 issue。 
