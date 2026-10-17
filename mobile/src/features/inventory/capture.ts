/**
 * Getting an invoice off the phone, which is the shared capture flow with an
 * invoice's own compression profile and filename.
 *
 * The three routes in - camera, camera roll, PDF - are the same ones a
 * compliance certificate arrives by, so they live in features/files/capture.
 * What is specific to an invoice is how hard its photographs are squeezed:
 * see utils/media.ts, where INVOICE is the most generous profile because an
 * invoice is read character by character and an avatar never is.
 */
import {captureFile, type CaptureSource} from '../files/capture';
import {INVOICE, type PreparedFile} from '../../utils/media';

export {PermissionDenied, describePermissionDenied} from '../files/capture';
export type {CaptureSource} from '../files/capture';

/** Returns the chosen file ready to upload, or null if the user backed out. */
export function captureInvoice(source: CaptureSource): Promise<PreparedFile | null> {
  return captureFile(source, {profile: INVOICE, name: 'invoice.jpg'});
}
