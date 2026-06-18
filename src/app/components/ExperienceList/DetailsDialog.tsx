'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ReadmeContent } from '@/app/components/ReadmeContent';
import type { Experience } from '@/app/lib/experiences/listExperiences';
import { formatRelativeTime } from '@/app/lib/catalog/formatRelativeTime';
import { PlusCircle, PlaySquare } from 'lucide-react';

interface DetailsDialogProps {
  open: boolean;
  experience: Experience | null;
  onOpenChange: (open: boolean) => void;
}

export function DetailsDialog({
  open,
  experience,
  onOpenChange,
}: DetailsDialogProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        {experience ? (
          <motion.div
            className="flex flex-col min-h-0 flex-1"
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {/* Hero image — close button overlaid with a backdrop so it's always readable */}
            <div className="relative h-[250px] shrink-0 border-b border-border bg-cover bg-center bg-muted"
              style={
                experience.previewImageUrl
                  ? { backgroundImage: `url(${experience.previewImageUrl})` }
                  : undefined
              }
            >
              {experience.previewImageUrl && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              )}
            </div>

            {/* Scrollable body */}
            <div className="flex flex-col gap-6 p-6 overflow-y-auto flex-1">
              <DialogHeader className="space-y-2.5">
                <DialogTitle className="text-2xl leading-8">{experience.title}</DialogTitle>
                <DialogDescription className="text-base leading-7 text-foreground">
                  {experience.description}
                </DialogDescription>
                <p className="text-sm text-muted-foreground">
                  {[
                    `Version ${experience.version}`,
                    experience.author && `By ${experience.author}`,
                    experience.lastModified &&
                      `Last modified ${formatRelativeTime(experience.lastModified)}`,
                  ]
                    .filter(Boolean)
                    .join('  |  ')}
                </p>
              </DialogHeader>

              {experience.hasReadme ? (
                <>
                  <hr className="border-border" />
                  <ReadmeContent
                    experienceId={experience.id}
                    theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
                  />
                </>
              ) : null}
            </div>

            {/* Sticky footer */}
            <div className="flex items-center justify-end border-t border-border px-6 py-4 shrink-0 bg-background">
              <Button asChild>
                <Link href={`/play/${experience.id}`}>
                  {
                    experience.kind === 'meta' ? <PlusCircle className="size-5" /> : <PlaySquare className="size-5" />
                  }
                  {experience.kind === 'meta' ? 'Create Experience' : 'Play Experience'}
                </Link>
              </Button>
            </div>
          </motion.div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
