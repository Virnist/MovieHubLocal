import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FacetButton, RatingFacet, type FacetOption } from "./MovieGrid";
import type { LibraryMovie } from "../services/library";

export interface LibraryActor {
  id: number;
  name: string;
  profileUrl?: string;
  movies: LibraryMovie[];
}

export type LibraryDirector = LibraryActor;

type ActorSort = "random" | "nameAsc" | "nameDesc" | "moviesDesc" | "ratingDesc";

const ACTOR_SORTS: ActorSort[] = ["random", "nameAsc", "nameDesc", "moviesDesc", "ratingDesc"];
const PAGE_SIZE = 48;

function isActorSort(value: string): value is ActorSort {
  return ACTOR_SORTS.some((candidate) => candidate === value);
}

interface ActorSortMenuProps {
  sort: ActorSort;
  kind: "actors" | "directors";
  onChange: (sort: ActorSort) => void;
}

function ActorSortMenu({ sort, kind, onChange }: ActorSortMenuProps) {
  const { t } = useTranslation();

  return (
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold text-zinc-200 outline-none hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-red-500 [&::-webkit-details-marker]:hidden">
        <span>{t("sortBy")}:</span>
        <span>{t(`${kind === "actors" ? "actorSort" : "directorSort"}.${sort}`)}</span>
        <span aria-hidden="true" className="text-zinc-400">▾</span>
      </summary>
      <div className="absolute left-0 top-full z-20 mt-2 min-w-56 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
        {ACTOR_SORTS.map((option) => (
          <button
            type="button"
            key={option}
            aria-pressed={sort === option}
            onClick={(event) => {
              onChange(option);
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
            className={`flex min-h-10 w-full items-center justify-between gap-4 rounded-md px-3 py-2 text-left text-sm outline-none hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-red-500 ${
              sort === option ? "text-red-300" : "text-zinc-200"
            }`}
          >
            <span>{t(`${kind === "actors" ? "actorSort" : "directorSort"}.${option}`)}</span>
            {sort === option && <span aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>
    </details>
  );
}

function actorAverageRating(actor: LibraryActor): number | null {
  const ratings = actor.movies.flatMap((movie) =>
    typeof movie.voteAverage === "number" ? [movie.voteAverage] : [],
  );
  return ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null;
}

interface ActorGridProps {
  actors: LibraryActor[];
  language: string;
  kind: "actors" | "directors";
  onSelect: (actor: LibraryActor) => void;
}

export function PersonGrid({ actors, language, kind, onSelect }: ActorGridProps) {
  const { t } = useTranslation();
  const collator = useMemo(
    () => new Intl.Collator(language, { sensitivity: "base", numeric: true }),
    [language],
  );
  const [sort, setSort] = useState<ActorSort>("random");
  const [genres, setGenres] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [page, setPage] = useState(0);
  const randomOrder = useRef(new Map<number, number>());

  const genreOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const actor of actors) {
      const actorGenres = new Set(actor.movies.flatMap((movie) => movie.genres?.map(({ name }) => name) ?? []));
      for (const genre of actorGenres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
    return [...counts].sort(([a], [b]) => collator.compare(a, b));
  }, [actors, collator]);
  const yearOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const actor of actors) {
      const actorYears = new Set(actor.movies.flatMap((movie) => movie.year ? [String(movie.year)] : []));
      for (const year of actorYears) counts.set(year, (counts.get(year) ?? 0) + 1);
    }
    return [...counts].sort(([a], [b]) => Number(b) - Number(a));
  }, [actors]);
  const genreFacets: FacetOption[] = genreOptions.map(([value, count]) => ({
    value,
    label: value,
    count,
  }));
  const yearFacets: FacetOption[] = yearOptions.map(([value, count]) => ({
    value,
    label: value,
    count,
  }));

  const visibleActors = useMemo(() => {
    for (const actor of actors) {
      if (!randomOrder.current.has(actor.id)) randomOrder.current.set(actor.id, Math.random());
    }
    const matching = actors.filter((actor) => {
      const movieGenres = new Set(actor.movies.flatMap((movie) => movie.genres?.map(({ name }) => name) ?? []));
      const movieYears = new Set(actor.movies.flatMap((movie) => movie.year ? [String(movie.year)] : []));
      const rating = actorAverageRating(actor);
      return (
        (!genres.length || genres.some((genre) => movieGenres.has(genre))) &&
        (!years.length || years.some((year) => movieYears.has(year))) &&
        (minRating === 0 || (rating !== null && rating >= minRating))
      );
    });
    const ratings = new Map(actors.map((actor) => [actor.id, actorAverageRating(actor)]));
    matching.sort((left, right) => {
      switch (sort) {
        case "nameAsc":
          return collator.compare(left.name, right.name);
        case "nameDesc":
          return collator.compare(right.name, left.name);
        case "moviesDesc":
          return right.movies.length - left.movies.length || collator.compare(left.name, right.name);
        case "ratingDesc":
          return (ratings.get(right.id) ?? -1) - (ratings.get(left.id) ?? -1)
            || collator.compare(left.name, right.name);
        default:
          return (randomOrder.current.get(left.id) ?? 0) - (randomOrder.current.get(right.id) ?? 0);
      }
    });
    return matching;
  }, [actors, collator, genres, minRating, sort, years]);

  const pageCount = Math.ceil(visibleActors.length / PAGE_SIZE);
  const pageActors = visibleActors.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const activeFilters = genres.length > 0 || years.length > 0 || minRating > 0 || sort !== "random";

  function resetFilters() {
    setSort("random");
    setGenres([]);
    setYears([]);
    setMinRating(0);
    setPage(0);
  }

  function setActorSort(value: string) {
    if (isActorSort(value)) {
      setSort(value);
      setPage(0);
    }
  }

  return (
    <section aria-label={t(kind)} className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
        <ActorSortMenu sort={sort} kind={kind} onChange={setActorSort} />
        <FacetButton
          label={t("genreFilter")}
          values={genres}
          allLabel={t("allGenres")}
          selectedCountLabel={t("selectedCount")}
          options={genreFacets}
          onChange={(values) => {
            setGenres(values);
            setPage(0);
          }}
        />
        <FacetButton
          label={t("yearFilter")}
          values={years}
          allLabel={t("allYears")}
          selectedCountLabel={t("selectedCount")}
          options={yearFacets}
          onChange={(values) => {
            setYears(values);
            setPage(0);
          }}
        />
        <RatingFacet
          label={t("ratingFilter")}
          allLabel={t("allRatings")}
          minRating={minRating}
          onChange={(rating) => {
            setMinRating(rating);
            setPage(0);
          }}
        />
        <button
          type="button"
          disabled={!activeFilters}
          onClick={resetFilters}
          className="min-h-10 rounded-lg border border-zinc-700 px-3 text-sm text-zinc-200 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-40"
        >
          {t("resetFilters")}
        </button>
        {pageCount > 1 && (
          <nav aria-label={t("pagination")} className="ml-auto flex items-center gap-2">
            <button type="button" disabled={!page} onClick={() => setPage(page - 1)} className="min-h-10 rounded-lg border border-zinc-700 px-3 disabled:opacity-40">{t("previousPage")}</button>
            <span aria-live="polite" className="text-sm text-zinc-300">{t("pageOf", { page: page + 1, total: pageCount })}</span>
            <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)} className="min-h-10 rounded-lg border border-zinc-700 px-3 disabled:opacity-40">{t("nextPage")}</button>
          </nav>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-6">
        {pageActors.map((actor) => (
          <button
            key={actor.id}
            type="button"
            onClick={() => onSelect(actor)}
            className="group min-w-0 rounded-xl text-left outline-none focus-visible:ring-4 focus-visible:ring-red-500 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-950"
            aria-label={t(kind === "actors" ? "openActor" : "openDirector", { name: actor.name })}
          >
            <div className="aspect-[2/3] overflow-hidden rounded-xl bg-zinc-800 shadow-lg transition duration-200 group-focus-visible:scale-105 group-hover:scale-[1.03]">
              {actor.profileUrl ? (
                <img src={actor.profileUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-5xl font-bold text-zinc-600">{actor.name.slice(0, 1)}</div>
              )}
            </div>
            <span className="mt-3 block truncate text-base font-semibold text-zinc-100">{actor.name}</span>
            <span className="mt-1 block text-sm text-zinc-400">{t("localFilmCount", { count: actor.movies.length })}</span>
          </button>
        ))}
      </div>
      {pageActors.length === 0 && (
        <p className="py-16 text-center text-zinc-400">
          {actors.length ? t("noFilterMatches") : t(kind === "actors" ? "noActors" : "noDirectors")}
        </p>
      )}
    </section>
  );
}
