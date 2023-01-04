import * as core from '@actions/core'
import * as github from '@actions/github'
import labelPr from './label-pr'

async function main() {
  const token = core.getInput('github-token', { required: true })

  const {
    payload: { pull_request: pullRequest },
  } = github.context

  if (!pullRequest) {
    core.warning(
      '@exodus/lerna-package-name-action ran for non pull_request trigger and was skipped.'
    )
    return
  }

  const headSha = pullRequest.head.sha
  const baseSha = pullRequest.base.sha

  core.debug(`Labelling PR ${pullRequest.number} with head sha ${headSha} and base sha ${baseSha}`)

  const client = github.getOctokit(token)

  await labelPr({
    client,
    issueNumber: pullRequest.number,
    sha: headSha,
    baseSha: baseSha,
  })
}

main().catch((error) => {
  core.error(String(error))
  core.setFailed(String(error.message))
})
