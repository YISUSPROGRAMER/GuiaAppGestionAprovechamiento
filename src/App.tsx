import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { Dashboard } from './components/Dashboard';
import { EntidadesList } from './components/EntidadesList';
import { EntidadForm } from './components/EntidadForm';
import { RecoleccionesList } from './components/RecoleccionesList';
import { RecoleccionForm } from './components/RecoleccionForm';
import { SettingsPage } from './components/SettingsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="entidades" element={<EntidadesList />} />
          <Route path="entidades/new" element={<EntidadForm />} />
          <Route path="entidades/:id/edit" element={<EntidadForm />} />
          <Route path="recolecciones" element={<RecoleccionesList />} />
          <Route path="recolecciones/new" element={<RecoleccionForm />} />
          <Route path="recolecciones/:id/edit" element={<RecoleccionForm />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
