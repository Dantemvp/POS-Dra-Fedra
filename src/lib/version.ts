import packageJson from "../../package.json";

export const APP_VERSION = packageJson.version;
export const SERVICE_WORKER_URL = `/sw.js?v=${APP_VERSION}`;
