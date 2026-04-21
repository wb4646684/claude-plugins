# cos-mcp

腾讯云 COS（对象存储）临时文件中转 MCP server。

把本地文件变成公网 URL，传给只认 URL 的系统（HAP 附件字段、外部平台等）。用完即删，不囤文件。

---

## 工具列表

| 工具 | 作用 |
|------|------|
| `cos_upload_temp(file_path)` | 上传本地文件 → 返回 HTTPS URL |
| `cos_delete_temp(url)` | 按 URL 删除之前上传的文件 |

---

## 前置要求

- Claude Code（桌面版或 CLI）
- Python 3.8+
- 腾讯云账号 + 一个 COS bucket
- bucket 权限设为**公有读私有写**（上传需密钥，URL 可直接访问）

---

## 安装步骤

**第一步：准备腾讯云凭据**

1. 登录 [腾讯云控制台](https://cloud.tencent.com/)，开通 **对象存储 COS**
2. 创建 bucket，访问权限设为**公有读私有写**，地域选就近（如 `ap-shanghai`）
3. 进入 **访问管理 CAM** → 用户 → 新建用户 → 编程访问，附加 `QcloudCOSFullAccess` 权限，下载 **SecretId** 和 **SecretKey**（只显示一次，立即保存）

**第二步：安装插件**

```
/plugin marketplace add https://github.com/wb4646684/claude-plugins.git
/plugin install cos-mcp@wb4646684-plugins
/reload-plugins
```

**第三步：安装 Python 依赖**

```bash
pip3 install mcp cos-python-sdk-v5
```

**第四步：初始化凭据**

```
/cos-mcp:setup
```

Claude 会在聊天里问你 SecretId、SecretKey、bucket 名称和地域，填入后自动写入凭据文件。

**第五步：验证**

```
/mcp
# 看到 cos: connected 即成功
```

---

## 工作原理

插件通过 `plugin.json` 注册 MCP，**不修改 `~/.claude.json`**。

凭据存放在 `~/.config/cos-mcp/credentials`（权限 600），server 启动时从该文件读取，不依赖 shell 环境变量。

```
~/.config/cos-mcp/credentials
  COS_SECRET_ID=...
  COS_SECRET_KEY=...
  COS_BUCKET=...
  COS_REGION=ap-shanghai
  COS_PREFIX=tmp
```

---

## 使用示例

```
帮我把 ~/Downloads/report.pdf 上传到 COS，给我 URL
```

Claude 调用 `cos_upload_temp` → 返回类似：
`https://your-bucket.cos.ap-shanghai.myqcloud.com/tmp/1713600000_report.pdf`

用完清理：

```
把刚才上传的那个 URL 删掉
```

---

## 故障排查

| 症状 | 解决方法 |
|------|---------|
| `/mcp` 显示 `cos: disconnected` | Python 依赖未安装：`pip3 install mcp cos-python-sdk-v5` |
| 上传报 `access denied` | SecretKey 错 / bucket 名拼错 / region 不匹配 |
| URL 打不开 | bucket 权限设成「私有读」了，改成「公有读私有写」 |
| 重跑 setup 后不生效 | 运行 `/reload-plugins` 重新加载 |

---

## 安全说明

- **SecretKey 有整个桶的读写权限**，泄漏后别人能往你桶里写内容（产生扣费）
- 建议使用子账号并限制权限到指定 bucket
- 不要把 credentials 提交到 git

---

## License

[MIT](../../LICENSE)
