---
name: get-hap-bug-todolist
description: 从 HAP（明道云）「BUG管理」应用的「Web」工作表中，拉取「研发未解决」视图下、当前登录用户作为当前处理人的 BUG 清单，以表格形式输出（RowId 为首列）。触发场景：用户询问「我的 BUG」「我的 bug todolist」「我要处理的 BUG」「HAP 上我待处理的 bug」「BUG管理里我的任务」等。
---

# Skill: get-hap-bug-todolist

拉取当前登录用户在 HAP「BUG管理」应用「Web」工作表「研发未解决」视图下、作为「当前处理人」的 BUG 清单。

## 固定参数（已验证可用）

| 项 | 值 |
| --- | --- |
| 网络（Org） | MH & MD (`fe288386-3d26-4eab-b5d2-51eeab82a7f9`) |
| 应用 App | BUG管理 (`eed8e526-6c6e-4e05-9ab7-e25550aa990c`) |
| 工作表 | Web (`5cc4391adb8d4e0001ee6618`) |
| 视图 | 研发未解决 (`5cc4391adb8d4e0001ee6619`) |

> 如果上述 ID 失效（应用/工作表/视图被重建等），按「回退流程」重新发现。

## 当前用户 accountId 解析

本 skill 对团队内不同成员通用，accountId **必须在每次运行时解析**，不得写死。

解析顺序：
1. 如果调用时带了参数：
   - 参数看起来是 UUID（`^[0-9a-f-]{36}$`）→ 直接当作 `accountId` 使用。
   - 否则当作**中文姓名**，走下面第 3 步的 `find_member`。
2. 否则，读取 hap-mcp 登录用户持久化文件 `~/.config/hap-mcp/account_id`（hap-mcp ≥ 1.1.6 在首次 token 刷新时自动写入）。读到非空内容即直接作为 `accountId` 使用，无需再查 memory 或询问。
3. 若文件不存在 / 为空 / 读取失败，用一句话提示用户**手动输入 accountId 或中文姓名**（切勿自行猜测、也不要默认用 memory 里其他人的 accountId）。
   - 用户给 UUID → 直接用。
   - 用户给姓名 → 调用 `mcp__hap__find_member(appId="eed8e526-6c6e-4e05-9ab7-e25550aa990c", name="<中文姓名>")`，取返回里第一个 `users[].accountId`；若 `users` 为空告知「未匹配到成员」，让其确认姓名。

## 关键字段 ID

| 字段 | ID | 类型 |
| --- | --- | --- |
| 标题 | `5cc4391adb8d4e0001ee6612` | Text |
| 当前处理人 | `5cc4391adb8d4e0001ee6614` | Collaborator |
| 处理状态 | `5cc4391adb8d4e0001ee6611` | Dropdown |
| 处理优先级 | `5cc6762f442bf21e3c044f0d` | Dropdown |
| 环境 | `5fb224c4383644000159d8cf` | MultipleSelect |
| 所属模块 | `61b1c29afc669c450b795760` | MultipleSelect |
| BUG类型 | `65728cc8ba5ef3863bf73e66` | Dropdown |
| 合入分支 | `5dfb1e9b3e74520001925b46` | Dropdown |
| 产研参与成员 | `5d3943f2442bf2428801230c` | Collaborator |

### 处理状态 option keys（常见）

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

> 视图 `研发未解决` 已在服务端按「研发侧未闭环」口径过滤，**无需再手动叠加状态条件**。

### 处理优先级 option keys

| Key | 中文 |
| --- | --- |
| `1000` | 当天修复 |
| `100` | 三天内修复 |
| `10` | 一周内修复 |
| `1` | 可下个版本修复 |
| `10000` | 后面再看 |

## 执行步骤

### 1. 调用 `mcp__hap__get_record_list`

把 `<ACCOUNT_ID>` 替换成步骤「当前用户 accountId 解析」里拿到的 accountId。

```json
{
  "appId": "eed8e526-6c6e-4e05-9ab7-e25550aa990c",
  "worksheet_id": "5cc4391adb8d4e0001ee6618",
  "viewId": "5cc4391adb8d4e0001ee6619",
  "pageSize": 200,
  "pageIndex": 1,
  "responseFormat": "md",
  "tableView": true,
  "includeTotalCount": true,
  "fields": [
    "5cc4391adb8d4e0001ee6612",
    "5cc4391adb8d4e0001ee6611",
    "5cc6762f442bf21e3c044f0d",
    "5fb224c4383644000159d8cf",
    "61b1c29afc669c450b795760"
  ],
  "filter": {
    "type": "group",
    "logic": "AND",
    "children": [
      {
        "type": "condition",
        "field": "5cc4391adb8d4e0001ee6614",
        "operator": "contains",
        "value": ["<ACCOUNT_ID>"]
      }
    ]
  },
  "ai_description": "Worksheet: Web (BUG管理). View: 研发未解决. Filter: 当前处理人 contains current user."
}
```

> 如果用户要求「也看我作为产研参与成员参与的」，把 filter 改为 OR 组：`当前处理人 contains` 或 `产研参与成员 contains`；但默认 skill 只按**当前处理人**过滤。

### 2. 输出为表格

> 为了控制接口调用次数，本 skill **只用一次** `get_record_list`，不再逐行 `get_record_details`。负责人相关字段全部不展示。

必须按以下列顺序、RowId 作为首列：

| RowId | 标题 | 处理状态 | 处理优先级 | 环境 | 所属模块 |

- **处理状态 / 处理优先级**把 option key 翻译成中文；为空写 `—`
- **环境 / 所属模块** 是 MultipleSelect，把每个 key 翻译成中文后用 `/` 连接；为空写 `—`
- **不要**输出任何负责人列（当前处理人 / 产研参与成员 均不展示）

### 3. 末尾补充说明

- 告知本次命中条数（使用 `includeTotalCount` 返回值）、使用的视图（`研发未解决`）、过滤口径（当前处理人）
- 附上应用 ID、工作表 ID、视图 ID 来源信息

## 坑位（必读）

1. **不要**把 Relation 字段（如 `开发任务` `5cc59bece18661ad844fb441`、`产品需求` `5fb74348d6ce050001148e11`、`APP` `61149185b55c3de746b1519a` 等）放进 `fields`，其 `sourcevalue` 是整条序列化记录，容易直接爆 token 上限。
2. filter 根节点必须是 `group`；某个 group 的 children 不能混用 `group` 和 `condition`，所以即使只有一个条件也要再包一层 group。
3. Collaborator 字段用 `contains`+`value: [accountId]`；Dropdown 用 `in`/`notin`+`value: [optionKey, ...]`；MultipleSelect 同样用 option key。
4. `find_member` 用英文名/拼音常返回空，**优先用中文姓名**。
5. `get_record_list` 对 Collaborator 字段恒返回空串，所以**别**把 `5cc4391adb8d4e0001ee6614` / `5d3943f2442bf2428801230c` 加进 `fields`（filter 用作条件没问题）；想拿姓名要换 `get_record_details`，但本 skill 已**故意不展示**负责人，避免 N+1 次调用。
6. 视图 `研发未解决` 已做服务端过滤（研发侧未闭环），叠加状态 `in/notin` 条件会造成重复甚至把原本在视图里的记录过滤掉，**不要自行追加**。

## 回退流程（ID 失效时）

1. `get_org_list` → 找到 `MH & MD`
2. `get_app_list(orgId)` → 找 name=`BUG管理` 的条目，取 appId
3. `get_app_worksheets_list(appId, responseFormat=md)` → 找 `Web` 行，取 worksheet_id
4. `get_worksheet_structure(...)` → 在 views 里找到 name=`研发未解决` 的视图 id；并重新核对字段 ID、处理状态/优先级 option keys
5. 回到「当前用户 accountId 解析」+ 步骤 1
