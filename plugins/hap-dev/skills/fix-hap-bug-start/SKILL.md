---
name: fix-hap-bug-start
description: 开始修复 HAP（明道云）BUG管理中的一条 BUG：根据用户输入的任务名称或 RowID 查询记录详情，展示关键信息，并在当前 git 仓库中基于当前分支新建 bugfix/ 工作分支。触发场景：「开始修 bug」「fix bug 123」「开始处理这个 bug」「新建 bugfix 分支」等。
---

# Skill: fix-hap-bug-start

根据用户提供的 BUG 任务名称或 RowID，从 HAP「BUG管理」应用获取记录详情，然后在当前 git 仓库中新建对应的 `bugfix/` 工作分支。

## 固定参数（同 get-hap-bug-todolist）

| 项 | 值 |
| --- | --- |
| 网络（Org） | MH & MD (`fe288386-3d26-4eab-b5d2-51eeab82a7f9`) |
| 应用 App | BUG管理 (`eed8e526-6c6e-4e05-9ab7-e25550aa990c`) |
| 工作表 | Web (`5cc4391adb8d4e0001ee6618`) |
| 视图 | 研发未解决 (`5cc4391adb8d4e0001ee6619`) |

## 执行步骤

### Step 1：提示用户输入

如果用户调用时未提供参数，输出如下提示（一句话，不要多余解释）：

```
请输入BUG的 记录Id/RowId 或 完整的任务名称，您可以通过运行 /get-hap-bug-todolist 获得
```

### Step 2：查询记录

根据用户输入判断查询方式：

**情况 A — 输入看起来是 RowID**（符合以下任一格式）：
- GUID 格式：`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`，如 `e9b9a148-6085-4d62-a565-17bc75b724ea`
- 24 位十六进制字符串，如 `5cc4391adb8d4e0001ee6612`

直接调用 `get_record_details`：

```json
{
  "appId": "eed8e526-6c6e-4e05-9ab7-e25550aa990c",
  "worksheet_id": "5cc4391adb8d4e0001ee6618",
  "rowId": "<用户输入的 RowID>"
}
```

- 若返回结果为空或记录不存在：提示「记录不存在，请重新输入任务名称或者 RowID」，等待用户重新输入后从 Step 2 重新执行。

**情况 B — 输入是名称关键词**：

调用 `get_record_list` 按标题模糊搜索：

```json
{
  "appId": "eed8e526-6c6e-4e05-9ab7-e25550aa990c",
  "worksheet_id": "5cc4391adb8d4e0001ee6618",
  "viewId": "5cc4391adb8d4e0001ee6619",
  "pageSize": 10,
  "pageIndex": 1,
  "responseFormat": "md",
  "tableView": true,
  "fields": [
    "5cc4391adb8d4e0001ee6612",
    "5cc4391adb8d4e0001ee6611",
    "5cc6762f442bf21e3c044f0d",
    "5fb224c4383644000159d8cf",
    "61b1c29afc669c450b795760",
    "65728cc8ba5ef3863bf73e66",
    "5dfb1e9b3e74520001925b46"
  ],
  "filter": {
    "type": "group",
    "logic": "AND",
    "children": [
      {
        "type": "condition",
        "field": "5cc4391adb8d4e0001ee6612",
        "operator": "contains",
        "value": "<用户输入的关键词>"
      }
    ]
  }
}
```

- 若搜索结果 **为空**：提示「未找到匹配的 BUG，请重新输入任务名称或者 RowID」，等待用户重新输入后从 Step 2 重新执行。不要尝试缩短关键词或扩大查询范围。
- 若搜索结果 **多于 1 条**：以表格列出（列：RowId / 标题 / 处理状态 / 处理优先级），提示用户选择哪条，等待用户回复后重新走情况 A（用 RowID 取详情）。
- 若 **恰好 1 条**：直接继续。

### Step 3：展示记录详情

把记录的以下字段整理后展示给用户（无需再调 API，用 Step 2 已拿到的数据）：

| 字段 | 字段 ID | 说明 |
| --- | --- | --- |
| RowId | — | 记录唯一标识 |
| 标题 | `5cc4391adb8d4e0001ee6612` | BUG 名称 |
| 处理状态 | `5cc4391adb8d4e0001ee6611` | 见 option key 表 |
| 处理优先级 | `5cc6762f442bf21e3c044f0d` | 见 option key 表 |
| 环境 | `5fb224c4383644000159d8cf` | MultipleSelect |
| 所属模块 | `61b1c29afc669c450b795760` | MultipleSelect |
| BUG类型 | `65728cc8ba5ef3863bf73e66` | Dropdown |
| 合入分支 | `5dfb1e9b3e74520001925b46` | Dropdown |

Option key 翻译同 `get-hap-bug-todolist`，字段为空时写 `—`。

### Step 4：检查 git 工作目录

用 Bash 工具执行：

```bash
git rev-parse --git-dir 2>/dev/null && echo "IS_GIT=true" || echo "IS_GIT=false"
```

- 若 **不是 git 仓库**：提示「当前不是 Git 工作目录，不能创建 bugfix 分支。」，结束。
- 若 **是 git 仓库**：继续。

### Step 5：生成英文分支名

根据 Step 3 获取的 BUG 标题，生成英文分支名 `name` 部分，规则：

1. 将标题翻译/概括为英文关键词（2-4 个单词，选核心名词/动词）。
2. 所有字母小写，单词之间用 `-` 连接，不含空格、中文、特殊字符。
3. `name` 部分最多 **32 个字符**，如果超长，截断最后一个单词或缩写，确保不超限。

完整分支名格式：`bugfix/<name>`

### Step 6：获取当前分支并创建新分支

```bash
git branch --show-current
```

然后执行：

```bash
git checkout -b bugfix/<name>
```

- 若分支已存在（exit code 128 含 `already exists`）：提示「分支 `bugfix/<name>` 已存在，是否切换到该分支？」，等待用户确认后执行 `git checkout bugfix/<name>`。
- 若创建成功：输出确认信息。

### Step 7：输出总结

成功后以简洁格式输出：

```
BUG：<标题>
RowId：<rowId>
新分支：bugfix/<name>（基于 <原分支名>）

可开始修复，完成后运行 /fix-hap-bug-finish 提交 MR 并更新任务状态。
```

## 关键字段 option key 速查

### 处理状态

| Key | 中文 |
| --- | --- |
| `1` | 新提交 |
| `1f2b6a71-96c7-431b-9ed3-1197dd8337e7` | 待确认 |
| `10000000` | 待分配 |
| `10` | 处理中 |
| `370de0b7-746d-4a19-8d22-73c58a4f5c18` | 待更新 |
| `1e824352-d852-4461-b00d-b70b9f616225` | 梅花待更新 |
| `099da645-b48e-4dd2-ace2-0f6d09277e65` | 梅花待验证 |
| `e6ba092e-ef6e-4dc7-8378-00741885b81c` | 梅花已解决 |
| `100000000` | 生产待更新 |
| `1000000000` | 生产待验证 |
| `d0637d7d-a3f2-4f79-b527-aeea03ac8dec` | 生产已解决 |
| `100` | 已解决 |
| `1000000` | 已关闭（非Bug选此） |
| `1000` | 无法重现 |
| `10000000000000` | 验证不通过 |
| `100000000000000` | 待产品评审 |
| `ebab7a9e-183a-4363-a0f0-02b697490bdf` | 环境问题 |
| `100000` | 重复问题 |
| `dce7d1ba-c187-4653-94f1-a764c2069287` | 方案研究中 |
| `100000000000` | 以后解决 |
| `10000000000000000` | 已转需求 |
| `1000000000000` | 转APP |

### 处理优先级

| Key | 中文 |
| --- | --- |
| `1000` | 当天修复 |
| `100` | 三天内修复 |
| `10` | 一周内修复 |
| `1` | 可下个版本修复 |
| `10000` | 后面再看 |

## 坑位

1. **不要**把 Relation 字段（`开发任务` `5cc59bece18661ad844fb441`、`产品需求` `5fb74348d6ce050001148e11`、`APP` `61149185b55c3de746b1519a`）放进 `fields`，会爆 token。
2. `get_record_list` 对 Collaborator 字段恒返回空串，不要把 `5cc4391adb8d4e0001ee6614` 等加进 `fields`。
3. filter 根节点必须是 `group`。
4. 分支名只含 `[a-z0-9-]`，不含 `/` 以外的特殊字符（`bugfix/` 的斜杠是 git 命名空间分隔符，正常）。
