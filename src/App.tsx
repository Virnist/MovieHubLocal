import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActorDetails } from "./components/ActorDetails";
import { PersonGrid, type LibraryActor, type LibraryDirector } from "./components/ActorGrid";
import { InstallAppButton } from "./components/InstallAppButton";
import { MovieGrid } from "./components/MovieGrid";
import { MoviePlayer } from "./components/MoviePlayer";
import { OnlineMovieDetails } from "./components/OnlineMovieDetails";
import { SettingsPanel } from "./components/SettingsPanel";
import i18nInstance, { detectBrowserLanguage, type AppLanguage } from "./i18n";
import {
  getLibrary,
  getSettings,
  saveSettings,
  scanLibrary,
  selectLibraryFiles,
  type AppSettings,
  type LibraryMovie,
} from "./services/library";

export default function App() {
  const { t } = useTranslation();
  const [movies, setMovies] = useState<LibraryMovie[]>([]);
  const [unmatchedFiles, setUnmatchedFiles] = useState<string[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<LibraryMovie | null>(null);
  const [selectedActorId, setSelectedActorId] = useState<number | null>(null);
  const [selectedDirectorId, setSelectedDirectorId] = useState<number | null>(null);
  const [selectedOnlineMovieId, setSelectedOnlineMovieId] = useState<number | null>(null);
  const [browseSection, setBrowseSection] = useState<"movies" | "actors" | "directors">("movies");
  const [showSettings, setShowSettings] = useState(false);
  const [languageRevision, setLanguageRevision] = useState(0);
  const [settings, setSettings] = useState<AppSettings>({
    language: "en-US",
    languageConfigured: false,
    libraryPath: "",
    setupComplete: false,
    apiKeyConfigured: false,
  });
  const imageLanguage = settings.language;
  const [isInitialized, setIsInitialized] = useState(false);
  const [notice, setNotice] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const actors = useMemo(() => {
    const byId = new Map<number, LibraryActor>();
    for (const movie of movies) {
      for (const person of movie.cast ?? []) {
        const existing = byId.get(person.id);
        if (existing) {
          if (!existing.movies.some((candidate) => candidate.id === movie.id)) {
            existing.movies.push(movie);
          }
          existing.profileUrl ??= person.profileUrl;
        } else {
          byId.set(person.id, {
            id: person.id,
            name: person.name,
            profileUrl: person.profileUrl,
            movies: [movie],
          });
        }
      }
    }
    return [...byId.values()];
  }, [movies]);
  const directors = useMemo(() => {
    const byId = new Map<number, LibraryDirector>();
    for (const movie of movies) {
      if (movie.directorId === undefined || !movie.director) continue;
      const existing = byId.get(movie.directorId);
      if (existing) {
        if (!existing.movies.some((candidate) => candidate.id === movie.id)) {
          existing.movies.push(movie);
        }
        existing.profileUrl ??= movie.directorProfileUrl;
      } else {
        byId.set(movie.directorId, {
          id: movie.directorId,
          name: movie.director,
          profileUrl: movie.directorProfileUrl,
          movies: [movie],
        });
      }
    }
    return [...byId.values()];
  }, [movies]);
  const selectedActor = actors.find((actor) => actor.id === selectedActorId) ?? null;
  const selectedDirector = directors.find((director) => director.id === selectedDirectorId) ?? null;

  useEffect(() => {
    document.documentElement.lang =
      i18nInstance.resolvedLanguage ?? i18nInstance.language;
  }, [i18nInstance.language, i18nInstance.resolvedLanguage, languageRevision]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([getLibrary(), getSettings()])
      .then(async ([library, appSettings]) => {
        if (!isMounted) return;
        setMovies(library.movies);
        setUnmatchedFiles(library.unmatchedFiles ?? []);
        const language =
          !appSettings.setupComplete && !appSettings.languageConfigured
            ? detectBrowserLanguage()
            : appSettings.language;
        const initialSettings = { ...appSettings, language };
        setSettings(initialSettings);
        await i18nInstance.changeLanguage(language);
        if (!isMounted) return;
        setIsInitialized(true);

      })
      .catch((error: unknown) => {
        if (isMounted) {
          setNotice(
            error instanceof Error
              ? error.message
              : i18nInstance.t("serviceUnavailable"),
          );
          setIsInitialized(true);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleScan() {
    setIsScanning(true);
    setNotice("");
    setWarnings([]);
    setSelectedMovie(null);
    try {
      const result = await scanLibrary();
      setSettings(await getSettings());
      setMovies(result.movies);
      setUnmatchedFiles(result.unmatchedFiles);
      setWarnings(result.warnings);
      setNotice(
        t("scanSuccess", {
          count: result.scannedFiles,
          path: result.catalogPath,
          tmdb: result.tmdbEnabled ? "" : t("tmdbNotConfigured"),
          warnings: result.warnings.length
            ? t("warningCount", { count: result.warnings.length })
            : "",
        }),
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("serviceUnavailable"));
    } finally {
      setIsScanning(false);
    }
  }

  function handleBack() {
    setSelectedMovie(null);
    if (selectedOnlineMovieId !== null) {
      setSelectedOnlineMovieId(null);
      return;
    }
    if (selectedMovie) {
      setSelectedActorId(null);
      setSelectedDirectorId(null);
    }
    else if (selectedActorId !== null) setSelectedActorId(null);
    else if (selectedDirectorId !== null) setSelectedDirectorId(null);
    setShowSettings(false);
  }

  function handleNavigate(destination: "movies" | "actors" | "directors" | "settings") {
    setSelectedMovie(null);
    setSelectedActorId(null);
    setSelectedDirectorId(null);
    setSelectedOnlineMovieId(null);
    setShowSettings(destination === "settings");
    if (destination !== "settings") setBrowseSection(destination);
  }

  async function handleSaveSettings(
    nextLibraryPath: string,
    language: AppLanguage,
    apiKey: string,
  ) {
    const isFirstRun = !settings.setupComplete;
    const nextSettings = await saveSettings({
      language,
      libraryPath: nextLibraryPath,
      setupComplete: settings.setupComplete,
      ...(apiKey ? { apiKey } : {}),
    });
    setSettings(nextSettings);
    await i18nInstance.changeLanguage(nextSettings.language);

    setIsScanning(true);
    setNotice("");
    try {
      const result = await scanLibrary();
      setMovies(result.movies);
      setUnmatchedFiles(result.unmatchedFiles);
      setWarnings(result.warnings);
      setNotice(i18nInstance.t("scanSuccess", {
        count: result.scannedFiles,
        path: result.catalogPath,
        tmdb: result.tmdbEnabled ? "" : i18nInstance.t("tmdbNotConfigured"),
        warnings: result.warnings.length
          ? i18nInstance.t("warningCount", { count: result.warnings.length })
          : "",
      }));
      const completedSettings = await saveSettings({
        language,
        libraryPath: nextLibraryPath,
        setupComplete: true,
      });
      setSettings(completedSettings);
      if (isFirstRun) setShowSettings(false);
    } finally {
      setIsScanning(false);
    }
  }

  async function handleRemoveCredential() {
    const nextSettings = await saveSettings({
      language: settings.language,
      removeApiKey: true,
    });
    setSettings(nextSettings);
  }

  if (!isInitialized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-center text-zinc-300">
        {notice || t("loading")}
      </main>
    );
  }

  const isFirstRun = !settings.setupComplete;
  const sectionCounts = {
    movies: movies.length,
    actors: actors.length,
    directors: directors.length,
  };

  return (
    <main
      className="min-h-screen bg-zinc-950 px-5 py-8 text-white sm:px-8 lg:px-12"
      onKeyDown={(event) => {
        const target = event.target;
        const isTextField =
          target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
        if (
          (selectedMovie || selectedActorId !== null || selectedDirectorId !== null || selectedOnlineMovieId !== null || showSettings) &&
          !isTextField &&
          (event.key === "Escape" || event.key === "Backspace")
        ) {
          event.preventDefault();
          handleBack();
        }
      }}
    >
      <header className="sticky top-0 z-30 -mx-5 mb-8 border-b border-zinc-800 bg-zinc-950/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.3em] text-red-500">
              {t("tagline")}
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">MovieHub Local</h1>
            <p className="mt-1 text-sm text-zinc-400">{t("browseHint")}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {!isFirstRun && (
              <nav
                aria-label={t("mainNavigation")}
                className="flex max-w-full flex-wrap gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1"
              >
                {(["movies", "actors", "directors", "settings"] as const).map((destination) => {
                  const activeDestination = showSettings
                    ? "settings"
                    : selectedActorId !== null
                      ? "actors"
                      : selectedDirectorId !== null
                        ? "directors"
                        : selectedMovie !== null
                          ? "movies"
                          : browseSection;
                  const isActive = activeDestination === destination;
                  return (
                    <button
                      type="button"
                      key={destination}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => handleNavigate(destination)}
                      className={`min-h-10 rounded-lg px-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-red-500 ${
                        isActive
                          ? "bg-red-600 text-white shadow"
                          : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      }`}
                      >
                        {t(destination)}
                        {destination !== "settings" && ` (${sectionCounts[destination]})`}
                      </button>
                  );
                })}
              </nav>
            )}
            {!isFirstRun && <InstallAppButton />}
          </div>
        </div>
      </header>

      {notice && (
        <p role="status" className="mb-6 break-words rounded-lg bg-zinc-900 px-4 py-3 text-zinc-200">
          {notice}
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="mb-6 list-inside list-disc space-y-1 rounded-lg border border-amber-900 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
          {warnings.map((warning, index) => (
            <li key={`${index}-${warning}`}>{warning}</li>
          ))}
        </ul>
      )}

      {isFirstRun || showSettings ? (
        <SettingsPanel
          settings={settings}
          unmatchedFiles={unmatchedFiles}
          isFirstRun={isFirstRun}
          isRescanning={isScanning}
          onBrowseFolder={async (files, selection) => {
            const selectedPath = await selectLibraryFiles(files, selection);
            if (selectedPath) setSettings(await getSettings());
            return selectedPath;
          }}
          onSave={handleSaveSettings}
          onLanguageChange={async (language) => {
            const nextSettings = await saveSettings({ language });
            setSettings(nextSettings);
            await i18nInstance.changeLanguage(language);
            setLanguageRevision((revision) => revision + 1);
          }}
          onRescan={handleScan}
          onRemoveCredential={handleRemoveCredential}
          onClose={() => setShowSettings(false)}
        />
      ) : selectedOnlineMovieId !== null ? (
        <OnlineMovieDetails
          movieId={selectedOnlineMovieId}
          onBack={() => setSelectedOnlineMovieId(null)}
        />
      ) : selectedActor ? (
        <ActorDetails
          actor={selectedActor}
          onBack={handleBack}
          onSelectOnlineMovie={setSelectedOnlineMovieId}
          onSelectMovie={(movie) => {
            setSelectedActorId(null);
            setSelectedMovie(movie);
          }}
        />
      ) : selectedDirector ? (
        <ActorDetails
          actor={selectedDirector}
          kind="director"
          onBack={handleBack}
          onSelectOnlineMovie={setSelectedOnlineMovieId}
          onSelectMovie={(movie) => {
            setSelectedDirectorId(null);
            setSelectedMovie(movie);
          }}
        />
      ) : selectedMovie ? (
        <section
          aria-label={t("movieDetails", { title: selectedMovie.title })}
          className="space-y-6"
        >
          <button
            type="button"
            onClick={handleBack}
            className="rounded-lg px-4 py-2 text-zinc-200 outline-none hover:bg-zinc-800 focus-visible:ring-4 focus-visible:ring-red-500"
          >
            ← {t("close")}
          </button>
          <div className="grid gap-6 md:grid-cols-[minmax(180px,280px)_1fr]">
            <div className="aspect-[2/3] overflow-hidden rounded-xl bg-zinc-800">
              {selectedMovie.posterUrl ? (
                <img
                  src={selectedMovie.posterUrl}
                  alt={t("posterAlt", { title: selectedMovie.title })}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-400">
                  {t("posterUnavailable")}
                </div>
              )}
            </div>
            <div className="self-center">
              {selectedMovie.backdropUrl && (
                <img
                  src={selectedMovie.backdropUrl}
                  alt=""
                  className="mb-5 max-h-64 w-full rounded-xl object-cover"
                />
              )}
              <h2 className="text-3xl font-bold">{selectedMovie.title}</h2>
              <p className="mt-2 text-zinc-400">
                {[
                  selectedMovie.year,
                  selectedMovie.runtime && t("runtime", { count: selectedMovie.runtime }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                {selectedMovie.voteAverage
                  ? ` · ${t("stars", { rating: selectedMovie.voteAverage.toFixed(1) })}`
                  : ""}
              </p>
              {selectedMovie.genres && (
                <p className="mt-2 text-sm text-zinc-300">
                  {selectedMovie.genres.map((genre) => genre.name).join(" · ")}
                </p>
              )}
              {selectedMovie.director && (
                <p className="mt-4 text-zinc-300">
                  {selectedMovie.directorId !== undefined ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMovie(null);
                        setSelectedDirectorId(selectedMovie.directorId ?? null);
                      }}
                      className="rounded outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
                      aria-label={t("openDirector", { name: selectedMovie.director })}
                    >
                      {t("directedBy", { name: selectedMovie.director })}
                    </button>
                  ) : (
                    t("directedBy", { name: selectedMovie.director })
                  )}
                </p>
              )}
              <p className="mt-5 max-w-3xl leading-relaxed text-zinc-200">
                {selectedMovie.overview || t("detailsUnavailable")}
              </p>
              <p className="mt-5 break-all text-sm text-zinc-500">
                {t("savedPath", { path: selectedMovie.relativePath })}
              </p>
            </div>
          </div>
          <MoviePlayer
            key={selectedMovie.relativePath}
            movie={selectedMovie}
          />
          {selectedMovie.cast && selectedMovie.cast.length > 0 && (
            <div>
              <h3 className="mb-4 text-xl font-semibold">{t("cast")}</h3>
              <div className="flex gap-4 overflow-x-auto pb-3">
                {selectedMovie.cast.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => {
                      setSelectedMovie(null);
                      setSelectedActorId(person.id);
                    }}
                    className="w-28 shrink-0 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    aria-label={t("openActor", { name: person.name })}
                  >
                    <div className="aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800">
                      {person.profileUrl ? (
                        <img
                          src={person.profileUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                          {t("noPhoto")}
                        </div>
                      )}
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold">{person.name}</p>
                    <p className="truncate text-xs text-zinc-400">{person.character}</p>
                    </button>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : browseSection === "actors" || browseSection === "directors" ? (
        <PersonGrid
          key={browseSection}
          actors={browseSection === "actors" ? actors : directors}
          language={imageLanguage}
          kind={browseSection}
          onSelect={(person) => {
            setSelectedActorId(browseSection === "actors" ? person.id : null);
            setSelectedDirectorId(browseSection === "directors" ? person.id : null);
          }}
        />
      ) : (
        <MovieGrid
          movies={movies}
          onSelect={(movie) =>
            setSelectedMovie(movies.find((candidate) => candidate.id === movie.id) ?? null)
          }
          onBack={handleBack}
        />
      )}
    </main>
  );
}
