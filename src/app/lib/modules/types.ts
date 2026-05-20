export interface ModuleEntry {
  title: string;
  description: string;
  version: string;
  kind: string;
  author: string;
  requires: string[];
  sha256: string;
  url: string;
}

export interface ModuleManifest {
  version: string;
  modules: Record<string, ModuleEntry>;
}

export interface ModuleCatalogEntry extends ModuleEntry {
  id: string;
  installed: boolean;
  installedVersion: string | null;
  updateAvailable: boolean;
  previewImageUrl?: string;
}

export interface InstallResult {
  installed: string[];
  skipped: string[];
  errors: Array<{ moduleId: string; error: string }>;
}
