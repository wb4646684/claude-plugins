---
name: fix-hap-bug-finish
description: BUG 修复完成后的收尾流程：commit + push 当前分支，用 glab CLI 发起 Merge Request 到指定远端分支，然后更新 HAP「BUG管理」对应记录的处理状态/MR地址/描述BUG原因/合入分支。触发场景：「提交 MR」「完成修复」「fix-hap-bug-finish」「BUG修完了」等。
---

# Skill: fix-hap-bug-finish

BUG 修复完成后的标准收尾流程。依次执行：环境检查 → commit + push → 创建 MR → 更新 HAP 记录。

## 固定参数（同 fix-hap-bug-start）

| 项 | 值 |
| --- | --- |
| 应用 App | BUG管理 (`eed8e526-6c6e-4e05-9ab7-e25550aa990c`) |
| 工作表 | Web (`5cc4391adb8d4e0001ee6618`) |

## 关键字段 ID

| 字段 | ID | 类型 |
| --- | --- | --- |
| 处理状态 | `5cc4391adb8d4e0001ee6611` | Dropdown |
| MR地址 | `5d19a972442bf24178e97a5c` | Text |
| 描述BUG原因 | `652cadddb2073276db9f2916` | Text |
| 合入分支 | `5dfb1e9b3e74520001925b46` | Dropdown |

### 合入分支 option keys

| Key | 中文 |
| --- | --- |
| `1` | FE-Bug（前端生产分支） |
| `10` | FE-Dev（前端开发分支） |
| `1000` | BE-Bug（后端生产分支） |
| `100` | BE-Dev（后端开发分支） |
| `83e0ea02-1df5-4393-8d9e-56473aabb088` | PD-Bug（私有生产分支） |
| `a5a72e0f-87fe-4ba5-990a-59768df407e8` | PD-Dev（私有开发分支） |
| `237d42f1-37dd-4728-b158-234d2442dc9c` | None/无合并 |

### 处理状态（待更新）

将状态更新为「待更新」时使用 key：`370de0b7-746d-4a19-8d22-73c58a4f5c18`

---

## 执行步骤

### Step 1：检查 git 工作目录

```bash
git rev-parse --git-dir 2>/dev/null && echo "IS_GIT=true" || echo "IS_GIT=false"
```

- 若 **不是 git 仓库**：输出「当前不是 Git 工作目录，无法继续。」，**结束**。

### Step 2：检查 glab CLI

```bash
command -v glab 2>/dev/null && echo "GLAB_OK" || echo "GLAB_MISSING"
```

- 若 **未安装**：输出以下内容后**结束**：

```
未检测到 glab CLI，请先安装：
  Mac: brew install glab
  或参考 https://gitlab.com/gitlab-org/cli
安装完成后重新运行 /fix-hap-bug-finish
```

### Step 3：检查是否有待提交的修改

```bash
git status --porcelain
```

- 若输出**为空**：输出「没有检测到任何修改，请确认代码是否已保存。」，**结束**。
- 若有修改：继续。

### Step 4：生成 commit message

读取当前改动：

```bash
git diff HEAD
git status --short
```

根据改动内容生成简洁的 commit message，格式遵循项目规范：`fix: <一句话描述修复内容>`，直接使用，无需用户确认。

### Step 5：commit + push

```bash
git add -A
git commit -m "<最终 commit message>"
```

然后 push（自动处理首次推送需要设置 upstream 的情况）：

```bash
git push origin "$(git branch --show-current)" 2>&1
```

- 若 push 失败（提示需要 `-u`）：改用 `git push -u origin "$(git branch --show-current)"`。
- 若 push 失败（其他原因）：输出错误信息，**结束**。

### Step 6：询问 MR 目标分支

输出：

```
请输入合并目标的远端分支名称（完整名称，如 dev、main、bug）：
```

等待用户输入。

### Step 7：验证远端分支是否存在

```bash
git ls-remote --heads origin "<用户输入的分支名>"
```

- 若输出**为空**：提示「请输入正确的远端分支，必须完整名称匹配。」，等待用户重新输入，回到 Step 6。
- 若存在：继续。

### Step 8：填写审阅人（必填）

输出：

```
请输入审阅人的 GitLab 用户名（必填，多人用英文逗号分隔，如 zhangsan,lisi）：
```

等待用户输入，不允许为空。若用户未填写直接回车，重复提示直到输入为止。

将输入按逗号拆分，每个用户名生成一个 `--reviewer <username>` 参数。

### Step 9：创建 Merge Request

获取当前分支名：

```bash
git branch --show-current
```

执行 glab 创建 MR（含审阅人）：

```bash
glab mr create \
  --source-branch "$(git branch --show-current)" \
  --target-branch "<目标分支>" \
  --title "<commit message 内容>" \
  --description "<commit message 内容>" \
  --reviewer <username1> \
  --reviewer <username2> \
  --no-editor \
  --yes 2>&1
```

- 从输出中提取 MR URL（形如 `https://gitlab.xxx.com/.../merge_requests/123`）。
- 若创建失败：输出错误信息，**结束**。
- 若创建成功：记录 MR URL 供后续步骤使用。

### Step 10：获取 HAP 任务信息

检查当前对话上下文中是否有来自 `fix-hap-bug-start` 传入的任务 RowId 或标题。

- 若**找到**：直接使用，跳到 Step 11。
- 若**找不到**：输出以下提示，等待用户输入：

```
请输入BUG的 记录Id/RowId 或 完整的任务名称，您可以通过运行 /get-hap-bug-todolist 获得
```

根据用户输入查询记录（逻辑同 fix-hap-bug-start Step 2）：

- **GUID 或 24 位十六进制** → `get_record_details`；若不存在提示「记录不存在，请重新输入」。
- **名称关键词** → `get_record_list` 按标题过滤；未找到提示「未找到匹配的 BUG，请重新输入」；多条时列表让用户选择。

### Step 11：让用户选择合入分支

输出以下选项（格式化展示）：

```
请选择「合入分支」（输入序号）：
  1. FE-Bug（前端生产分支）
  2. FE-Dev（前端开发分支）
  3. BE-Bug（后端生产分支）
  4. BE-Dev（后端开发分支）
  5. PD-Bug（私有生产分支）
  6. PD-Dev（私有开发分支）
  7. None/无合并
```

等待用户输入序号，映射到对应 option key。

### Step 12：更新 HAP 记录

调用 `update_record`，一次性更新以下 4 个字段：

| 字段 | 字段 ID | 更新值 |
| --- | --- | --- |
| 处理状态 | `5cc4391adb8d4e0001ee6611` | `370de0b7-746d-4a19-8d22-73c58a4f5c18`（待更新） |
| MR地址 | `5d19a972442bf24178e97a5c` | Step 9 获取的 MR URL |
| 描述BUG原因 | `652cadddb2073276db9f2916` | 根据 commit 内容用 1-2 句话总结修复原因 |
| 合入分支 | `5dfb1e9b3e74520001925b46` | Step 11 用户选择的 option key |

```json
{
  "appId": "eed8e526-6c6e-4e05-9ab7-e25550aa990c",
  "worksheet_id": "5cc4391adb8d4e0001ee6618",
  "rowId": "<任务 RowId>",
  "values": {
    "5cc4391adb8d4e0001ee6611": "370de0b7-746d-4a19-8d22-73c58a4f5c18",
    "5d19a972442bf24178e97a5c": "<MR URL>",
    "652cadddb2073276db9f2916": "<修复原因摘要>",
    "5dfb1e9b3e74520001925b46": "<合入分支 option key>"
  }
}
```

### Step 13：输出总结

成功后输出：

```
✅ BUG 修复流程完成

BUG：<标题>
RowId：<rowId>
MR：<MR URL>
目标分支：<目标分支>
合入分支标记：<合入分支中文名>
处理状态：已更新为「待更新」
```

## 坑位

1. `glab mr create` 的 `--yes` 参数用于跳过交互确认；`--no-editor` 跳过打开编辑器。不同版本 glab 参数略有差异，若报错可去掉 `--yes` 重试。
2. `git ls-remote --heads origin <branch>` 返回空即分支不存在，不要跳过这步直接创建 MR，否则 glab 会报错。
3. `update_record` 的 Dropdown 字段值直接传 option key 字符串（非数组）。
4. 不要把 Relation 字段放入 `fields`，会爆 token。
