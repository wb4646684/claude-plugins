# context-optimize

审查 Claude Code 的 memory + skills 结构，防止上下文越积越肿导致响应变慢。

无需凭据，装完即用。

---

## 安装

```
/plugin marketplace add https://github.com/wb4646684/claude-plugins.git
/plugin install context-optimize@wb4646684-plugins
/reload-plugins
```

---

## 使用

```
/context-optimize:context-optimize
```

或直接说：「帮我审计一下 memory 和 skills 的结构」

---

## 能检查什么

- `MEMORY.md` 是否超过 150 行（超出部分被系统截断，等于白写）
- 某个 `SKILL.md` 是否过长、是否混入了应该按需加载的数据
- 哪些 memory 条目重复、过时或可以合并
- 分层是否合理（Layer 0 指针 → Layer 1 流程 → Layer 2 数据）

---

## License

[MIT](../../LICENSE)
