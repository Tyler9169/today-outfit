# 今天穿什么 · Today Outfit

由 [Tyler9169](https://github.com/Tyler9169) 维护的免费中文个人衣橱与穿搭网页工具。

[立即使用](https://tyler9169.github.io/today-outfit/) · [关于作者](https://tyler9169.github.io/today-outfit/about.html) · [反馈问题](https://github.com/Tyler9169/today-outfit/issues)

手机和电脑浏览器都能使用的个人衣橱工具。上传衣服照片、填写类别与颜色，从自己的衣橱选择搭配，并导入导出包含照片的备份。

## 在线使用

在线入口：https://tyler9169.github.io/today-outfit/

仓库管理员首次需要在 **Settings → Pages → Build and deployment** 选择 **Deploy from a branch**，分支 **main**，目录 **/docs**，点击 **Save**。等 GitHub Pages 部署成功后，以上链接才可使用。

iPhone 使用 Safari 打开，分享 → 添加到主屏幕；安卓使用 Chrome 菜单 → 安装应用或添加到主屏幕。等待页面显示“离线准备完成”后可尝试断网使用。

## 数据和功能边界

- 照片、衣橱保存在当前设备的浏览器中，不会因为源码上传 GitHub 而公开。
- 手机和电脑不自动同步。换设备、清理浏览器前，请导出备份，再在新设备导入。
- GitHub Pages 版本使用手动类别与颜色录入、本地规则搭配，不提供云端 AI 照片识别。
- 服务端识别代码保留在 `app/api/recognize`，需要自行部署后端和配置服务端密钥，不能直接运行在 GitHub Pages 上。
- `mobile/` 是尚未完成的原生应用入口，不是已发布的 iOS/Android 安装包；当前公开使用方式是网页。

## 本地运行网页版本

安装 Node.js 22.13 以上版本（建议 24），执行：

```sh
npm ci
npm run pages:dev
```

打开终端显示的本地地址。

## 更新 GitHub Pages

```sh
npm run pages:build
```

将源码和重新生成的 `docs/` 一起提交到 `main`。Pages 会部署 `docs/`。构建使用相对路径，适配仓库子目录；应用图标、清单与离线缓存均包含在构建产物中。

## 检查

```sh
npm run pages:build
node --test tests/vision.test.mjs
```

## 开发目录

- `app/page.tsx`：当前衣橱界面。
- `components/`、`lib/`：照片、搭配、备份与本地存储。
- `github-pages/`：GitHub Pages 独立入口，复用现有衣橱界面。
- `scripts/build-github-pages.mjs`：生成相对路径清单及离线缓存。
- `docs/`：可以直接托管的网页构建产物。
- `documentation/FRAMEWORK.md`：原始完整框架与服务端配置说明。

`.dev.vars`、本地环境配置、依赖目录和运行缓存不应上传。服务端配置示例见 `.dev.vars.example`，不要把真实密钥填进任何公开文件。
