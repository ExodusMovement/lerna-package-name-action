[![Checks](https://github.com/ExodusMovement/lerna-package-name-action/actions/workflows/checks.yml/badge.svg)](https://github.com/ExodusMovement/lerna-package-name-action/actions/workflows/checks.yml)

# Lerna package name action

This action labels PRs in a lerna monorepo with the package names they affect

## Example usage

```yaml
name: Label PR

on:
  pull_request:
    types: [opened, synchronize]

permissions: {}

jobs:
  label:
    name: Label PR
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@f43a0e5ff2bd294095638e18286ca9a3d1956744 # v3.6.0
        with:
          # required for diff
          fetch-depth: 0
      - name: Label PR
        uses: ExodusMovement/lerna-package-name-action
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
```

### Running from a subdirectory

When the lerna workspace lives in a subdirectory of the repository rather than
at its root, set the optional `path` input to that subdirectory (relative to
the checkout root). Workspace discovery then runs there, and changed files are
attributed to the packages inside it. When omitted, the action runs at the
checkout root.

```yaml
- name: Label PR
  uses: ExodusMovement/lerna-package-name-action
  with:
    github-token: '${{ secrets.GITHUB_TOKEN }}'
    path: apps/mobile
```
