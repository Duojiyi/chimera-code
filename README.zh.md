<p align="center">
  <img src="packages/desktop/icons/prod/icon.png" alt="Chimera" width="128" height="128">
</p>
<p align="center"><strong>Chimera</strong></p>
<p align="center">独立品牌的桌面编码代理：自己的身份、数据和网关。</p>
<p align="center">
  <a href="https://chimerahub.org">官网</a> ·
  <a href="https://github.com/Duojiyi/chimera-code">GitHub</a> ·
  <a href="https://github.com/Duojiyi/chimera-code/issues/new">反馈</a> ·
  <a href="README.md">English</a>
</p>

---

Chimera 是带品牌的桌面应用。它与本机上其他编码代理的应用数据、协议和设置相互隔离。

- 产品：[chimerahub.org](https://chimerahub.org)
- 网关：[api.chimerahub.org](https://api.chimerahub.org/)
- 协议：`chimera://`
- 发布页：[GitHub Releases](https://github.com/Duojiyi/chimera-code/releases)

### 桌面端

从 [Releases](https://github.com/Duojiyi/chimera-code/releases) 下载最新构建。反馈和缺陷请提到 [GitHub Issues](https://github.com/Duojiyi/chimera-code/issues/new)。

Chimera 不会在 WSL 里安装或挂载第二套编码代理 CLI，请使用本机应用。

### 开发

默认分支是 `dev`。

```bash
bun install
```

类型检查在包目录内运行，不要从仓库根目录跑：

```bash
cd packages/app && bun typecheck
cd packages/desktop && bun typecheck
```
