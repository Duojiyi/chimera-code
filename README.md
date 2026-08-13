<p align="center">
  <img src="packages/desktop/icons/prod/icon.png" alt="Chimera" width="128" height="128">
</p>
<p align="center"><strong>Chimera</strong></p>
<p align="center">Desktop coding agent with its own identity, data, and gateway.</p>
<p align="center">
  <a href="https://chimerahub.org">Homepage</a> ·
  <a href="https://github.com/Duojiyi/chimera-code">GitHub</a> ·
  <a href="https://github.com/Duojiyi/chimera-code/issues/new">Issues</a> ·
  <a href="README.zh.md">简体中文</a>
</p>

---

Chimera is a branded desktop app. It does not share app data, protocol handlers, or settings with other coding-agent installs on the same machine.

- Product: [chimerahub.org](https://chimerahub.org)
- Gateway: [api.chimerahub.org](https://api.chimerahub.org/)
- Protocol: `chimera://`
- Releases: [GitHub Releases](https://github.com/Duojiyi/chimera-code/releases)

### Desktop

Download the latest build from [Releases](https://github.com/Duojiyi/chimera-code/releases). Feedback and bugs go to [GitHub Issues](https://github.com/Duojiyi/chimera-code/issues/new).

Chimera will not install a second coding-agent CLI inside WSL. Use the local app.

### Development

Default branch is `dev`.

```bash
bun install
```

Run typecheck from a package directory, not the repo root:

```bash
cd packages/app && bun typecheck
cd packages/desktop && bun typecheck
```
