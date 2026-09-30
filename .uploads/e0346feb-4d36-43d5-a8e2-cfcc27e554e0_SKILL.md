---
name: anime-to-real
description: 动画/游戏/二次元角色转真人实拍风格的提示词工程。当用户提交一张动画、漫画、游戏原画、3D 渲染或手办/立绘的角色图，要求「变成真人」「真人化」「真人版」「实拍感」「真人 cos」「去掉二次元感」，或要为真人角色做图生图 / 文生图 / I2V 视频时提示词如何写时使用。也用于诊断真人化失败（塑料 CG 脸、性别跑偏、配饰丢失、背景被填充、恐怖谷）。触发词：动画转真人、真人化、realistic、live-action、真人 cos、二次元转实拍、角色真人版。
---

# 动画角色真人化 Anime → Real

把二次元角色转成真人实拍风格的提示词工程方法论。核心不是"加个 realistic"，而是**同时打赢两场仗**。

---

## 一、底层原理：两场拔河

模型的潜空间里，"动画域"和"摄影域"是两个很强的吸引子，而你传入的参考图本身又有巨大引力（它牢牢把生成结果拽回动画侧）。

| 只做一半 | 结果 |
|---|---|
| 只写 `realistic` | 在动画域里打补丁 → 塑料感 CG 脸 |
| 只写"保留角色" | 根本换不了域 → 还是动画 |
| 用力过猛的 `photorealistic` | 脸是真人了，人也不像了 |

**解法：把两个目标拆成独立段落，再写一条"仲裁规则"告诉模型冲突时听谁的。**

这就是 §二 四段式的由来。其中 STYLE TRANSLATION 段是仲裁规则，最容易被忽略，也最关键。

---

## 二、四段式结构

| 段落 | 职责 | 省略后果 |
|---|---|---|
| **IDENTITY ANCHORS** | 锁住可识别特征 | 生成"另一个好看的人" |
| **STYLE TRANSLATION** | 仲裁：允许真人化改造，并划出改造边界 | 强行走动画比例 → 恐怖谷 |
| **REALISM** | 破坏"完美平滑" | 塑料 CG 脸 |
| **PHOTOGRAPHY** | 切换生成域 | 仍是渲染感 |

**STYLE TRANSLATION 的作用**是给模型发许可证："你可以改，但只能改这些，那些不许动。"

典型写法：
```
Keep the silhouette, hair shape, eye color and signature color palette recognizable,
but render them with human anatomy and natural proportions.
```
前半句拉住，后半句放行。缺了这句，模型会在"还原"和"真实"之间随机站队。

---

## 三、三条黄金法则

### ① 描述结果，不描述过程
模型是在**重新生成**，不是在做图像编辑滤镜。元指令它听不懂。

- ❌ `transform this anime character into a real person`
- ✅ `a real live-action photograph of a young adult MAN`

同理，别写 `make it look realistic`、`remove the anime style`。

### ② 用物理属性锚定细节
抽象符号会被当噪声丢掉；带上材质和工艺，模型会当成实体去渲染。

| 弱 | 强 |
|---|---|
| `X mark` | `the X mark physically etched on the lens` |
| `goggles` | `worn scratched glass and metal goggles, X etched on lens` |
| `a necklace` | `a silver chain necklace with a pendant, metal showing reflections` |

**力度差别**：只写名词 → 可能生成任何同类物件；加了材质与制作工艺 → 几乎必然渲染出来。

### ③ 抽象词无效，名词才有效
"冒险感""神秘氛围""帅气"这类词模型接不住。必须翻译成可渲染的名词：

| 想表达 | 该写 |
|---|---|
| 破旧 | `torn, dirt-stained, with visible stitching` |
| 疲惫 | `weary, tense expression, shadows under eyes` |
| 破洞裤 | `dark trousers with holes at the knees` |
| 脏 | `grime on fabric, smudges on skin` |

---

## 四、换域词汇武器库

这三组词是真正的"动画 → 摄影"开关，**比 `realistic` 有效得多**：

**媒介词**（`live-action` 权重极高，直接切域）
```
live-action footage, shot on 35mm film, photographed on location,
captured with ARRI Alexa, practical lighting
```

**材质词**（重点在于加"不完美"——动画皮肤是完美平滑的）
```
visible skin pores, fine vellus hair on cheeks, subtle skin imperfections,
slight facial asymmetry, subsurface scattering, natural oil sheen,
flyaway hairs, real fabric weave texture
```
> `subsurface scattering`（次表面散射）是单挑塑料感的杀手锏：真皮肤透光，塑料不透光。

**光学词**（动画里天然不存在的东西）
```
shallow depth of field, natural bokeh, anamorphic lens characteristics,
slight chromatic aberration, subtle film grain, realistic motion blur
```

**光照词**（打碎动画的均匀平光）
```
single hard light source from camera left, deep shadow falloff,
rim light separating subject from background, ambient occlusion in hair
```

---

## 五、特征翻译对照表

动画特征直接抄会翻车，必须"翻译"成真人能长出来的样子。

| 动画里的 | 真人 prompt 该写 | 别写 |
|---|---|---|
| 超大眼睛 + 高光点 | `large almond-shaped eyes, amber-gold iris with natural catchlight` | `huge eyes` |
| 尖锥下巴 | `soft tapered jawline with natural contour` | `pointy chin` |
| 纯色块头发 | `silver-white hair with visible strand separation and flyaways` | `flat silver hair` |
| 平涂服装 | `tailored garment in black with crimson accents, natural fabric drape` | `black and red clothes` |
| 完美无瑕皮肤 | `real skin texture with pores and subtle imperfections` | `flawless skin` |
| 幼态脸 | `young adult features, mature bone structure` | `loli / childlike` |
| 夸张身材比例 | `natural human proportions` | `hourglass / exaggerated curves` |

**收敛原则**：真人脸上"稍微收一点"反而更像本人。取舍优先级：
**气质 > 配色 > 发型 > 五官精确**

---

## 六、负面提示词的两层

**第一层：标准反风格词**（每次都带）
```
anime, cartoon, cel shading, 2D, illustration, drawn, painted,
3D render, CGI, plastic skin, airbrushed, overly smooth,
perfect symmetry, doll-like, uncanny valley, stylized
```
`plastic skin` 和 `airbrushed` 必带，专治 CG 脸。

**第二层：针对具体故障定制**（进阶，比第一层更管用）

出过什么毛病，就把那个毛病翻译成英文写进负面词：

| 故障 | 加什么 |
|---|---|
| 性别跑偏 | `female, woman, feminine face, makeup` |
| 配饰丢失 | `missing accessories, closed empty hands` |
| 背景被填充 | `background scenery, room, forest, street` |
| 手部糊掉 | `deformed hands, extra fingers, blurred hands` |
| 画风残留 | `lineart, flat colors, cel shading` |

---

## 七、cosplay 框架：一个高价值捷径

在 prompt 开头写 `a real live-action photograph of ... cosplaying as the character`。

**有效原因**：训练数据里"真人 cos 照片"恰好落在动画角色与真人的交叉点上，模型走这条路最顺，还原度和真实感同时受益。

**⚠️ 最大的坑**：cosplay 训练数据严重偏向女性 coser。**生成男性角色时必须显式写 `male` 或 `man`，并在负面词加 `female, woman`**，否则极大概率出女生——哪怕你写了男性特征描述也没用。

---

## 八、参数设置（比 prompt 更决定成败）

| 参数 | 推荐值 | 说明 |
|---|---|---|
| 重绘幅度 / denoise | **0.50–0.60**（细节多的角色）<br>0.65–0.75（细节少、有 IP-Adapter 兜底） | 0.7+ 会吃掉小配饰；0.85+ 基本重画，人就不像了 |
| IP-Adapter / FaceID / 角色参考 | **0.7–0.8** | 保住"这是同一个人"最有效的手段，比写一百个字都强 |
| ControlNet (depth / openpose) | 0.5 | 锁姿势与手部结构，道具不跑偏 |
| 采样步数 | 30–40 | 低于 25 细节容易糊 |

**原则：细节密度越高，重绘幅度越要压低。** 满身配饰的角色（护目镜、腰带挂件、手持道具）用 0.5–0.6。

---

## 九、两步走流程（强烈推荐）

### 第一步：定特征
- 重绘 **0.5**
- 用完整四段式 prompt
- 一次跑 6–8 张
- **验收标准只看两点**：性别对不对、标识全不全。质感不真没关系

### 第二步：真人化
- 把挑中的图重新喂进去
- 重绘降到 **0.3–0.4**
- prompt **只留 REALISM + PHOTOGRAPHY 两段，删掉 IDENTITY**
- 这一步只换质感，不动长相

**为什么必须两步**：一步到位时，"换域"和"还原"在同一轮里互相拉扯，十有八九会丢东西或掉进恐怖谷。

---

## 十、万能模板

```
A real live-action photograph of a young adult 【MALE/FEMALE】, cosplayer,
【framing, e.g. full-body medium shot】, 【background spec】.

IDENTITY ANCHORS — reproduce every item exactly:
【hair color + style】; 【signature accessory, with material and how it's made】;
【costume pieces, each with condition: torn / dirt-stained / stitched】;
【which hand holds what, and any light it emits】;
【expression + gendered features】.

STYLE TRANSLATION: 【male/female】 live-action realism — natural human proportions,
no exaggerated features. Keep 【silhouette / hair shape / eye color / palette】
recognizable. Real skin with visible pores, subtle imperfections, slight asymmetry.
Hair as real strands with flyaways. Costume as real fabric with weave texture,
weight and natural drape. 【Accessory】 as real 【material】, 【mark】 physically
etched / engraved on it.

PHOTOGRAPHY: shot on 35mm, shallow depth of field, single 【key light + direction】,
rim light along 【shoulders / hair】, subtle film grain, slight chromatic aberration,
【repeat the background spec】.

NO: 【opposite gender】, 【opposite-gender features】, anime, cartoon, cel shading,
2D, illustration, 3D render, CGI, plastic skin, airbrushed, doll-like, uncanny valley,
perfect symmetry, missing accessories, closed empty hands, background scenery,
text, watermark.
```

---

## 十一、故障诊断表

| 症状 | 根因 | 修法 |
|---|---|---|
| 出成塑料 CG 脸 | 域没切换，"完美平滑"没被破坏 | 补 `subsurface scattering`、`visible pores`；负面词加 `plastic skin` |
| 性别跑偏 | cosplay 数据偏女性 | 主语显式写 `MALE`；负面词加 `female, woman, feminine face` |
| 配饰/道具消失 | 重绘幅度过高，小物件被牺牲 | 降到 0.5；配饰加物理属性描述；负面词加 `missing accessories` |
| 手部糊成一团 | 手是扩散模型最弱区域 | 加 ControlNet openpose/depth；道具连光效一起写 |
| 背景被填成森林/房间 | 训练数据里几乎没有"纯黑背景实拍人像" | 正向写死 `pure black background, no environment, no floor`，负面词重复一遍 |
| 恐怖谷 | 强行还原反人类比例（超大眼、锥子下巴） | 按 §五 收敛；加 `natural human proportions` |
| 一步到位总是丢东西 | 换域与还原互相拉扯 | 改走 §九 两步走 |
| 画风残留（线条、平涂） | 参考图引力过强 | 提高重绘到 0.65；或参考图仅作 IP-Adapter 输入、不参与像素重绘 |

---

## 十二、视频延伸（I2V）

动画转真人的视频，额外压力是**时序一致性**——模型容易在帧间"漂回"动画风格。

必须补一句：
```
maintains photorealistic skin texture throughout the entire shot,
no style drift between frames
```

**推荐路径**：先用图生图拿到满意的真人静态图，再拿这张图做 I2V。**不要**直接从动画图一步生成真人视频——时序压力叠加载域切换，几乎必翻车。

若走 Minimax H3 这类 I2V API，参考图职责要"限权"（见 §十三），否则模型会连绘画质感一起抄走：
```
Image 1 provides pose, framing and color palette ONLY —
do not inherit its illustration texture, linework or cel-shaded style.
```

---

## 十三、参考图限权写法

这是最容易被忽略的一步。若 prompt 只写"画面风格跟随参考图片"，模型会**连材质一起抄走**，真人化必然失败。

**必须拆开说清楚哪些要继承、哪些不要：**

```
Image 1 仅提供人物姿态、镜头构图与配色方案，
不要继承其绘画质感与线条风格；
人物皮肤、材质、光影按真实摄影标准重新生成。
```

英文版：
```
Image 1 provides pose, framing and color palette ONLY —
do not inherit its illustration texture, linework or cel-shaded style.
Rerender skin, material and lighting to real photography standards.
```

---

## 十四、角色卡格式（复用）

为同一角色反复生成时，存一份角色卡，避免每次重写：

```yaml
character: 【角色名 / IP】
gender: male | female
age_impression: young adult / teen / middle-aged
hair: 【颜色 + 发型 + 特殊细节】
eyes: 【形状 + 瞳色 + 高光】
face: 【脸型 + 标志性特征：痣 / 伤疤 / 妆容】
signature_items:
  - 【配饰1 + 材质 + 工艺细节】
  - 【配饰2 + ...】
costume: 【上装 / 下装 / 鞋 / 配色 / 破损状态】
held_items:
  right: 【道具 + 光效】
  left: 【道具】
expression: 【情绪 + 气质】
palette: 【主色 / 辅色 / 强调色】
background: 【纯黑 / 实景 / 场景描述】
negative_custom:
  - 【本次实测翻车过的具体问题】
```

生成时把角色卡字段填进 §十 模板即可。每次翻车的新问题追加到 `negative_custom`——这份清单会越用越准。

---

## 使用流程

1. **收图**：用户给动画/游戏角色图 → 用 §十四 角色卡提取特征（缺失项向用户确认）
2. **填模板**：套 §十，性别务必写死，配饰加物理属性
3. **配参数**：重绘 0.5，开 IP-Adapter 0.7–0.8
4. **第一步跑 6–8 张** → 只验收"性别对 + 标识全"
5. **第二步精修**：挑中的图重绘降到 0.3–0.4，只留 REALISM + PHOTOGRAPHY
6. **翻车就查 §十一**，把新故障记进角色卡 `negative_custom`
7. 要视频 → 走 §十二，用真人图做 I2V

---

## 硬约束

- **性别必须显式写死**，并在负面词加反性别词。cosplay 数据偏女性，这是第一大翻车点
- **永远不写元指令**（transform / make it / remove the style），只描述结果
- **不引用 IP 名**当身份锚点。写特征翻译，不写 `the character from 【IP】`——模型未必认得，认了也容易连画风一起带过来
- **细节越多，重绘幅度越低**
- **默认推荐两步走**，不要主动一步到位
- 涉及真实在世人物时，仅用于风格化创作，不做身份伪造或误导性内容
