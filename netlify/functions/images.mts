import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

export default async (_request: Request, context: Context) => {
  const key = context.params.key;
  if (!key || !/^[a-f0-9-]{36}$/.test(key)) return new Response("Imagem inválida", { status: 400 });
  const image = await getStore({ name: "demand-images", consistency: "strong" }).get(key, { type: "blob" });
  if (!(image instanceof Blob)) return new Response("Imagem não encontrada", { status: 404 });
  return new Response(image, {
    headers: { "Content-Type": image.type || "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  });
};

export const config: Config = { path: "/api/images/:key" };
