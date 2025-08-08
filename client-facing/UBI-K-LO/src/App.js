import React, { useState, useEffect } from 'react';
import './App.css';
import LoginScreen from './components/LoginScreen';
import SupabaseTest from './components/SupabaseTest';
import Page from './App.jsx';
import { supabase } from './utils/supabase.js';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="App">
      <SupabaseTest />
      {!isAuthenticated ? (
        <LoginScreen />
      ) : (
        <div>
          <div className="bg-linde-600 text-white p-4 flex justify-between items-center">
            <h1 className="text-xl font-bold">Welcome, {user?.email}</h1>
            <button
              onClick={handleSignOut}
              className="bg-linde-700 hover:bg-linde-800 px-4 py-2 rounded-lg text-sm"
            >
              Sign Out
            </button>
          </div>
          <Page />
        </div>
      )}
    </div>
  );
}

export default App;
