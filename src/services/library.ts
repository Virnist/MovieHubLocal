import type { AppLanguage } from "../i18n";
import { cleanVideoFilename } from "../lib/filename";

export interface AppSettings {
  language: AppLanguage;
  languageConfigured: boolean;
  libraryPath: string;
  setupComplete: boolean;
  apiKeyConfigured: boolean;
}

export interface LibraryMovie {
  id: string;
  tmdbId: number | null;
  title: string;
  year?: number;
  relativePath: string;
  size: number;
  overview?: string;
  releaseDate?: string;
  runtime?: number | null;
  voteAverage?: number;
  genres?: Array<{ id: number; name: string }>;
  director?: string;
  directorId?: number;
  directorProfileUrl?: string;
  posterUrl?: string;
  backdropUrl?: string;
  cast?: Array<{
    id: number;
    name: string;
    character?: string;
    profileUrl?: string;
  }>;
}

export interface ScanResult {
  path: string;
  scannedFiles: number;
  movies: LibraryMovie[];
  unmatchedFiles: string[];
  catalogPath: string;
  tmdbEnabled: boolean;
  warnings: string[];
}

export interface TmdbPersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  placeOfBirth: string | null;
  profileUrl: string | null;
  topMovies: Array<{
    id: number;
    title: string;
    character: string;
    releaseDate: string;
    overview: string;
    voteAverage: number;
    posterUrl: string | null;
  }>;
}

interface DirectoryEntry {
  readonly kind: "directory" | "file";
  readonly name: string;
}

interface VideoFileEntry extends DirectoryEntry {
  getFile(): Promise<File>;
}

interface VideoDirectoryHandle extends DirectoryEntry {
  values(): AsyncIterableIterator<DirectoryEntry | VideoFileEntry>;
  getDirectoryHandle(name: string): Promise<VideoDirectoryHandle>;
  getFileHandle(name: string): Promise<VideoFileEntry>;
  queryPermission(descriptor: { mode: "read" }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: "read" }): Promise<PermissionState>;
}

interface BrowserWindow extends Window {
  showDirectoryPicker?: () => Promise<VideoDirectoryHandle>;
}

interface PersistedSettings {
  language: AppLanguage;
  languageConfigured: boolean;
  libraryPath: string;
  setupComplete: boolean;
  apiKey: string;
}

interface TmdbMovieResponse {
  id: number;
  title: string;
  overview: string;
  release_date?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  runtime: number | null;
  genres: Array<{ id: number; name: string }>;
  credits: {
    cast: Array<{
      id: number;
      name: string;
      character?: string;
      profile_path: string | null;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job?: string;
      profile_path: string | null;
    }>;
  };
}

export interface TmdbMovie {
  id: number;
  title: string;
  overview: string;
  releaseDate: string;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number;
  runtime: number | null;
  genres: Array<{ id: number; name: string }>;
  cast: Array<{
    id: number;
    name: string;
    character?: string;
    profilePath: string | null;
  }>;
  crew: Array<{
    id: number;
    name: string;
    job?: string;
    profilePath: string | null;
  }>;
}

interface TmdbMovieSearchResponse {
  results: Array<{ id: number }>;
}

interface TmdbPersonResponse {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  movie_credits: {
    cast: Array<{
      id: number;
      title: string;
      character?: string;
      release_date?: string;
      overview: string;
      poster_path: string | null;
      vote_average: number;
      vote_count: number;
      popularity: number;
    }>;
    crew: Array<{
      id: number;
      title: string;
      release_date?: string;
      overview: string;
      poster_path: string | null;
      vote_average: number;
      vote_count: number;
      popularity: number;
      job: string;
    }>;
  };
}

const DATABASE_NAME = "moviehub-local";
const STORE_NAME = "app";
const VIDEO_EXTENSIONS = new Set([".mkv", ".mp4", ".avi", ".mov"]);
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const DEFAULT_LANGUAGE: AppLanguage = "en-US";
const DEFAULT_SETTINGS: PersistedSettings = {
  language: DEFAULT_LANGUAGE,
  languageConfigured: false,
  libraryPath: "",
  setupComplete: false,
  apiKey: "",
};

let databasePromise: Promise<IDBDatabase> | undefined;
let selectedVideoFiles = new Map<string, File>();

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open browser storage."));
      request.onblocked = () => reject(new Error("Browser storage is blocked by another MovieHub tab."));
    });
    databasePromise = opening.catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }
  const database = databasePromise;
  if (!database) throw new Error("Could not initialize browser storage.");
  return database;
}

async function readValue<T>(key: string): Promise<T | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error ?? new Error("Could not read browser storage."));
  });
}

async function writeValue(key: string, value: unknown): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save browser storage."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Browser storage write was aborted."));
  });
}

async function loadSettings(): Promise<PersistedSettings> {
  const saved = await readValue<Partial<PersistedSettings>>("settings");
  return { ...DEFAULT_SETTINGS, ...saved };
}

async function savePersistedSettings(settings: PersistedSettings): Promise<void> {
  await writeValue("settings", settings);
}

async function getDirectory(requestPermission: boolean): Promise<VideoDirectoryHandle> {
  const directory = await readValue<VideoDirectoryHandle>("directory");
  if (!directory) throw new Error("Choose your movie folder again to grant access.");
  let permission = await directory.queryPermission({ mode: "read" });
  if (permission !== "granted" && requestPermission) {
    permission = await directory.requestPermission({ mode: "read" });
  }
  if (permission !== "granted") {
    throw new Error("Movie folder access is not currently granted. Choose the folder again in Settings.");
  }
  return directory;
}

export async function getLibrary(): Promise<{
  path: string;
  movies: LibraryMovie[];
  unmatchedFiles: string[];
}> {
  const [settings, movies, unmatchedFiles] = await Promise.all([
    loadSettings(),
    readValue<LibraryMovie[]>("movies"),
    readValue<string[]>("unmatchedFiles"),
  ]);
  return {
    path: settings.libraryPath,
    movies: movies ?? [],
    unmatchedFiles: unmatchedFiles ?? [],
  };
}

export async function getSettings(): Promise<AppSettings> {
  const settings = await loadSettings();
  return {
    language: settings.language,
    languageConfigured: settings.languageConfigured,
    libraryPath: settings.libraryPath,
    setupComplete: settings.setupComplete,
    apiKeyConfigured: Boolean(settings.apiKey),
  };
}

export async function browseLibraryFolder(): Promise<string | null> {
  const picker = (window as BrowserWindow).showDirectoryPicker;
  if (!picker) {
    throw new Error("Folder access requires a browser that supports the File System Access API, such as Chrome or Edge on a computer.");
  }
  const directory = await picker.call(window);
  const settings = await loadSettings();
  settings.libraryPath = directory.name;
  await Promise.all([
    writeValue("directory", directory),
    savePersistedSettings(settings),
  ]);
  return directory.name;
}

export async function selectLibraryFiles(files: File[]): Promise<string> {
  const firstRelativePath = files.find((file) => file.webkitRelativePath)?.webkitRelativePath;
  if (!firstRelativePath) {
    throw new Error("Select a folder, not individual files.");
  }
  const folderName = firstRelativePath.split("/")[0];
  const selected = new Map<string, File>();
  for (const file of files) {
    const relativePath = file.webkitRelativePath.split("/").slice(1).join("/");
    if (relativePath && VIDEO_EXTENSIONS.has(extensionOf(file.name))) {
      selected.set(relativePath, file);
    }
  }
  if (selected.size === 0) {
    throw new Error("No supported video files were found in that folder.");
  }

  selectedVideoFiles = selected;
  const settings = await loadSettings();
  settings.libraryPath = folderName;
  settings.setupComplete = false;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.delete("directory");
    store.put(settings, "settings");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the selected folder."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Saving the selected folder was aborted."));
  });
  return folderName;
}

export async function scanLibrary(): Promise<ScanResult> {
  const settings = await loadSettings();
  let folderName = settings.libraryPath;
  let files = [...selectedVideoFiles].map(([relativePath, file]) => ({ relativePath, file }));
  if (files.length === 0) {
    const directory = await getDirectory(false);
    folderName = directory.name;
    async function visit(current: VideoDirectoryHandle, prefix: string): Promise<void> {
      for await (const entry of current.values()) {
        if (entry.name === ".moviehub") continue;
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.kind === "directory") {
          await visit(entry as VideoDirectoryHandle, relativePath);
        } else if (VIDEO_EXTENSIONS.has(extensionOf(entry.name))) {
          files.push({
            relativePath,
            file: await (entry as VideoFileEntry).getFile(),
          });
        }
      }
    }
    await visit(directory, "");
  }
  if (!folderName) throw new Error("Choose your movie folder first.");

  const movies: LibraryMovie[] = [];
  const unmatchedFiles: string[] = [];
  const warnings: string[] = [];
  for (const entry of files) {
    const filename = entry.relativePath.split("/").pop() ?? entry.relativePath;
    const cleaned = cleanVideoFilename(filename);
    const baseName = filename.replace(/\.[^.]+$/, "");
    const tmdbIdMatch = baseName.match(/\[(?:tmdb|id)[-_ ]?(\d+)\]/i);
    let tmdbId = tmdbIdMatch ? Number(tmdbIdMatch[1]) : null;
    let unmatched = false;
    const movie: LibraryMovie = {
      id: entry.relativePath,
      tmdbId,
      title: cleaned.title || baseName,
      ...(cleaned.year === undefined ? {} : { year: cleaned.year }),
      relativePath: entry.relativePath,
      size: entry.file.size,
    };

    if (settings.apiKey) {
      try {
        if (tmdbId === null) {
          const results = await tmdbRequest<TmdbMovieSearchResponse>("/search/movie", {
            query: cleaned.title,
            ...(cleaned.year === undefined ? {} : { year: String(cleaned.year) }),
          }, settings);
          tmdbId = results.results[0]?.id ?? null;
          if (tmdbId === null) unmatched = true;
        }
        if (tmdbId !== null) {
          const metadata = await fetchMovieMetadata(tmdbId, settings);
          Object.assign(movie, mapMovieMetadata(movie, metadata));
        }
      } catch (error) {
        if (tmdbId !== null && error instanceof TmdbApiError && error.status === 404) unmatched = true;
        warnings.push(`${filename}: ${error instanceof Error ? error.message : "TMDB lookup failed."}`);
      }
    } else if (tmdbId === null) {
      unmatched = true;
    }
    if (unmatched) unmatchedFiles.push(entry.relativePath);
    movies.push(movie);
  }

  const activePaths = new Set(files.map(({ relativePath }) => relativePath));
  const savedProgress = (await readValue<Record<string, number>>("progress")) ?? {};
  const progress = Object.fromEntries(
    Object.entries(savedProgress).filter(([relativePath]) => activePaths.has(relativePath)),
  );
  const currentSettings = await loadSettings();
  currentSettings.libraryPath = folderName;
  currentSettings.setupComplete = true;
  await Promise.all([
    writeValue("movies", movies),
    writeValue("unmatchedFiles", unmatchedFiles),
    writeValue("progress", progress),
    savePersistedSettings(currentSettings),
  ]);

  return {
    path: folderName,
    scannedFiles: files.length,
    movies,
    unmatchedFiles,
    catalogPath: "this browser",
    tmdbEnabled: Boolean(settings.apiKey),
    warnings,
  };
}

export async function refreshLibraryMetadata(): Promise<ScanResult> {
  return scanLibrary();
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot < 0 ? "" : filename.slice(dot).toLowerCase();
}

function imageUrl(imagePath: string | null, size: string): string | undefined {
  return imagePath ? `${TMDB_IMAGE_BASE_URL}/${size}${imagePath}` : undefined;
}

function mapMovieMetadata(
  movie: LibraryMovie,
  metadata: TmdbMovieResponse,
): Partial<LibraryMovie> {
  const director = metadata.credits.crew.find((person) => person.job === "Director");
  return {
    id: String(metadata.id),
    tmdbId: metadata.id,
    title: metadata.title,
    overview: metadata.overview,
    releaseDate: metadata.release_date ?? "",
    year: metadata.release_date
      ? Number(metadata.release_date.slice(0, 4))
      : movie.year,
    runtime: metadata.runtime,
    voteAverage: metadata.vote_average,
    genres: metadata.genres,
    director: director?.name,
    directorId: director?.id,
    directorProfileUrl: director ? imageUrl(director.profile_path, "w185") : undefined,
    posterUrl: imageUrl(metadata.poster_path, "w500"),
    backdropUrl: imageUrl(metadata.backdrop_path, "w780"),
    cast: metadata.credits.cast.slice(0, 20).map((person) => ({
      id: person.id,
      name: person.name,
      character: person.character,
      profileUrl: imageUrl(person.profile_path, "w185"),
    })),
  };
}

async function fetchMovieMetadata(
  movieId: number,
  settings: PersistedSettings,
): Promise<TmdbMovieResponse> {
  return tmdbRequest<TmdbMovieResponse>(
    `/movie/${encodeURIComponent(movieId)}`,
    { append_to_response: "credits" },
    settings,
  );
}

function normalizeTmdbMovie(movie: TmdbMovieResponse): TmdbMovie {
  return {
    id: movie.id,
    title: movie.title,
    overview: movie.overview,
    releaseDate: movie.release_date ?? "",
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    voteAverage: movie.vote_average,
    runtime: movie.runtime,
    genres: movie.genres,
    cast: movie.credits.cast.map((person) => ({
      id: person.id,
      name: person.name,
      character: person.character,
      profilePath: person.profile_path,
    })),
    crew: movie.credits.crew.map((person) => ({
      id: person.id,
      name: person.name,
      job: person.job,
      profilePath: person.profile_path,
    })),
  };
}

export async function getTmdbMovie(movieId: number): Promise<TmdbMovie> {
  const settings = await loadSettings();
  return normalizeTmdbMovie(await fetchMovieMetadata(movieId, settings));
}

export async function searchTmdbMovie(filename: ReturnType<typeof cleanVideoFilename>): Promise<TmdbMovie | null> {
  const settings = await loadSettings();
  const result = await tmdbRequest<TmdbMovieSearchResponse>(
    "/search/movie",
    {
      query: filename.title,
      ...(filename.year === undefined ? {} : { year: String(filename.year) }),
    },
    settings,
  );
  const movieId = result.results[0]?.id;
  return movieId === undefined
    ? null
    : normalizeTmdbMovie(await fetchMovieMetadata(movieId, settings));
}

async function tmdbRequest<T>(
  endpoint: string,
  params: Record<string, string>,
  settings?: PersistedSettings,
  signal?: AbortSignal,
): Promise<T> {
  const savedSettings = settings ?? await loadSettings();
  if (!savedSettings.apiKey) throw new TmdbApiError("Add your TMDB credential in Settings first.");
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.search = new URLSearchParams({
    ...params,
    language: savedSettings.language,
    ...(!savedSettings.apiKey.includes(".") ? { api_key: savedSettings.apiKey } : {}),
  }).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      signal,
      headers: savedSettings.apiKey.includes(".")
        ? { Authorization: `Bearer ${savedSettings.apiKey}` }
        : undefined,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new TmdbApiError(
      `Could not reach TMDB: ${error instanceof Error ? error.message : "network error"}`,
    );
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { status_message?: string } | null;
    throw new TmdbApiError(
      body?.status_message ?? `TMDB request failed (${response.status}).`,
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

export async function getPlaybackPosition(relativePath: string): Promise<number> {
  const progress = (await readValue<Record<string, number>>("progress")) ?? {};
  return progress[relativePath] ?? 0;
}

export async function savePlaybackPosition(relativePath: string, currentTime: number): Promise<void> {
  const progress = (await readValue<Record<string, number>>("progress")) ?? {};
  progress[relativePath] = currentTime;
  await writeValue("progress", progress);
}

export async function getVideoObjectUrl(relativePath: string): Promise<string> {
  const selectedFile = selectedVideoFiles.get(relativePath);
  if (selectedFile) return URL.createObjectURL(selectedFile);
  const directory = await getDirectory(false);
  const parts = relativePath.split("/");
  if (!parts.length || parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error("The selected video path is invalid.");
  }
  let current = directory;
  for (const part of parts.slice(0, -1)) {
    current = await current.getDirectoryHandle(part);
  }
  const file = await current.getFileHandle(parts[parts.length - 1]).then((handle) => handle.getFile());
  return URL.createObjectURL(file);
}

export async function getPersonDetails(
  personId: number,
  signal?: AbortSignal,
  department?: "directing",
): Promise<TmdbPersonDetails> {
  const settings = await loadSettings();
  const person = await tmdbRequest<TmdbPersonResponse>(
    `/person/${encodeURIComponent(personId)}`,
    { append_to_response: "movie_credits" },
    settings,
    signal,
  );
  const credits = department === "directing"
    ? person.movie_credits.crew.filter((movie) => movie.job === "Director")
    : person.movie_credits.cast;
  const localIds = new Set((await readValue<LibraryMovie[]>("movies") ?? [])
    .flatMap((movie) => movie.tmdbId === null ? [] : [movie.tmdbId]));
  const topMovies = credits
    .filter((movie) => !localIds.has(movie.id))
    .sort((a, b) => b.vote_count - a.vote_count || b.popularity - a.popularity)
    .slice(0, 10)
    .map((movie) => ({
      id: movie.id,
      title: movie.title,
      character: "character" in movie ? movie.character ?? "" : "",
      releaseDate: movie.release_date ?? "",
      overview: movie.overview,
      voteAverage: movie.vote_average,
      posterUrl: imageUrl(movie.poster_path, "w500") ?? null,
    }));
  return {
    id: person.id,
    name: person.name,
    biography: person.biography,
    birthday: person.birthday,
    placeOfBirth: person.place_of_birth,
    profileUrl: imageUrl(person.profile_path, "w500") ?? null,
    topMovies,
  };
}

export async function saveSettings(
  next: {
    language: AppLanguage;
    libraryPath?: string;
    setupComplete?: boolean;
    apiKey?: string;
    removeApiKey?: boolean;
  },
): Promise<AppSettings> {
  const settings = await loadSettings();
  settings.language = next.language;
  settings.languageConfigured = true;
  if (next.libraryPath !== undefined) settings.libraryPath = next.libraryPath;
  if (next.setupComplete !== undefined) settings.setupComplete = next.setupComplete;
  if (next.apiKey) settings.apiKey = next.apiKey;
  if (next.removeApiKey) settings.apiKey = "";
  await savePersistedSettings(settings);
  return getSettings();
}

export class TmdbApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "TmdbApiError";
  }
}
