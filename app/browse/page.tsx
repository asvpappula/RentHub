"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiFilter, FiSearch, FiPackage, FiX } from "react-icons/fi";
import type { Item } from "@/types";
import { CATEGORIES } from "@/types";
import ItemCard from "@/components/ItemCard";
import EmptyState from "@/components/EmptyState";
import Button from "@/components/ui/Button";
import { ItemCardSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

function BrowseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const sort = searchParams.get("sort") ?? "newest";
  const page = Number(searchParams.get("page") ?? 1);

  const [searchInput, setSearchInput] = useState(search);

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      if (!("page" in updates)) params.delete("page");
      router.push(`/browse?${params.toString()}`);
    },
    [router, searchParams]
  );

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    params.set("sort", sort);
    params.set("page", String(page));

    fetch(`/api/items?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      })
      .finally(() => setLoading(false));
  }, [search, category, minPrice, maxPrice, sort, page]);

  const hasFilters = category || minPrice || maxPrice;

  const filterPanel = (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-700">Category</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setParam({ category: category === c ? null : c })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                category === c
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-slate-200 text-slate-600 hover:border-primary-300"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">Daily rate</h3>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder="Min $"
            defaultValue={minPrice}
            onBlur={(e) => setParam({ minPrice: e.target.value || null })}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-primary-500 focus:outline-none"
          />
          <span className="text-slate-400">–</span>
          <input
            type="number"
            min={0}
            placeholder="Max $"
            defaultValue={maxPrice}
            onBlur={(e) => setParam({ maxPrice: e.target.value || null })}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
      </div>

      {hasFilters && (
        <button
          onClick={() =>
            setParam({ category: null, minPrice: null, maxPrice: null })
          }
          className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline"
        >
          <FiX className="h-3.5 w-3.5" /> Clear filters
        </button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Search bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParam({ search: searchInput || null });
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <FiSearch className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="What do you need? Drill, camera, tent…"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <Button type="submit">Search</Button>
        <Button
          type="button"
          variant="outline"
          className="lg:hidden"
          onClick={() => setFiltersOpen(true)}
        >
          <FiFilter className="h-4 w-4" />
        </Button>
      </form>

      <div className="mt-6 flex gap-8">
        {/* Desktop filters */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            {filterPanel}
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {loading ? "Searching…" : `${total} item${total === 1 ? "" : "s"} available`}
            </p>
            <select
              value={sort}
              onChange={(e) => setParam({ sort: e.target.value })}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-600 focus:outline-none"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low → high</option>
              <option value="price_desc">Price: high → low</option>
              <option value="rating">Top rated</option>
            </select>
          </div>

          {loading ? (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ItemCardSkeleton key={i} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={<FiPackage className="h-6 w-6" />}
                title="No items found"
                description="Try a different search, or clear your filters. New items are listed every day."
              />
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setParam({ page: String(page - 1) })}
                  >
                    Previous
                  </Button>
                  <span className="px-3 text-sm text-slate-500">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setParam({ page: String(page + 1) })}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile bottom-sheet filters */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 animate-fade-in-up rounded-t-2xl bg-white p-6 pb-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Filters</h2>
              <button
                onClick={() => setFiltersOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
            {filterPanel}
            <Button className="mt-6 w-full" onClick={() => setFiltersOpen(false)}>
              Show results
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense>
      <BrowseContent />
    </Suspense>
  );
}
