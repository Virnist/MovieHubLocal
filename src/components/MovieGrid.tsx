import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export interface MovieCard {
  id: string | number;
  title: string;
  year?: number;
  runtime?: number | null;
  voteAverage?: number;
  genres?: Array<{ id: number; name: string }>;
  posterUrl?: string | null;
}

const MOVIE_SORT_ORDERS = [
  "random",
  "titleAsc",
  "titleDesc",
  "yearDesc",
  "yearAsc",
  "ratingDesc",
  "runtimeAsc",
] as const;
type MovieSortOrder = (typeof MOVIE_SORT_ORDERS)[number];

const PAGE_SIZE = 48;

function isMovieSortOrder(value: string): value is MovieSortOrder {
  return MOVIE_SORT_ORDERS.some((order) => order === value);
}

function compareNumericValues(
  left: number | null | undefined,
  right: number | null | undefined,
  direction: 1 | -1,
): number {
  if (left == null) return right == null ? 0 : 1;
  if (right == null) return -1;
  return (left - right) * direction;
}

interface SortButtonProps {
  sortOrder: MovieSortOrder;
  onChange: (order: MovieSortOrder) => void;
}

function SortButton({ sortOrder, onChange }: SortButtonProps) {
  const { t } = useTranslation();

  return (
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold text-zinc-200 outline-none hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-red-500 [&::-webkit-details-marker]:hidden">
        <span>{t("sortBy")}:</span>
        <span>{t(`sortOption.${sortOrder}`)}</span>
        <span aria-hidden="true" className="text-zinc-400">▾</span>
      </summary>
      <div className="absolute left-0 top-full z-20 mt-2 min-w-56 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
        {MOVIE_SORT_ORDERS.map((order) => (
          <button
            type="button"
            key={order}
            aria-pressed={sortOrder === order}
            onClick={(event) => {
              onChange(order);
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
            className={`flex min-h-10 w-full items-center justify-between gap-4 rounded-md px-3 py-2 text-left text-sm outline-none hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-red-500 ${
              sortOrder === order ? "text-red-300" : "text-zinc-200"
            }`}
          >
            <span>{t(`sortOption.${order}`)}</span>
            {sortOrder === order && <span aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>
    </details>
  );
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export interface FacetButtonProps {
  label: string;
  values: string[];
  allLabel: string;
  selectedCountLabel: string;
  options: FacetOption[];
  onChange: (values: string[]) => void;
}

export function FacetButton({
  label,
  values,
  allLabel,
  selectedCountLabel,
  options,
  onChange,
}: FacetButtonProps) {
  const hasSelections = values.length > 0;
  return (
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold text-zinc-200 outline-none hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-red-500 [&::-webkit-details-marker]:hidden">
        <span>{label}:</span>
        <span className="max-w-40 truncate">
          {hasSelections ? selectedCountLabel.replace("{{count}}", String(values.length)) : allLabel}
        </span>
        <span aria-hidden="true" className="text-zinc-400">▾</span>
      </summary>
      <div className="absolute left-0 top-full z-20 mt-2 max-h-72 min-w-56 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
        <button
          type="button"
          disabled={!hasSelections}
          onClick={() => onChange([])}
          className="mb-1 w-full rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:text-zinc-500"
        >
          {allLabel}
        </button>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center justify-between gap-6 rounded-md px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            <span className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={values.includes(option.value)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...values, option.value]
                      : values.filter((value) => value !== option.value),
                  )
                }
                className="size-4 accent-red-600"
              />
              <span>{option.label}</span>
            </span>
            <span className="text-xs text-zinc-400">{option.count}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

interface RatingFacetProps {
  label: string;
  allLabel: string;
  minRating: number;
  onChange: (rating: number) => void;
}

export function RatingFacet({ label, allLabel, minRating, onChange }: RatingFacetProps) {
  const { t } = useTranslation();
  const isActive = minRating > 0;
  const displayedRating = minRating.toFixed(1);

  return (
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold text-zinc-200 outline-none hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-red-500 [&::-webkit-details-marker]:hidden">
        <span>{label}:</span>
        <span>{isActive ? `≥ ${displayedRating}/10` : allLabel}</span>
        <span aria-hidden="true" className="text-zinc-400">▾</span>
      </summary>
      <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-xl">
        <label htmlFor="minimum-rating" className="mb-3 flex justify-between text-sm text-zinc-200">
          <span>{t("minimumRating")}</span>
          <span className="font-semibold">{displayedRating}/10</span>
        </label>
        <input
          id="minimum-rating"
          type="range"
          min="0"
          max="10"
          step="0.1"
          value={minRating}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full accent-red-600"
        />
        <div className="mt-1 flex justify-between text-xs text-zinc-400">
          <span>0</span><span>10</span>
        </div>
        <button
          type="button"
          disabled={!isActive}
          onClick={() => onChange(0)}
          className="mt-3 min-h-10 rounded-md px-3 text-sm text-zinc-200 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:text-zinc-500"
        >
          {allLabel}
        </button>
      </div>
    </details>
  );
}

export interface MovieGridProps {
  movies: MovieCard[];
  onSelect: (movie: MovieCard) => void;
  onBack?: () => void;
}

export function MovieGrid({ movies, onSelect, onBack }: MovieGridProps) {
  const { t, i18n } = useTranslation();
  const imageLanguage = i18n.resolvedLanguage ?? i18n.language;
  const collator = useMemo(
    () => new Intl.Collator(imageLanguage, { sensitivity: "base", numeric: true }),
    [imageLanguage],
  );
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [sortOrder, setSortOrder] = useState<MovieSortOrder>("random");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [minimumRating, setMinimumRating] = useState(0);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const randomOrder = useRef(new Map<string | number, number>());

  useEffect(() => {
    setPage(0);
    setFocusedIndex(0);
  }, [movies]);

  const sortedMovies = useMemo(() => {
    for (const movie of movies) {
      if (!randomOrder.current.has(movie.id)) {
        randomOrder.current.set(movie.id, Math.random());
      }
    }

    return [...movies].sort((left, right) => {
      switch (sortOrder) {
        case "titleAsc":
          return collator.compare(left.title, right.title);
        case "titleDesc":
          return collator.compare(right.title, left.title);
        case "yearAsc":
          return compareNumericValues(left.year, right.year, 1)
            || collator.compare(left.title, right.title);
        case "yearDesc":
          return compareNumericValues(left.year, right.year, -1)
            || collator.compare(left.title, right.title);
        case "ratingDesc":
          return compareNumericValues(left.voteAverage, right.voteAverage, -1)
            || collator.compare(left.title, right.title);
        case "runtimeAsc":
          return compareNumericValues(left.runtime, right.runtime, 1)
            || collator.compare(left.title, right.title);
        default:
          return (randomOrder.current.get(left.id) ?? 0) - (randomOrder.current.get(right.id) ?? 0);
      }
    });
  }, [collator, movies, sortOrder]);

  const genreOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const movie of movies) {
      for (const genre of new Set(movie.genres?.map(({ name }) => name) ?? [])) {
        counts.set(genre, (counts.get(genre) ?? 0) + 1);
      }
    }
    return [...counts].sort(([left], [right]) => collator.compare(left, right))
      .map(([value, count]) => ({ value, label: value, count }));
  }, [collator, movies]);
  const yearOptions = useMemo(() => {
    const counts = new Map<number, number>();
    for (const movie of movies) {
      if (movie.year) counts.set(movie.year, (counts.get(movie.year) ?? 0) + 1);
    }
    return [...counts].sort(([left], [right]) => right - left)
      .map(([year, count]) => ({ value: String(year), label: String(year), count }));
  }, [movies]);
  const availableGenres = genreOptions.map(({ value }) => value);
  const availableYears = yearOptions.map(({ value }) => value);
  const filteredMovies = sortedMovies.filter((movie) => {
    const matchesGenre =
      selectedGenres.length === 0 ||
      movie.genres?.some(({ name }) => selectedGenres.includes(name));
    const matchesYear =
      selectedYears.length === 0 || selectedYears.includes(String(movie.year ?? ""));
    const matchesRating =
      minimumRating === 0 ||
      (typeof movie.voteAverage === "number" && movie.voteAverage >= minimumRating);
    return matchesGenre && matchesYear && matchesRating;
  });

  const pageCount = Math.ceil(filteredMovies.length / PAGE_SIZE);
  const visibleMovies = filteredMovies.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setSelectedGenres((selected) => selected.filter((genre) => availableGenres.includes(genre)));
    setSelectedYears((selected) => selected.filter((year) => availableYears.includes(year)));
  }, [movies]);

  useEffect(() => {
    cardRefs.current[focusedIndex]?.focus();
  }, [focusedIndex, page]);

  function changePage(nextPage: number) {
    setPage(Math.max(0, Math.min(nextPage, pageCount - 1)));
    setFocusedIndex(0);
  }

  function resetFilters() {
    setSortOrder("random");
    setSelectedGenres([]);
    setSelectedYears([]);
    setMinimumRating(0);
    setPage(0);
    setFocusedIndex(0);
  }

  const hasActivePreferences =
    sortOrder !== "random" ||
    selectedGenres.length > 0 ||
    selectedYears.length > 0 ||
    minimumRating > 0;

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && event.target instanceof Element) {
      const openFacet = event.target.closest("details[open]");
      if (openFacet) {
        openFacet.removeAttribute("open");
        event.preventDefault();
        return;
      }
    }
    if (event.key === "Escape" || event.key === "Backspace") {
      if (onBack) {
        event.preventDefault();
        onBack();
      }
      return;
    }

    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      return;
    }

    const current = cardRefs.current[focusedIndex];
    if (!current || event.target !== current) return;

    const currentRect = current.getBoundingClientRect();
    const currentX = currentRect.left + currentRect.width / 2;
    const currentY = currentRect.top + currentRect.height / 2;
    const direction = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    }[event.key];

    if (!direction) return;

    const next = cardRefs.current
      .map((element, index) => {
        if (!element || index === focusedIndex) return null;
        const rect = element.getBoundingClientRect();
        const dx = rect.left + rect.width / 2 - currentX;
        const dy = rect.top + rect.height / 2 - currentY;
        const primary = dx * direction.x + dy * direction.y;

        if (primary <= 0) return null;
        const cross = Math.abs(dx * direction.y - dy * direction.x);
        return { index, score: primary + cross * 2 };
      })
      .filter((candidate): candidate is { index: number; score: number } => candidate !== null)
      .sort((left, right) => left.score - right.score)[0];

    if (next) {
      event.preventDefault();
      setFocusedIndex(next.index);
    }
  }

  return (
    <section
      aria-label={t("collection")}
      className="outline-none"
      onKeyDown={handleKeyDown}
    >
      {movies.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
          <SortButton
            sortOrder={sortOrder}
            onChange={(order) => {
              if (!isMovieSortOrder(order)) return;
              setSortOrder(order);
              setPage(0);
              setFocusedIndex(0);
            }}
          />
          <FacetButton
            label={t("genreFilter")}
            values={selectedGenres}
            allLabel={t("allGenres")}
            selectedCountLabel={t("selectedCount")}
            options={genreOptions}
            onChange={(values) => {
              setSelectedGenres(values);
              setPage(0);
              setFocusedIndex(0);
            }}
          />
          <FacetButton
            label={t("yearFilter")}
            values={selectedYears}
            allLabel={t("allYears")}
            selectedCountLabel={t("selectedCount")}
            options={yearOptions}
            onChange={(values) => {
              setSelectedYears(values);
              setPage(0);
              setFocusedIndex(0);
            }}
          />
          <RatingFacet
            label={t("ratingFilter")}
            allLabel={t("allRatings")}
            minRating={minimumRating}
            onChange={(rating) => {
              setMinimumRating(rating);
              setPage(0);
              setFocusedIndex(0);
            }}
          />
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasActivePreferences}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-zinc-200 outline-none hover:border-zinc-500 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span aria-hidden="true">↺</span>
            {t("resetFilters")}
          </button>
          {pageCount > 1 && (
            <nav aria-label={t("pagination")} className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => changePage(page - 1)}
                disabled={page === 0}
                className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-zinc-200 outline-none hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("previousPage")}
              </button>
              <span aria-live="polite" className="whitespace-nowrap text-sm text-zinc-300">
                {t("pageOf", { page: page + 1, total: pageCount })}
              </span>
              <button
                type="button"
                onClick={() => changePage(page + 1)}
                disabled={page >= pageCount - 1}
                className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm font-semibold text-zinc-200 outline-none hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("nextPage")}
              </button>
            </nav>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-6">
        {visibleMovies.map((movie, index) => (
          <button
            key={movie.id}
            ref={(element) => {
              cardRefs.current[index] = element;
            }}
            type="button"
            tabIndex={focusedIndex === index ? 0 : -1}
            onFocus={() => setFocusedIndex(index)}
            onClick={() => onSelect(movie)}
            className="group min-w-0 rounded-xl text-left outline-none focus-visible:ring-4 focus-visible:ring-red-500 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-950"
            aria-label={t("openMovie", {
              title: movie.title,
              year: movie.year ? `, ${movie.year}` : "",
            })}
          >
            <div className="aspect-[2/3] overflow-hidden rounded-xl bg-zinc-800 shadow-lg transition duration-200 group-focus-visible:scale-105 group-hover:scale-[1.03]">
              {movie.posterUrl ? (
                <img
                  src={movie.posterUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-4 text-center text-sm text-zinc-400">
                  {t("posterUnavailable")}
                </div>
              )}
            </div>
            <span className="mt-3 block truncate text-base font-semibold text-zinc-100">
              {movie.title}
            </span>
            {movie.year && (
              <span className="mt-1 block text-sm text-zinc-400">{movie.year}</span>
            )}
          </button>
        ))}
      </div>
      {movies.length > 0 && filteredMovies.length === 0 && (
        <p className="py-16 text-center text-zinc-400">{t("noFilterMatches")}</p>
      )}
      {movies.length === 0 && (
        <p className="py-16 text-center text-zinc-400">{t("noMovies")}</p>
      )}
    </section>
  );
}
