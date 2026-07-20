# xbrowser Diff & Stream — 调试工具文档

## 概述

`diff` 和 `stream` 是 xbrowser 独有的调试和监控工具，Playwright MCP 没有等价物。它们服务于两个不同的场景：

- **diff**：回归测试和变更验证——"这个操作前后页面发生了什么变化？"
- **stream**：持续监控——"页面在长时间运行中发生了什么？"

---

## Diff — 差异对比

### 设计目的

浏览器自动化中，经常需要验证"点击后页面是否按预期变化"或"A/B 两个版本的页面有什么区别"。传统做法是截图后人工对比，diff 将这个过程自动化。

### 子命令

| 子命令 | 说明 | 对比内容 |
|--------|------|----------|
| `diff snapshot` | 快照差异 | 两个 snapshot 的可访问性树差异 |
| `diff screenshot` | 截图差异 | 两张截图的视觉像素差异 |
| `diff url` | URL 差异 | 当前页面 URL 与目标 URL 的差异 |

### diff snapshot

比较两个页面快照，返回差异的 DOM 元素列表。

```bash
# 先获取基准快照
xb run snapshot -i  # 返回 @e1..@e20

# 执行操作（如点击、填充表单）
xb run click @e5

# 再获取新快照，对比
xb run diff snapshot  # 对比当前快照与上一快照
```

**输出**：新增的元素、移除的元素、变化的元素（文本内容变化、属性变化等）。

**使用场景**：
- 验证点击后表单是否正确展开
- 确认导航后页面内容是否加载
- 检查 DOM 操作是否正确执行
- 回归测试：验证某次部署后页面结构是否变化

### diff screenshot

视觉像素级别的截图对比。

```bash
# 截图 A
xb run screenshot --full

# 执行操作
xb run click @e3

# 截图 B 并对比
xb run diff screenshot
```

**输出**：像素差异区域、变化百分比。

**使用场景**：
- 验证 UI 布局没有意外变化
- 确认颜色、样式变化是否正确
- 检测视觉回归（CSS 变更影响）

### diff url

URL 级别的对比，验证导航是否正确。

```bash
xb run open https://example.com/login
xb run fill @e1 "user"  # 输入用户名
xb run fill @e2 "pass"  # 输入密码
xb run click @e3        # 点击登录
xb run diff url         # 验证是否跳转到了 dashboard
```

**使用场景**：
- 验证登录后是否跳转到正确页面
- 确认重定向链是否按预期工作
- 检测路由变化

---

## Stream — 持续页面监控

### 设计目的

长时间运行的自动化任务（如爬取、监控、压力测试）需要持续了解页面状态。stream 提供了一种低开销的持续监控能力，无需频繁执行 snapshot 或 screenshot。

### 子命令

| 子命令 | 说明 |
|--------|------|
| `stream enable` | 开启连续页面监控 |
| `stream status` | 查看监控状态 |
| `stream disable` | 停止监控 |

### 工作流程

```bash
# 1. 打开目标页面
xb run open https://example.com/app

# 2. 开启持续监控
xb run stream enable

# 3. 执行一系列操作
xb run click @e5
xb run fill @e3 "data"
xb run click @e7
# ... 更多操作 ...

# 4. 随时查看当前状态
xb run stream status

# 5. 完成后停止监控
xb run stream disable
```

**监控内容**（持续跟踪）：
- 当前页面 URL
- 页面标题变化
- 网络请求计数
- 控制台错误计数
- JavaScript 错误
- 页面加载状态

**使用场景**：
- **长时间自动化**：监控数小时运行中页面是否出现错误
- **爬虫**：跟踪爬取过程中的 URL 跳转和错误
- **调试**：定位"点了之后页面静默失败了"的问题
- **压力测试**：持续监控页面的网络请求数和错误率
- **SPA 应用监控**：跟踪单页应用的 URL 和状态变化

### 注意事项

- stream 不是无限数据源——它是状态摘要，不是事件日志
- 需要在操作完成后主动查询 `stream status`
- 关闭浏览器或会话会自动停止 stream
- stream 状态是会话级别的，跨会话不保留

---

## 与 Playwright MCP 的比较

| 维度 | Playwright MCP | xbrowser diff/stream |
|------|---------------|---------------------|
| **快照差异** | 无内置 diff — 需要手动对比两次 snapshot 输出 | `diff snapshot` 自动对比并报告差异 |
| **截图差异** | 无内置像素对比 — 需要外部工具（如 pixelmatch） | `diff screenshot` 内置像素级对比 |
| **URL 对比** | 无 — 需要手动 `browser_evaluate` 获取 URL 后对比 | `diff url` 自动对比当前 URL 与目标 |
| **持续监控** | 无 — 每次操作都是独立的工具调用，无状态保持 | `stream enable/status/disable` 完整生命周期 |
| **监控状态查询** | 无 — 需要多次 `browser_snapshot` 或 `browser_console_messages` | `stream status` 一次查询获取所有状态摘要 |

**核心差异**：diff 和 stream 是 xbrowser 中的**一等公民功能**——它们有专门的命令、生命周期管理和结构化输出。PMCP 中这些能力需要通过组合多个基本操作来实现，且没有统一的状态管理。

---

## 在验证工作流中的位置

diff 和 stream 与 xbrowser 的 `verify` 命令（Phase 2）配合使用，形成完整的测试和调试流水线：

```
verify text/url/title   — 断言验证（通过/失败）
diff snapshot/screenshot/url — 差异分析（什么变了）
stream enable/status    — 持续监控（运行中发生了什么）
```

三者在测试工作流中的关系：

```
1. 设置页面状态（导航、填充表单）
2. stream enable       ← 开启监控
3. 执行被测操作
4. verify text "..."   ← 断言（通过/失败）
5. 如果失败：
   a. diff snapshot    ← 看看什么变了
   b. diff screenshot  ← 看看视觉上有什么差异
   c. stream status    ← 看看运行中出了什么错
6. stream disable      ← 关闭监控
```
