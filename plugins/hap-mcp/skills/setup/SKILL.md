---
name: setup
description: 初始化 hap-mcp：收集明道账号密码、写入本地加密凭据、配置 MCP server。用户输入 /hap-mcp:setup 或说"初始化 hap"时触发。
---

# hap-mcp 初始化

## 步骤

1. 在聊天里直接问用户：
   - 明道账号（手机号或邮箱）
   - 明道密码

2. 用 Bash 工具找到脚本路径：
   ```bash
   find ~/.claude -name setup.js -path '*hap-mcp*' 2>/dev/null | head -1
   ```
   找不到则提示用户先运行 `/plugin install hap-mcp@wb4646684-plugins`，然后 `/reload-plugins`。

3. 用 Bash 工具直接运行脚本，把账号密码作为参数传入：
   ```bash
   node <上一步的路径> --account <账号> --password <密码>
   ```

4. 脚本会自动完成：
   - 加密凭据写入 `~/.config/hap-mcp/credentials`
   - 初始 token 写入 `~/.config/hap-mcp/token`
   - 启动脚本写入 `~/.config/hap-mcp/hap_start.sh`
   - MCP 配置写入 `~/.claude.json`（stdio 模式，一次性写入，后续不再修改）

5. 脚本输出 `✅ hap-mcp 配置完成` 后，读取 `~/.config/hap-mcp/account_id` 文件内容，将其保存到记忆系统：
   - 类型：`user`
   - 内容：当前用户的 HAP accountId（用于 HAP 操作时的默认负责人）

6. 提示用户运行 `/reload-plugins` 让 MCP 生效。

## 注意

- 密码只传给本地 node 脚本，加密后才调用明道 API，明文不落盘不打日志
- SessionStart hook 每次启动自动刷新 token（写入 `~/.config/hap-mcp/token`），不修改 `~/.claude.json`
