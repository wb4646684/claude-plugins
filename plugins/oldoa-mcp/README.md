# oldoa-mcp

明道协作（老版 OA）精简版 MCP，提供**动态**和**日程**两块功能。

---

## 工具列表

| 分类 | 工具 |
|------|------|
| 动态 | `post_add_post` `post_delete_post` `post_get_all_posts` `post_get_post_detail` `post_add_post_reply` `post_get_post_reply` |
| 日程 | `calendar_create_event` `calendar_edit_event` `calendar_remove_event` `calendar_get_events` `calendar_get_event_details` `calendar_add_members` `calendar_remove_member` `calendar_confirm_invitation` `calendar_get_unconfirmed_events` `calendar_search` |

---

## 前置要求

- Claude Code
- Python 3.10+
- Node.js 18+
- 明道云账号

---

## 安装步骤

**第一步：安装插件**

```
/plugin marketplace add https://github.com/wb4646684/claude-plugins.git
/plugin install oldoa-mcp@wb4646684-plugins
/reload-plugins
```

**第二步：安装 Python 依赖**

```bash
pip3 install 'mcp[cli]>=1.0.0'
```

**第三步：初始化**

```
/oldoa-mcp:setup
```

Claude 会在聊天里问你明道账号和密码。脚本自动完成：

1. 登录 → 在开放平台建应用 → 提取 APP_KEY/SECRET
2. 启用测试模式 → 安装应用
3. 打开浏览器跳转 OAuth 授权页，点「同意授权」后自动捕获 code
4. 换取 access_token，写入 `~/.config/oldoa/.secrets.json`

**第四步：验证**

```
/mcp
# oldoa: connected 即成功
```

---

## 工作原理

```
~/.config/oldoa/
  .env              APP_KEY / APP_SECRET（setup 写入）
  .secrets.json     access_token / refresh_token（OAuth 后写入）
```

插件通过 `plugin.json` 注册 MCP，**不修改 `~/.claude.json`**。access_token 到期后由 server 自动用 refresh_token 续期，通常无感。

---

## 重新授权

以下情况需重跑 `/oldoa-mcp:setup`：

- 新机器首次配置
- 应用被删或 APP_SECRET 重置
- refresh_token 长期不用失效（一般几周）

应用不用重建，重跑时脚本会检测到已有 .env 并跳过建应用步骤，直接走 OAuth。

---

## 故障排查

| 症状 | 解决方法 |
|------|---------|
| setup 报"登录失败" | 账号密码错；或触发了验证码（先去网页登一次） |
| `/mcp` 显示 `oldoa: disconnected` | Python 依赖未安装；或 `mcp` 版本不对 |
| 调用报 `Token expired and cannot be refreshed` | refresh_token 失效，重跑 `/oldoa-mcp:setup` 的 OAuth 步骤 |

---

## 安全说明

- `.env` 和 `.secrets.json` 不要提交到 git
- APP_SECRET 泄漏：去 open.mingdao.com 重置，再重跑 OAuth
- 怀疑 token 泄漏：重新 OAuth 授权即作废旧 token

---

## License

[MIT](../../LICENSE)
