# context-optimize

一个 Claude Code skill，帮你审查和优化 memory + skills 的分层结构，避免 context 被不必要的内容塞满。

## 为什么需要它

Claude 每次会话都有上下文窗口。上下文塞得越满：

- 响应变慢
- 指令跟随能力下降
- Cache miss 率上升，调用更贵

每个 memory 条目、每个 skill 定义都占 context —— 哪怕你这次用不到，只要加载了就占位。长期使用 Claude 后，`MEMORY.md` 和 `skills/` 会越来越肿，有必要定期审计。

## 安装

```
/plugin marketplace add wb4646684/claude-plugins
/plugin install context-optimize@claude-plugins
```

## 使用

在 Claude Code 里直接触发：

```
/context-optimize:context-optimize
```

或用自然语言：

- 「帮我审计下 memory 和 skills 的结构」
- 「MEMORY.md 是不是太大了」
- 「整理一下 skills，该拆的拆该合的合」

Claude 会自动加载本 skill，按分层原则输出问题清单 + 建议。

## 分层原则速查

```
Layer 0  MEMORY.md              ≤150 行，只放一行指针
Layer 1  skills/<name>/SKILL.md  流程 + 指针，一般 ≤ 100 行
Layer 2  skills/<name>/data/*   原始数据，从不自动加载
```

完整规则见 [SKILL.md](./skills/context-optimize/SKILL.md)。

## License

[MIT](../../LICENSE)
