# Lerna package name action

This action labels PRs in a lerna monorepo with the package names they affect

## Example usage

```yaml
name: Label PR

on:
  pull_request:
    types: [opened, synchronize]
jobs:
  label:
    name: Label PR
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          # required for diff
          fetch-depth: 0 
      - name: Label PR
        uses: ExodusMovement/lerna-package-name-action
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
```
