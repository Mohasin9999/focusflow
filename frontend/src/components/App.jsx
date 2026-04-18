import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SignIn from '../pages/SignIn';
import SignUp from '../pages/SignUp';
import Home from '../pages/Home';
import ActivityLog from '../pages/ActivityLog';
import FocusTimer from '../pages/FocusTimer';
import { readStoredUser } from '../utils/userProfile';
import { bootstrapStoredUserFromSession, subscribeToAuthChanges } from '../utils/supabaseAuth';

function RequireAuth({ children, user }) {
  return user ? children : <Navigate to="/" replace />;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(readStoredUser);

  useEffect(() => {
    let isMounted = true;

    void bootstrapStoredUserFromSession().then((user) => {
      if (!isMounted) return;
      setCurrentUser(user);
      setAuthReady(true);
    });

    const unsubscribe = subscribeToAuthChanges((user) => {
      if (!isMounted) return;
      setCurrentUser(user);
      setAuthReady(true);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  if (!authReady) {
    return null;
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/dashboard" element={<Home />} />
      <Route
        path="/activity-log"
        element={(
          <RequireAuth user={currentUser}>
            <ActivityLog />
          </RequireAuth>
        )}
      />
      <Route
        path="/focus-timer"
        element={(
          <RequireAuth user={currentUser}>
            <FocusTimer />
          </RequireAuth>
        )}
      />
    </Routes>
  );
}
