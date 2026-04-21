---
name: plugin-builder
description: 交互式新建 Claude Code 插件：收集插件信息，生成完整目录结构（plugin.json、README、setup skill 等）。说"新建插件"、"创建插件"、"scaffold plugin"时触发。
---

# plugin-builder

## 准备

读取 `~/.config/plugin-builder/config`，加载 `PLUGIN_REPO_PATH`、`MARKETPLACE_NAME`、`AUTHOR_NAME`。
若配置不存在，提示用户先运行 `/plugin-builder:setup`。

## 收集信息

依次询问：

1. **插件名**（kebab-case，如 `my-mcp`）
2. **一句话描述**（写入 plugin.json `description`）
3. **插件类型**（可多选）：
   - `mcp` — 包含 MCP server
   - `skills` — 仅包含 skill（无 server）
   - `hooks` — 包含 hook
4. **MCP server 语言**（仅 mcp 类型）：`python` / `node`
5. **是否需要凭据**（需要则生成 setup skill + credentials 文件模板）
6. **版本号**（默认 `1.0.0`）

## 生成文件

在 `$PLUGIN_REPO_PATH/plugins/<插件名>/` 下创建：

### 必须生成

**`.claude-plugin/plugin.json`**
```json
{
  "name": "<插件名>",
  "description": "<描述>",
  "version": "<版本>",
  "author": { "name": "<AUTHOR_NAME>" },
  "homepage": "",
  "repository": "",
  "license": "MIT",
  "keywords": [],
  "category": "<类型>"
}
```
若类型含 `mcp`，追加 `mcpServers` 块：
```json
"mcpServers": {
  "<server名>": {
    "type": "stdio",
    "command": "<启动命令>",
    "args": ["${CLAUDE_PLUGIN_ROOT}/server/<入口文件>"],
    "env": {}
  }
}
```
> 凭据路径用 `${HOME}/.config/<插件名>/credentials`，通过 env 传入，server 从文件读取。**不写入 `~/.claude.json`。**

**`README.md`** — 包含：前置要求、安装步骤（`/plugin install` → setup → `/reload-plugins`）、配置文件说明、故障排查。

### 按类型生成

**MCP server（node）**：`server/index.js` — MCP SDK 骨架，`_loadCreds()` 从凭据文件读取配置，启动时检查依赖并输出友好错误。

**MCP server（python）**：`server/server.py` — FastMCP 骨架，`_load_creds()` 读 KEY=VALUE 格式凭据文件，缺失时 `sys.exit` 并打印提示。

**需要凭据时**额外生成：
- `scripts/credentials.example` — KEY=VALUE 注释模板
- `skills/setup/SKILL.md` — 引导用户填写凭据、写入 `~/.config/<插件名>/credentials`（chmod 600）、检查依赖

**包含 skill 时**：`skills/<插件名>/SKILL.md` — 基础骨架，说明触发场景和可用工具

**包含 hook 时**：`hooks/hooks.json` — SessionStart 骨架

## 更新 marketplace.json

在 `$PLUGIN_REPO_PATH/.claude-plugin/marketplace.json` 的 `plugins` 数组追加新插件条目：
```json
{
  "name": "<插件名>",
  "source": "./plugins/<插件名>",
  "description": "<描述>",
  "version": "<版本>",
  "category": "<类型>",
  "keywords": []
}
```

## 完成

列出所有已生成的文件路径，并提示：
```
下一步：
  cd $PLUGIN_REPO_PATH
  git add plugins/<插件名> .claude-plugin/marketplace.json
  git commit -m "feat: add <插件名>"
  git push
```

## 核心原则（生成代码时必须遵守）

- **插件不修改 `~/.claude.json`**，MCP 注册由 `plugin.json mcpServers` 完成
- 凭据存 `~/.config/<插件名>/`，权限 600
- 所有脚本在入口处检查依赖（`node --version`、`python3 -c "import xxx"`、`command -v curl`），缺失时打印安装提示后退出
- API 错误提取：Python 用 `OK:<value>` / `ERROR:<msg>` 前缀模式，避免裸 `KeyError`
