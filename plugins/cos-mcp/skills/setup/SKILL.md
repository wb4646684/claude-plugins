---
name: setup
description: 初始化 cos-mcp：收集腾讯云 COS 凭据，写入 MCP 配置。用户输入 /cos-mcp:setup 或说"初始化 cos"时触发。
---

# cos-mcp 初始化

## 步骤

1. 在聊天里直接问用户：
   - 腾讯云子账号 **SecretId**
   - 腾讯云子账号 **SecretKey**
   - COS Bucket 名称（如 `my-bucket-1256981397`，需设置为**公有读私有写**）
   - COS Region（默认 `ap-shanghai`）

2. 用 Bash 工具找到脚本路径：
   ```bash
   find ~/.claude -name setup.js -path '*cos-mcp*' 2>/dev/null | head -1
   ```
   找不到则提示用户先运行 `/plugin install cos-mcp@wb4646684-plugins`，然后 `/reload-plugins`。

3. 用 Bash 工具直接运行脚本，把凭据作为参数传入：
   ```bash
   node <上一步的路径> --secret-id <SecretId> --secret-key <SecretKey> --bucket <Bucket> --region <Region>
   ```

4. 脚本输出 `✅ cos-mcp 配置完成` 后，提示用户运行 `/reload-plugins` 让 MCP 生效。
