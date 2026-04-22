---
name: service-commit-push-build-deploy
description: 执行完整的代码发布流程，包括提交代码、推送到远程仓库、触发 Jenkins 构建
---

# 开发环境发布

## 参数

| 参数 | 必填 | 说明 | 来源 |
|------|------|------|------|
| `jobName` | 是 | Jenkins 构建任务名称 | 从 CLAUDE.md 的 CI/CD 配置读取，或执行时由用户指定 |
| `buildParams` | 否 | Jenkins 构建参数，键值对形式 | 从 CLAUDE.md 的 CI/CD 配置读取，或执行时由用户指定 |

## 环境预检测

在执行发布流程前，必须完成以下环境检查，任何一项失败都应终止流程并提示用户：

### 1. Git 安装检查

| 检查项 | 检查命令 | 失败提示 |
|--------|----------|----------|
| Git 是否安装 | `git --version` | Git 未安装，请先安装 Git |

### 2. MCP Jenkins 检查

| 检查项 | 检查方式 | 失败提示 |
|--------|----------|----------|
| mcp-jenkins 是否安装 | 调用 `mcp__jenkins__jenkins_list_instances` | mcp-jenkins 未安装或未配置，请先安装并配置 mcp-jenkins |

### 3. Git 仓库环境检查

| 检查项 | 检查命令 | 失败提示 |
|--------|----------|----------|
| 是否在 Git 仓库中 | `git rev-parse --is-inside-work-tree` | 当前目录不是 Git 仓库 |
| 是否有远程仓库 | `git remote` | 未配置远程仓库 |
| 当前分支名称 | `git rev-parse --abbrev-ref HEAD` | 无法获取当前分支 |

远程仓库名称：使用 `git remote` 获取第一个远程仓库名称作为默认推送目标。

### 4. Jenkins 环境变量检查

| 环境变量 | 用途 | 失败提示 |
|----------|------|----------|
| `MCP_JENKINS_URL` | Jenkins 服务器地址 | 未设置 Jenkins URL，请配置 MCP_JENKINS_URL 环境变量 |
| `MCP_JENKINS_USER` | Jenkins 用户名 | 未设置 Jenkins 用户名，请配置 MCP_JENKINS_USER 环境变量 |
| `MCP_JENKINS_API_TOKEN` | Jenkins API Token | 未设置 Jenkins API Token，请配置 MCP_JENKINS_API_TOKEN 环境变量 |

检查方式：在 Windows 环境下使用 `$env:MCP_JENKINS_URL` 读取环境变量。

### 5. Jenkins 连通性检查

- 使用 `mcp__jenkins__jenkins_get_version` 验证 Jenkins 连接
- 失败时提示：无法连接到 Jenkins 服务器，请检查网络和认证配置

### 6. 任务存在性检查

- 使用 `mcp__jenkins__jenkins_search_jobs` 搜索指定的 `jobName` 任务
- 失败时提示：Jenkins 中未找到任务 `{jobName}`

## 执行步骤

### Step 1: 检查工作区状态

```bash
git status --porcelain
```

- 有变更 → 进入 Step 2 执行 Commit
- 无变更 → 跳过 Step 2，直接进入 Step 3

### Step 2: Git Commit

1. 查看变更详情：
   ```bash
   git status
   git diff --stat
   git diff
   git log --oneline -5  # 参考历史 commit 风格
   ```

2. 根据变更内容生成 commit message，格式参考：
   - `feat: 添加新功能描述`
   - `fix: 修复问题描述`
   - `refactor: 重构描述`
   - `docs: 文档更新描述`
   - `style: 代码格式调整`

3. 执行提交：
   ```bash
   git add <变更文件>
   git commit -m "commit message"
   ```

### Step 3: Git Pull

```bash
git pull <远程仓库名> <当前分支>
```

- 远程仓库名称通过 `git remote` 获取第一个远程仓库
- 拉取远程最新代码，避免覆盖他人提交
- 如果有冲突，提示用户解决冲突后继续

### Step 4: Git Push

```bash
git push <远程仓库名> <当前分支>
```

- 首次推送新分支使用 `git push -u <远程仓库名> <分支名>`
- 推送失败时检查是否有冲突，提示用户解决后重试

### Step 5: 触发 Jenkins 构建

使用 mcp-jenkins 触发构建：

```
mcp__jenkins__jenkins_trigger_build(
  jobName="<jobName>",
  params=<buildParams>
)
```

> 构建参数由 CLAUDE.md 定义，或由用户在执行时指定。

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| Git 未安装 | 终止流程，提示用户安装 Git |
| mcp-jenkins 未安装 | 终止流程，提示用户安装并配置 mcp-jenkins |
| Git 仓库环境检查失败 | 终止流程，提示用户检查 Git 配置 |
| Jenkins 环境变量缺失 | 终止流程，列出缺失变量并提示配置方法 |
| Jenkins 连接失败 | 终止流程，提示检查网络和认证 |
| Git Push 冲突 | 提示用户执行 `git pull` 解决冲突后重试 |
| Jenkins 任务不存在 | 终止流程，提示检查任务名称或权限 |

## 完成报告

发布完成后，输出简要报告：

```
✅ 发布完成
- 分支: <分支名>
- Commit: <commit hash> (如有新提交)
- Jenkins 构建: #<构建号>
- 构建状态: <状态>
- 构建链接: <Jenkins URL>/job/<jobName>/<构建号>
```