import type { CleanedFilename } from "../lib/filename";
import {
  getTmdbMovie,
  searchTmdbMovie,
  TmdbApiError,
  type TmdbMovie,
} from "./library";

const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export type { TmdbMovie };
export { TmdbApiError };

export interface TmdbPerson {
  id: number;
  name: string;
  character?: string;
  job?: string;
  profilePath: string | null;
}

export function tmdbImageUrl(
  imagePath: string | null,
  size: "w185" | "w342" | "w500" | "w780" | "original" = "w500",
): string | null {
  return imagePath ? `${IMAGE_BASE_URL}/${size}${imagePath}` : null;
}

export function createTmdbService() {
  return {
    getMovie: getTmdbMovie,
    searchMovie: (filename: CleanedFilename) => searchTmdbMovie(filename),
  };
}
