import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { createTmdbService, tmdbImageUrl, type TmdbMovie } from "../services/tmdb";

interface OnlineMovieDetailsProps {
  movieId: number;
  onBack: () => void;
}

const tmdb = createTmdbService();

export function OnlineMovieDetails({
  movieId,
  onBack,
}: OnlineMovieDetailsProps) {
  const { t } = useTranslation();
  const [movie, setMovie] = useState<TmdbMovie | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setMovie(null);
    setError("");
    setIsLoading(true);
    tmdb.getMovie(movieId)
      .then((result) => {
        if (active) setMovie(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : t("onlineMovieLoadFailed"));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [movieId, t]);

  return (
    <section
      aria-label={t("onlineMovieDetails", { title: movie?.title ?? t("onlineMovie") })}
      className="space-y-6"
    >
      <button
        type="button"
        onClick={onBack}
        className="min-h-11 rounded-lg px-4 text-zinc-200 outline-none hover:bg-zinc-800 focus-visible:ring-4 focus-visible:ring-red-500"
      >
        ← {t("close")}
      </button>

      {isLoading ? (
        <p role="status" className="py-20 text-center text-zinc-300">{t("loadingOnlineMovie")}</p>
      ) : error ? (
        <p role="alert" className="rounded-lg border border-amber-900 bg-amber-950/40 p-4 text-amber-200">{error}</p>
      ) : movie ? (
        <>
          {movie.backdropPath && (
            <img
              src={tmdbImageUrl(movie.backdropPath, "w780") ?? undefined}
              alt=""
              className="max-h-[30rem] w-full rounded-2xl object-cover"
            />
          )}
          <div className="grid gap-6 md:grid-cols-[minmax(180px,280px)_1fr]">
            <div className="aspect-[2/3] max-h-[28rem] overflow-hidden rounded-2xl bg-zinc-800">
              {movie.posterPath ? (
                <img
                  src={tmdbImageUrl(movie.posterPath, "w500") ?? undefined}
                  alt={t("posterAlt", { title: movie.title })}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-400">{t("posterUnavailable")}</div>
              )}
            </div>
            <div className="self-center">
              <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-red-400">
                {t("onlineMovie")}
              </p>
              <h2 className="text-3xl font-bold sm:text-4xl">{movie.title}</h2>
              <p className="mt-3 text-zinc-400">
                {[
                  movie.releaseDate.slice(0, 4),
                  movie.runtime ? t("runtime", { count: movie.runtime }) : "",
                  movie.voteAverage ? t("stars", { rating: movie.voteAverage.toFixed(1) }) : "",
                ].filter(Boolean).join(" · ")}
              </p>
              {movie.genres.length > 0 && (
                <p className="mt-3 text-sm text-zinc-300">
                  {movie.genres.map((genre) => genre.name).join(" · ")}
                </p>
              )}
              {movie.crew.find((person) => person.job === "Director") && (
                <p className="mt-4 text-zinc-300">
                  {t("directedBy", { name: movie.crew.find((person) => person.job === "Director")?.name })}
                </p>
              )}
              <h3 className="mt-6 text-xl font-semibold">{t("overview")}</h3>
              <p className="mt-2 max-w-4xl whitespace-pre-line leading-relaxed text-zinc-200">
                {movie.overview || t("detailsUnavailable")}
              </p>
              <p className="mt-5 text-sm text-zinc-500">{t("onlineOnlyNotice")}</p>
            </div>
          </div>

          {movie.cast.length > 0 && (
            <section aria-labelledby="online-movie-cast">
              <h3 id="online-movie-cast" className="mb-4 text-xl font-semibold">{t("cast")}</h3>
              <div className="flex gap-4 overflow-x-auto pb-3">
                {movie.cast.map((person) => (
                  <div
                    key={person.id}
                    className="w-28 shrink-0 rounded-lg text-left"
                  >
                    <div className="aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800">
                      {person.profilePath ? (
                        <img
                          src={tmdbImageUrl(person.profilePath, "w185") ?? undefined}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-zinc-500">{t("noPhoto")}</div>
                      )}
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold">{person.name}</p>
                    <p className="truncate text-xs text-zinc-400">{person.character}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}
    </section>
  );
}
