import fs from 'fs';
import zlib from 'zlib';

export const key = 'gzip';

export async function compressTo(src: string, dest: string, isText: boolean): Promise<boolean> {

  const buffer = fs.readFileSync(src);
  const resultBuffer = zlib.gzipSync(buffer);

  // Don't actually create the file if it would be bigger
  if (resultBuffer.length < buffer.length) {
    fs.writeFileSync(dest, resultBuffer);
    return true;
  } else {
    return false;
  }

}
