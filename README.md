# 别吵醒猫咪

**Production:** https://cat.fde.fan

手机优先的中文病毒传播网页小游戏：每局随机出现真实猫咪，趁它没盯着你时把鱼拖走；进入警戒状态时必须立刻停手。没有固定终点，难度持续上升。

## V2 已包含

- 中文界面
- 12 只真实猫咪随机池，保留来源与摄影师
- 无限难度曲线、真假预警、后期双重假动作
- 今日 / 本周 / 全球总榜
- 匿名昵称，不强制注册
- 好友挑战链接
- 中文分享战绩
- 服务端 run token + 基础反作弊
- Vercel Web Analytics
- Supabase 行为事件、反馈、排行榜、实验数据
- 每日自动增长报告
- 带样本量和“不公平率”护栏的自动实验流量优化器

## 增长闭环

曝光 → 第一次操作 → 第一次偷鱼 → 死亡 → 重试 → 多局 → 分享/挑战 → 新玩家

显式反馈：太简单 / 刚刚好 / 不公平 / 可选文字。

隐式反馈：page_view、first_interaction、game_start、fake_cue、eyes_open、look_survived、fish_stolen、run_end、retry、share、challenge、leaderboard、page_hide、image_error。

详见 docs/GROWTH_LOOP.md。

## 数据驱动实验

当前 difficulty_v2 有 A / B 两套难度参数，权重存在 Supabase，因此调整流量不需要重新部署。

每日 optimizer：
1. 汇总最近 7 天数据
2. 每个版本至少 200 个独立玩家后才允许自动调权
3. 主要看二次开局率与分享/挑战
4. “不公平”反馈是强制 guardrail
5. 证据不足保持 50/50
6. 有明显优势时最多到 75/25；更大样本时最多 90/10
7. 永远保留探索流量
8. 每次自动调权写入审计表

## 排行榜与反作弊

每局由服务端创建 runId + token。结束时服务端检查 token、运行时长和分数的基本物理合理性，再决定是否记为有效全球成绩。

## 真实猫咪图片

生产素材池定义在 src/data/cats.ts。每张照片都保存固定图片 ID、原始照片页、摄影师和裁切位置。界面有照片来源入口。

## 隐私

- 不要求账号
- 不主动保存 IP
- 只保存匿名 session、粗粒度国家/设备、游戏行为、分数、实验版本与用户主动反馈
- 数据表启用 RLS
- anon/authenticated 没有直接读写 policy
- 浏览器只访问本站 API，数据库连接串只在服务端

## 变现顺序

V2 不放强制广告。先证明流量与复玩，再分别实验：失败后自愿看广告换一次续命、多局后的自然断点广告、“今日猫咪”品牌赞助、宠物用品联盟 / 电商导流。

任何变现实验必须同时看收入、二次开局率、session 长度、分享率和负面反馈。收入升但病毒传播明显下降，就不放量。

## 部署纪律

普通 commit 不触发 Vercel production deployment。

- [deploy]：完整 build + 1 次 production deploy
- [ops]：DNS / 域名 / 健康检查，不部署
- Cat growth optimizer：只读写 Supabase 实验权重，不部署

## Required GitHub secrets

VERCEL_API_TOKEN, SUPABASE_DB_URL, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN.

## Stack

Astro + Vercel + Vercel Web Analytics + PostgreSQL / Supabase + Cloudflare DNS
