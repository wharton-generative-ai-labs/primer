import { getCachedSession } from "@/lib/getCachedSession";
import { Permission } from "@/config/auth";

/**
 * Static hero for the experiences catalog. Rendered above any Suspense boundary
 * so the headline streams immediately while `listExperiences` runs.
 */
export async function Intro() {
  const session = await getCachedSession();
  const privileges = session?.user?.privileges ?? [];

  return (
    <div className="mb-4 w-full px-6 pb-5 pt-1 text-center">
      <h2 className="font-serif font-bold text-3xl text-brand md:text-4xl">
        Choose an experience to begin.
      </h2>

      <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-foreground">
        {
          privileges.includes(Permission.ADMIN_USERS) ?
            "Create guided learning experiences or play existing ones."
          : "Each experience is designed for a different learning goal."
        }
      </p>
    </div>
  );
}
