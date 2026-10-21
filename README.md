# LingoPop · 英语碰碰乐

一个轻松有趣的英语学习网站，每天玩一点，英语进步一点。
A playful way to learn English, one little discovery at a time.

> 少一点枯燥，多一点“原来如此”。

纯静态站点（HTML/CSS/原生 JS），无构建步骤，进度存在浏览器 localStorage；
可选登录一个共享账号，把进度同步到 Cloudflare KV（`functions/api/progress.js`）。
发音由开源模型 [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)（Apache-2.0，音色 `af_heart`）预先生成。

## 本地运行

    npx wrangler pages dev        # 或任意静态服务器指向 public/
    node test.mjs                 # 逻辑与内容自检

## 部署到 Cloudflare Pages

方式一（命令行）:

    npx wrangler login
    npx wrangler pages deploy

方式二（Git 集成）: Cloudflare 控制台 → Workers & Pages → 创建 Pages 项目 → 连接 GitHub 仓库 `lingopop`，
构建命令留空，输出目录填 `public`。

## 进度同步（账号）

首页点「☁️ 登录 / 注册」，每个人可以创建自己的账号（用户名 + 密码），各自的进度分开保存在 Cloudflare KV。
登录时本机进度与云端合并（发现的卡取并集，连续打卡取较新的一份）；退出时先上传再清空本机，下一个人登录不会串号。

    npx wrangler kv namespace create lingopop   # 把输出的 id 填进 wrangler.toml

KV 里每个账号两个键: `user:<用户名小写>`（加盐哈希的密码）和 `progress:<用户名小写>`。
忘记密码: 删掉 `user:` 键后用同名重新注册，进度还在

    npx wrangler kv key delete "user:小明" --binding LP --remote

## 添加内容

编辑 `public/data/{kids,students,adults}.json`，每张卡:

    {"id":"k21","emoji":"🐼","word":"panda","zh":"熊猫","fact":"原来如此的小知识","quiz":{...}}

`quiz` 三种:
- `{"type":"spell"}` 拼写 `word`（只能是单个英文单词）
- `{"type":"choice","q":"题目","options":["正确答案","干扰项",...]}`
- `{"type":"listen","options":["正确答案（会被朗读）","干扰项",...]}`

**`options` 第一项永远是正确答案**，页面上会随机打乱。新卡追加在末尾，`id` 不要复用。

改完内容后生成发音并自检:

    npm i              # 首次
    npm run tts        # 只生成新增的发音，删除不再用到的
    node test.mjs

生成的 mp3 在 `public/audio/`，需要一起提交。
