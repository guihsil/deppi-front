import AdminHome from "../../../src/screens/AdminHome";
import ProtectedRoute from "../../../src/components/ProtectedRoute";

export default function AdminPage() {
  return (
    <ProtectedRoute roles={["ADMIN"]}>
      <AdminHome />
    </ProtectedRoute>
  );
}
