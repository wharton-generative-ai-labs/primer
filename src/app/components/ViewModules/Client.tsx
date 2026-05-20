'use client';

import { useMemo, useState, useTransition } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

import { Permission } from '@/config/auth';
import { usePermissions } from '@/app/hooks/usePermissions';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { ModuleCatalogEntry } from '@/app/lib/modules/types';
import { useCatalogListEnterGeneration } from '@/app/components/catalog/CatalogListEnterContext';
import { installModule } from '@/app/server-actions/catalog';
import { CatalogFilters as CatalogFiltersBar } from '@/app/components/catalog/CatalogFilters';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

interface ClientProps {
  initialModules: ModuleCatalogEntry[];
}

function kindBadgeVariant(kind?: string): BadgeVariant {
  switch (kind) {
    case 'template':
      return 'template';
    case 'meta':
      return 'meta';
    case 'debugger':
      return 'debugger';
    case 'bundled':
      return 'bundled';
    case 'user':
      return 'user';
    default:
      return 'recommended';
  }
}

function kindLabel(kind?: string): string | null {
  switch (kind) {
    case 'template':
      return 'Template';
    case 'meta':
      return 'Experience Creator';
    case 'debugger':
      return 'Debugger';
    case 'bundled':
      return 'Bundled';
    case 'user':
      return 'Experience';
    default:
      return null;
  }
}

export function Client({ initialModules }: ClientProps) {
  const { can } = usePermissions();
  const { toast } = useToast();
  const listEnterGen = useCatalogListEnterGeneration();
  const cardEnterInitial = listEnterGen === 0 ? false : { opacity: 0, y: 12 as const };
  const [isInstallPending, startInstallTransition] = useTransition();
  const [installingModuleId, setInstallingModuleId] = useState<string | null>(null);
  const [installPhase, setInstallPhase] = useState<'preparing' | 'installing' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredModules = useMemo(() => {
    const lower = searchQuery.toLowerCase();
    return initialModules.filter(
      (m) =>
        m.kind !== 'template' &&
        (m.title.toLowerCase().includes(lower) || m.description.toLowerCase().includes(lower)),
    );
  }, [initialModules, searchQuery]);

  const moduleTitleById = (id: string): string => {
    return initialModules.find((m) => m.id === id)?.title || id;
  };

  const installButtonLabel = (moduleId: string) => {
    if (installingModuleId !== moduleId) return 'Install';
    if (installPhase === 'preparing') return 'Preparing...';
    return 'Installing...';
  };

  const handleInstall = (moduleId: string) => {
    if (installingModuleId) return;
    setInstallingModuleId(moduleId);
    setInstallPhase('preparing');
    // Clear via finally so a thrown action doesn't leak the timer (the
    // previous version cleared inline, only running on the success path).
    const phaseTimer = window.setTimeout(() => setInstallPhase('installing'), 220);

    startInstallTransition(async () => {
      try {
        const result = await installModule(moduleId);

        if (!result.success) {
          toast({
            title: 'Install failed',
            description: result.error ?? 'Failed to install module',
            variant: 'destructive',
          });
          return;
        }

        const installedCount = result.result?.installed?.length || 0;
        const skippedCount = result.result?.skipped?.length || 0;
        toast({
          title: 'Module installed',
          description: `Installed ${installedCount} module(s)${
            skippedCount > 0 ? `, ${skippedCount} already present` : ''
          }.`,
        });
      } finally {
        window.clearTimeout(phaseTimer);
        setInstallingModuleId(null);
        setInstallPhase(null);
      }
    });
  };

  const renderModuleCard = (mod: ModuleCatalogEntry) => {
    const isInstalling = installingModuleId === mod.id;
    const anyMutation = !!installingModuleId || isInstallPending;
    const isBlocked = anyMutation && !isInstalling;
    const canManageInstall = can(Permission.UPLOAD_EXPERIENCE);

    return (
      <Card
        key={mod.id}
        className={cn(
          'flex w-full flex-col overflow-hidden p-0 transition-shadow duration-200 h-full',
          isBlocked && 'opacity-45',
          !isBlocked && 'hover:shadow-md',
        )}
      >
        <div className="relative h-[250px] w-full shrink-0 overflow-hidden border-b border-input bg-gradient-to-br from-muted to-muted/60">
          {mod.previewImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- intentional */
            <img
              src={mod.previewImageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-serif text-2xl italic text-muted-foreground select-none">No preview image</span>
            </div>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col gap-5 p-6 text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {mod.installed && <Badge variant="installed">Installed</Badge>}
              {
                mod.kind && (
                  <Badge variant={kindBadgeVariant(mod.kind)}>{kindLabel(mod.kind)}</Badge>
                )
              }
              {mod.author && <Badge variant="user">{mod.author}</Badge>}
              {mod.updateAvailable && <Badge variant="bundled">Update available</Badge>}
            </div>
            <Badge variant="secondary" className="shrink-0">
              v{mod.version}
            </Badge>
          </div>

          <div className="flex flex-1 flex-col gap-1.5">
            <CardTitle className="text-lg font-semibold leading-7">{mod.title}</CardTitle>
            <CardDescription className="line-clamp-2 text-base leading-6 text-muted-foreground">
              {mod.description}
            </CardDescription>
          </div>

          {mod.requires.length > 0 && (
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">
                Includes {mod.requires.length} {mod.requires.length === 1 ? 'Template' : 'Templates'}:
              </span>{' '}
              {mod.requires.map((r) => moduleTitleById(r)).join(', ')}
            </p>
          )}

          {canManageInstall && (
            <div className="flex items-center gap-2.5">
              {mod.installed ? (
                <Button variant="outline" size="lg" disabled>
                  Installed
                </Button>
              ) : (
                <Button onClick={() => handleInstall(mod.id)} size="lg" disabled={anyMutation}>
                  {isInstalling ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      {installButtonLabel(mod.id)}
                    </>
                  ) : (
                    'Install'
                  )}
                </Button>
              )}
            </div>
          )}

          {isInstalling && (
            <p className="text-xs font-medium text-muted-foreground">Fetching module assets</p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex w-full flex-col">
      <CatalogFiltersBar
        // The modules page doesn't expose the experience filters; we still
        // render the search input via this component for layout consistency.
        filters={{ templates: false, bundled: true, debug: false, mine: false }}
        onFiltersChange={() => {
          // Filters UI hidden on this page; search only.
        }}
        hasUser
        isAdmin={false}
        isTechnical={false}
        hasCatalogActivity={initialModules.length > 0}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search modules..."
        catalogControlsDisabled
        busy={!!installingModuleId}
        showInstallButton={false}
        showAdminButton={false}
      />


      {initialModules.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-16">
          <div className="flex flex-col items-center gap-7 rounded-lg border border-border bg-background p-10 text-center">
            <div className="flex flex-col gap-1.5">
              <p className="text-xl font-semibold text-foreground">No modules available.</p>
            </div>
          </div>
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-16">
          <div className="flex flex-col items-center gap-7 rounded-lg border border-border bg-background p-10 text-center">
            <div className="flex flex-col gap-1.5">
              <p className="text-xl font-semibold text-foreground">
                {searchQuery ? `No modules match "${searchQuery}".` : 'No modules found.'}
              </p>
              {searchQuery ? (
                <p className="text-base text-muted-foreground">Try adjusting your search.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {filteredModules.map((mod) => (
              <motion.div
                key={mod.id}
                initial={cardEnterInitial}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.18 }}
              >
                {renderModuleCard(mod)}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
