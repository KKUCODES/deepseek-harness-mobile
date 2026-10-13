# DSHM Logo 设计稿

[查看第四版透明 PNG](./dshm-logo-concept-v4.png) · [返回素材来源](../README.md)

## 第四版：DeepSeek 鲸鱼与手机、电脑互联

用户指出第三版只能看出 DeepSeek 聊天，无法看出 Remote。第四版保留完整鲸鱼，将气泡替换为电脑屏幕与前侧手机轮廓，用双向箭头表达手机和电脑共同参与同一会话。

用户已确认第四版并要求重新打包。本版作为 Android 启动图标来源，保持鲸鱼、电脑、手机和箭头构图；使用白色底板和安全留白，提供自适应及五档密度资源。原前三稿保留用于说明设计过程，应用内聊天品牌和 README 横幅不在本轮替换范围。

后续 README 标志接入沿用同一原 PNG：手机端、插件和后端各自保存 `docs/images/logo.png`，统一以 128 像素展示，便于仓库独立分发。没有替换原横幅和截图，也没有重新生成图案。

启动资源见 [Android 资源目录](../../../android/app/src/main/res/)。自适应前景为 432 像素画布，主体按 108 dp 画布中的 66 dp 圆形安全区缩放，适配圆形与圆角遮罩；原 Logo PNG 保持不变。本版仍是栅格素材，未声称已经提供 SVG。

### 第四版生成提示词

输入分别为实际 DSH 图标与第三版候选；保留鲸鱼形态，重做 Remote 构图。

```text
Use case: logo-brand redesign.
Asset type: fourth DSHM logo concept: a mobile DeepSeek chat client connected to the user's computer.
Input image 1 is the real DeepSeek Harness whale. Preserve this complete identifiable whale geometry: rounded curling body, belly opening, upward tail, dorsal fin, small eye and eye-side curve.
Input image 2 is the previous DSHM concept. The user recognizes DeepSeek but says it does not communicate REMOTE. Keep the blue-and-white visual language, replace the standalone speech-bubble container.
Create ONE unified, compact app logo that clearly reads "phone connects to computer", with the recognizable DeepSeek whale as the central identity:
- A simple broad desktop-monitor outline in royal blue, with a minimal short stand. Rounded corners, bold uniform stroke, frontal view.
- A smaller upright smartphone outline overlaps the monitor's lower LEFT edge, in the same blue and stroke weight. The two outlines must form a balanced single silhouette rather than scattered clip art.
- Place the complete DeepSeek whale prominently in the monitor's screen, in blue against the transparent/white screen opening; preserve its recognizable identity and proportions. The whale is the hero and must be large, not a tiny badge.
- In the clean gap between the phone screen and the lower monitor area, use two short opposing horizontal arrows in blue to show two-way conversation/control between the phone and computer. Make them a clear structural part of the device connection, not a separate UI button.
Use flat vector-like design, one saturated royal blue close to #4D6BFE with clear negative space. Bold simple geometry that remains understandable when reduced; device detail is restricted to outline and stand, no keyboards, app chrome, tiny text or buttons. No extra bubble outline, Wi-Fi waves, globe, clouds, chains, padlock, gears, labels or letters.
One centered mark on a square truly transparent background with generous equal padding. Fully opaque crisp shape fills and clean edges. No gradient, texture, grain, speckles, shadow, gloss, 3D, presentation board or mockup. Independent DSHM project mark using the supplied DeepSeek identity; do not add claims of official branding.
```

[查看第三版透明 PNG](./dshm-logo-concept-v3.png)

## 第三版：DeepSeek 完整鲸鱼与聊天气泡

用户反馈未体现 Remote，因此保留用于对比，当前候选为第四版。

用户指出第二版只有鲸尾，看不出与 DeepSeek 的关联。本版以 DeepSeek Harness 实际图标中的完整鲸鱼为参考，保留卷曲身体、腹部留白、上扬鲸尾、背鳍与眼部特征，以白色完整鲸鱼配蓝色聊天气泡，重新建立识别关系。

参考来源：上游检出 `ddefc45fbc7f` 的 `apps/desktop/resources/icon.png`，轮廓同时核对 `packages/client/ui-primitives/src/FishLogo.tsx`。只读取参考，不修改 DSH 文件；不表示官方出品或背书。

本版是内置 imagegen 编辑生成的透明 PNG 候选，尚未得到用户定稿确认，未替换 App 图标或其他产品资源。正式应用前仍需制作干净的矢量、自适应与小尺寸图标。

### 第三版生成提示词

编辑输入为实际 DSH 图标，只参考鲸鱼形态，不保留原底板、阴影和渐变。

```text
Use case: logo-brand redesign from an identity reference.
Asset type: third DSHM logo concept, recognizable as a DeepSeek-related mobile chat client.
Input image 1 is the actual whale emblem from the DeepSeek Harness app. Use its WHALE GEOMETRY as the identity reference. Ignore its app-tile background, shadows, gradients and framing.
The previous concepts failed: a generic smiling whale was not visibly a chat bubble, and a lone whale tail inside a bubble no longer looked related to DeepSeek.
Design one clear compact mark: a flat royal-blue rounded speech bubble with a distinct short triangular pointer at the lower left. Inside it, place the COMPLETE recognizable DeepSeek whale emblem in opaque white. Closely preserve the reference whale's rounded curling body, broad curved belly cutout, upward branching tail at upper right, dorsal fin, small eye and characteristic curved mark around the eye. Preserve orientation and proportions; do not replace it with a generic whale, a tail alone, a dolphin, smiling cartoon face or simple fish.
The DeepSeek whale should occupy most of the interior with comfortable consistent breathing room. The bubble is a secondary containing silhouette, not a heavy decorative frame. Use blue for the whale's eye and belly openings so the white whale remains clearly legible against the blue bubble.
Flat two-color design: uniform royal blue close to #4D6BFE and opaque white. No gradients, texture, bevels, shadow, glossy surface, speckling or stray pixels.
One centered mark on a square truly transparent canvas with generous padding around the outside; the blue bubble and white glyph are fully opaque, ONLY the area outside the bubble is transparent. No letters, wordmark, badges, extra objects, mockup or multiple variants.
This is a DSHM derivative-project concept. Convey the connection through the actual supplied whale identity instead of inventing a new animal. Do not add text claiming an official product.
```

[查看第二版透明 PNG](./dshm-logo-concept-v2.png)

## 第二版：气泡外框与鲸尾

用户反馈这版只有通用鲸尾，无法清楚联想到 DeepSeek；保留用于对比，当前候选为第三版。

用户指出第一版看不出聊天气泡，因此重新设计为明确的圆角气泡外框和左下尾尖，内部使用鲸尾负形。以气泡为主、鲸鱼元素为辅，避免依赖说明才能理解聊天含义。

本版仍为内置 imagegen 生成的栅格候选，带透明通道；尚未得到用户定稿确认，没有替换应用图标、页面品牌或 README 横幅。边缘与填色仍需在正式图标制作时完善。

### 第二版生成提示词

以第一版为编辑输入，允许重做构图。

```text
Use case: logo-brand redesign.
Edit the provided DSHM concept in response to this exact feedback: the chat bubble is not recognizable. Change the design substantially to make CHAT the first visual reading; retain only the royal-blue palette and whale motif as the secondary identity.
Create ONE clean professional flat symbol: a classic saturated royal-blue speech bubble, with a wide rounded-rectangle body and an unmistakable short triangular speech pointer extending from its LOWER LEFT corner. The exterior must immediately look like a chat-message bubble. Inside the bubble, place one simple white/transparent negative-space WHALE TAIL emblem: two broad curved upward-pointing flukes joined to a short tapered stem, centrally balanced. Whale tail must be readily recognizable; it should not look like a heart, bird, butterfly, fork, plant or letter. The negative-space emblem should be bold and take roughly half the bubble width.
Do not retain the previous whale body, face, eye or smiling mouth. Those made it look like an animal instead of a chat symbol. Do not turn the speech pointer into a flipper.
Use one uniform vivid blue close to #4D6BFE, smooth decisive curves, balanced negative space and sharp clean edges. No texture, gradient, speckles, stray pixels, shadow or semi-transparent fill.
Square canvas, truly transparent background, equal generous margins, centered mark within roughly the central 70%. The bubble body is fully opaque blue; inside emblem and exterior are transparent cutouts. No wordmark, lettering, mockup, multiple logo options, phones, laptops, chains, network symbols or watermark. Independent DSHM project identity, not an official DeepSeek logo.
```

## 第一版：鲸鱼轮廓（保留对比）

用户反馈这版主要像鲸鱼，底部尖角无法清楚表达气泡。保留原素材和提示词，不再作为当前推荐方向。

[查看第一版透明 PNG](./dshm-logo-concept-v1.png)

本轮设计方向是“蓝色鲸鱼＋对话气泡”，让聊天成为标志的主体，同时延续项目既有的鲸鱼视觉语言。图稿由内置 imagegen 生成并做过一次边缘清理，1254 × 1254，带透明通道。

这是供用户评审的栅格初稿，尚未定稿或转成 SVG，也未替换 Android 图标、README 横幅或聊天页品牌。已检查大图与 96 像素缩略显示；正式用于小尺寸图标前仍需完善轮廓、纯色填充和边缘，再制作 Android 自适应图标。此素材不表示 DeepSeek 官方背书。

生成日期：2026-10-13。无需配置额外 API Key，未修改原图或现有应用资源。

## 生成提示词

```text
Use case: logo-brand.
Asset type: first logo concept for DSHM, an independent Android-first chat client that can continue conversations and approve work performed by DeepSeek Harness on a computer.
Primary request: design ONE original, polished, compact logo mark combining a friendly blue whale with the silhouette of a rounded conversation bubble. The whale and bubble must feel like one coherent symbol, not separate clip art. A forward-moving whale with an expressive, clean curved back and lifted tail; a subtle speech-bubble point built into the body contour. One tiny eye as a clean negative-space cutout is sufficient. The mark should communicate friendly conversation and continuity while retaining its own identity.
Style/medium: vector-like flat design, bold confident geometry, smooth controlled curves, strong silhouette, balanced negative space. Use a single saturated royal blue close to #4D6BFE. No gradient, shading, texture or thin strokes.
Composition/framing: one centered symbol on a square canvas with truly transparent background. Generous equal padding, symbol fits comfortably within the central 65–70% so it can work within Android icon masks. Keep details recognizable at small size. No background tile, presentation board or multiple variants.
Text: none; do not add DSHM letters or any other writing.
Constraints: original independent project identity, do not reproduce an existing official DeepSeek logo. No phones, laptops, cables, Wi-Fi symbols, gear icons, padlocks, literal chain links, stars, sparkles or AI atom symbols. No mascot character illustration. No 3D, bevel, shadow, watermark, mockup, checkerboard pattern or background colors. Preserve real alpha transparency.
```

## 清理提示词

编辑输入为第一轮生成图，保留原始鲸鱼与气泡构图。

```text
Use case: precise-object-edit / logo-brand refinement.
Edit the provided DSHM whale-chat logo. Preserve the exact overall concept, orientation, distinctive raised tail, rounded whale body, speech-bubble point, eye position, and friendly expression. Do not redesign it or add elements.
Change ONLY the rendering quality: produce a clean vector-like flat logo with perfectly smooth contours and one uniform royal-blue fill #4D6BFE. Remove all blue speckles, stray fragments, texture and uneven color, especially inside the mouth, around the tail and outside the contour. The body must be fully opaque, with clean transparent eye and mouth cutouts; no haze or semitransparent body. Pixels well inside the blue silhouette should have alpha 255, outside should be alpha 0 with only a narrow antialiased edge.
Keep a truly transparent square background, balanced padding and one centered mark. No words, labels, tile, shadow, bevel, gradient, mockup, board, border or watermark. This is an independent project logo concept, not an official DeepSeek emblem.
```
