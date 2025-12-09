# Contributing Guide

Thank you for your interest in contributing to SAR Analyzer!

## Code of Conduct

Be respectful, inclusive, and constructive.

---

## How to Contribute

### 1. Fork & Clone

```bash
git clone https://gitlab.com/YOUR_USERNAME/nisar_pro.git
cd nisar_pro
```

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

### 3. Make Changes

- Follow existing code style
- Add tests for new functionality
- Update documentation if needed

### 4. Test Locally

```bash
# Rust
cd sar-gateway && cargo test
cd ../sar_processor && cargo test

# Frontend
cd ../sar-dashboard-v3 && npm run build
```

### 5. Commit

Use conventional commits:

```bash
git commit -m "feat: add ship detection algorithm"
git commit -m "fix: handle OAuth token expiry"
git commit -m "docs: update API reference"
```

### 6. Push & Create MR

```bash
git push origin feature/your-feature-name
```

Create a Merge Request on GitLab.

---

## Project Structure

| Directory | Language | Purpose |
|-----------|----------|---------|
| `sar-dashboard-v3/` | JavaScript/React | Frontend UI |
| `sar-gateway/` | Rust | API Gateway |
| `sar_processor/` | Rust | Data Processing |
| `sar_operator_v2/` | Rust | K8s Operator |
| `k8s_manifests/` | YAML | Kubernetes configs |
| `Docs/` | Markdown | Documentation |

---

## Good First Issues

Look for issues labeled `good-first-issue` on GitLab.

Current areas needing help:
- [ ] Unit tests for Gateway handlers
- [ ] Dashboard accessibility improvements
- [ ] Documentation translations
- [ ] Additional data source integrations

---

## Questions?

Open an issue on GitLab or reach out to the maintainers.
