import { LATEST_TESTED_CLI_VERSION, MIN_CLI_VERSION } from './contract'

export enum CliCompatible {
  NO_CANNOT_VERIFY = 'no-cannot-verify',
  NO_INCOMPATIBLE = 'no-incompatible',
  NO_NOT_FOUND = 'no-not-found',
  YES = 'yes'
}

export type ParsedSemver = { major: number; minor: number; patch: number }

export const COLLAPSE_FOREACH_MATRIX_MIN_VERSION = '3.66.0'

export const supportsCollapseForeachMatrix = (version: string) => {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:\+\S+)?$/)
  if (!match) {
    return false
  }
  const [, major, minor] = match.map(Number)
  const [minMajor, minMinor] =
    COLLAPSE_FOREACH_MATRIX_MIN_VERSION.split('.').map(Number)
  return major > minMajor || (major === minMajor && minor >= minMinor)
}

export const extractSemver = (stdout: string): ParsedSemver | undefined => {
  const semver = stdout.match(/^(\d+\.)?(\d+\.)?(\*|\d+)/)
  if (!semver) {
    return
  }
  const [major, minor, patch] = semver[0].split('.')
  return { major: Number(major), minor: Number(minor), patch: Number(patch) }
}

const checkCLIVersion = (currentSemVer: {
  major: number
  minor: number
  patch: number
}): CliCompatible => {
  const {
    major: currentMajor,
    minor: currentMinor,
    patch: currentPatch
  } = currentSemVer
  const {
    major: minMajor,
    minor: minMinor,
    patch: minPatch
  } = extractSemver(MIN_CLI_VERSION) as ParsedSemver

  const isBehindMinVersion =
    currentMajor < minMajor ||
    (currentMajor === minMajor && currentMinor < minMinor) ||
    (currentMinor === minMinor && currentPatch < Number(minPatch))

  if (isBehindMinVersion) {
    return CliCompatible.NO_INCOMPATIBLE
  }

  return CliCompatible.YES
}

export const isVersionCompatible = (
  version: string | undefined
): CliCompatible => {
  if (!version) {
    return CliCompatible.NO_NOT_FOUND
  }

  const currentSemVer = extractSemver(version)

  if (
    !currentSemVer ||
    Number.isNaN(currentSemVer.major) ||
    Number.isNaN(currentSemVer.minor) ||
    Number.isNaN(currentSemVer.patch)
  ) {
    return CliCompatible.NO_CANNOT_VERIFY
  }

  return checkCLIVersion(currentSemVer)
}

export const isAboveLatestTestedVersion = (version: string | undefined) => {
  if (!version) {
    return undefined
  }

  const { major: currentMajor, minor: currentMinor } = extractSemver(
    version
  ) as ParsedSemver

  const { major: latestTestedMajor, minor: latestTestedMinor } = extractSemver(
    LATEST_TESTED_CLI_VERSION
  ) as ParsedSemver

  return (
    currentMajor > latestTestedMajor ||
    (currentMajor === latestTestedMajor && currentMinor > latestTestedMinor)
  )
}
