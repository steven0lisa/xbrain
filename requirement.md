# 基于邮件+Claude Code的AI助手

## 项目概述

这是一个基于邮件和Claude Code的智能AI助手系统，能够自动接收邮件、识别用户请求、调用Claude Code生成智能回复，并自动发送回复邮件。系统采用Node.js开发，支持IMAP/SMTP协议，集成Claude Code CLI工具，实现完全自动化的邮件处理流程。

## 功能特性

### 核心功能
- **自动邮件接收**：通过IMAP协议定期检查新邮件，支持SSL连接
- **智能触发检测**：自动识别邮件正文中的"@助手"关键词
- **邮件内容解析**：支持纯文本和HTML格式，自动提取邮件内容
- **附件处理**：自动下载邮件附件到本地知识库
- **Claude Code集成**：调用Claude Code CLI工具生成智能回复
- **自动邮件回复**：通过SMTP协议发送回复，支持HTML格式和附件
- **状态持久化**：记录已处理邮件UID，避免重复处理
- **日志记录**：完整的操作日志，支持文件轮转和多级别日志

### 技术特性
- **容错处理**：完善的异常处理和错误恢复机制
- **定时轮询**：可配置的邮件检查间隔
- **工作目录管理**：每次Claude调用使用独立工作目录
- **多格式支持**：支持文本、Markdown、HTML格式的回复
- **附件传递**：支持Claude生成的文件作为邮件附件发送

## 系统架构

### 项目结构
```
src/
├── index.js          # 主入口文件，邮件轮询和触发逻辑
├── config.js         # 配置管理，环境变量加载
├── assistant.js      # Claude Code调用核心逻辑
├── logger.js         # Winston日志配置
└── mail/
    ├── imap.js       # IMAP邮件接收和附件下载
    └── smtp.js       # SMTP邮件发送

data/                 # 运行时数据目录
├── kb/              # 邮件知识库，按UID组织
├── state.json       # 状态持久化文件
└── assistant/       # Claude工作目录

logs/                # 日志文件目录
scripts/             # 工具脚本
tests/               # 测试文件
```

### 数据流程
1. **邮件接收阶段**：
   - 定期连接IMAP服务器检查新邮件
   - 使用UID范围增量获取，避免重复处理
   - 解析邮件内容，下载附件到本地知识库
   - 更新处理状态

2. **触发检测阶段**：
   - 扫描邮件正文、HTML内容和主题
   - 检测"@助手"关键词
   - 过滤无需回复的邮件

3. **Claude处理阶段**：
   - 创建独立工作目录
   - 准备邮件内容和附件作为输入
   - 调用Claude Code CLI工具
   - 解析生成结果和附件

4. **邮件回复阶段**：
   - 构建回复邮件，支持HTML格式
   - 附加Claude生成的文件
   - 通过SMTP发送回复
   - 记录发送状态

## 配置说明

### 环境变量配置

#### 邮箱配置（必需）
```bash
MAIL_USER=steven0lisa@163.com          # 邮箱用户名
MAIL_PASS=your_password                # 邮箱密码/授权码
IMAP_HOST=imap.163.com                 # IMAP服务器地址
IMAP_PORT=993                          # IMAP端口
SMTP_HOST=smtp.163.com                 # SMTP服务器地址
SMTP_PORT=465                          # SMTP端口
```

#### Claude Code配置（必需）
```bash
ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic  # Claude API基础URL
ANTHROPIC_AUTH_TOKEN=your_token                             # Claude API认证令牌
ANTHROPIC_SMALL_FAST_MODEL=glm-4.6                         # 快速模型名称
ANTHROPIC_MODEL=glm-4.6                                    # 主模型名称
```

#### 可选配置
```bash
POLL_INTERVAL_MS=60000              # 邮件轮询间隔（毫秒）
LOG_LEVEL=info                      # 日志级别
CLAUDE_BIN=claude                   # Claude二进制路径
```

### 服务器配置信息

#### 163邮箱服务器
- **IMAP服务器**: imap.163.com (端口993，SSL)
- **SMTP服务器**: smtp.163.com (端口465，SSL)
- **POP3服务器**: pop.163.com (端口995，SSL)

#### 测试账号
- **邮箱**: steven0lisa@163.com
- **密码**: [配置文件中]

## 技术实现

### 关键技术栈
- **Node.js**: 项目运行环境
- **imapflow**: IMAP客户端库
- **mailparser**: 邮件解析库
- **nodemailer**: SMTP发送库
- **winston**: 日志管理库
- **dotenv**: 环境变量管理

### Claude Code集成
- 使用`spawn`调用Claude Code CLI工具
- 支持JSON输出格式和工具权限配置
- 具备超时机制和错误回退逻辑
- 支持多种输出格式检测

### 错误处理策略
- 网络连接异常的自动重试
- Claude调用失败的容错处理
- 邮件解析异常的跳过机制
- 状态同步的一致性保证

## 使用说明

### 启动服务
```bash
# 安装依赖
npm install

# 启动服务
npm start

# 开发模式启动
npm run dev

# 干运行模式（不实际发送邮件）
DRY_RUN=1 npm start
```

### 测试工具
```bash
# 运行测试
npm test

# 发送测试邮件
node scripts/send-test-email.js

# 单独测试助手
node scripts/run-assistant.js
```

### 监控和日志
- 日志文件位于`logs/`目录
- 支持按日期轮转，保留14天历史
- 实时控制台输出，方便调试

## 部署和维护

### 部署要求
- Node.js 18+ 运行环境
- 稳定的网络连接
- Claude Code CLI工具安装
- 有效的邮箱和API访问权限

### 维护建议
- 定期检查日志文件大小
- 监控邮件处理队列
- 备份重要的状态文件
- 更新Claude模型配置

### 性能优化
- 调整轮询间隔平衡响应速度和资源消耗
- 优化工作目录清理策略
- 监控内存和网络使用情况

## 扩展功能

### 已实现功能
- ✅ 完整的邮件接收和发送流程
- ✅ Claude Code智能回复集成
- ✅ 附件处理和传递
- ✅ 状态持久化和防重复处理
- ✅ 完善的日志和错误处理
- ✅ 多格式回复支持（文本/Markdown/HTML）

### 未来扩展方向
- 支持多邮箱账户配置
- 添加邮件模板系统
- 集成更多AI模型选择
- 增加邮件分类和优先级
- 支持定时邮件发送
- 添加Web管理界面

## 测试验证

### 功能测试
- 邮件发送和接收测试通过
- Claude Code调用测试通过
- 附件处理测试通过
- 错误恢复测试通过

### 性能测试
- 单封邮件处理时间：~45秒（包含Claude调用）
- 内存占用：稳定在50MB以内
- 并发处理：支持持续邮件流

## 故障排除

### 常见问题
1. **邮件连接失败**：检查邮箱配置和网络连接
2. **Claude调用超时**：检查API配置和模型可用性
3. **状态文件损坏**：删除state.json重新开始
4. **权限问题**：确保文件目录写权限

### 调试方法
- 使用`DRY_RUN=1`模式测试
- 检查日志文件详细错误信息
- 使用测试脚本单独验证组件
- 监控网络和API调用状态
