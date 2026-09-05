import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import StudentDashboard from "./pages/StudentDashboard";
import ResumeScanner from "./pages/ResumeScanner";
import StudyAssistant from "./pages/StudyAssistant";
import MySchedule from "./pages/MySchedule";
import StudentInterventions from "./pages/StudentInterventions";
import MentorDashboard from "./pages/MentorDashboard";
import StudentDetail from "./pages/StudentDetail";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/profile" element={<Profile />} />

            <Route element={<ProtectedRoute roles={["student"]} />}>
              <Route path="/student" element={<StudentDashboard />} />
              <Route path="/interventions" element={<StudentInterventions />} />
              <Route path="/resume" element={<ResumeScanner />} />
              <Route path="/study" element={<StudyAssistant />} />
              <Route path="/schedule" element={<MySchedule />} />
            </Route>

            <Route element={<ProtectedRoute roles={["mentor"]} />}>
              <Route path="/mentor" element={<MentorDashboard />} />
              <Route path="/mentor/students/:id" element={<StudentDetail />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
