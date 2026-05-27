import { db, chapters } from "./packages/database/src/index.ts";
import { eq } from "drizzle-orm";

async function test() {
  try {
    const chapterId = "4e1ffcfc-e22a-4811-85a4-c7853e13abc4";
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, chapterId));
    console.log("Found chapter:", chapter?.title);

    await db.update(chapters).set({
      status: "confirmed",
      frozenAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(chapters.id, chapterId));
    console.log("Update OK");

    const { bus } = await import("./packages/agents/src/index.ts");
    bus.emit({ type: "chapter.committed", projectId: chapter.projectId, chapterId });
    console.log("Emit OK");
  } catch (err: any) {
    console.error("ERROR:", err.message);
    console.error(err.stack);
  }
  process.exit(0);
}
test();
