import { docs, meta } from "../.source";
import { createMDXSource } from "fumadocs-mdx";
import { loader } from "fumadocs-core/source";
import { i18n } from "./i18n";

export const source = loader({
  baseUrl: "/docs",
  source: createMDXSource(docs, meta),
  i18n,
});
