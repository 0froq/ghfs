import type { ScannedRepo } from '../../hub/scanner'
import type { HubScannedProject } from './types'
import { defineRpcFunction } from 'devframe'
import { resolveScannedRepo } from '../../hub/scanned-repo'
import { scanGitRepos } from '../../hub/scanner'
import { findProjectIcon } from '../../utils/project-icon'
import { resolveHubRoot } from './hub-helpers'
import { getHubContext } from './utils'

export const hubScan = defineRpcFunction({
  name: 'ghfs:hub-scan',
  type: 'query',
  setup: (context) => {
    const hub = getHubContext(context)
    return {
      handler: async (rootPath?: string): Promise<HubScannedProject[]> => {
        const targets: string[] = rootPath ? [resolveHubRoot(rootPath)] : Array.from(hub.roots).sort()
        const enabledPaths = new Set(Array.from(hub.projects.values()).map(p => p.path))
        const unique: ScannedRepo[] = []
        const seen = new Set<string>()
        for (const target of targets) {
          let scanned: ScannedRepo[]
          try {
            scanned = await scanGitRepos(target)
          }
          catch {
            continue
          }
          for (const repo of scanned) {
            if (seen.has(repo.path))
              continue
            seen.add(repo.path)
            unique.push(repo)
          }
        }
        const resolved = await Promise.all(unique.map(async (repo) => {
          const [iconDataUrl, resolution] = await Promise.all([
            findProjectIcon(repo.path).catch(() => null),
            resolveScannedRepo(repo.path),
          ])
          return { repo, resolution, iconDataUrl }
        }))
        const entries: HubScannedProject[] = []
        for (const { repo, resolution, iconDataUrl } of resolved) {
          entries.push({
            path: repo.path,
            name: repo.name,
            repo: resolution.repo,
            error: resolution.error,
            enabled: enabledPaths.has(repo.path),
            iconDataUrl,
          })
        }
        entries.sort((a, b) => a.path.localeCompare(b.path))
        return entries
      },
    }
  },
})
