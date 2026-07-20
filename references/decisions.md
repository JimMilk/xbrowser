# xbrowser 决策点系统 — 设计文档

## 设计理念

### 为什么浏览器自动化需要人类在回路

xbrowser 控制的不是沙箱中的无头浏览器——它控制的是用户的**真实浏览器**，带有用户的 cookie、会话状态、登录凭证和浏览器 profile。

这意味着：
- 一个错误的导航可能泄露用户的登录态到攻击者控制的页面
- 一个"看似无害"的 fill 操作可能在恶意表单上输入敏感数据
- 关闭浏览器进程可能导致用户未保存的工作丢失

**决策点系统**是这一问题的解决方案。它不是给 agent 加锁——它是确保安全敏感的配置和操作始终由**真实用户**做出最终决策。

### 设计原则

1. **默认不信任 AI agent 的安全判断**
   - AI agent 的任务是执行浏览器自动化，不是做安全决策
   - 任何改变安全边界、浏览器状态或配置的操作，必须由用户确认

2. **推荐值是引导，不是许可**
   - `recommended` 字段告诉 UI 层"可以高亮这一项"
   - 它不是告诉 agent "可以代用户决定"
   - agent 读到 `recommended` 后仍然必须等待用户选择

3. **用户选择映射仅在用户选择后执行**
   - `user_choice_mapping` 是"用户选完后 agent 要执行什么"
   - 它不是"agent 可以从中挑一个执行"
   - 用户没选，映射就是死数据

4. **模糊授权不是授权**
   - "你看着办""按你的推荐""随便"不构成确认
   - 只有明确的"我确认 + 操作 + 对象"三联才有效

---

## 所有决策点

xbrowser 的决策点系统覆盖了从首次配置到运行时安全确认的完整生命周期：

### 1. config — step 0：快速开始 vs 自定义

**触发**：`xb guide config`（首次使用时的默认引导步骤）

**场景**：用户首次使用 xbrowser，需要在快速开始和自定义设置之间选择。

**决策点 JSON 示例**：
```json
{
  "awaits_user_input": true,
  "message": "欢迎使用 xbrowser 浏览器自动化工具！首次使用需要简单配置。",
  "options": [
    {
      "value": "quick",
      "label": "快速开始（推荐）",
      "description": "使用内置浏览器，干净环境，立即可用"
    },
    {
      "value": "custom",
      "label": "自定义设置",
      "description": "选择默认浏览器和显示模式"
    }
  ],
  "recommended": "quick",
  "user_choice_mapping": {
    "quick": "xb config reset",
    "custom": "xb guide config --step 1"
  }
}
```

**为什么需要用户决策**：选择内置浏览器（CfT）vs 本地浏览器会根本性地改变隐私隔离策略 — CfT 是全新 profile，无任何登录态；本地浏览器复用用户已有的所有 cookie 和会话。

**推荐 quick 的理由**：新用户用 CfT 最安全，不会意外泄露已有登录态，也不占用本地浏览器进程。

---

### 2. config — step 1：浏览器选择

**触发**：`xb guide config --step 1`（用户在上一步选择了"自定义设置"）

**场景**：用户需要选择默认浏览器。系统自动检测已安装的本地浏览器。

**有本地浏览器时的决策点**：
```json
{
  "awaits_user_input": true,
  "message": "请选择默认使用的浏览器：",
  "options": [
    {
      "value": "cft",
      "label": "内置浏览器 Chrome for Testing（推荐）",
      "description": "干净环境，无登录态"
    },
    {
      "value": "chrome",
      "label": "谷歌浏览器 Google Chrome",
      "description": "使用本地 Chrome，可复用登录态"
    }
  ],
  "recommended": "cft",
  "user_choice_mapping": {
    "cft": "xb config set browser=cft",
    "chrome": "xb config set browser=chrome"
  },
  "next_step_hint": "用户选择对应命令执行成功后，继续执行 xb guide config --step 2"
}
```

**边界情况 — 无本地浏览器时（不是决策点）**：
```json
{
  "awaits_user_input": false,
  "auto_set": true,
  "message": "未检测到本地浏览器，将使用内置浏览器。",
  "options": [{
    "value": "cft",
    "label": "内置浏览器 Chrome for Testing（推荐）",
    "description": "干净环境，无登录态"
  }],
  "recommended": "cft",
  "user_choice_mapping": {
    "cft": "xb config set browser=cft"
  },
  "next_step_hint": "执行完成后继续执行 xb guide config --step 2"
}
```

当 `awaits_user_input: false` 时，只有一个选项（CfT），agent 可以直接按 `user_choice_mapping` 执行。但仍应把 `message` 告知用户。

**支持的浏览器选项**：
- `cft` — Chrome for Testing（内置，agent-browser 管理）
- `chrome` — 本地 Google Chrome
- `edge` — 本地 Microsoft Edge
- `qqbrowser` — 本地 QQ 浏览器

---

### 3. config — step 2：显示模式

**触发**：`xb guide config --step 2`

**场景**：用户选择浏览器后，配置默认显示模式。

**决策点**：
```json
{
  "awaits_user_input": true,
  "message": "请选择浏览器的默认显示模式：",
  "options": [
    {
      "value": "true",
      "label": "有头模式：显示浏览器窗口（推荐）",
      "description": "可以看到自动化操作过程，方便观察和人工干预"
    },
    {
      "value": "false",
      "label": "无头模式：后台静默运行",
      "description": "不显示窗口，速度更快，适合纯脚本场景"
    }
  ],
  "recommended": "true",
  "user_choice_mapping": {
    "true": "xb config set headed=true",
    "false": "xb config set headed=false"
  },
  "note": "可随时通过 xb run --headed 覆盖默认值"
}
```

**为什么推荐有头模式**：用户能看到浏览器窗口，可以监控 agent 的实际操作。无头模式适合纯脚本场景，但不适合需要人工观察的交互式自动化。

---

### 4. close-browser：关闭浏览器确认

**触发**：`xb guide close-browser --browser <chrome|edge|qqbrowser>`

**场景**：浏览器正在运行，agent 需要关闭它以完成操作（如迁移 profile）。用户可能有未保存的数据。

**决策点**：
```json
{
  "awaits_user_input": true,
  "message": "检测到 谷歌浏览器 Google Chrome 正在运行。迁移浏览器数据前需要关闭浏览器，请确认：",
  "options": [
    {
      "value": "confirmed",
      "label": "我已确认手动关闭（推荐）",
      "description": "请先保存数据后手动关闭浏览器"
    },
    {
      "value": "force",
      "label": "帮我强制关闭",
      "description": "可能丢失未保存的数据"
    },
    {
      "value": "skip",
      "label": "暂不关闭",
      "description": "暂停操作，稍后再试"
    }
  ],
  "recommended": "confirmed",
  "user_choice_mapping": {
    "confirmed": "xb stop chrome --force",
    "force": "xb stop chrome --force",
    "skip": null
  },
  "skip_hint": "不执行任何命令。告知用户：好的，我会等待你确认数据保存并关闭对应浏览器后再尝试自动化操作；或者你如果需要临时自动化操作，可以通过内置浏览器进行。"
}
```

**注意**：`skip` 选项的 `user_choice_mapping` 值为 `null`。用户选择 skip 时 agent 不执行任何命令，按 `skip_hint` 告知用户。

---

### 5. incomplete-config：配置不完整补救

**触发**：`xb guide incomplete-config`（当 `xb init` 检测到配置存在但不完整时）

**场景**：配置文件存在但缺少必要字段（如 browser 项缺失），可能由版本迁移中断或手动编辑导致。

**决策点**：
```json
{
  "awaits_user_input": true,
  "message": "配置未完成，以下选项需要设置：browser（浏览器）",
  "options": [
    {
      "value": "reset",
      "label": "重置为默认设置（推荐）",
      "description": "使用内置浏览器 + 显示浏览器窗口"
    },
    {
      "value": "guide",
      "label": "重新引导设置",
      "description": "重新选择浏览器和显示模式"
    }
  ],
  "recommended": "reset",
  "user_choice_mapping": {
    "reset": "xb config reset",
    "guide": "xb guide config --step 1"
  }
}
```

---

### 6. shield-allow：加白名单确认

**触发**：`xb guide shield-allow <host:port>`（当网络防护拦截了一个可以加入白名单的地址）

**场景**：用户要访问的地址被防护拦截，但该地址属于可以加入白名单的范围（不是云元数据、不是危险协议）。

**决策点**：
```json
{
  "awaits_user_input": true,
  "message": "网络防护拦截了 192.168.1.10:8080。是否允许 xbrowser 访问该地址？",
  "options": [
    {
      "value": "cancel",
      "label": "取消（推荐）",
      "description": "保持拦截，不修改白名单"
    },
    {
      "value": "confirm",
      "label": "确认加入白名单",
      "description": "允许访问该 host:port"
    }
  ],
  "recommended": "cancel",
  "user_choice_mapping": {
    "cancel": null,
    "confirm": "<以当前 guide 实际返回为准>"
  }
}
```

**关键安全规则**：
- 推荐选项永远是"取消"，不是"确认"——安全默认
- `cancel` 映射为 `null`（不执行命令）
- `confirm` 映射的具体命令**由当前 guide 返回决定**，agent 不能推断或构造
- 云元数据端点不会被送到这里——它们在格式校验阶段就被直接拒绝

**为什么需要用户决策**：加入白名单意味着 agent 可以访问用户的内部网络。在 prompt injection 场景下，攻击者可能诱导 agent 访问内网服务。用户必须明确知道并确认允许访问的具体地址。

---

### 7. shield-off：关闭整体防护确认

**触发**：`xb guide shield-off`（仅当用户明确要求关闭整个防护时）

**场景**：用户要求完全关闭网络防护。

**决策点**：
```json
{
  "awaits_user_input": true,
  "message": "⚠️ 高风险操作：关闭 xbrowser 网络防护。关闭后，浏览器可以访问内网地址、本地地址，存在安全风险。",
  "options": [
    {
      "value": "cancel",
      "label": "保持防护开启（推荐）",
      "description": "维持当前安全防护状态"
    },
    {
      "value": "confirm",
      "label": "我了解风险，确认关闭",
      "description": "关闭整体网络防护，允许所有网络访问"
    }
  ],
  "recommended": "cancel",
  "user_choice_mapping": {
    "cancel": null,
    "confirm": "<以当前 guide 实际返回为准>"
  }
}
```

**安全策略**：
- agent **绝不主动建议**关闭防护
- 如果用户只是要访问某个地址，先推荐 `shield-allow`
- 即使用户说"关闭防护"，也要先展示风险并要求明确确认
- `recommended` 永远是 `cancel`——在任何情况下都不推荐关闭防护

---

## 决策点 JSON Schema

所有决策点遵循统一的结构：

```typescript
interface DecisionPoint {
  // 标志位：true 表示这是需要用户决策的节点，不是完成状态
  awaits_user_input: boolean;

  // 面向最终用户的提示消息（自然语言）
  message: string;

  // 可选的选择列表
  options: Array<{
    value: string;       // 选项标识符，映射到 user_choice_mapping
    label: string;       // 面向用户的简短标签（可含"（推荐）"标记）
    description: string; // 选项的详细说明
  }>;

  // AI agent 的推荐选项 value（仅用于 UI 高亮，不是 agent 自动选择的许可）
  recommended: string;

  // 用户选择某个 value 后，agent 应执行的命令
  // 键为 option.value，值为要执行 xb 命令字符串，null 表示不执行
  user_choice_mapping: Record<string, string | null>;

  // 可选：用户选择 skip（映射为 null）时，agent 应告知用户的内容
  skip_hint?: string;

  // 可选：用户选择对应命令执行成功后，还有后续步骤的提示
  next_step_hint?: string;

  // 可选：额外说明（如"可随时通过 --headed 覆盖默认值"）
  note?: string;

  // 可选：当只有一个选项时，标记为自动设置（不是真正的决策点）
  auto_set?: boolean;
}
```

### 字段设计说明

| 字段 | 为什么存在 | 谁消费 |
|------|-----------|--------|
| `awaits_user_input` | 区分"需要停等用户"vs"可以继续执行" | agent 流程控制 |
| `message` | 告诉用户当前发生了什么，为什么需要决策 | 最终用户 |
| `options[].label` | 给用户一个简短的、可理解的选择 | 最终用户 |
| `options[].description` | 帮助用户理解每个选项的后果 | 最终用户 |
| `recommended` | 给用户一个安全默认的建议（但不代决定） | 最终用户（UI 高亮） |
| `user_choice_mapping` | 告诉 agent 用户选择后要执行什么 | agent（仅在用户选择后） |
| `skip_hint` | 当映射为 null 时，告诉 agent 如何告知用户 | agent |
| `next_step_hint` | 多步流程中，告诉 agent 执行完当前步后下一步做什么 | agent |

---

## Agent 处理决策点的规则

### 必须做（MUST）

1. 读到 `awaits_user_input: true` → **立即停止当前流程**
2. 把 `message` 原文或简短转述展示给用户
3. 把 `options[]` 每一项（label + description）用编号列表展示
4. 以问询句结尾（"你想选哪个？" / "请选择："）
5. 等用户明确回复选择后，从 `user_choice_mapping[用户选择的 value]` 取对应命令并执行
6. 若映射值为 `null` → 按 `skip_hint` 告知用户，不执行任何命令
7. 若有 `next_step_hint` → 执行完当前命令后按提示继续

### 严禁做（MUST NOT）

- ❌ 读到 `recommended` 后自行代选
- ❌ 读到 `user_choice_mapping` 后直接挑一个命令执行
- ❌ "我帮你选了推荐的 X，现在执行 ..."
- ❌ 只列选项但不以问询句结尾

### 自我说服检测表

| 自我说服的念头 | 真相 |
|--------------|------|
| "推荐值就是默认值，直接用推荐值没问题" | 推荐是给用户的引导，不是给 agent 的许可 |
| "mapping 里已经给了具体命令，说明可以直接执行" | mapping 是用户选完后的映射，用户还没选 |
| "用户的意图很明确，跳过配置能更快达成" | 用户的意图里不包含"替我决定配置" |
| "这个选项太简单了，用户肯定会选推荐" | 你不是用户。让用户选。 |
| "我已经展示了选项，现在可以顺便执行一下" | 展示了就停，不能接着执行 |

---

## 与 Playwright MCP 的比较

| 维度 | Playwright MCP | xbrowser 决策点 |
|------|---------------|----------------|
| **人在回路** | 无 — AI agent 直接执行所有操作 | 安全敏感操作强制用户确认 |
| **配置引导** | 无 — 依赖环境变量和 CLI 参数 | 交互式分步引导 + 自动检测已安装浏览器 |
| **浏览器关闭确认** | 无 — agent 随意关闭 session | 强制用户确认（有未保存数据风险） |
| **安全确认** | 无 — 所有的 `--allowed-hosts`、`--blocked-origins` 由 agent 自行配置 | 每次加白/关闭防护都需要用户二次确认 |
| **模糊授权处理** | N/A（无需确认） | 明确拒绝模糊授权（"你看着办"不构成确认） |
| **推荐机制** | 无 | 每个决策点都有推荐值，引导用户但不代替用户 |

**核心差异**：PMCP 设计理念是"信任 AI agent"，所有配置和执行决策都交给 agent。
xbrowser 的设计理念是"信任用户，不信任 AI agent"——安全边界的改变必须由真实用户确认。
这是一个**刻意的设计选择**，针对的是安全敏感环境（如企业内部自动化、涉及登录态的自动化）。

---

## 扩展性

### 添加新决策点

向 xbrowser 添加新决策点的步骤：

1. 在 `scripts/xb.cjs` 的 guide 模块中定义新的 `ye()` 调用
2. 确认是否需要新的 guide 子命令（如 `xb guide <new-action>`）
3. 确保决策点包含完整的 `awaits_user_input`、`message`、`options`、`recommended`、`user_choice_mapping`
4. 在 `SKILL.md` 的"处理决策点返回"章节中无需修改——所有决策点统一由该流程处理
5. 如需记录，添加到此文档的"所有决策点"列表

### 非决策点的边界

以下情况**不是**决策点（`awaits_user_input: false`）：

- config step 1 只有 CfT 一个选项时（无本地浏览器）
- 任何只有一个必然选项的场景

此时 agent 可以直接执行 `user_choice_mapping`，但仍应将 `message` 告知用户让用户知情。
