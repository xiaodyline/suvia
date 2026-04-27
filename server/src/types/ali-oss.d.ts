declare module "ali-oss" {
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

  export default class OSS {
    constructor(options: ClientOptions);

    put(
      name: string,
      file: Buffer | Uint8Array | string,
      options?: PutOptions
    ): Promise<PutResult>;
  }
}
