import ProtectedRoute from "@/src/components/ProtectedRoute";
import ProfessorCourses from "@/src/screens/ProfessorCourses";

export default function ProfessorPage() {
  return (
    <ProtectedRoute roles={["PROFESSOR"]}>
      <ProfessorCourses />
    </ProtectedRoute>
  );
}
