---
name: get-hap-feature-todolist
description: 从 HAP（明道云）「研发管理」应用的「开发任务」工作表中，拉取当前登录用户参与的、开发状态未完成的任务清单，以表格形式输出（RowId 为首列）。触发场景：用户询问「我的开发任务」「我的 todolist」「我参与的未完成任务」「HAP 上我的待办」「研发管理里我的任务」等。
---

# Skill: get-hap-feature-todolist

拉取当前登录用户在 HAP「研发管理」应用「开发任务」工作表中的未完成任务清单。

## 固定参数（已验证可用）

| 项 | 值 |
| --- | --- |
| 网络（Org） | MH & MD (`fe288386-3d26-4eab-b5d2-51eeab82a7f9`) |
| 应用 App | 研发管理 (`86892856-1fb7-4cee-b4a9-36caa9e8798a`) |
| 工作表 | 开发任务 (`5cc59abed9bf1f00013c2714`) |

> 如果上述 ID 失效（应用/工作表被重建等），按「回退流程」重新发现。

## 当前用户 accountId 解析

本 skill 对团队内不同成员通用，accountId **必须在每次运行时解析**，不得写死。

解析顺序：
1. 如果调用时带了参数：
   - 参数看起来是 UUID（`^[0-9a-f-]{36}$`）→ 直接当作 `accountId` 使用。
   - 否则当作**中文姓名**，走下面第 3 步的 `find_member`。
2. 否则，读取 hap-mcp 登录用户持久化文件 `~/.config/hap-mcp/account_id`（hap-mcp ≥ 1.1.6 在首次 token 刷新时自动写入）。读到非空内容即直接作为 `accountId` 使用，无需再查 memory 或询问。
3. 若文件不存在 / 为空 / 读取失败，用一句话提示用户**手动输入 accountId 或中文姓名**（切勿自行猜测、也不要默认用 memory 里其他人的 accountId）。
   - 用户给 UUID → 直接用。
   - 用户给姓名 → 调用 `mcp__hap__find_member(appId="86892856-1fb7-4cee-b4a9-36caa9e8798a", name="<中文姓名>")`，取返回里第一个 `users[].accountId`；若 `users` 为空告知「未匹配到成员」，让其确认姓名。

## 关键字段 ID

| 字段 | ID | 类型 |
| --- | --- | --- |
| 名称（标题） | `5cc59abed9bf1f00013c2705` | Text |
| 开发状态 | `5cc59abed9bf1f00013c270d` | Dropdown |
| 前端状态 | `5d2453a1442bf20a4c287355` | Dropdown |
| 后端状态 | `5d2453a1442bf20a4c287356` | Dropdown |
| 优先级 | `5cc59abed9bf1f00013c270c` | Rating |
| 关联的开发人员 | `5cc59abed9bf1f00013c2711` | Collaborator |
| 前端负责人 | `637f322bee7732feecdd11b9` | Collaborator |
| 后端负责人 | `637f322bee7732feecdd11b8` | Collaborator |
| 任务类型 | `6221a2acd651b965928e60b4` | MultipleSelect |

### 开发状态 option keys

| Key | 中文 | 归类 |
| --- | --- | --- |
| `10000` | 未开始 | **未完成** |
| `8e7e2229-7698-4e73-9c78-cedc5e290220` | 待定 | **未完成** |
| `e3bb1134-b03e-48e8-8af8-be44b96c0a91` | 已规划 | **未完成** |
| `575e3fb3-586d-48ed-81f2-73a4fc9d4613` | 评审中 | **未完成** |
| `10` | 开发中 | **未完成** |
| `100` | 开发完成 | 已出开发阶段 |
| `3d1fffd9-1ab1-47c4-af4f-6ca47525dad5` | 验收中 | 已出开发阶段 |
| `f4cb9fbf-7b82-4686-935f-eb24f7e661e9` | 测试中 | 已出开发阶段 |
| `6a61edcf-ad06-4a50-a0d0-15e5a5e9a02e` | 待发布 | 已出开发阶段 |
| `1000000` | 已发布 | 终态 |
| `100000` | 已废弃 | 终态 |
| `c759a466-a316-4de4-8a0b-41cc530e09af` | 转缺陷 | 终态 |
| `cb5d3971-49e5-471f-9cd1-df6baf66fbff` | 需求重复 | 终态 |
| `0d78f41f-57fa-4e7f-aee8-adc9470a6c13` | 后续版本 | 延后 |

### 前端/后端状态 option keys

| Key | 前端状态 | 后端状态 |
| --- | --- | --- |
| `1` | 未开始 | 未开始 |
| `10` | 进行中 | 进行中 |
| `100` | 前端完成 | 后端完成 |
| `1000` | 无需前端 | 无需后端 |

## 执行步骤

### 1. 调用 `mcp__hap__get_record_list`

把 `<ACCOUNT_ID>` 替换成步骤「当前用户 accountId 解析」里拿到的 accountId。

**默认「严格未完成」口径**（5 个状态）：

```json
{
  "appId": "86892856-1fb7-4cee-b4a9-36caa9e8798a",
  "worksheet_id": "5cc59abed9bf1f00013c2714",
  "pageSize": 200,
  "pageIndex": 1,
  "responseFormat": "md",
  "tableView": true,
  "includeTotalCount": true,
  "fields": [
    "5cc59abed9bf1f00013c2705",
    "5cc59abed9bf1f00013c270d",
    "5d2453a1442bf20a4c287355",
    "5d2453a1442bf20a4c287356",
    "5cc59abed9bf1f00013c270c",
    "6221a2acd651b965928e60b4"
  ],
  "filter": {
    "type": "group",
    "logic": "AND",
    "children": [
      {
        "type": "group",
        "logic": "OR",
        "children": [
          { "type": "condition", "field": "5cc59abed9bf1f00013c2711", "operator": "contains", "value": ["<ACCOUNT_ID>"] },
          { "type": "condition", "field": "637f322bee7732feecdd11b9", "operator": "contains", "value": ["<ACCOUNT_ID>"] },
          { "type": "condition", "field": "637f322bee7732feecdd11b8", "operator": "contains", "value": ["<ACCOUNT_ID>"] }
        ]
      },
      {
        "type": "group",
        "logic": "AND",
        "children": [
          {
            "type": "condition",
            "field": "5cc59abed9bf1f00013c270d",
            "operator": "in",
            "value": ["10000", "8e7e2229-7698-4e73-9c78-cedc5e290220", "e3bb1134-b03e-48e8-8af8-be44b96c0a91", "575e3fb3-586d-48ed-81f2-73a4fc9d4613", "10"]
          }
        ]
      }
    ]
  },
  "ai_description": "Worksheet: 开发任务. Filter: (关联开发人员/前端负责人/后端负责人 contains current user) AND 开发状态 in 未完成集合"
}
```

**如果用户要「宽口径未完成」**（仍包含 测试中/验收中/开发完成/待发布），则把 `开发状态` 那条 condition 改为：

```json
{
  "type": "condition",
  "field": "5cc59abed9bf1f00013c270d",
  "operator": "notin",
  "value": ["1000000", "100000", "cb5d3971-49e5-471f-9cd1-df6baf66fbff", "c759a466-a316-4de4-8a0b-41cc530e09af"]
}
```

### 2. 输出为表格

> 为了控制接口调用次数，本 skill **只用一次** `get_record_list`，不再逐行 `get_record_details`。负责人相关字段全部不展示。

必须按以下列顺序、RowId 作为首列：

| RowId | 任务名称 | 开发状态 | 前端状态 | 后端状态 | 优先级 |

- **状态列**把 option key 翻译成中文；为空写 `—`
- **优先级**用 `★` 乘以 rating 数（1-5）；为空写 `—`
- **不要**输出任何负责人列（关联的开发人员 / 前端负责人 / 后端负责人 均不展示）

### 3. 末尾补充说明

- 告知本次命中条数、使用的口径（严格/宽松）
- 如果用了严格口径，提示「宽口径」会命中多少（可选，避免额外 API 调用）
- 附上应用 ID、工作表 ID 来源信息

## 坑位（必读）

1. **不要**把 Relation 字段（如 `规划版本` `5cc59bece18661ad844fb43c`）放进 `fields`，其 `sourcevalue` 是整条序列化记录，227 行会直接爆 token 上限。
2. filter 根节点必须是 `group`；某个 group 的 children 不能混用 `group` 和 `condition`，所以即使只有一个条件也要再包一层 group。
3. Collaborator 字段用 `contains`+`value: [accountId]`；Dropdown 用 `in`/`notin`+`value: [optionKey, ...]`。
4. `find_member` 用英文名/拼音常返回空，**优先用中文姓名**。
5. `get_record_list` 对 Collaborator 字段恒返回空串，所以**也别**把 `637f322bee7732feecdd11b9` / `637f322bee7732feecdd11b8` / `5cc59abed9bf1f00013c2711` 加进 `fields`（filter 用作条件没问题）；想拿姓名要换 `get_record_details`，但本 skill 已**故意不展示**负责人，避免 N+1 次调用。

## 回退流程（ID 失效时）

1. `get_org_list` → 找到 `MH & MD`
2. `get_app_list(orgId)` → 找 name=`研发管理` 的条目，取 appId
3. `get_app_worksheets_list(appId, responseFormat=md)` → 找 `开发任务` 行，取 worksheet_id
4. `get_worksheet_structure(...)` → 重新核对字段 ID 与开发状态 option keys
5. 回到「当前用户 accountId 解析」+ 步骤 1
