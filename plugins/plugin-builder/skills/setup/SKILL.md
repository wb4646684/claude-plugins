---
name: setup
description: 配置 plugin-builder：设置本地插件仓库路径和作者信息，供后续 /plugin-builder:plugin-builder 使用
---

# plugin-builder 初始化

询问用户以下信息，并写入 `~/.config/plugin-builder/config`：

1. **插件仓库本地路径**（plugins 目录所在的根目录，例如 `~/projects/my-plugins`）
2. **marketplace 名称**（对应 marketplace.json 里的 `name` 字段，例如 `myname-plugins`）
3. **作者名**（写入每个新插件的 `plugin.json`，例如 `Alice`）

## 写入格式

`~/.config/plugin-builder/config` 使用 KEY=VALUE 格式，权限 600：

```
PLUGIN_REPO_PATH=/Users/alice/projects/my-plugins
MARKETPLACE_NAME=alice-plugins
AUTHOR_NAME=Alice
```

## 步骤

1. 依次询问上述三项，允许用户直接回车跳过（保留已有值）
2. 读取已有配置（如存在）作为默认值展示给用户
3. 写入配置文件，`chmod 600`
4. 确认：`✅ plugin-builder 已配置，运行 /plugin-builder:plugin-builder 新建插件`
