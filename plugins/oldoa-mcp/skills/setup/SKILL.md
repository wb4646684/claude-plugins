---
name: setup
description: 初始化 oldoa-mcp：建应用、OAuth 授权、写凭据。用户输入 /oldoa-mcp:setup 或说"初始化 oldoa"时触发。
---

# oldoa-mcp 初始化

## 步骤

1. 在聊天里直接问用户：
   - 明道账号（手机号或邮箱）
   - 明道密码

2. 用 Bash 工具找到脚本路径：
   ```bash
   find ~/.claude -name create_app.js -path '*oldoa-mcp*' 2>/dev/null | head -1
   ```
   找不到则提示用户先运行 `/plugin install oldoa-mcp@wb4646684-plugins`，然后 `/reload-plugins`。

3. 用 Bash 工具直接运行脚本，把账号密码作为参数传入（脚本是非交互式的）：
   ```bash
   node <上一步的路径> --account <账号> --password <密码>
   ```

4. 等脚本自检完成（输出含 `自检通过`），提示用户运行 `/reload-plugins` 让 MCP 生效。

## 注意

- 密码只传给本地 node 脚本，不会发送到任何远程服务（只有加密后的密文才会传给明道登录 API）
- OAuth 授权步骤会自动打开浏览器，用户在浏览器点"同意授权"后脚本自动捕获 code，无需手动操作
