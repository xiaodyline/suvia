declare module "ali-oss" {
  import type { Readable } from "node:stream";

  type ClientOptions = {
    region: string;
    bucket: string;
    accessKeyId: string;
    accessKeySecret: string;
  };

  type PutOptions = {
    headers?: Record<string, string>;
  };

  type PutResult = {
    name: string;
    url: string;
  };

  type GetStreamResult = {
    stream: Readable;
  };

  type SignatureUrlOptions = {
    expires?: number;
    method?: string;
    response?: Record<string, string>;
  };

  export default class OSS {
    constructor(options: ClientOptions);

    put(
      name: string,
      file: Buffer | Uint8Array | string,
      options?: PutOptions
    ): Promise<PutResult>;

    getStream(name: string): Promise<GetStreamResult>;

    signatureUrl(name: string, options?: SignatureUrlOptions): string;
  }
}
