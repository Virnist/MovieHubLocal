import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getPersonDetails, type LibraryMovie, type TmdbPersonDetails } from "../services/library";
import type { LibraryActor } from "./ActorGrid";

interface ActorDetailsProps {
  actor: LibraryActor;
  kind?: "actor" | "director";
  onBack: () => void;
  onSelectMovie: (movie: LibraryMovie) => void;
  onSelectOnlineMovie: (movieId: number) => void;
}

export function ActorDetails({
  actor,
  kind = "actor",
  onBack,
  onSelectMovie,
  onSelectOnlineMovie,
}: ActorDetailsProps) {
  const { t } = useTranslation();
  const [details, setDetails] = useState<TmdbPersonDetails | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setDetails(null);
    setError("");
    setIsLoading(true);
    getPersonDetails(actor.id, controller.signal, kind === "director" ? "directing" : undefined)
      .then(setDetails)
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof Error
            ? reason.message
            : t(kind === "actor" ? "actorDetailsFailed" : "directorDetailsFailed"),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [actor.id, kind, t]);

  return (
    <section aria-label={t(kind === "actor" ? "actorDetails" : "directorDetails", { name: actor.name })} className="space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="min-h-11 rounded-lg px-4 text-zinc-200 outline-none hover:bg-zinc-800 focus-visible:ring-4 focus-visible:ring-red-500"
      >
        ← {t("close")}
      </button>

      <div className="grid gap-6 md:grid-cols-[minmax(180px,280px)_1fr]">
        <div className="aspect-[2/3] max-h-[28rem] overflow-hidden rounded-2xl bg-zinc-800">
          {(details?.profileUrl ?? actor.profileUrl) ? (
            <img
              src={details?.profileUrl ?? actor.profileUrl ?? ""}
              alt={t("actorPortrait", { name: actor.name })}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-7xl font-bold text-zinc-600">
              {actor.name.slice(0, 1)}
            </div>
          )}
        </div>
        <div className="self-center">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-red-400">{t(kind === "actor" ? "actorLabel" : "directorLabel")}</p>
          <h2 className="text-3xl font-bold sm:text-4xl">{actor.name}</h2>
          <p className="mt-3 text-zinc-400">{t("localFilmCount", { count: actor.movies.length })}</p>
          {kind === "actor" && details?.birthday && (
            <p className="mt-2 text-sm text-zinc-400">
              {t("actorBorn", { date: details.birthday, place: details.placeOfBirth ? ` · ${details.placeOfBirth}` : "" })}
            </p>
          )}
          <h3 className="mt-7 text-xl font-semibold">{t("biography")}</h3>
          {isLoading ? (
            <p className="mt-3 text-zinc-400" role="status">{t("loadingBiography")}</p>
          ) : error ? (
            <p className="mt-3 rounded-lg border border-amber-900 bg-amber-950/40 p-4 text-amber-200" role="status">{error}</p>
          ) : (
            <p className="mt-3 max-w-4xl whitespace-pre-line leading-relaxed text-zinc-200">
              {details?.biography || t("biographyUnavailable")}
            </p>
          )}
        </div>
      </div>

      <section aria-labelledby="actor-local-movies">
        <h3 id="actor-local-movies" className="mb-4 text-2xl font-bold">{t(kind === "actor" ? "actorLocalMovies" : "directorLocalMovies")}</h3>
        {actor.movies.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-6">
            {actor.movies.map((movie) => (
              <button
                key={movie.id}
                type="button"
                onClick={() => onSelectMovie(movie)}
                className="group min-w-0 rounded-xl text-left outline-none focus-visible:ring-4 focus-visible:ring-red-500"
              >
                <div className="aspect-[2/3] overflow-hidden rounded-xl bg-zinc-800">
                  {movie.posterUrl ? (
                    <img src={movie.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center p-4 text-center text-zinc-400">{t("posterUnavailable")}</div>
                  )}
                </div>
                <span className="mt-2 block truncate font-semibold">{movie.title}</span>
                {movie.year && <span className="text-sm text-zinc-400">{movie.year}</span>}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-zinc-400">{t(kind === "actor" ? "noLocalActorMovies" : "noLocalDirectorMovies")}</p>
        )}
      </section>

      <section aria-labelledby="actor-other-movies">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
          <h3 id="actor-other-movies" className="text-2xl font-bold">{t(kind === "actor" ? "actorOtherMovies" : "directorOtherMovies")}</h3>
          <p className="text-sm text-zinc-500">{t(kind === "actor" ? "actorOnlineHint" : "directorOnlineHint")}</p>
        </div>
        {isLoading ? (
          <p className="py-8 text-zinc-400">{t("loadingRecommendations")}</p>
        ) : error ? (
          <p className="py-4 text-zinc-400">{t("recommendationsUnavailable")}</p>
        ) : details?.topMovies.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-6">
            {details.topMovies.map((movie) => (
              <button
                key={movie.id}
                type="button"
                onClick={() => onSelectOnlineMovie(movie.id)}
                className="group min-w-0 rounded-xl text-left outline-none focus-visible:ring-4 focus-visible:ring-red-500 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-950"
                aria-label={t("openOnlineMovie", { title: movie.title })}
              >
                <div className="aspect-[2/3] overflow-hidden rounded-xl bg-zinc-800">
                  {movie.posterUrl ? (
                    <img src={movie.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center p-4 text-center text-zinc-400">{t("posterUnavailable")}</div>
                  )}
                </div>
                <h4 className="mt-2 truncate font-semibold">{movie.title}</h4>
                <p className="text-sm text-zinc-400">
                  {[movie.releaseDate.slice(0, 4), movie.voteAverage ? t("stars", { rating: movie.voteAverage.toFixed(1) }) : ""].filter(Boolean).join(" · ")}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="py-4 text-zinc-400">{t(kind === "actor" ? "noOtherActorMovies" : "noOtherDirectorMovies")}</p>
        )}
      </section>
    </section>
  );
}
