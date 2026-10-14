const VIDEO_EXTENSION = /\.(?:mkv|mp4|avi|mov)$/i;
const YEAR_PATTERN = /\b(19\d{2}|20\d{2})\b/g;

const RELEASE_TAG_PATTERN =
  /\b(?:2160p|1080p|720p|480p|4k|8k|uhd|hdr10?\+?|hdr|dv|dolby[ ._-]?vision|blu[ ._-]?ray|brrip|bdrip|webrip|web[ ._-]?dl|hdtv|remux|x26[45]|h26[45]|hevc|av1|aac|dts(?:[ ._-]?hd)?|truehd|atmos|proper|repack|limited|extended|unrated|directors[ ._-]?cut|criterion|nf|amzn|dsnp|hmax|atvp)\b/gi;

export interface CleanedFilename {
  title: string;
  year?: number;
}

/**
 * Turns common release filenames into a title suitable for metadata search.
 * Example: "Inception.2010.1080p.BluRay.x264.mkv" -> "Inception 2010".
 */
export function cleanVideoFilename(filename: string): CleanedFilename {
  const basename = filename.split(/[\\/]/).pop() ?? filename;
  let cleaned = basename.replace(VIDEO_EXTENSION, "");

  cleaned = cleaned
    .replace(/[._]+/g, " ")
    .replace(/[\[\](){}]/g, " ")
    .replace(RELEASE_TAG_PATTERN, " ")
    .replace(/\b(?:Proper|REPACK|LIMITED)\b/gi, " ")
    .replace(/\b[A-Z0-9]{2,}(?:-[A-Z0-9]+)+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const yearMatches = [...cleaned.matchAll(YEAR_PATTERN)];
  const yearMatch = yearMatches.at(-1);
  const year = yearMatch ? Number(yearMatch[1]) : undefined;

  if (yearMatch?.index !== undefined) {
    cleaned = cleaned.slice(0, yearMatch.index).replace(/[\s([{]+$/, "");
  }

  return {
    title: cleaned.replace(/\s+/g, " ").trim(),
    ...(year === undefined ? {} : { year }),
  };
}
