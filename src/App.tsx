import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
} from "react-router-dom";
import { DocumentGenerator } from "./DocumentGenerator";
import "./App.css";
import ProfileChartApp from "./diagram";

function App() {
  return (
    <Router>
      <header className="bg-white shadow mb-4">
        <nav className="max-w-6xl mx-auto px-4 py-3 flex gap-6 font-medium">
          <NavLink
            to="/"
            className={({ isActive }: { isActive: boolean }) =>
              isActive ? "text-blue-600" : "text-gray-700 hover:text-blue-600"
            }
          >
            Chart
          </NavLink>
          <NavLink
            to="/documents"
            className={({ isActive }: { isActive: boolean }) =>
              isActive ? "text-blue-600" : "text-gray-700 hover:text-blue-600"
            }
          >
            Documents
          </NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<ProfileChartApp />} />
        <Route path="/documents" element={<DocumentGenerator />} />
      </Routes>
    </Router>
  );
}

export default App;
