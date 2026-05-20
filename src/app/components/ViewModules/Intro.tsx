/**
 * Static hero for the module registry. Mirrors `@/app/components/ExperienceList/Intro`
 * so the modules route has the same top-of-page rhythm as the experiences page.
 */
export async function Intro() {
  return (
    <div className="mb-4 w-full px-6 pb-5 pt-1 text-center">
      <h2 className="font-serif font-bold text-3xl text-brand md:text-4xl">Module Registry</h2>
      <p className="mx-auto mt-3 max-w-2xl text-lg leading-7 text-foreground">
        Browse installable modules and pull new experiences into the catalog.
      </p>
    </div>
  );
}
