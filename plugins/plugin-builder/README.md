# plugin-builder

Claude Code 插件脚手架工具，交互式生成符合规范的插件目录结构。

---

## 维护者入门（新人必读）

### 第一步：克隆插件仓库到本地

```bash
git clone https://sourcecode.mingdao.net/mingdao/ai/ai-plugins.git ~/projects/ai-plugins
```

### 第二步：安装 plugin-builder

```
/plugin marketplace add https://sourcecode.mingdao.net/mingdao/ai/ai-plugins.git
/plugin install plugin-builder@mingdao-ai-plugins
/reload-plugins
```

### 第三步：初始化配置

```
/plugin-builder:setup
```

填写时参考：
- 插件仓库本地路径：`~/projects/ai-plugins`
- marketplace 名称：`mingdao-ai-plugins`
- 作者名：你自己的名字（每次新建插件也可单独修改）

### 第四步：新建插件

说「新建插件」或运行 `/plugin-builder:plugin-builder`，按提示填写后自动生成文件并更新 `marketplace.json` 和根 `README.md`。

### 第五步：推送并验证

```bash
cd ~/projects/ai-plugins
git add plugins/<插件名> .claude-plugin/marketplace.json README.md
git commit -m "feat: add <插件名>"
git push
```

推送后在 Claude Code 里执行：
```
/plugin marketplace update mingdao-ai-plugins
/plugin install <插件名>@mingdao-ai-plugins
/reload-plugins
```

验证插件正常加载即完成上架。

---

## 安装

```
/plugin marketplace add https://sourcecode.mingdao.net/mingdao/ai/ai-plugins.git
/plugin install plugin-builder@mingdao-ai-plugins
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

同时自动更新仓库根目录的 `marketplace.json` 和 `README.md` 插件列表。

## 配置文件

| 文件 | 内容 |
|------|------|
| `~/.config/plugin-builder/config` | 仓库路径、marketplace 名、作者名 |

---

## License

[MIT](../../LICENSE)
