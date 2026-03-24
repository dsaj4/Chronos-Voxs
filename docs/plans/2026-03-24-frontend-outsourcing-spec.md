# Chronos-Vox 前端外包开发数据合约与设计需求文档

日期：2026-03-24

## 1. 文档目的

本文档用于对外包前端团队明确以下内容：

- 项目目标与交付边界
- 前端唯一可依赖的数据合约
- 页面结构、交互规则与视觉要求
- 开发约束、非目标与验收标准

本文档是外包执行规格，不替代代码中的类型定义。

前端数据合约的代码真源是：

- [publishedTypes.ts](/E:/Project/Cronos-Vox/frontend/workspace/src/loader/publishedTypes.ts)
- [chronos-vox.ts](/E:/Project/Cronos-Vox/shared/contracts/chronos-vox.ts)

如果本文档与上述类型定义冲突，以类型定义为准；本文档负责解释字段含义、交互语义和设计要求。

## 2. 项目目标与外包边界

### 2.1 项目目标

Chronos-Vox 是一个围绕评论语义分析结果进行浏览和判断的统一工作台。前端目标不是做通用后台，而是做一个：

- 单一主视图
- 低噪声
- 中文优先
- 图形优先
- 可在 `主线 / 关系 / 证据` 三个镜头之间切换的分析工作台

### 2.2 本次外包范围

外包团队负责 `frontend/workspace/` 下的工作台前端实现，包括：

- 工作台外壳
- bundle loader
- 共享焦点状态
- 三个主视图的 UI 呈现
- 右侧统一详情面板
- 状态缩略图
- 前端测试、构建与基础文档

### 2.3 非目标

外包团队不负责：

- 后端采集、清洗、Claim 提取、聚合与预测算法
- 修改共享 schema、共享 contracts 或 golden fixture
- 在 loader 中重建语义实体
- 关系编辑能力
- 自然语言预测输入
- 第二套结果浏览器或独立结果页

## 3. 技术基线与工程要求

### 3.1 技术栈

- React 19
- Vite 6
- TypeScript 5
- Vitest

入口目录：

- [frontend/workspace](/E:/Project/Cronos-Vox/frontend/workspace)

常用命令：

```powershell
cd frontend/workspace
npm install
npm run dev
npm run test
npm run check
npm run build
```

### 3.2 工程规则

- 前端只消费已发布的 `PublishedBundle`
- loader 只允许做：读取、基础 shape 校验、索引建立、格式映射
- loader 禁止做：重新生成 storyline、viewpoint、claim 或关系结构
- 所有功能名称、标签、状态提示使用中文
- 页面文案短句化，不在主图区堆长说明
- 新增 UI 必须通过 `npm run test`、`npm run check`、`npm run build`

## 4. 前端唯一数据合约

### 4.1 总体规则

前端唯一输入为 `PublishedBundle`。

顶层结构固定为：

```ts
type PublishedBundle = {
  meta: BundleMeta;
  stream: StreamPayload;
  neural_map: NeuralMapPayload;
  particle_field: ParticleFieldPayload;
  reasoning: ReasoningPayload;
}
```

### 4.2 顶层字段语义

#### `meta`

用于工作台的全局信息和默认行为。

关键字段：

- `case_id`: 案例 ID
- `case_title`: 页面主标题
- `topic_tag`: 当前案例主题
- `contract_version`: 合约版本
- `fixture_id`: 数据包/样例 ID
- `bucket_granularity`: `hour | day | week`
- `analysis_window_start`
- `analysis_window_end`
- `default_model_id`
- `available_models`

约束：

- 当 `bucket_granularity = "hour"` 时，`bucket_start` 必须使用完整 ISO datetime
- 当 `bucket_granularity = "day" | "week"` 时，`bucket_start` 使用日期字符串

#### `stream`

用于主线视图和预测展示。

包含：

- `storylines`
- `storyline_snapshots`
- `forecast_series`

核心对象：

- `PublishedStoryline`
  - 代表一条主线
  - UI 直接使用 `title / summary / logic_status / evidence_posture / display_rank / display_tier`
- `storyline_snapshots`
  - 代表主线在每个时间桶上的状态
  - UI 使用 `bucket_index / bucket_start / support_count / comment_count / top_viewpoint_ids / storyline_heat_index`
- `PublishedStorylineForecastSeries`
  - 一条主线在某模型下的历史段 + 未来段
  - UI 使用 `historical_points / forecast_points / explanation`

#### `neural_map`

用于关系视图与观点相关说明。

包含：

- `viewpoints`
- `viewpoint_snapshots`
- `viewpoint_relations`
- `storyline_relations`

核心对象：

- `PublishedViewpoint`
  - 代表观点对象本身
- `viewpoint_snapshots`
  - 代表观点在某时间桶上的支持状态
- `viewpoint_relations`
  - 观点之间的关系
- `storyline_relations`
  - 主线之间的关系

关系类型固定为：

- `reinforces`
- `competes_with`
- `constrains`
- `depends_on`
- `qualifies`

#### `particle_field`

用于证据视图。

包含：

- `particles`
- `evidence_clusters`

核心对象：

- `particle`
  - 最小证据粒子
  - 带 `storyline_id / viewpoint_id / claim_id / comment_id / bucket_index / excerpt`
- `evidence_cluster`
  - 某时间桶下的证据簇
  - 带 `storyline_id / viewpoint_id / bucket_index / label / representative_comment_id`

#### `reasoning`

用于右侧详情面板中的解释区。

包含：

- `heat_index_formula`
- `model_reasoning`
- `traceability`

前端只展示解释，不改写这些内容。

### 4.3 前端内部共享状态合约

页面层面共享状态固定为：

```ts
type WorkspaceFocusState = {
  activePrimaryView: "storylines" | "relationships" | "evidence";
  activeStorylineIds: string[];
  activeViewpointId: string | null;
  activeBucketIndex: number | null;
  selectedModelId: "bass_diffusion" | "gompertz";
  lastInteractionImpact: string;
  cameraStateByView: {
    storylines: { panX: number; panY: number; zoom: number };
    relationships: { panX: number; panY: number; zoom: number };
    evidence: { panX: number; panY: number; zoom: number };
  };
}
```

约束：

- 三个主视图必须读取同一份共享焦点
- 切视图不能丢 `storyline / viewpoint / bucket / model`
- 每个视图保留独立相机状态

## 5. 页面结构与交互需求

### 5.1 顶层布局

页面始终是单一工作台，不允许出现三张并列大图。

固定结构：

1. 顶部导航层
2. 中央视图层
3. 右侧统一详情面板
4. 非激活视图状态缩略图

中央始终只有一个主视图。

### 5.2 顶部导航层

必须提供：

- 主视图切换器：`主线 / 关系 / 证据`
- 当前案例标题
- 模型切换器
- 最近一次交互影响摘要

默认主视图为 `主线`。

### 5.3 主线视图

目标：讲清楚整体走势与未来变化。

要求：

- 展示历史实线与未来虚线
- 当前主线明显高于背景主线
- 允许切换 `bass_diffusion / gompertz`
- 切换模型只影响未来段，不改历史段
- 主线选择后，要同步更新共享焦点
- 默认选到“该主线最新时间桶中的最强观点”

### 5.4 关系视图

关系视图不是静态关系列表，而是“时间-观点演化图”。

目标：讲清楚当前主线内观点随时间如何变化，以及它与同主线其他观点、外部主线/观点的关键关系。

要求：

- 横轴：时间桶
- 纵向：观点泳道
- 主图主体：当前主线中观点的时间演化
- 当前观点轨迹是主角，最亮、最清晰
- 同主线其他相关观点弱化显示
- 只显示“当前观点 + 相关 Top 4”泳道，避免全量展开
- 外部主线/外部观点只作为边缘锚点出现，不进入主体泳道
- 关系类型主要靠线型、亮度、颜色表达
- 主图内不堆长文案，解释进入右侧详情面板

关系视图的焦点规则：

- 进入关系视图时继承当前 `storyline / viewpoint / bucket`
- 如果当前观点在该桶缺席：
  - 关系视图内部局部切换到该桶主导观点
  - 这个自动切换不写回全局共享焦点
  - 只有用户点击节点时，才写回全局 `activeViewpointId + activeBucketIndex`

### 5.5 证据视图

目标：从抽象结构回到真实证据。

要求：

- 只显示当前主线、当前时间桶的证据
- 如果存在当前观点，则进一步收窄到该观点证据
- 如果当前桶为空，回退到最近有证据的时间桶
- 粒子数量受控
- 当前主导观点的粒子更亮或更大
- 原始说明文字不堆在主画布，放到详情面板

### 5.6 右侧统一详情面板

右侧详情面板是唯一深解释区，不是第二个主页面。

信息优先级固定为：

1. 当前观点
2. 当前主线
3. 当前时间桶
4. 当前模型说明

关系视图进入详情面板时，还应承接：

- 当前演化段说明
- 当前关系解释
- 外部锚点说明
- 最近一次模型切换影响摘要

### 5.7 状态缩略图

非激活视图以轻量缩略图维持存在感，只做提醒，不做深解释。

可展示：

- 主线：当前模型、预测是否变化
- 关系：当前桶主导观点是否切换、识别到几条关键关系
- 证据：当前桶有几个证据簇、主导观点是否变化

## 6. 视觉与设计要求

### 6.1 整体气质

产品气质必须是：

- 极简
- 克制
- 冷静
- 低噪声
- 图形优先

禁止做成：

- 传统后台
- 监控控制台
- 高饱和赛博风
- 同屏多主图

### 6.2 色彩与材质

建议：

- 深蓝灰 / 墨黑 / 冷灰背景
- 高亮近白主文本
- 灰蓝次文本
- 少量偏青、偏蓝、偏金或偏珊瑚作为功能强调色
- 轻玻璃感 / 轻雾面感，不要厚重卡片

功能色只用于：

- 当前焦点
- 预测变化提示
- 风险或冲突关系

### 6.3 文案要求

- 全中文
- 短句
- 少解释
- 不重复图中已表达的信息

推荐术语统一为：

- 主线
- 关系
- 证据
- 观点
- 预测
- 时间点
- 已选择模型

## 7. 交付要求

外包交付应至少包含：

- `frontend/workspace/src/` 下的完整源码
- 运行说明
- 关键交互说明
- 测试代码

不得修改：

- `shared/contracts/**`
- `shared/schemas/**`
- golden fixture 字段结构

如果确实需要扩展契约，必须先提变更说明，不能直接改合约。

## 8. 验收标准

### 8.1 数据合约验收

- 前端只消费 `PublishedBundle`
- loader 无语义重建
- hour 粒度 `bucket_start` 能正确显示小时
- 模型切换只影响未来段展示

### 8.2 交互验收

- 三个主视图共享同一份焦点
- 切换视图不丢主线、观点、时间桶、模型
- 切主线后自动落到该主线最新时间桶的最强观点
- 关系视图局部自动切换不污染全局焦点
- 点击关系视图节点后，其他视图能继承新的共享焦点

### 8.3 视觉验收

- 中央始终只有一个主图
- 右侧详情面板固定存在
- 页面第一眼不是“后台感”
- 关系视图第一眼能看出“观点如何随时间演化”
- 证据视图第一眼能看出“当前时间切片下有哪些证据簇”

### 8.4 工程验收

- `npm run test` 通过
- `npm run check` 通过
- `npm run build` 通过
- 不引入未约定的新技术栈

## 9. 参考文件

外包团队开始前应先阅读：

- [frontend/workspace/README.md](/E:/Project/Cronos-Vox/frontend/workspace/README.md)
- [publishedTypes.ts](/E:/Project/Cronos-Vox/frontend/workspace/src/loader/publishedTypes.ts)
- [bundleLoader.ts](/E:/Project/Cronos-Vox/frontend/workspace/src/loader/bundleLoader.ts)
- [Chronos-Vox 信息架构与页面结构文档.md](/E:/Project/Cronos-Vox/docs/core/Chronos-Vox%20信息架构与页面结构文档.md)
- [Chronos-Vox 前端交互状态与联动设计文档.md](/E:/Project/Cronos-Vox/docs/core/Chronos-Vox%20前端交互状态与联动设计文档.md)
- [Chronos-Vox 前端视觉与交互呈现设计文档.md](/E:/Project/Cronos-Vox/docs/core/Chronos-Vox%20前端视觉与交互呈现设计文档.md)
