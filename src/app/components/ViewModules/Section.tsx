import { getModuleCatalog } from '@/app/lib/modules/ModuleService';
import { Client } from './Client';

/**
 * Server component that awaits `getModuleCatalog` and is intended to be
 * wrapped in `<Suspense>` so the page intro can stream first.
 */
export default async function Section() {
  const modules = await getModuleCatalog();
  return <Client initialModules={modules} />;
}
