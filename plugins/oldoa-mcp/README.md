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

适合：明道协作活跃用户、需要让 Claude 代发动态/管日程的场景。

## 前置要求

- **Python 3.10+**
- 在 [明道开放平台](https://open.mingdao.com/) 注册了一个应用，拿到 `APP_KEY` / `APP_SECRET` / 回调 URL
- Python 依赖：`mcp[cli]`（插件安装后 `pip install` 一次即可）

## 安装

### 1. 安装插件

```
/plugin marketplace add wb4646684/claude-plugins
/plugin install oldoa-mcp@claude-plugins
```

### 2. 装 Python 依赖

```bash
pip3 install 'mcp[cli]>=1.0.0'
```

（插件自己没有单独的 requirements 文件，因为只依赖 `mcp` 一个包。）

### 3. 在明道开放平台注册应用

1. 登录 <https://open.mingdao.com/>
2. 新建应用，拿到 **APP_KEY** 和 **APP_SECRET**
3. 填一个**回调 URL**（OAuth2 授权完成后的跳转地址）。本地开发可以用 `http://localhost/callback`，应用不用真的接收回调，只要你能从浏览器地址栏里复制 `code` 就行。

### 4. 准备凭据目录

```bash
mkdir -p ~/.config/oldoa
# 从插件目录复制模板
cp ~/.claude/plugins/cache/claude-plugins/plugins/oldoa-mcp/server/.env.example \
   ~/.config/oldoa/.env
chmod 600 ~/.config/oldoa/.env
vim ~/.config/oldoa/.env   # 填入第 3 步的 APP_KEY / APP_SECRET / REDIRECT_URI
```

> 插件路径可能因 Claude Code 版本有微差，用 `find ~/.claude -name .env.example -path '*oldoa*'` 定位。

### 5. OAuth 首次授权（拿 access_token）

```bash
# 让 Python 能找到 oldoa 包
export PYTHONPATH="${HOME}/.claude/plugins/cache/claude-plugins/plugins/oldoa-mcp/server/src"
export OLDOA_CONFIG_DIR="${HOME}/.config/oldoa"

# 生成授权链接
python3 -m oldoa.server authorize-url
```

输出类似：

```
Open this URL in your browser:
https://api.mingdao.com/oauth2/authorize?app_key=xxx&redirect_uri=http%3A%2F%2Flocalhost%2Fcallback&state=mcp-auth
```

- 在浏览器打开此链接 → 点"同意授权"
- 浏览器会跳转到你填的回调 URL（可能 404 没关系），**复制地址栏里的 `code=xxx` 参数值**

然后用这个 code 换 access_token：

```bash
python3 -m oldoa.server exchange-code <刚才复制的code>
```

成功会输出 `Token saved to .secrets.json`，文件位于 `~/.config/oldoa/.secrets.json`。

### 6. 重启 Claude 验证

```
/mcp
# 看到 oldoa 条目为 connected 即成功
```

## 使用示例

在 Claude Code 里：

```
# 动态
发一条动态：刚更新了 Moodle 2.5 → 2.6 版本

# 日程
帮我建一个明天下午 2 点的日程，和 A/B/C 讨论下周的运维分工
查下明天有哪些日程
```

Claude 会自动调 `mcp__oldoa__*` 工具完成。

## 工具列表

| 分类 | 工具 |
|------|------|
| 动态 | `post_add_post`, `post_delete_post`, `post_get_all_posts`, `post_get_post_detail`, `post_add_post_reply`, `post_get_post_reply` |
| 日程 | `calendar_create_event`, `calendar_edit_event`, `calendar_remove_event`, `calendar_get_events`, `calendar_get_event_details`, `calendar_add_members`, `calendar_remove_member`, `calendar_confirm_invitation`, `calendar_get_unconfirmed_events`, `calendar_search` |

## Token 自动刷新

`access_token` 有过期时间（明道给的一般是 2 小时）。插件会自动：

1. 每次调用前检查 token 是否快过期
2. 快过期时用 `refresh_token` 换新的（刷新后自动写回 `.secrets.json`）
3. `refresh_token` 彻底失效时报错提示重新授权

日常不用管 token，除非你长期（比如超过一周）没用过，`refresh_token` 也失效了——那就重跑步骤 5。

## 环境变量参考

插件的 `.mcp.json` 用这两个：

| 变量 | 默认 | 作用 |
|------|------|------|
| `OLDOA_CONFIG_DIR` | `$HOME/.config/oldoa` | `.env` 和 `.secrets.json` 存放目录 |
| `PYTHONPATH` | `${CLAUDE_PLUGIN_ROOT}/server/src` | Python 能找到 `oldoa` 包 |

手动调试时（不经 Claude 启动）要自己 export 这两个。

## 故障排查

| 症状 | 排查 |
|------|------|
| `/mcp` 显示 `oldoa: disconnected` | PYTHONPATH / OLDOA_CONFIG_DIR 没对；或 `mcp` 依赖没装（`pip3 show mcp`） |
| 调用报 `Token expired and cannot be refreshed` | 很久没用了，refresh_token 也失效。重跑步骤 5 |
| `authorize-url` 命令报错找不到 APP_KEY | `.env` 没读到；确认 `OLDOA_CONFIG_DIR` 指向的目录下有 `.env` |
| 调用报 `access_denied` | APP_KEY / APP_SECRET 填错；或应用在开放平台被禁用 |

## 安全提示

- `.env` 和 `.secrets.json` **不要进 git**
- `APP_SECRET` 泄漏了别人可以假冒你的应用——去开放平台重置
- `access_token` 泄漏了别人可以以你身份操作（发动态、改日程）——重新授权即可作废旧 token

## License

[MIT](../../LICENSE)
