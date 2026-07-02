import { mkdir } from "node:fs/promises";
import path from "node:path";

const DEFAULT_FOLDER_PREFIX = "箱单";
const BEIJING_TIME_ZONE = "Asia/Shanghai";
const MAX_UNIQUE_DIRECTORY_ATTEMPTS = 1000;

export async function preparePackingListRunDownloadDirectory(baseDirectory, options = {}) {
  const selectedDownloadDirectory = path.resolve(String(baseDirectory || "").trim());
  if (!selectedDownloadDirectory) {
    const error = new Error("Please choose a packing list PDF download directory first.");
    error.statusCode = 400;
    throw error;
  }

  await mkdir(selectedDownloadDirectory, { recursive: true });

  const folderBaseName = String(options.folderBaseName || formatPackingListRunFolderName(options.date)).trim();
  const downloadFolderName = await createUniqueChildDirectory(selectedDownloadDirectory, folderBaseName);
  const downloadDirectory = path.join(selectedDownloadDirectory, downloadFolderName);

  return {
    selectedDownloadDirectory,
    downloadDirectory,
    downloadFolderName,
  };
}

export function formatPackingListRunFolderName(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BEIJING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${DEFAULT_FOLDER_PREFIX}-${values.year}${values.month}${values.day}`;
}

async function createUniqueChildDirectory(parentDirectory, baseName) {
  for (let index = 0; index < MAX_UNIQUE_DIRECTORY_ATTEMPTS; index += 1) {
    const folderName = index === 0 ? baseName : `${baseName}-${index}`;
    try {
      await mkdir(path.join(parentDirectory, folderName));
      return folderName;
    } catch (error) {
      if (error?.code === "EEXIST") {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Could not create a unique packing list download folder under ${parentDirectory}.`);
}
