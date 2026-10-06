declare namespace Cloudflare {
  interface Env {
    VISION_API_KEY?: string;
    VISION_API_URL?: string;
    VISION_MODEL?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
