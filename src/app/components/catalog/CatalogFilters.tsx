'use client';

import { type ChangeEvent, type Ref } from 'react';
import { Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { type CatalogFilters } from '@/app/lib/catalog/filterStorage';
import { UploadButton } from '@/app/components/ExperienceList/UploadButton';

interface CatalogFiltersProps {
  filters: CatalogFilters;
  /** Update filter toggles without a server round-trip (client-only for the experiences catalog). */
  onFiltersChange: (next: Partial<CatalogFilters>) => void;
  /** True if the current user is signed in (has an email). Gates the "mine" filter. */
  hasUser: boolean;
  isAdmin: boolean;
  isTechnical: boolean;
  /** True if the catalog has any visible activity (experiences/searches/filters). */
  hasCatalogActivity: boolean;
  searchQuery: string;
  onSearchChange: (next: string) => void;
  searchInputRef?: Ref<HTMLInputElement>;
  onSearchKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  searchPlaceholder: string;
  /** Hide filter/upload/admin controls (e.g. when on the modules page). */
  catalogControlsDisabled?: boolean;
  /** Disable interactions while another mutation is running. */
  busy?: boolean;
  /** Show the "Install Experience" button. */
  showInstallButton: boolean;
  /** Show the Admin link. */
  showAdminButton: boolean;
}

function activeFilterCount(filters: CatalogFilters): number {
  return (
    Number(filters.templates) +
    Number(filters.bundled) +
    Number(filters.debug) +
    Number(filters.mine)
  );
}

export function CatalogFilters({
  filters,
  onFiltersChange,
  hasUser,
  isAdmin,
  isTechnical,
  hasCatalogActivity,
  searchQuery,
  onSearchChange,
  searchInputRef,
  onSearchKeyDown,
  searchPlaceholder,
  catalogControlsDisabled = false,
  busy = false,
  showInstallButton,
  showAdminButton,
}: CatalogFiltersProps) {
  const count = activeFilterCount(filters);
  const disabled = busy;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 justify-center">
      {hasCatalogActivity && (
        <div className="relative w-full sm:w-64">
          <Input
            ref={searchInputRef}
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
            onKeyDown={onSearchKeyDown}
            disabled={disabled}
            className="pr-9"
          />
          {searchQuery ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          )}
        </div>
      )}
      {!catalogControlsDisabled && showInstallButton && (
        <UploadButton disabled={disabled} />
      )}
      {!catalogControlsDisabled && (hasUser || isAdmin) && hasCatalogActivity && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" title="View options" size="lg" disabled={disabled}>
              <SlidersHorizontal className="size-5" />
              Filter
              {count > 0 && (
                <span className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 text-sm font-bold">
                  {count}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {hasUser && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Filter</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  className="cursor-pointer"
                  checked={filters.mine}
                  onCheckedChange={(checked) => onFiltersChange({ mine: !!checked })}
                >
                  My Experiences Only
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel className="text-xs text-muted-foreground">Include</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              className="cursor-pointer"
              checked={filters.bundled}
              onCheckedChange={(checked) => onFiltersChange({ bundled: !!checked })}
            >
              Bundled
            </DropdownMenuCheckboxItem>
            {isTechnical && (
              <DropdownMenuCheckboxItem
                className="cursor-pointer"
                checked={filters.debug}
                onCheckedChange={(checked) => onFiltersChange({ debug: !!checked })}
              >
                Debugger
              </DropdownMenuCheckboxItem>
            )}
            {isAdmin && (
              <DropdownMenuCheckboxItem
                className="cursor-pointer"
                checked={filters.templates}
                onCheckedChange={(checked) => onFiltersChange({ templates: !!checked })}
              >
                Templates
              </DropdownMenuCheckboxItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {!catalogControlsDisabled && showAdminButton && (
        <Button
          asChild
          variant="outline"
          size="lg"
          title="Manage users and permissions"
          disabled={disabled}
        >
          <a href="/admin/users">
            <ShieldCheck className="size-5" />
            Admin
          </a>
        </Button>
      )}
    </div>
  );
}
