import path from 'path';
import type { CommandLineOptions } from "command-line-args";

import { generateOrLoadPublishId } from "../util/publish-id.js";
import { loadConfigFile } from "../load-config.js";
import { getKVStoreKeys, kvStoreDeleteFile } from "../util/kv-store.js";
import { FastlyApiContext, loadApiKey } from "../util/fastly-api.js";
import { getKVStoreKeysFromMetadata } from "../../util/metadata.js";
import { ContentAssetMetadataMap } from "../../types/index.js";

type StaticsMetadataModule = {
  kvStoreName: string | null,
  contentAssetMetadataMap: ContentAssetMetadataMap,
};

export async function cleanKVStore(commandLineValues: CommandLineOptions) {

  const { publishId } = generateOrLoadPublishId();

  const errors: string[] = [];
  const { normalized: config } = await loadConfigFile(errors);

  if (config == null) {
    console.error("❌ Can't load static-publish.rc.js");
    console.error("Run this from a compute-js-static-publish compute-js directory.");
    for (const error of errors) {
      console.error(error);
    }
    process.exitCode = 1;
    return;
  }

  let fastlyApiContext: FastlyApiContext | null = null;

  const apiKeyResult = loadApiKey();
  if (apiKeyResult == null) {
    console.error("❌ Fastly API Token not provided.");
    console.error("Specify one on the command line, or use the FASTLY_API_TOKEN environment variable.");
    process.exitCode = 1;
    return;
  }

  fastlyApiContext = { apiToken: apiKeyResult.apiToken };

  const staticsMetadata: StaticsMetadataModule = await import(path.resolve('./src/statics-metadata.js'));

  const { kvStoreName, contentAssetMetadataMap } = staticsMetadata;

  if (kvStoreName == null) {
    console.error("❌ KV Store not specified.");
    console.error("This only has meaning in KV Store mode.");
    process.exitCode = 1;
    return;
  }

  // TODO: Enable getting kvStoreName and publishId from command line

  // These are the items that are currently in the KV Store and that belong to this publish ID.
  const items = ((await getKVStoreKeys(fastlyApiContext, kvStoreName)) ?? [])
    .filter(x => x.startsWith(`${publishId}:`));

  // These are the items that are currently are being used.
  const keys = getKVStoreKeysFromMetadata(contentAssetMetadataMap);

  // So these are the items that we should be deleting.
  const itemsToDelete = items.filter(x => !keys.has(x));

  console.log("Publish ID: " + publishId);
  console.log("KV Store contains " + items.length + " item(s) for this publish ID.");
  console.log("Current site metadata contains " + keys.size + " item(s) (including compressed alternates).");

  console.log("Number of items to delete: " + itemsToDelete.length);

  for (const [index, item] of itemsToDelete.entries()) {
    console.log("Deleting item [" + (index+1) + "]: " + item);
    await kvStoreDeleteFile(fastlyApiContext, kvStoreName, item);
  }

  console.log("✅ Completed.")
}
