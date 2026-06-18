'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Edit, Link2, MoreVertical, PlaySquare, PlusCircle, Trash2, Users } from 'lucide-react';

import { Permission } from '@/config/auth';
import { usePermissions } from '@/app/hooks/usePermissions';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Experience } from '@/app/lib/experiences/listExperiences';
import { deleteExperience } from '@/app/server-actions/catalog';
import { DeleteDialog } from '@/app/components/ExperienceList/DeleteDialog';
import { DetailsDialog } from '@/app/components/ExperienceList/DetailsDialog';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

function kindBadgeVariant(kind?: string): BadgeVariant {
  switch (kind) {
    case 'template': return 'template';
    case 'meta': return 'meta';
    case 'debugger': return 'debugger';
    case 'bundled': return 'bundled';
    case 'user': return 'user';
    default: return 'recommended';
  }
}

function kindLabel(kind?: string): string | null {
  switch (kind) {
    case 'template': return 'Template';
    case 'meta': return 'Experience Creator';
    case 'debugger': return 'Debugger';
    case 'bundled': return 'Experience';
    case 'user': return 'Experience';
    default: return null;
  }
}

export interface ExperienceCardProps {
  experience: Experience;
  userEmail?: string;
  copyLinkButton?: boolean;
  viewDetailsButton?: boolean;
  onCopyLink?: () => void;
  className?: string;
}

export function ExperienceCard({
  experience,
  userEmail,
  copyLinkButton = false,
  viewDetailsButton = true,
  onCopyLink,
  className,
}: ExperienceCardProps) {
  const { can } = usePermissions();
  const { toast } = useToast();
  const router = useRouter();

  const [isDeleting, setIsDeleting] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isAuthor = !!experience.authorEmail && experience.authorEmail === userEmail;
  const canEdit = can(Permission.EDIT_ANY_EXPERIENCE) || (can(Permission.EDIT_OWN_EXPERIENCE) && isAuthor);
  const canDelete = can(Permission.DELETE_EXPERIENCE) || isAuthor;
  const canManage = (can(Permission.MANAGE_ANY_CLASSES) || (can(Permission.MANAGE_OWN_CLASSES) && isAuthor))
    && experience.kind !== 'template'
    && experience.kind !== 'meta'
    && experience.kind !== 'debugger';
  const hasActions = canEdit || canDelete || canManage;

  const badges: { label: string; variant: BadgeVariant }[] = [];
  if (experience.kind === 'bundled') {
    if (experience.kind === 'bundled') badges.push({ label: 'Bundled', variant: 'bundled' });
  } else {
    const label = kindLabel(experience.kind);
    if (label) {
      badges.push({ label, variant: kindBadgeVariant(experience.kind) });
    }
  }

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setDeleteOpen(false);
    const result = await deleteExperience(experience.id);
    if (result.success) {
      toast({ title: 'Experience deleted', description: `"${experience.title}" has been deleted successfully.` });
    } else {
      toast({ title: 'Delete failed', description: result.error ?? 'Failed to delete experience', variant: 'destructive' });
    }
    setIsDeleting(false);
  };

  return (
    <>
      <Card className={cn('flex w-full flex-col overflow-hidden p-0 transition-shadow duration-200 h-full hover:shadow-md', className)}>
        <div className="relative h-[250px] w-full shrink-0 overflow-hidden border-b border-input bg-gradient-to-br from-muted to-muted/60">
          {experience.previewImageUrl ? (
            // Native img for lazy off-screen previews; next/image is unoptimized in next.config
            // eslint-disable-next-line @next/next/no-img-element -- see above
            <img
              src={experience.previewImageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-serif text-2xl italic text-muted-foreground">No preview</span>
            </div>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col gap-5 p-6 text-left">
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <Badge key={badge.label} variant={badge.variant}>{badge.label}</Badge>
              ))}
            </div>
          )}

          <div className="flex flex-1 flex-col gap-1.5">
            <CardTitle className="text-lg font-semibold leading-7">{experience.title}</CardTitle>
            {experience.description && (
              <CardDescription className="line-clamp-2 text-base leading-6 text-muted-foreground">
                {experience.description}
              </CardDescription>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <Button asChild size="lg">
              <Link href={`/play/${experience.id}`}>
                {experience.kind === 'meta'
                  ? <PlusCircle className="size-5" />
                  : <PlaySquare className="size-5" />
                }
                {experience.kind === 'meta' ? 'Create Experience' : 'Play Experience'}
              </Link>
            </Button>

            {copyLinkButton && (
              <Button variant="outline" size="icon" onClick={onCopyLink} aria-label="Copy share link">
                <Link2 />
              </Button>
            )}

            {
              viewDetailsButton && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setDetailsOpen(true)}
                >
                  View Details
                </Button>
              )
            }

            {hasActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto"
                    onClick={(e) => e.stopPropagation()}
                    disabled={isDeleting}
                    aria-label="Actions"
                  >
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canManage && (
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/manage/${experience.id}`); }}
                    >
                      <Users className="mr-2" />
                      Manage
                    </DropdownMenuItem>
                  )}
                  {canEdit && (
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/edit/${experience.id}`); }}
                    >
                      <Edit className="mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteOpen(true); }}
                      className="text-rose-800 focus:text-rose-800 dark:focus:text-rose-200 dark:text-rose-200 focus:bg-rose-100 cursor-pointer dark:focus:bg-rose-900"
                      disabled={isDeleting}
                    >
                      <Trash2 className="mr-2" />
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>

      <DetailsDialog
        open={detailsOpen}
        experience={experience}
        onOpenChange={setDetailsOpen}
      />
      <DeleteDialog
        open={deleteOpen}
        experienceTitle={experience.title}
        onOpenChange={setDeleteOpen}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
