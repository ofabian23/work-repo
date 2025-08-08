import React, { useState } from 'react';
import './App.css';
import LoginScreen from './components/LoginScreen';
import SupabaseTest from './components/SupabaseTest';
import Page from './App.jsx';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <div className="App">
      <SupabaseTest />
      {!isAuthenticated ? (
        <LoginScreen />
      ) : (
        <Page />
      )}
    </div>
  );
}

export default App;
