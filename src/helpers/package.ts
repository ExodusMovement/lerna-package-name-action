import * as path from 'path'
import * as fs from 'fs'
import { readJson } from './fs'
import { LernaConfig } from './types'

type Params = {
  filesystem: typeof fs
}

type GetPackagePathsByFolderParams = {
  packageRoots: string[]
} & Params

export async function getPackagePaths({ filesystem }: Params) {
  const packageRoots = await getPackageRoots({ filesystem })
  const paths = await Promise.all(
    packageRoots.map(async (root) => {
      const folders = await filesystem.promises.readdir(root)
      return folders.map((folder) => path.join(root, folder))
    })
  )
  return paths.flat()
}

export async function getPackageRoots({ filesystem }: Params) {
  const lernaConfig = await readJson<LernaConfig>('lerna.json', { filesystem })
  const packageRoots = lernaConfig?.packages ?? ['packages/*']

  return packageRoots.map((it: string) => path.dirname(it))
}

export function getPackageFolderName(packageName: string) {
  return path.basename(packageName)
}
