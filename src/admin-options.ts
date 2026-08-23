/**
 * How a generated package is told which Firebase project to talk to.
 *
 * A plain structural interface, duplicated today into the `firebase-admin.ts`
 * runtime of every generated backend package. The accessors that read it —
 * `getAdminApp` and the `admin.*` surface around it — stay inside those
 * packages, so nothing here depends on `firebase-admin`.
 */
export interface AdminOptions {
  credential?: string | null;
  projectId?: string | null;
  databaseURL?: string | null;
  storageBucket?: string | null;
  serviceAccountId?: string | null;
  appName?: string | null;
}
