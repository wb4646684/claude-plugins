# oldoa-mcp

明道协作（老版 OA）精简版 MCP server，只保留**动态（post）**和**日程（calendar）**两块最常用功能。

## 能做什么

### 动态（post）
- 发动态 / 回复动态
- 查询自己或某人的动态列表
- 读取动态详情和回复

### 日程（calendar）
- 创建 / 修改 / 删除日程
- 查询日程列表、日程详情
- 添加 / 移除日程成员
- 查看待确认日程、确认参会
- 按关键字搜索日程

## 前置要求

- **Python 3.10+**
- **Node.js 18+**（跑 create_app.js 用，如果走手动路径可省）
- 一个**明道账号**

> **不需要自己去 open.mingdao.com 手动建应用**——create_app.js 会帮你建好。

## 极简安装（推荐）

```bash
# 1. 装插件
/plugin marketplace add wb4646684/claude-plugins
/plugin install oldoa-mcp@claude-plugins

# 2. 装 Python 依赖
pip3 install 'mcp[cli]>=1.0.0'

# 3. 自动建应用 + 写凭据
node ~/.claude/plugins/cache/claude-plugins/plugins/oldoa-mcp/scripts/create_app.js
#   → 交互输入明道账号/密码/应用名
#   → 自动登录、创建应用、提取 APP_KEY/APP_SECRET、写入 ~/.config/oldoa/.env

# 4. OAuth 授权（拿 access_token）
export PYTHONPATH=~/.claude/plugins/cache/claude-plugins/plugins/oldoa-mcp/server/src
export OLDOA_CONFIG_DIR=~/.config/oldoa
python3 -m oldoa.server authorize-url
# → 浏览器打开输出的链接 → 点同意 → 复制地址栏里 code= 后面的值
python3 -m oldoa.server exchange-code <code>

# 5. 重启 Claude Code
```

插件路径随 Claude Code 版本略有差异，用
`find ~/.claude -name create_app.js -path '*oldoa*'` 定位。

验证：

```
/mcp
# oldoa 条目为 connected 即成功
```

## 使用示例

在 Claude Code 里：

```
# 动态
发一条动态：刚更新了 Moodle 到新版

# 日程
帮我建一个明天下午 2 点的日程，主题"运维周会"，邀请 A 和 B
这周哪些日程待确认
```

## 工具列表

| 分类 | 工具 |
|------|------|
| 动态 | `post_add_post`, `post_delete_post`, `post_get_all_posts`, `post_get_post_detail`, `post_add_post_reply`, `post_get_post_reply` |
| 日程 | `calendar_create_event`, `calendar_edit_event`, `calendar_remove_event`, `calendar_get_events`, `calendar_get_event_details`, `calendar_add_members`, `calendar_remove_member`, `calendar_confirm_invitation`, `calendar_get_unconfirmed_events`, `calendar_search` |

## create_app.js 做了什么

1. 交互收集明文账号 + 密码 + 应用名 + 回调 URL（密码输入不回显）
2. 本地 **RSA-1024 PKCS#1 v1.5** 加密凭据（用明道前端的公钥）
3. POST `/api/Login/MDAccountLogin` → 拿 `sessionId`
4. POST `/AppAjax/ApplyApp` → 创建应用
5. GET `/App/List` → 匹配刚建的应用拿 app_id
6. GET `/App/<app_id>` → 从 HTML 解析 `APP_KEY` / `APP_SECRET`
7. 写入 `~/.config/oldoa/.env`，权限 `600`

明文密码**只在内存里用过**，不落盘不打日志。

只在以下情况重跑：
- 新电脑/新机器首次配置
- 你在明道开放平台把应用删了

## OAuth Token 自动刷新

`access_token` 有过期时间（未发布应用 1 天、已发布 7 天）。auth.py 会自动用 `refresh_token` 续约，你**平时无感**。

只有很久（超过 refresh_token 周期，一般几周）没用过 oldoa 时，`refresh_token` 也会失效——那就重跑步骤 4 的 OAuth 授权即可（应用本身不用重建，APP_KEY/SECRET 不变）。

## 环境变量

| 变量 | 默认 | 作用 |
|------|------|------|
| `OLDOA_CONFIG_DIR` | `$HOME/.config/oldoa` | `.env` 和 `.secrets.json` 的目录 |
| `PYTHONPATH` | `${CLAUDE_PLUGIN_ROOT}/server/src` | Python 能找到 `oldoa` 包 |

## 手动安装（不想用 create_app.js）

如果你宁愿手动 2 分钟点网页：

1. 去 <https://open.mingdao.com/> 建应用，拿 APP_KEY / APP_SECRET / 回调 URL
2. 写入 `.env`：
   ```bash
   mkdir -p ~/.config/oldoa
   cat > ~/.config/oldoa/.env <<EOF
   MINGDAO_APP_KEY=<你的 APP_KEY>
   MINGDAO_APP_SECRET=<你的 APP_SECRET>
   MINGDAO_REDIRECT_URI=http://localhost/callback
   EOF
   chmod 600 ~/.config/oldoa/.env
   ```
3. 跑上述 "极简安装" 的第 4 步 OAuth 授权

## 故障排查

| 症状 | 排查 |
|------|------|
| create_app.js 报"登录失败" | 账号密码错；或明道前端 RSA 公钥换了（极少发生） |
| create_app.js 报"ApplyApp failed" | 明道改了表单字段；告诉作者更新 |
| create_app.js 报"无法提取 APP_KEY" | 明道改了应用详情页 HTML；告诉作者更新 |
| `/mcp` 显示 `oldoa: disconnected` | PYTHONPATH / OLDOA_CONFIG_DIR 没对；或 mcp 依赖没装 |
| 调用报 `Token expired and cannot be refreshed` | refresh_token 失效，重跑 OAuth 授权 |

## 安全提示

- `.env` 和 `.secrets.json` **不要进 git**
- `APP_SECRET` 泄漏：去 open.mingdao.com 重置，再重跑 OAuth 授权
- `access_token` 泄漏：重新授权即作废旧 token

## License

[MIT](../../LICENSE)
