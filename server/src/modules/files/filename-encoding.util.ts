import path from "node:path";

const REPLACEMENT_CHARACTER = "\uFFFD";
const C1_CONTROL_RANGE_PATTERN = /[\u0080-\u009f]/u;
const COMMON_UTF8_MOJIBAKE_PATTERN =
  /[\u00c3\u00c2\u00e2\u00e4\u00e5\u00e6\u00e7\u00e8\u00e9\u00ef][\u0080-\u00ff]?/u;
const CJK_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
const OUTSIDE_LATIN1_PATTERN = /[^\u0000-\u00ff]/u;

const hasSameExtension = (left: string, right: string) => {
  return path.extname(left).toLowerCase() === path.extname(right).toLowerCase();
};

const looksLikeLatin1DecodedUtf8 = (value: string) => {
  return (
    C1_CONTROL_RANGE_PATTERN.test(value) ||
    COMMON_UTF8_MOJIBAKE_PATTERN.test(value)
  );
};

export const getMojibakeFilenameRepair = (filename: string) => {
  if (
    !filename ||
    filename.includes(REPLACEMENT_CHARACTER) ||
    OUTSIDE_LATIN1_PATTERN.test(filename) ||
    !looksLikeLatin1DecodedUtf8(filename)
  ) {
    return null;
  }

  const repaired = Buffer.from(filename, "latin1")
    .toString("utf8")
    .normalize("NFC");

  if (
    repaired === filename ||
    !repaired ||
    repaired.includes(REPLACEMENT_CHARACTER) ||
    repaired.includes("\0") ||
    /[\\/]/.test(repaired) ||
    !CJK_PATTERN.test(repaired) ||
    !hasSameExtension(filename, repaired)
  ) {
    return null;
  }

  return repaired;
};

export const repairMojibakeFilename = (filename: string) => {
  return getMojibakeFilenameRepair(filename) ?? filename;
};
