/** Stub: DASH (blob) streams not supported in CLI. */
export class DashDownloader {
    async downloadDashStream() {
        throw new Error('DASH streams are not supported in the CLI');
    }
}
