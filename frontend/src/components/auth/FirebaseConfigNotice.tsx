import { missingFirebaseEnvVars } from "../../lib/firebase";
import { StatusAlert } from "../ui/StatusAlert";

export function FirebaseConfigNotice() {
  if (missingFirebaseEnvVars.length === 0) {
    return null;
  }

  return (
    <StatusAlert
      variant="warning"
      title="Firebase Authentication Configuration Required"
    >
      <p>
        Real Google Sign-In and Email/Password authentication require your Firebase Web App keys in{" "}
        <code className="font-mono text-xs font-semibold">frontend/.env</code>. Simulated login is disabled.
      </p>
      <p className="mt-2 text-xs">
        Missing variables:{" "}
        <span className="font-mono font-medium">{missingFirebaseEnvVars.join(", ")}</span>
      </p>
      <p className="mt-2 text-xs">
        Follow <code className="font-mono font-medium">docs/FIREBASE_SETUP.md</code> to create the{" "}
        <strong>LIFE SIGNAL</strong> Firebase project, enable Google &amp; Email/Password sign-in providers, and
        configure <code className="font-mono font-medium">backend/.env</code> with your Firebase Admin SDK key.
      </p>
    </StatusAlert>
  );
}

