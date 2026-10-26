import ProtectedRoute from "../../../src/components/ProtectedRoute";
import Placeholder from "../../../src/screens/Placeholder";

export default function DeppiPage() {
  return (
    <ProtectedRoute roles={["DEPPI"]}>
      <Placeholder />
    </ProtectedRoute>
  );
}
