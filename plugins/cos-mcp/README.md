# cos-mcp

腾讯云 COS（对象存储）临时文件中转 MCP server。

## 用途

把**本地文件**变成**一个公网 URL**，用于：

- 传给 HAP / 明道云等只接受 URL 的附件字段
- 给 Claude 生成的报告/图片拿到一个可分享的链接
- 任何「我手边是文件路径，但对方要 URL」的场景

用完即删，避免垃圾文件堆积。

## 工具列表

| 工具 | 作用 |
|------|------|
| `cos_upload_temp(file_path)` | 上传本地文件 → 返回 HTTPS URL |
| `cos_delete_temp(url)` | 按 URL 删除之前上传的文件 |

## 前置要求

- **腾讯云账号**（`https://cloud.tencent.com/`）+ 一个 COS bucket
- **Python 3.8+**
- 本插件的 Python 依赖：`mcp`, `cos-python-sdk-v5`

## 安装

### 1. 安装插件

```
/plugin marketplace add wb4646684/claude-plugins
/plugin install cos-mcp@claude-plugins
```

### 2. 注册腾讯云 + 创建 bucket

1. 注册 <https://cloud.tencent.com/>
2. 开通**对象存储 COS**（个人用免费额度完全够 Claude 临时中转）
3. 创建 bucket：
   - 名称：如 `claude-temp-1256981397`（后缀的 appid 腾讯云自动加）
   - 所属地域：**上海（ap-shanghai）** 或就近
   - **访问权限：公有读私有写**（关键 —— 上传需要密钥，但 URL 可以被任何人访问）

### 3. 创建子账号 AK（⚠️ 不要用主账号 AK）

1. **访问管理 CAM** → **用户** → **新建用户** → **自定义创建**
2. 访问方式：只勾 **编程访问**
3. 权限策略：给 `QcloudCOSFullAccess`（或更严，只给这个 bucket 的读写）
4. 创建完立刻下载 **SecretId** 和 **SecretKey**（只显示一次！丢了只能重建）

### 4. 安装 Python 依赖

```bash
pip3 install -r ~/.claude/plugins/cache/claude-plugins/plugins/cos-mcp/server/requirements.txt
# 或者全局装：
pip3 install mcp cos-python-sdk-v5
```

> 插件路径可能随 Claude Code 版本变化，用 `find ~/.claude -name requirements.txt -path '*cos-mcp*'` 定位

### 5. 配置环境变量

插件的 `.mcp.json` 里的 env 读自这几个环境变量，在你的 shell（`~/.zshrc` 或 `~/.bashrc`）里 export：

```bash
export COS_SECRET_ID='<第 3 步下载的 SecretId>'
export COS_SECRET_KEY='<第 3 步下载的 SecretKey>'
export COS_BUCKET='<第 2 步创建的 bucket 全名，如 claude-temp-1256981397>'
export COS_REGION='ap-shanghai'     # 可选，默认 ap-shanghai
export COS_PREFIX='tmp'              # 可选，默认 tmp
```

`source ~/.zshrc` 让环境变量生效。

### 6. 重启 Claude Code 验证

```
/mcp
# 看到 cos 条目为 connected 即成功
```

## 使用示例

在 Claude Code 里：

```
帮我把 ~/Downloads/report.pdf 上传到 COS，拿个 URL 给我
```

Claude 会调 `cos_upload_temp` → 返回类似 `https://claude-temp-1256981397.cos.ap-shanghai.myqcloud.com/tmp/1713600000_report.pdf`。

用完记得：

```
把刚才那个 URL 删掉
```

Claude 会调 `cos_delete_temp` 清理。

## 安全提示

- **SecretKey 有完整桶读写权限**，泄漏了别人能往你的桶写内容（消耗流量/存储 → 扣费）
- 建议用**子账号**并限定权限范围到这一个 bucket
- 别把 SecretId/Key 提交到 git（本插件仓库的 `.gitignore` 已屏蔽常见敏感文件名）
- 如果桶里文件含敏感信息，用完**务必删**

## 故障排查

| 症状 | 排查 |
|------|------|
| `/mcp` 显示 `cos: disconnected` 或启动失败 | 环境变量没导入（`env | grep COS_` 确认）；或 Python 依赖缺失（`pip3 list | grep -E "mcp\|cos-python"`） |
| 上传报 `access denied` | SecretKey 错 / bucket 名拼错 / bucket 所属 region 不匹配 |
| URL 打不开 | bucket 权限设成「私有读」了，改成「公有读私有写」 |

## License

[MIT](../../LICENSE)
