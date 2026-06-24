import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import { initTimeSync } from './utils/timeSync';

const Login = lazy(() => import('./components/pages/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./components/pages/Dashboard').then(m => ({ default: m.Dashboard })));

const PageLoader = () => (
  <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
    <Loader2 className="animate-spin text-[#0066cc]" size={32} />
    <span className="text-sm font-semibold text-slate-700">Loading page...</span>
  </div>
);

function App() {
  const [userEmail, setUserEmail] = useState(() => {
    return localStorage.getItem('cms_email') || sessionStorage.getItem('cms_email') || '';
  });

  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('cms_role') || sessionStorage.getItem('cms_role') || '';
  });

  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('cms_name') || sessionStorage.getItem('cms_name') || '';
  });

  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    initTimeSync();
  }, []);

  // Clear toast notifications
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  const handleLoginSuccess = (email, role, token, rememberMe) => {
    let name = '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      name = payload.name || '';
    } catch (e) {
      console.warn('Failed to parse name from token:', e);
    }

    if (rememberMe) {
      localStorage.setItem('cms_token', token);
      localStorage.setItem('cms_email', email);
      localStorage.setItem('cms_role', role);
      localStorage.setItem('cms_name', name);
      
      // Clear from session storage to avoid conflicts
      sessionStorage.removeItem('cms_token');
      sessionStorage.removeItem('cms_email');
      sessionStorage.removeItem('cms_role');
      sessionStorage.removeItem('cms_name');
    } else {
      sessionStorage.setItem('cms_token', token);
      sessionStorage.setItem('cms_email', email);
      sessionStorage.setItem('cms_role', role);
      sessionStorage.setItem('cms_name', name);

      // Clear from local storage to avoid conflicts
      localStorage.removeItem('cms_token');
      localStorage.removeItem('cms_email');
      localStorage.removeItem('cms_role');
      localStorage.removeItem('cms_name');
    }

    setUserEmail(email);
    setUserRole(role);
    setUserName(name);
    setToastMsg(`Signed in as ${role}`);
  };

  const handleSignOut = () => {
    localStorage.removeItem('cms_token');
    localStorage.removeItem('cms_email');
    localStorage.removeItem('cms_role');
    localStorage.removeItem('cms_name');

    sessionStorage.removeItem('cms_token');
    sessionStorage.removeItem('cms_email');
    sessionStorage.removeItem('cms_role');
    sessionStorage.removeItem('cms_name');

    setUserEmail('');
    setUserRole('');
    setUserName('');
  };

  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/"
            element={
              <Login onLoginSuccess={handleLoginSuccess} />
            }
          />
          <Route
            path="/dashboard"
            element={
              <Dashboard
                userEmail={userEmail}
                userRole={userRole}
                userName={userName}
                onSignOut={handleSignOut}
              />
            }
          />
          {/* Fallback route redirection */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      
      {/* Toast Notification */}
      {toastMsg && (() => {
        const text = typeof toastMsg === 'object' ? toastMsg.text : toastMsg;
        const isError = typeof toastMsg === 'object' 
          ? !!toastMsg.isError 
          : /fail|error|denied|invalid|required|must|limit|locked|please|cannot|no\s+data|no\s+record|skipped|skip|not\s+allowed|only|wrong|warning|incorrect|unable|at\s+least/i.test(text);
        return (
          <div className={`fixed bottom-8 right-8 ${isError ? 'bg-rose-600 border border-rose-700' : 'bg-emerald-600 border border-emerald-700'} rounded-xl px-5 py-4 flex items-center gap-3 shadow-xl z-50 animate-slide-in-right`}>
            {isError 
              ? <span className="text-sm select-none">❌</span>
              : <CheckCircle size={18} className="text-white" />
            }
            <span className="text-sm text-white font-medium">{text}</span>
          </div>
        );
      })()}
    </Router>
  );
}

export default App;

