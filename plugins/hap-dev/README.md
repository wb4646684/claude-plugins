# hap-dev

HAP 研发工作流 Skills，覆盖 BUG 和开发任务的日常处理流程。

## Skills

| Skill | 触发场景 |
| --- | --- |
| `get-hap-bug-todolist` | 「我的 BUG」「HAP 上我待处理的 bug」 |
| `get-hap-feature-todolist` | 「我的开发任务」「我的 todolist」 |
| `fix-hap-bug-start` | 「开始修 bug」「新建 bugfix 分支」 |
| `fix-hap-bug-finish` | 「提交 MR」「完成修复」「BUG修完了」 |
| `service-commit-push-build-deploy` | 「发布」「publish」「触发 Jenkins 构建」 |

## 前置要求

- 已安装并配置 [hap-mcp](../hap-mcp)（需要 HAP token）
- `fix-hap-bug-finish` 需要安装 [glab CLI](https://gitlab.com/gitlab-org/cli)

```bash
brew install glab
glab auth login  # 登录你的 GitLab 实例
```

- `service-commit-push-build-deploy` 需要安装并配置 [mcp-jenkins](https://github.com/kud/mcp-jenkins)
  - `MCP_JENKINS_URL` 如: https://nextci.mingdao.net
  - `MCP_JENKINS_USER` 设置页面 URL 中 user 后面的部分即为用户名： user/`xxx`
  - `MCP_JENKINS_API_TOKEN` 在设置页面添加新 Token

  ⚡⚡⚡windows 环境下如果安装不成功，可按如下步骤操作：
  1. `npm install -g @kud/mcp-jenkins`
  1. `claude mcp add --transport stdio --scope user jenkins -- mcp-jenkins`
  1. 手动在系统环境变量中新增以上环境变量
 

## 安装

**第一步：确保 marketplace 已添加**

```
/plugin marketplace add wb4646684/claude-plugins
```

**第二步：安装插件**

```
/plugin install hap-dev@wb4646684-plugins
```

**第三步：重载**

```
/reload-plugins
```
