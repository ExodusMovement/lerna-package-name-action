import * as github from '@actions/github'
import { exec } from './process'

export type OctoClient = ReturnType<typeof github.getOctokit>

export type LernaConfig = {
  packages?: string[]
}

export type Exec = typeof exec
