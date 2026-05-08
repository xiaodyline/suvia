import assert from "node:assert/strict";
import {
  getMojibakeFilenameRepair,
  repairMojibakeFilename,
} from "../modules/files/filename-encoding.util.ts";
import { validateUploadedFile } from "../modules/files/files.validation.ts";
import type { IncomingUploadedFile } from "../modules/files/files.types.ts";

const toLatin1Mojibake = (value: string) => {
  return Buffer.from(value, "utf8").toString("latin1");
};

const createFile = (originalname: string): IncomingUploadedFile => ({
  originalname,
  mimetype: "text/markdown",
  size: 5,
  buffer: Buffer.from("hello"),
});

const run = () => {
  const chineseMarkdown = "需求文档.md";
  const chineseMarkdownMojibake = toLatin1Mojibake(chineseMarkdown);

  assert.equal(
    getMojibakeFilenameRepair(chineseMarkdownMojibake),
    chineseMarkdown
  );
  assert.equal(repairMojibakeFilename(chineseMarkdownMojibake), chineseMarkdown);
  assert.equal(repairMojibakeFilename(chineseMarkdown), chineseMarkdown);
  assert.equal(getMojibakeFilenameRepair(chineseMarkdown), null);

  assert.equal(repairMojibakeFilename("resume.md"), "resume.md");
  assert.equal(repairMojibakeFilename("résumé.md"), "résumé.md");
  assert.equal(repairMojibakeFilename("Â£.md"), "Â£.md");
  assert.equal(repairMojibakeFilename("bad�name.md"), "bad�name.md");

  assert.equal(
    validateUploadedFile(createFile(chineseMarkdownMojibake)).originalName,
    chineseMarkdown
  );
  assert.equal(validateUploadedFile(createFile("需求文档.pdf")).fileExt, "pdf");
  assert.equal(validateUploadedFile(createFile("需求文档.md")).fileExt, "md");
  assert.equal(
    validateUploadedFile(createFile("需求文档.markdown")).fileExt,
    "markdown"
  );

  console.log("filename encoding tests passed");
};

run();
