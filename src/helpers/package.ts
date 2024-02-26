import * as path from 'path'

export function getPackageFolderName(packageName: string) {
  return path.basename(packageName)
}
