# Changelog

## [Unreleased] - 阶段一至阶段三

### 阶段一：架构加固
- Config JSON 分层 merge（默认值 → 文件 → 环境变量 → CLI）
- `--mode persistent|isolated` 显式化
- 工具按 `--caps` 能力分级
- Watchdog 自动清理

### 阶段二：能力补全
- 新增 `verify` 命令
- 新增 `install` 命令
- `snapshot --a11y` 增强
- 超时配置化（action/navigation）

### 阶段三：差异化加固
- Shield 保持不变
- 决策点系统保留
- Diff/Stream 保留

## [1.2.0] - 2025-06-11
- Shield 安全防护模块（网络拦截、白名单、决策点确认）
- QQ 浏览器支持（CDP 自动检测和连接）
- Profile 同步迁移（robocopy/rsync）
- 版本升级兼容

## [1.0.0] - 初始版本
- 基础浏览器自动化（open/snapshot/click/fill 等）
- Chrome/Edge/CfT 三浏览器支持
- 引导式配置流程
- 状态管理和错误诊断
