---
name: context-optimize
description: 审查并优化 Claude Code 的 memory 和 skills 结构，让 context 保持轻量、按需加载。当用户提到「优化记忆」「整理 skills」「context 太臃肿」「MEMORY.md 太大」「skill 越来越长」等情景时使用。
---

# context-optimize

审查并优化 Claude 的记忆（memory）和技能（skills）结构，确保 context 始终轻量、按需加载。

## 分层原则

```
Layer 0  MEMORY.md              永远在 context，≤150 行，只放一行指针
           └→ memory/*.md       按需读，存事实/偏好/反馈
           └→ skill 名称        触发时才加载

Layer 1  skills/<name>/SKILL.md  轻量入口：触发条件 + 流程步骤 + 指向数据文件的指针
           └→ data/index.md     内容较多时先读索引，按需选择性加载子文件
           └→ data/*.md         实际内容，只在需要时 Read，可以很大

Layer 2  skills/<name>/data/*   原始数据、QA、模板，从不自动加载
```

---

## 判断放哪一层

### Memory vs Skill

| 放 Memory | 放 Skill |
|-----------|---------|
| 用户偏好、角色、背景 | 多步骤操作流程 |
| 系统/平台的地址、ID | 需要查阅外部文件才能执行 |
| 一句话能说清的事实 | "如何做 X"类的操作规范 |
| 反馈/纠正记录 | 包含大量参考数据（表格、QA、模板） |

### SKILL.md 直接写 vs 拆数据文件

| 直接写在 SKILL.md | 拆成 data/*.md |
|------------------|---------------|
| 流程步骤 ≤ 30 行 | QA 问答清单 |
| 无需外部数据 | 表格模板、字段映射 |
| 逻辑判断为主 | 参考内容 > 100 行 |

---

## 操作流程

### 审查现有结构

1. **定位当前项目的 MEMORY.md**：
   - 全局位置：`~/.claude/projects/<项目路径转码>/memory/MEMORY.md`
   - 项目路径转码规则：把项目目录绝对路径里的 `/` 替换成 `-`，例如 `/Users/alice/work` → `-Users-alice-work`
   - 可用一行 bash 定位：`ls ~/.claude/projects/ | grep "$(pwd | tr / -)"`
2. 列出 `~/.claude/skills/` 下所有 skill 目录
3. 检查每个 skill 的 SKILL.md 行数
4. 输出问题清单：
   - MEMORY.md 中哪些条目内容过重（应移入 skill 或 data 文件）
   - 哪些 SKILL.md 超过 100 行（应拆出 data 文件）
   - 哪些 skill 缺少 `data/index.md`（内容多但没有索引）

### 新建 Memory 条目

按类型选择：
- `user_*.md` — 用户角色/背景
- `feedback_*.md` — 操作偏好/纠正记录
- `project_*.md` — 项目进展/决策
- `reference_*.md` — 外部资源指针

MEMORY.md 指针格式：`- [标题](文件名.md) — 一句话说明用途`

### 新建 Skill

```
~/.claude/skills/<name>/
├── SKILL.md        # 必须：frontmatter + 流程 + 数据文件指针
└── data/
    ├── index.md    # 推荐：列出所有数据文件及其覆盖范围
    └── *.md        # 按需：实际数据内容
```

SKILL.md 的 frontmatter 必填 `name` 和 `description`（触发关键词越具体越好）：

```markdown
---
name: my-skill
description: 一句话说明本 skill 做什么 + 触发它的典型用户意图
---

# 正文...
```

数据文件指针格式：
```markdown
## 数据文件
- `data/index.md` — 先读此文件确认需要加载哪些子文件
- `data/01_xxx.md` — 覆盖范围描述
- `data/02_xxx.md` — 覆盖范围描述
```

### 拆分过大的 SKILL.md

1. 识别哪些内容是「流程逻辑」，保留在 SKILL.md
2. 识别哪些内容是「参考数据」，移入 `data/` 目录
3. 在 SKILL.md 中替换为文件指针
4. 新增 `data/index.md` 说明每个文件的覆盖范围

---

## 注意事项

- MEMORY.md 超过 150 行时系统会截断，必须保持精简
- skill 名称用小写 + 连字符，见名知义（中文用户也要能理解）
- 数据文件命名加序号前缀（`01_`、`02_`）便于有序加载
- skill 修改后**无需重启 Claude**，即时生效
