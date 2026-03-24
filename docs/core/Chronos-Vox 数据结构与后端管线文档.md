## 1. 文档目的

本文档用于定义 Chronos-Vox 的核心数据对象、分析层级、后端处理流程，以及后端到前端的发布链路。

它回答的问题是：
- 原始数据如何一步步转化为主线与预测
- 每一层对象承担什么职责
- 哪些对象是真源，哪些对象只是兼容投影
- 前端消费的数据应当来自哪里

## 2. 核心数据主链

Chronos-Vox 的后端主链固定为：

`评论 -> Claim -> Viewpoint -> Storyline -> Forecast`

每一层职责都必须清晰，避免多个对象争夺同一语义中心。

## 3. 原始输入层

输入数据来自平台抓取结果，例如：
- Bilibili
- 小红书
- 其他后续接入平台

原始评论进入系统后，需要先标准化：
- 平台字段统一
- 文本清洗
- 去空、去噪、去重
- 质量评分
- 来源类别推断
- 时间字段规范化

这一层的目标是得到可分析的评论真源。

## 4. Claim 层

Claim 是评论中的原子表达片段。

它建议包含：
- `claim_id`
- `comment_id`
- `text`
- `evidence_text`
- `evidence_start`
- `evidence_end`
- `created_at`
- `extractor_id`
- `extractor_confidence`
- `stance`
- `topic_tags`
- `source_class`
- `signal_strength`
- `metadata`

Claim 只负责表达“评论里有哪些原子主张”，不负责最终叙事。

## 5. Viewpoint 层

Viewpoint 是由多个 Claim 和评论支撑的具体观点。

它是第一个真正对用户有意义的语义对象。

建议字段：
- `viewpoint_id`
- `topic_tag`
- `viewpoint_label`
- `title`
- `claim_statement`
- `summary`
- `summary_source`
- `summary_grounding_score`
- `claim_ids`
- `comment_ids`
- `representative_claim_ids`
- `evidence_comment_ids`
- `support_count`
- `unique_comment_count`
- `keywords`
- `metadata`

Viewpoint 还应有两个配套对象：
- `ViewpointSnapshot`
- `ViewpointRelation`

## 6. Storyline 层

Storyline 是跨时间串联多个 Viewpoint 的主线，是系统当前最重要的主叙事对象。

设计原则：
- 不按固定立场桶强行切线
- 先按主题和稳定标签形成主线
- 再用时间接续和关系证据做加权
- 一条主线允许不同阶段的观点变化

建议字段：
- `storyline_id`
- `topic_tag`
- `title`
- `summary`
- `summary_source`
- `logic_status`
- `evidence_posture`
- `support_count`
- `viewpoint_count`
- `comment_count`
- `keywords`
- `display_rank`
- `display_tier`
- `metadata`

Storyline 还应有三个配套对象：
- `StorylineMembership`
- `StorylineSnapshot`
- `StorylineRelation`

## 7. Forecast 层

Forecast 不再独立叫反事实层，而是并入主时间流的未来段预测层。

原则：
- 只预测未来段
- 沿用当前时间桶单位
- horizon 自适应
- 不允许无限增长
- 必须有饱和上限和衰减项
- 置信度随未来距离递减
- 支持模块化的模型选用

建议对象：
- `ForecastPoint`
- `StorylineForecastSeries`
- `StorylineRelationImpact`

## 8. 后端分析流程

推荐流程：
1. 数据接入与标准化
2. Claim 抽取
3. Viewpoint 聚合
4. Storyline 聚合
5. Summary 层压缩表达
6. Forecast 生成未来段
7. 发布面向前端的中间层

## 9. AnalysisState 角色

后端应有一个统一总对象承载完整分析状态。

建议至少包含：
- 标准化评论
- Claim
- Viewpoint
- ViewpointSnapshot
- ViewpointRelation
- Storyline
- StorylineMembership
- StorylineSnapshot
- StorylineRelation
- StorylineForecast
- 元数据与诊断信息

它是整个后端的分析真源。


## 10. 发布层设计

后端最终应发布一个面向前端的中间层对象，例如 bundle。

发布层职责：
- 将分析真源转成前端易消费结构
- 保持语义清晰
- 不再在前端 loader 中承担重推理

建议发布结构：
- `meta`
- `stream`
- `neural_map`
- `particle_field`
- `reasoning`

## 12. 前端消费链路

前端建议走：

`bundle -> loader -> workspace payload`

loader 只负责：
- 轻量字段映射
- 焦点状态初始化
- 展示格式转换

而不再负责从评论临时拼接核心对象。

## 13. 与 MediaCrawler 的关系

MediaCrawler 是数据接入层，而不是分析层。

完整链路应为：

`关键词 -> 爬取任务 -> 原始内容 -> 标准化评论 -> Claim -> Viewpoint -> Storyline -> Forecast -> 工作台`

## 14. 验收标准

后端管线完成后应满足：
- 前端核心对象都能追溯到明确真源
- 主线与预测语义统一
- 前端三个主视图消费的是同一套对象体系
- 用户切换模型后，只改变未来段展示

## 15. 总结

Chronos-Vox 的后端管线必须围绕一个核心原则建立：

**所有复杂前端体验，都必须建立在稳定、可解释、层级清晰的数据对象之上。**

因此，真正的主链必须是：

**评论 -> Claim -> Viewpoint -> Storyline -> Forecast**
