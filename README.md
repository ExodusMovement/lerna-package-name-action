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
