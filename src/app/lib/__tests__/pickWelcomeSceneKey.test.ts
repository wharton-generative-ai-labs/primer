import { pickWelcomeSceneKey } from "@/app/lib/pickWelcomeSceneKey";

describe("pickWelcomeSceneKey", () => {
  it("prefers creator_welcome when present", () => {
    expect(
      pickWelcomeSceneKey(["blank", "welcome", "creator_welcome", "other"]),
    ).toBe("creator_welcome");
  });

  it("uses welcome* prefix before substring match", () => {
    expect(pickWelcomeSceneKey(["blank", "welcome_hero", "x_welcome_y"])).toBe(
      "welcome_hero",
    );
  });

  it("falls back to any key containing welcome", () => {
    expect(pickWelcomeSceneKey(["blank", "intro", "foo_welcome_bar"])).toBe(
      "foo_welcome_bar",
    );
  });

  it("returns undefined when nothing matches", () => {
    expect(pickWelcomeSceneKey(["blank", "intro"])).toBeUndefined();
  });
});
