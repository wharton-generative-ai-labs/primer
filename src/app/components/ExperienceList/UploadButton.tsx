'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { revalidateExperiencesAction } from '@/app/server-actions/catalog';

interface UploadButtonProps {
  /** Disable the button while another long-running catalog action is in flight. */
  disabled?: boolean;
}

/**
 * "Install Experience" button — opens a hidden file picker, POSTs the chosen
 * `.zip` to the existing `/api/upload` endpoint, then revalidates the catalog.
 */
export function UploadButton({ disabled }: UploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast({
        title: 'Invalid file type',
        description: `${file.name} is not a .zip file.`,
        variant: 'destructive',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch('/api/upload', { method: 'POST', body: file });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Upload failed');
      }

      toast({
        title: 'Experience installed',
        description: `${file.name} was uploaded successfully.`,
      });

      await revalidateExperiencesAction();
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Unable to install experience.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isUploading}
      >
        {isUploading ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}
        {isUploading ? 'Uploading...' : 'Install Experience'}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        onChange={handleFileSelect}
        className="hidden"
      />
    </>
  );
}
