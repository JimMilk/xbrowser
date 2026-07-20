# xbrowser

OpenClaw 浏览器自动化技能。通过 CLI 控制真实浏览器，支持多浏览器、登录态复用、网络安全防护。

## 架构

```
SKILL.md           → Agent 行为指令（如何使用 xb）
references/        → 详细参考文档
scripts/xb.cjs     → CLI 入口（87KB 打包文件）
```

底层引擎：[agent-browser](https://www.npmjs.com/package/agent-browser) v0.25.3

## 版本

当前版本 **1.2.0**。Changelog 见 [CHANGELOG.md](./CHANGELOG.md)。

## 升级路线

参见 [GitHub Issues](https://github.com/JimMilk/xbrowser/issues)，按阶段跟踪：

- **阶段一**：架构加固（Config 分层、浏览器模式显式化、工具能力分级、Watchdog）
- **阶段二**：能力补全（verify/install 命令、A11y snapshot 增强、超时配置化）
- **阶段三**：差异化加固（Shield 强化、决策点系统、Diff/Stream 保留）
