const GITHUB_RELEASES_API =
  "https://api.github.com/repos/Rakeshtagadghar/meeting-assistant/releases?per_page=100";

export const GITHUB_RELEASES_PAGE =
  "https://github.com/Rakeshtagadghar/meeting-assistant/releases";

type GitHubAsset = {
  name: string;
  browser_download_url: string;
};

type GitHubRelease = {
  tag_name: string;
  name: string;
  html_url: string;
  published_at?: string | null;
  assets?: GitHubAsset[];
};

export type LatestWindowsRelease = {
  version: string | null;
  downloadUrl: string;
  releaseUrl: string;
};

type ReleaseFetchOptions = RequestInit & {
  next?: {
    revalidate?: number;
  };
};

function pickWindowsAsset(assets: GitHubAsset[]): GitHubAsset | null {
  const msiAsset = assets.find((asset) =>
    asset.name.toLowerCase().endsWith(".msi"),
  );
  if (msiAsset) {
    return msiAsset;
  }

  const exeAsset = assets.find((asset) =>
    asset.name.toLowerCase().endsWith(".exe"),
  );
  return exeAsset ?? null;
}

function extractVersionFromText(text: string): string | null {
  const semverMatch = text.match(/(^|[^0-9])(\d+\.\d+\.\d+)(?!\d)/);
  if (semverMatch?.[2]) {
    return semverMatch[2];
  }

  const shortVersionMatch = text.match(/(^|[^0-9])(\d+\.\d+)(?![\d.])/);
  if (shortVersionMatch?.[2]) {
    return `${shortVersionMatch[2]}.0`;
  }

  return null;
}

function extractReleaseVersion(
  release: GitHubRelease,
  windowsAssetName?: string,
): string | null {
  const candidates = [windowsAssetName, release.name, release.tag_name].filter(
    Boolean,
  ) as string[];

  for (const candidate of candidates) {
    const parsed = extractVersionFromText(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function hasWindowsAsset(release: GitHubRelease): boolean {
  if (!Array.isArray(release.assets)) {
    return false;
  }

  return release.assets.some(
    (asset) =>
      asset.name.toLowerCase().endsWith(".msi") ||
      asset.name.toLowerCase().endsWith(".exe"),
  );
}

function pickLatestPublishedRelease(
  releases: GitHubRelease[],
): GitHubRelease | null {
  const publishedReleases = releases.filter((release) =>
    Boolean(release.published_at),
  );

  if (publishedReleases.length === 0) {
    return releases[0] ?? null;
  }

  return publishedReleases.reduce((latest, current) => {
    const latestPublishedAt = Date.parse(latest.published_at ?? "");
    const currentPublishedAt = Date.parse(current.published_at ?? "");
    return currentPublishedAt > latestPublishedAt ? current : latest;
  });
}

export async function getLatestWindowsRelease(
  options?: ReleaseFetchOptions,
): Promise<LatestWindowsRelease | null> {
  try {
    const response = await fetch(GITHUB_RELEASES_API, {
      headers: {
        Accept: "application/vnd.github+json",
      },
      ...options,
    });

    if (!response.ok) {
      return null;
    }

    const releases = (await response.json()) as GitHubRelease[];
    const latestRelease = pickLatestPublishedRelease(releases);
    if (!latestRelease) {
      return null;
    }

    const windowsAsset = hasWindowsAsset(latestRelease)
      ? pickWindowsAsset(latestRelease.assets ?? [])
      : null;

    return {
      version: extractReleaseVersion(latestRelease, windowsAsset?.name),
      downloadUrl: windowsAsset?.browser_download_url ?? latestRelease.html_url,
      releaseUrl: latestRelease.html_url,
    };
  } catch {
    return null;
  }
}
