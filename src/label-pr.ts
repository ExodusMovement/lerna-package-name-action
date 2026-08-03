import * as core from '@actions/core'
import * as github from '@actions/github'
import { getPackagePaths } from '@exodus/lerna-utils'

import * as fs from 'node:fs'

import { Exec, OctoClient } from './helpers/types'
import { getPackageFolderName } from './helpers/package'
import { exec as promisifiedExec } from './helpers/process'
import { difference } from './helpers/array'
import { toWorkspaceRelativePaths } from './helpers/working-directory'

type Params = {
  issueNumber: number
  sha: string
  baseSha: string
  // Current base branch name. The payload's base.sha is frozen when the PR is
  // created, so once the head catches up with the base (rebase or merge from
  // it), diffing against it attributes every commit the base gained since —
  // mislabelling the PR with packages it never touched. origin/<baseRef> is
  // fetched at run time, so it is preferred; baseSha remains the fallback for
  // checkouts that lack the remote ref.
  baseRef?: string
  client: OctoClient
  filesystem?: typeof fs
  exec?: Exec
  // Working directory's path relative to the repo root. git diff returns
  // repo-root-relative paths; package paths are cwd-relative, so changed
  // files are rebased into the working directory before attribution. Empty
  // when the action runs at the repo root.
  repoRelativePrefix?: string
}

const HEX_LIKE_STRING = /^(?:[\da-f]{2})+$/
// Conservative allowlist keeping the ref safe for shell interpolation; git
// refnames additionally forbid space, ~, ^, :, ?, *, [, .. and @{.
const SAFE_REF = /^[\w./-]+$/
const MAX_LABELS_PER_PR = 100

async function resolveBase({
  baseRef,
  baseSha,
  exec,
}: {
  baseRef?: string
  baseSha: string
  exec: Exec
}): Promise<string> {
  if (!baseRef || !SAFE_REF.test(baseRef)) return baseSha

  try {
    const { stdout } = await exec(`git rev-parse origin/${baseRef}`)
    const resolved = stdout.trim()
    if (HEX_LIKE_STRING.test(resolved)) return resolved
  } catch {
    core.warning(`Could not resolve origin/${baseRef}; falling back to the event's base sha`)
  }

  return baseSha
}

export default async function labelPr({
  issueNumber,
  sha,
  baseSha,
  baseRef,
  client,
  filesystem = fs,
  exec = promisifiedExec,
  repoRelativePrefix = '',
}: Params) {
  if (!HEX_LIKE_STRING.test(baseSha) || !HEX_LIKE_STRING.test(sha))
    throw new Error('Security: unexpected ref(s)')

  const base = await resolveBase({ baseRef, baseSha, exec })

  // `--no-relative` forces repo-root-relative paths regardless of the
  // consumer's `diff.relative` git config, so attribution stays correct when
  // the action runs from a subdirectory.
  core.debug(`Executing git diff --merge-base --no-relative --name-only ${base} ${sha} | xargs`)
  const { stdout } = await exec(
    `git diff --merge-base --no-relative --name-only ${base} ${sha} | xargs`
  )
  core.debug(stdout)

  const packageFolderPaths = await getPackagePaths({ filesystem })
  core.debug(`Package folder paths: ${packageFolderPaths}`)

  const changes = toWorkspaceRelativePaths(stdout.trim().split(' '), repoRelativePrefix)

  const affected = packageFolderPaths
    .filter((packagePath) => changes.some((change) => change.startsWith(`${packagePath}/`)))
    .map((packageFolderPath) => getPackageFolderName(packageFolderPath))

  const { data } = await client.rest.pulls.get({
    ...github.context.repo,
    pull_number: Number(issueNumber),
  })

  const packageNames = new Set(packageFolderPaths.map((it) => getPackageFolderName(it)))
  const current = data.labels.map((label) => label.name).filter((label) => packageNames.has(label))
  const obsolete = difference(current, affected)
  let missing = difference(affected, current)

  if (affected.length > 0) {
    core.notice(`The following packages are affected: ${affected}`)
  }

  if (data.labels.length + missing.length - obsolete.length > MAX_LABELS_PER_PR) {
    missing = missing.slice(0, MAX_LABELS_PER_PR - data.labels.length + obsolete.length)
    core.warning(
      `Applying only ${missing.length} labels to avoid exceeding the maximum of ${MAX_LABELS_PER_PR} labels per PR`
    )
  }

  if (obsolete.length === 0 && missing.length === 0) {
    core.notice('Affected packages have not changed. Labels need not be updated.')
    return
  }

  if (obsolete.length > 0) {
    await Promise.all(
      obsolete.map((label) =>
        client.rest.issues.removeLabel({
          ...github.context.repo,
          issue_number: Number(issueNumber),
          name: label,
        })
      )
    )
    core.notice(`The following labels were removed: ${obsolete}`)
  }

  if (missing.length > 0) {
    await client.rest.issues.addLabels({
      ...github.context.repo,
      issue_number: Number(issueNumber),
      labels: missing,
    })
    core.notice(`The following labels were added: ${missing}`)
  }
}
