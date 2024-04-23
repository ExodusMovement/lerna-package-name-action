import { Exec, OctoClient } from './helpers/types'
import { Volume } from 'memfs/lib/volume'
import { when } from 'jest-when'
import labelPr from './label-pr'
import * as core from '@actions/core'

jest.mock('@actions/core', () => ({
  notice: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}))

jest.mock('@actions/github', () => ({
  context: {
    repo: {
      repo: 'Batcave',
      owner: 'WayneEnterprises',
    },
  },
}))

describe('labelPr', () => {
  const issueNumber = 32
  const sha = 'fff19bfa1197410ce28486ee269d38ac3f9b24b5'
  const baseSha = 'c89ec1569797c49c4573b4c2a0d5a18a2ef42b15'

  const mockRepo = {
    repo: 'Batcave',
    owner: 'WayneEnterprises',
  }

  let fs: Volume
  let exec: Exec
  let client: OctoClient

  const lernaConfig = JSON.stringify({
    packages: ['libraries/*', 'modules/*'],
    version: 'independent',
    npmClient: 'yarn',
    useWorkspaces: true,
    useNx: true,
  })

  beforeEach(() => {
    client = {
      rest: {
        pulls: {
          get: jest.fn() as unknown,
        },
        issues: {
          addLabels: jest.fn() as unknown,
          removeLabel: jest.fn() as unknown,
        },
      },
    } as OctoClient

    fs = Volume.fromJSON({
      'lerna.json': lernaConfig,
      'modules/storage-mobile/package.json': 'some content',
      'unmanaged/something/package.json': 'some content',
      'modules/config/package.json': 'some content',
      'libraries/formatting/package.json': 'some content',
    })
    exec = jest.fn()
  })

  it('should add labels managed packages', async () => {
    when(exec)
      .calledWith(`git diff --merge-base --name-only ${baseSha} ${sha} | xargs`)
      .mockResolvedValue({
        stderr: '',
        stdout:
          '.github/workflows/label.yaml modules/storage-mobile/package.json libraries/formatting/package.json unmanaged/something/package.json',
      })
    mockLabels([])

    await labelPr({
      filesystem: fs as never,
      issueNumber,
      sha,
      baseSha,
      client,
      exec,
    })

    expect(client.rest.issues.addLabels).toHaveBeenCalledWith({
      ...mockRepo,
      issue_number: Number(issueNumber),
      labels: ['formatting', 'storage-mobile'],
    })
  })

  it('should not apply labels of partially included package names', async () => {
    fs = Volume.fromJSON({
      'lerna.json': lernaConfig,
      'modules/storage-mobile/package.json': 'some content',
      'modules/storage/package.json': 'some content',
      'libraries/formatting/package.json': 'some content',
    })

    when(exec)
      .calledWith(`git diff --merge-base --name-only ${baseSha} ${sha} | xargs`)
      .mockResolvedValue({
        stderr: '',
        stdout: 'modules/storage-mobile/package.json',
      })

    mockLabels([])

    await labelPr({
      filesystem: fs as never,
      issueNumber,
      sha,
      baseSha,
      client,
      exec,
    })

    expect(client.rest.issues.addLabels).toHaveBeenCalledWith({
      ...mockRepo,
      issue_number: Number(issueNumber),
      labels: ['storage-mobile'],
    })
  })

  it('should apply a maximum of 100 labels', async () => {
    const labels = [...Array.from({ length: 200 }).keys()].map((i) => `package-${i}`)

    fs = Volume.fromJSON({
      'lerna.json': lernaConfig,
      'modules/no-longer-affected/package.json': 'some content',
      ...Object.fromEntries(labels.map((name) => [`modules/${name}/package.json`, 'some content'])),
    })

    when(exec)
      .calledWith(`git diff --merge-base --name-only ${baseSha} ${sha} | xargs`)
      .mockResolvedValue({
        stderr: '',
        stdout: labels.map((name) => `modules/${name}/package.json`).join(' '),
      })

    mockLabels(['dependencies', 'blockchain-metadata', 'no-longer-affected'])

    await labelPr({
      filesystem: fs as never,
      issueNumber,
      sha,
      baseSha,
      client,
      exec,
    })

    expect(jest.mocked(client.rest.issues.addLabels).mock.calls[0]![0]!.labels!.length).toBe(98)
    expect(core.warning).toHaveBeenCalledWith(
      `Applying only 98 labels to avoid exceeding the maximum of 100 labels per PR`
    )
  })

  it('should remove labels of packages no longer affected', async () => {
    when(exec)
      .calledWith(`git diff --merge-base --name-only ${baseSha} ${sha} | xargs`)
      .mockResolvedValue({
        stderr: '',
        stdout: '.github/workflows/label.yaml modules/storage-mobile/package.json',
      })
    mockLabels(['storage-mobile', 'formatting', 'config', 'unrelated-label'])

    await labelPr({
      filesystem: fs as never,
      issueNumber,
      sha,
      baseSha,
      client,
      exec,
    })

    expect(client.rest.issues.removeLabel).toHaveBeenCalledTimes(2)
    expect(client.rest.issues.removeLabel).toHaveBeenCalledWith({
      ...mockRepo,
      issue_number: Number(issueNumber),
      name: 'formatting',
    })
    expect(client.rest.issues.removeLabel).toHaveBeenCalledWith({
      ...mockRepo,
      issue_number: Number(issueNumber),
      name: 'config',
    })
  })

  it('should not alter PR and create annotation if affected unchanged', async () => {
    when(exec)
      .calledWith(`git diff --merge-base --name-only ${baseSha} ${sha} | xargs`)
      .mockResolvedValue({
        stderr: '',
        stdout: '.github/workflows/label.yaml modules/storage-mobile/package.json',
      })
    mockLabels(['storage-mobile'])

    await labelPr({
      filesystem: fs as never,
      issueNumber,
      sha,
      baseSha,
      client,
      exec,
    })

    expect(client.rest.issues.removeLabel).not.toHaveBeenCalled()
    expect(client.rest.issues.addLabels).not.toHaveBeenCalled()
    expect(core.notice).toHaveBeenCalledWith(
      'Affected packages have not changed. Labels need not be updated.'
    )
  })

  function mockLabels(labels: string[]) {
    when(client.rest.pulls.get)
      .calledWith({
        ...mockRepo,
        pull_number: Number(issueNumber),
      })
      .mockResolvedValue({
        data: {
          labels: labels.map((label) => ({ name: label })),
        },
      } as never)
  }
})
