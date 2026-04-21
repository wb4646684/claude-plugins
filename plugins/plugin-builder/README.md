# plugin-builder

Claude Code 插件脚手架工具，交互式生成符合规范的插件目录结构。

---

## 安装

```
/plugin marketplace add wb4646684/claude-plugins
/plugin install plugin-builder@wb4646684-plugins
/reload-plugins
```

## 初始化

```
/plugin-builder:setup
```

配置本地插件仓库路径、marketplace 名称和作者名，写入 `~/.config/plugin-builder/config`。

## 使用

```
/plugin-builder:plugin-builder
```

或直接说「新建插件」、「创建插件」，Claude 会交互式收集插件信息并生成完整目录结构。

## 生成内容

根据插件类型自动生成：

| 文件 | 说明 |
|------|------|
| `.claude-plugin/plugin.json` | 插件元数据 + MCP server 声明 |
| `README.md` | 安装和使用文档 |
| `server/index.js` 或 `server/server.py` | MCP server 骨架 |
| `skills/setup/SKILL.md` | 凭据初始化 skill |
| `skills/<名>/SKILL.md` | 功能 skill 骨架 |
| `hooks/hooks.json` | Hook 骨架 |
| `scripts/credentials.example` | 凭据模板 |

同时自动更新仓库根目录的 `marketplace.json`。

## 配置文件

| 文件 | 内容 |
|------|------|
| `~/.config/plugin-builder/config` | 仓库路径、marketplace 名、作者名 |

---

## License

[MIT](../../LICENSE)
