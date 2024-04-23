import * as core from '@actions/core'
import * as github from '@actions/github'
import { getPackagePaths } from '@exodus/lerna-utils'

import * as fs from 'node:fs'

import { Exec, OctoClient } from './helpers/types'
import { getPackageFolderName } from './helpers/package'
import { exec as promisifiedExec } from './helpers/process'
import { difference } from './helpers/array'

type Params = {
  issueNumber: number
  sha: string
  baseSha: string
  client: OctoClient
  filesystem?: typeof fs
  exec?: Exec
}

const HEX_LIKE_STRING = /^(?:[\da-f]{2})+$/
const MAX_LABELS_PER_PR = 100

export default async function labelPr({
  issueNumber,
  sha,
  baseSha,
  client,
  filesystem = fs,
  exec = promisifiedExec,
}: Params) {
  if (!HEX_LIKE_STRING.test(baseSha) || !HEX_LIKE_STRING.test(sha))
    throw new Error('Security: unexpected ref(s)')

  core.debug(`Executing git diff --merge-base --name-only ${baseSha} ${sha} | xargs`)
  const { stdout } = await exec(`git diff --merge-base --name-only ${baseSha} ${sha} | xargs`)
  core.debug(stdout)

  const packageFolderPaths = await getPackagePaths({ filesystem })
  core.debug(`Package folder paths: ${packageFolderPaths}`)

  const changes = stdout.trim().split(' ')

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
